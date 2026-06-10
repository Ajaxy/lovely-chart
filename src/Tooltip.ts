import type { Projection } from './Projection';
import type {
  AnalyzedData, ChartColors, ChartState, FocusOn, Pixel, Point, PointerVector, Size, StatisticsItem,
} from './types';

import { clearCanvas, setupCanvas } from './canvas';
import { BALLOON_OFFSET, GAP, MAX_TOOLTIP_ITEMS, NO_FOCUS, X_AXIS_HEIGHT } from './constants';
import { formatInteger, getLabelDate, getLabelTime, statsFormatDayHourFull } from './format';
import { getPieRadius } from './formulas';
import { addEventListener, createElement, removeEventListener } from './minifiers';
import { getCssColor, isColorCloseToBackground } from './skin';
import { throttle, throttleWithRaf } from './utils';

export class Tooltip {
  readonly #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #plotSize: Size;
  readonly #colors: ChartColors;
  readonly #onZoom: (labelIndex: number | undefined) => void;
  readonly #onFocus: ((focusOn: FocusOn) => void) | undefined;

  #state?: ChartState;
  #points?: Point[][];
  #projection?: Projection;
  #secondaryPoints?: Point[];
  #secondaryProjection?: Projection;

  #element!: HTMLElement;
  #canvas!: HTMLCanvasElement;
  #context!: CanvasRenderingContext2D;
  #balloon!: HTMLElement;

  #offsetX?: number;
  #offsetY?: number;
  #clickedOnLabel?: number;

  #isZoomed = false;
  #isZooming = false;
  #documentMoveEvent?: string;

  readonly #selectLabelOnRaf = throttleWithRaf((isExternal?: boolean) => this.#selectLabel(isExternal));
  readonly #throttledUpdateContent = throttle(
    (title: string | undefined, statistics: StatisticsItem[]) => this.#updateContent(title, statistics),
    100,
    true,
  );

  constructor(
    container: HTMLElement,
    data: AnalyzedData,
    plotSize: Size,
    colors: ChartColors,
    onZoom: (labelIndex: number | undefined) => void,
    onFocus?: (focusOn: FocusOn) => void,
  ) {
    this.#container = container;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
    this.#onZoom = onZoom;
    this.#onFocus = onFocus;

    this.#setupLayout();
  }

  update(
    state: ChartState,
    points: Point[][],
    projection: Projection,
    secondaryPoints: Point[] | undefined,
    secondaryProjection: Projection | undefined,
  ) {
    this.#state = state;
    this.#points = points;
    this.#projection = projection;
    this.#secondaryPoints = secondaryPoints;
    this.#secondaryProjection = secondaryProjection;
    this.#selectLabel(true);
  }

  toggleLoading(isLoading: boolean) {
    this.#balloon.classList.toggle('lovely-chart--state-loading', isLoading);

    if (!isLoading) {
      this.#clear();
    }
  }

  toggleIsZoomed(isZoomed: boolean) {
    if (isZoomed !== this.#isZoomed) {
      this.#isZooming = true;
    }
    this.#isZoomed = isZoomed;
    this.#balloon.classList.toggle('lovely-chart--state-inactive', isZoomed);
  }

  destroy() {
    if (this.#documentMoveEvent) {
      removeEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
      this.#documentMoveEvent = undefined;
    }
  }

  #setupLayout() {
    this.#element = createElement();
    this.#element.className = `lovely-chart--tooltip`;

    this.#setupCanvas();
    this.#setupBalloon();

    if ('ontouchstart' in window) {
      addEventListener(this.#element, 'touchmove', this.#onMouseMove);
      addEventListener(this.#element, 'touchstart', this.#onMouseMove);
      this.#documentMoveEvent = 'touchstart';
      addEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
    } else {
      addEventListener(this.#element, 'mousemove', this.#onMouseMove);
      addEventListener(this.#element, 'click', this.#onClick);
      this.#documentMoveEvent = 'mousemove';
      addEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
    }

    this.#container.appendChild(this.#element);
  }

  #setupCanvas() {
    const { canvas, context } = setupCanvas(this.#element, this.#plotSize);

    this.#canvas = canvas;
    this.#context = context;
  }

  #setupBalloon() {
    this.#balloon = createElement();
    this.#balloon.className
      = `lovely-chart--tooltip-balloon${!this.#data.isZoomable ? ' lovely-chart--state-inactive' : ''}`;
    this.#balloon.innerHTML = `
      <div class="lovely-chart--tooltip-title"></div>
      <div class="lovely-chart--tooltip-legend"></div>
      <div class="lovely-chart--spinner"></div>`;

    if ('ontouchstart' in window && this.#data.isZoomable) {
      addEventListener(this.#balloon, 'click', this.#onBalloonClick);
    }

    this.#element.appendChild(this.#balloon);
  }

  readonly #onMouseMove = (e: MouseEvent | TouchEvent) => {
    if (e.target === this.#balloon || this.#balloon.contains(e.target as Node) || this.#clickedOnLabel !== undefined) {
      return;
    }

    this.#isZooming = false;

    const event = e as MouseEvent & TouchEvent;
    const pageOffset = this.#getPageOffset(this.#element);
    this.#offsetX = (event.touches ? event.touches[0].clientX : event.clientX) - pageOffset.left;
    this.#offsetY = (event.touches ? event.touches[0].clientY : event.clientY) - pageOffset.top;

    this.#selectLabelOnRaf();
  };

  readonly #onDocumentMove = (e: MouseEvent | TouchEvent) => {
    if (this.#offsetX !== undefined && e.target !== this.#element && !this.#element.contains(e.target as Node)) {
      this.#clear();
    }
  };

  readonly #onClick = (e: MouseEvent) => {
    if (this.#isZooming) {
      return;
    }

    if (this.#data.isZoomable) {
      const oldLabelIndex = this.#clickedOnLabel;

      this.#clickedOnLabel = undefined;
      this.#onMouseMove(e);

      const newLabelIndex = this.#getLabelIndex();
      if (newLabelIndex !== oldLabelIndex) {
        this.#clickedOnLabel = newLabelIndex;
      }

      this.#onZoom(newLabelIndex);
    }
  };

  readonly #onBalloonClick = () => {
    if (this.#balloon.classList.contains('lovely-chart--state-inactive')) {
      return;
    }

    const labelIndex = this.#projection!.findClosestLabelIndex(this.#offsetX!);
    this.#onZoom(labelIndex);
  };

  #clear(isExternal?: boolean) {
    this.#offsetX = undefined;
    this.#clickedOnLabel = undefined;
    clearCanvas(this.#canvas, this.#context);
    this.#hideBalloon();

    if (!isExternal) {
      this.#onFocus?.(NO_FOCUS);
    }
  }

  #getLabelIndex(): number | undefined {
    const labelIndex = this.#projection!.findClosestLabelIndex(this.#offsetX!);
    return labelIndex < this.#state!.labelFromIndex || labelIndex > this.#state!.labelToIndex ? undefined : labelIndex;
  }

  #selectLabel(isExternal?: boolean) {
    if (this.#offsetX === undefined || !this.#state || this.#isZooming) {
      return;
    }

    const labelIndex = this.#getLabelIndex();
    if (labelIndex === undefined) {
      this.#clear(isExternal);
      return;
    }

    const pointerVector = this.#getPointerVector();
    const shouldShowBalloon = this.#data.isPie ? pointerVector.distance <= getPieRadius(this.#projection!) : true;

    if (!isExternal) {
      if (this.#data.isPie) {
        this.#onFocus?.(pointerVector);
      } else {
        this.#onFocus?.(labelIndex);
      }
    }

    const getValue = (values: (number | null)[], labelIndex: number): number | null => {
      if (this.#data.isPie) {
        return values.slice(this.#state!.labelFromIndex, this.#state!.labelToIndex + 1)
          .reduce<number>((a, x) => a + (x ?? 0), 0);
      }

      return values[labelIndex];
    };

    const [xPx] = this.#projection!.toPixels(labelIndex, 0);
    const statistics: StatisticsItem[] = this.#data.datasets
      .map(({ key, name, values, hasOwnYAxis }, i) => ({
        key,
        name,
        value: getValue(values, labelIndex),
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => this.#state!.filter[key]);

    if (statistics.length && shouldShowBalloon) {
      this.#updateBalloon(statistics, labelIndex);
    } else {
      this.#hideBalloon();
    }

    clearCanvas(this.#canvas, this.#context);
    if (this.#data.isLines || this.#data.isAreas) {
      if (this.#data.isLines) {
        this.#drawCircles(statistics, labelIndex);
      }

      this.#drawTail(xPx, this.#plotSize.height - X_AXIS_HEIGHT, getCssColor(this.#colors, 'grid-lines'));
    }
  }

  #drawCircles(statistics: StatisticsItem[], labelIndex: number) {
    statistics.forEach(({ value, key, hasOwnYAxis, originalIndex }) => {
      if (value === GAP) return;

      const pointIndex = labelIndex - this.#state!.labelFromIndex;
      const point = hasOwnYAxis ? this.#secondaryPoints![pointIndex] : this.#points![originalIndex][pointIndex];

      if (!point) {
        return;
      }

      const [x, y] = hasOwnYAxis
        ? this.#secondaryProjection!.toPixels(labelIndex, point.stackValue)
        : this.#projection!.toPixels(labelIndex, point.stackValue);

      // TODO animate
      this.#drawCircle(
        [x, y],
        getCssColor(this.#colors, `dataset#${key}`),
        getCssColor(this.#colors, 'background'),
      );
    });
  }

  #drawCircle([xPx, yPx]: Pixel, strokeColor: string, fillColor: string) {
    this.#context.strokeStyle = strokeColor;
    this.#context.fillStyle = fillColor;
    this.#context.lineWidth = 2;

    this.#context.beginPath();
    this.#context.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    this.#context.fill();
    this.#context.stroke();
  }

  #drawTail(xPx: number, height: number, color: string) {
    this.#context.strokeStyle = color;
    this.#context.lineWidth = 1;

    this.#context.beginPath();
    this.#context.moveTo(xPx, 0);
    this.#context.lineTo(xPx, height);
    this.#context.stroke();
  }

  #getBalloonLeftOffset(labelIndex: number): number {
    const meanLabel = (this.#state!.labelFromIndex + this.#state!.labelToIndex) / 2;
    const { angle } = this.#getPointerVector();

    const shouldPlaceRight = this.#data.isPie ? angle > Math.PI / 2 : labelIndex < meanLabel;

    const leftOffset = shouldPlaceRight
      ? this.#offsetX! + BALLOON_OFFSET
      : this.#offsetX! - (this.#balloon.offsetWidth + BALLOON_OFFSET);

    return Math.min(Math.max(0, leftOffset), this.#container.offsetWidth - this.#balloon.offsetWidth);
  }

  #getBalloonTopOffset(): string | number {
    return this.#data.isPie ? `${this.#offsetY}px` : 0;
  }

  #updateBalloon(statistics: StatisticsItem[], labelIndex: number) {
    this.#balloon.style.transform
      = `translate3D(${this.#getBalloonLeftOffset(labelIndex)}px, ${this.#getBalloonTopOffset()}, 0)`;
    this.#balloon.classList.add('lovely-chart--state-shown');

    if (this.#data.isPie) {
      this.#updateContent(undefined, statistics);
    } else {
      this.#throttledUpdateContent(this.#getTitle(this.#data, labelIndex), statistics);
    }
  }

  #getTitle(data: AnalyzedData, labelIndex: number): string {
    switch (data.tooltipFormatter) {
      case 'statsFormatDayHourFull':
        return statsFormatDayHourFull(data.xLabels[labelIndex].value);
      case 'statsTooltipFormat(\'day\')':
        return getLabelDate(data.xLabels[labelIndex]);
      case 'statsTooltipFormat(\'hour\')':
      case 'statsTooltipFormat(\'5min\')':
        return getLabelTime(data.xLabels[labelIndex]);
      default:
        return data.xLabels[labelIndex].text;
    }
  }

  // The angular offset must come from the item's position in the original
  // (dataset-order) statistics — sectors are drawn in that order, while the
  // displayed entries are sorted by value.
  #isPieSectorSelected(
    statistics: StatisticsItem[],
    statItem: StatisticsItem,
    totalValue: number,
    pointerVector: PointerVector,
  ): boolean {
    const index = statistics.indexOf(statItem);
    const { value } = statItem;
    const offset = index > 0 ? statistics.slice(0, index).reduce((a, x) => a + (x.value ?? 0), 0) : 0;
    const beginAngle = offset / totalValue * Math.PI * 2 - Math.PI / 2;
    const endAngle = (offset + (value ?? 0)) / totalValue * Math.PI * 2 - Math.PI / 2;

    return Boolean(pointerVector)
      && beginAngle <= pointerVector.angle
      && pointerVector.angle < endAngle
      && pointerVector.distance <= getPieRadius(this.#projection!);
  }

  #updateTitle(title: string | undefined) {
    const titleContainer = this.#balloon.children[0] as HTMLElement;

    if (this.#data.isPie) {
      if (titleContainer) {
        titleContainer.style.display = 'none';
      }
    } else {
      if (titleContainer.style.display === 'none') {
        titleContainer.style.display = '';
      }
      const currentTitle = titleContainer.querySelector(':not(.lovely-chart--state-hidden)');

      if (!titleContainer.textContent || !currentTitle) {
        const newTitle = createElement<HTMLSpanElement>('span');
        newTitle.textContent = title!;
        titleContainer.replaceChildren(newTitle);
      } else {
        currentTitle.textContent = title!;
      }
    }
  }

  #insertNewDataSet(
    dataSetContainer: HTMLElement, { name, key, value }: StatisticsItem, totalValue: number,
  ) {
    const colorHex = this.#data.colors[key];
    const colorClass = isColorCloseToBackground(this.#colors, colorHex)
      ? ''
      : ` lovely-chart--color-${colorHex.slice(1)}`;
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right${colorClass}`;
    const newDataSet = createElement();
    newDataSet.className = 'lovely-chart--tooltip-dataset';
    newDataSet.setAttribute('data-present', 'true');
    newDataSet.setAttribute('data-name', name);
    const titleElement = createElement<HTMLSpanElement>('span');
    titleElement.className = 'lovely-chart--dataset-title';
    titleElement.textContent = name;
    newDataSet.appendChild(titleElement);

    const valueElement = createElement<HTMLSpanElement>('span');
    valueElement.className = className;
    valueElement.textContent = this.#formatValue(value!);
    newDataSet.appendChild(valueElement);

    this.#renderPercentageValue(newDataSet, value!, totalValue);

    dataSetContainer.appendChild(newDataSet);
  }

  #updateDataSet(currentDataSet: HTMLElement, { value }: StatisticsItem, totalValue: number) {
    currentDataSet.setAttribute('data-present', 'true');

    const valueElement = currentDataSet.querySelector(`.lovely-chart--tooltip-dataset-value`);

    if (valueElement) {
      valueElement.textContent = this.#formatValue(value!);
    }

    this.#renderPercentageValue(currentDataSet, value!, totalValue);
  }

  #formatValue(value: number): string {
    const formatted = formatInteger(value);
    const prefix = this.#data.valuePrefix || '';
    const suffix = this.#data.valueSuffix || '';
    if (this.#data.prefixIsCurrency && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }

  #renderPercentageValue(dataSet: HTMLElement, value: number, totalValue: number) {
    if (!this.#data.isPercentage) {
      return;
    }

    if (this.#data.isPie) {
      Array.from(dataSet.querySelectorAll(`.lovely-chart--percentage-title`)).forEach((e) => e.remove());
      return;
    }

    const percentageValue = totalValue ? Math.round(value / totalValue * 100) : 0;
    const percentageElement = dataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);

    if (!percentageElement) {
      const newPercentageTitle = createElement<HTMLSpanElement>('span');
      newPercentageTitle.className = 'lovely-chart--percentage-title lovely-chart--position-left';
      newPercentageTitle.textContent = `${percentageValue}%`;
      dataSet.prepend(newPercentageTitle);
    } else {
      percentageElement.textContent = `${percentageValue}%`;
    }
  }

  #updateDataSets(statistics: StatisticsItem[]) {
    const dataSetContainer = this.#balloon.children[1] as HTMLElement;
    if (this.#data.isPie) {
      dataSetContainer.classList.add('lovely-chart--tooltip-legend-pie');
    }

    Array.from(dataSetContainer.children).forEach((dataSet) => {
      if (!this.#data.isPie && dataSetContainer.classList.contains('lovely-chart--tooltip-legend-pie')) {
        dataSet.remove();
      } else {
        dataSet.setAttribute('data-present', 'false');
      }
    });

    const totalValue = statistics.reduce((a, x) => a + (x.value ?? 0), 0);
    const pointerVector = this.#getPointerVector();
    const filteredStatistics = statistics.filter(({ value }) => value !== 0 && value !== GAP);
    const sortedStatistics = filteredStatistics.sort((a, b) => b.value! - a.value!);
    const limitedStatistics = sortedStatistics.slice(0, MAX_TOOLTIP_ITEMS);
    const finalStatistics = this.#data.isPie
      ? limitedStatistics.filter(
        (statItem) => this.#isPieSectorSelected(statistics, statItem, totalValue, pointerVector),
      )
      : limitedStatistics;

    finalStatistics.forEach((statItem) => {
      const currentDataSet = Array.from(dataSetContainer.children)
        .find((element) => (element as HTMLElement).dataset.name === statItem.name) as HTMLElement | undefined;

      if (!currentDataSet) {
        this.#insertNewDataSet(dataSetContainer, statItem, totalValue);
      } else {
        this.#updateDataSet(currentDataSet, statItem, totalValue);
        dataSetContainer.appendChild(currentDataSet);
      }
    });

    if ((this.#data.isBars || this.#data.isSteps || this.#data.isAreas) && this.#data.isStacked) {
      this.#renderTotal(dataSetContainer, this.#formatValue(totalValue));
    }

    if (this.#data.secondaryYAxis) {
      this.#renderSecondaryTotal(dataSetContainer, totalValue);
    }

    // Re-append total rows to keep them at the bottom after sort reordering
    Array.from(dataSetContainer.querySelectorAll('[data-total="true"]'))
      .forEach((el) => dataSetContainer.appendChild(el));

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  #updateContent(title: string | undefined, statistics: StatisticsItem[]) {
    this.#updateTitle(title);
    this.#updateDataSets(statistics);
  }

  #renderTotal(dataSetContainer: HTMLElement, totalValue: string) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset lovely-chart--tooltip-dataset-total';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      const titleElement = createElement<HTMLSpanElement>('span');
      titleElement.textContent = 'Total';
      newTotalText.appendChild(titleElement);

      const valueElement = createElement<HTMLSpanElement>('span');
      valueElement.className = className;
      valueElement.textContent = totalValue;
      newTotalText.appendChild(valueElement);

      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(
        `.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`,
      )!;
      valueElement.textContent = totalValue;
    }
  }

  #renderSecondaryTotal(dataSetContainer: HTMLElement, totalValue: number) {
    const { label, multiplier, prefix = '', suffix = '' } = this.#data.secondaryYAxis!;
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;

    const secondaryValue = (totalValue * multiplier).toFixed(2);

    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset lovely-chart--tooltip-dataset-total';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      const titleElement = createElement<HTMLSpanElement>('span');
      titleElement.textContent = label;
      newTotalText.appendChild(titleElement);

      const valueElement = createElement<HTMLSpanElement>('span');
      valueElement.className = className;
      valueElement.textContent = `${prefix}${secondaryValue}${suffix}`;
      newTotalText.appendChild(valueElement);

      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(
        `.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`,
      )!;
      valueElement.textContent = `${prefix}${secondaryValue}${suffix}`;
    }
  }

  #hideBalloon() {
    this.#balloon.classList.remove('lovely-chart--state-shown');
  }

  #getPointerVector(): PointerVector {
    // #offsetX/Y are relative to the element, while the chart is drawn on the
    // canvas, which sits lower within it (margin-top) — translate the pointer
    // into canvas space and measure from the projection's center, where the
    // pie is actually drawn.
    const elementRect = this.#element.getBoundingClientRect();
    const canvasRect = this.#canvas.getBoundingClientRect();
    const pointerX = this.#offsetX! - (canvasRect.left - elementRect.left);
    const pointerY = this.#offsetY! - (canvasRect.top - elementRect.top);

    const center = this.#data.isPie && this.#projection
      ? this.#projection.getCenter()
      : [canvasRect.width / 2, canvasRect.height / 2];
    const angle = Math.atan2(pointerY - center[1], pointerX - center[0]);
    const distance = Math.sqrt((pointerX - center[0]) ** 2 + (pointerY - center[1]) ** 2);

    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance,
    };
  }

  #getPageOffset(el: HTMLElement): DOMRect {
    return el.getBoundingClientRect();
  }
}
