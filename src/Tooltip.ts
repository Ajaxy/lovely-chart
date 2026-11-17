import type { Projection } from './Projection.js';
import type {
  AnalyzedData, ChartColors, ChartState, FocusOn, Pixel, Point, PointerVector, Size, StatisticsItem,
} from './types.js';

import { clearCanvas, setupCanvas } from './canvas.js';
import { getComparisonValues } from './comparison.js';
import { BALLOON_OFFSET, GAP, MAX_TOOLTIP_ITEMS, NO_FOCUS, SPARKLINE_PADDING, X_AXIS_HEIGHT } from './constants.js';
import { formatDayHourFull, formatInteger, getLabelDate, getLabelTime } from './format.js';
import { getCircleRadius, getDrawnPattern } from './formulas.js';
import { addEventListener, createElement, removeEventListener } from './minifiers.js';
import { getCssColor } from './skin.js';
import { throttle, throttleWithRaf } from './utils.js';

const CONTENT_THROTTLE_MS = 100;
const NO_VALUE = '—';
const WEEK_OF = 'Week of';
const CIRCLE_RADIUS = 4;
const CIRCLE_LINE_WIDTH = 2;

export class Tooltip {
  readonly #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #plotSize: Size;
  readonly #colors: ChartColors;
  readonly #onZoom: (labelIndex: number) => void;
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
    (title: string | undefined, statistics: StatisticsItem[], resolvedTotal?: number | null) => (
      this.#updateContent(title, statistics, resolvedTotal)
    ),
    CONTENT_THROTTLE_MS,
    true,
  );

  constructor(
    container: HTMLElement,
    data: AnalyzedData,
    plotSize: Size,
    colors: ChartColors,
    onZoom: (labelIndex: number) => void,
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
    removeEventListener(document, this.#documentMoveEvent!, this.#onDocumentMove);
    this.#documentMoveEvent = undefined;
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
    this.#balloon.className = 'lovely-chart--tooltip-balloon';
    if (!this.#data.isZoomable) {
      this.#balloon.classList.add('lovely-chart--state-inactive');
    }
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
    if (this.#isZooming || !this.#data.isZoomable) {
      return;
    }

    const oldLabelIndex = this.#clickedOnLabel;

    this.#clickedOnLabel = undefined;
    this.#onMouseMove(e);

    const newLabelIndex = this.#getLabelIndex();
    if (newLabelIndex !== oldLabelIndex) {
      this.#clickedOnLabel = newLabelIndex;
    }

    if (newLabelIndex !== undefined) {
      this.#onZoom(newLabelIndex);
    }
  };

  readonly #onBalloonClick = () => {
    if (this.#balloon.classList.contains('lovely-chart--state-inactive')) {
      return;
    }

    const labelIndex = this.#getLabelIndex();
    if (labelIndex !== undefined) {
      this.#onZoom(labelIndex);
    }
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
    // `NaN` (e.g. from an `#offsetX` cleared mid-interaction) fails both comparisons
    return Number.isNaN(labelIndex) || labelIndex < this.#state!.labelFromIndex
      || labelIndex > this.#state!.labelToIndex
      ? undefined
      : labelIndex;
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
    const shouldShowBalloon = this.#data.isCircle ? pointerVector.distance <= getCircleRadius(this.#projection!) : true;

    if (!isExternal) {
      if (this.#data.isCircle) {
        this.#onFocus?.(pointerVector);
      } else {
        this.#onFocus?.(labelIndex);
      }
    }

    const getValue = (values: (number | null)[], labelIndex: number): number | null => {
      if (this.#data.isCircle) {
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

      const plotBottom = this.#plotSize.height - (this.#data.isSparkline ? SPARKLINE_PADDING : X_AXIS_HEIGHT);
      this.#drawTail(xPx, plotBottom, getCssColor(this.#colors, 'grid-lines'));
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
    this.#context.lineWidth = CIRCLE_LINE_WIDTH;

    this.#context.beginPath();
    this.#context.arc(xPx, yPx, CIRCLE_RADIUS, 0, 2 * Math.PI);
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

    const shouldPlaceRight = this.#data.isCircle ? angle > Math.PI / 2 : labelIndex < meanLabel;

    const leftOffset = shouldPlaceRight
      ? this.#offsetX! + BALLOON_OFFSET
      : this.#offsetX! - (this.#balloon.offsetWidth + BALLOON_OFFSET);

    return Math.min(Math.max(0, leftOffset), this.#container.offsetWidth - this.#balloon.offsetWidth);
  }

  #getBalloonTopOffset(): string | number {
    return this.#data.isCircle ? `${this.#offsetY}px` : 0;
  }

  #updateBalloon(datasetStatistics: StatisticsItem[], labelIndex: number) {
    const resolvedTotal = this.#data.isCircle ? undefined : this.#data.resolveTooltipTotal?.(
      this.#data.xLabels[labelIndex].value, datasetStatistics.map(({ originalIndex }) => originalIndex),
    );
    const statistics = this.#data.comparison
      ? [this.#buildComparisonItem(datasetStatistics, labelIndex, resolvedTotal), ...datasetStatistics]
      : datasetStatistics;

    this.#balloon.style.transform
      = `translate3D(${this.#getBalloonLeftOffset(labelIndex)}px, ${this.#getBalloonTopOffset()}, 0)`;
    this.#balloon.classList.add('lovely-chart--state-shown');

    if (this.#data.isCircle) {
      this.#updateContent(undefined, statistics);
    } else {
      this.#throttledUpdateContent(this.#getTitle(this.#data, labelIndex), statistics, resolvedTotal);
    }
  }

  #buildComparisonItem(
    statistics: StatisticsItem[], labelIndex: number, resolvedTotal: number | null | undefined,
  ): StatisticsItem {
    const { comparison, datasets } = this.#data;
    const visibilities = datasets.map(({ key }) => (this.#state!.filter[key] ? 1 : 0));
    const value = getComparisonValues(this.#data, visibilities)[labelIndex];
    const current = resolvedTotal !== undefined
      ? resolvedTotal
      : statistics.reduce((sum, { value: itemValue, hasOwnYAxis }) => (hasOwnYAxis ? sum : sum + (itemValue ?? 0)), 0);

    return {
      key: 'comparison',
      name: comparison!.name,
      value,
      hasOwnYAxis: false,
      originalIndex: -1,
      isComparison: true,
      comparisonChange: value !== GAP && value > 0 && current !== GAP ? (current / value - 1) * 100 : undefined,
    };
  }

  #getTitle(data: AnalyzedData, labelIndex: number): string {
    switch (data.tooltipFormatter) {
      case 'statsFormatDayHourFull':
        return formatDayHourFull(data.xLabels[labelIndex].value, data.dateLocale);
      case 'statsTooltipFormat(\'day\')':
        return getLabelDate(data.xLabels[labelIndex], { withYear: true }, data.dateLocale);
      case 'statsTooltipFormat(\'week\')':
        return `${data.dateLocale?.weekOf ?? WEEK_OF} ${getLabelDate(data.xLabels[labelIndex], {}, data.dateLocale)}`;
      case 'statsTooltipFormat(\'hour\')':
      case 'statsTooltipFormat(\'5min\')':
        return getLabelTime(data.xLabels[labelIndex]);
      default:
        return data.xLabels[labelIndex].text;
    }
  }

  // The angular offset must come from the item's position in the original
  // (dataset-order) statistics — sectors are drawn in that order, while the
  // displayed entries are sorted by value
  #isCircleSectorSelected(
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
      && pointerVector.distance <= getCircleRadius(this.#projection!);
  }

  #updateTitle(title: string | undefined) {
    const titleContainer = this.#balloon.children[0] as HTMLElement;

    if (this.#data.isCircle) {
      titleContainer.style.display = 'none';
      return;
    }

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

  #insertNewDataSet(dataSetContainer: HTMLElement, statItem: StatisticsItem, totalValue: number) {
    const { key, value, isComparison, comparisonChange } = statItem;
    const newDataSet = createElement();
    newDataSet.className
      = `lovely-chart--tooltip-dataset${isComparison ? ' lovely-chart--tooltip-dataset-comparison' : ''}`;
    newDataSet.setAttribute('data-present', 'true');
    newDataSet.setAttribute('data-key', key);

    const swatchElement = createElement<HTMLSpanElement>('span');
    swatchElement.className = 'lovely-chart--tooltip-swatch';
    newDataSet.appendChild(swatchElement);

    const titleElement = createElement<HTMLSpanElement>('span');
    titleElement.className = 'lovely-chart--dataset-title';
    newDataSet.appendChild(titleElement);
    this.#fillDataSetIdentity(newDataSet, statItem);

    const valueElement = createElement<HTMLSpanElement>('span');
    valueElement.className = 'lovely-chart--tooltip-dataset-value lovely-chart--position-right';
    this.#fillValue(valueElement, value, comparisonChange);
    newDataSet.appendChild(valueElement);

    this.#renderPercentageValue(newDataSet, value!, totalValue);

    dataSetContainer.appendChild(newDataSet);
  }

  #updateDataSet(currentDataSet: HTMLElement, statItem: StatisticsItem, totalValue: number) {
    const { value, comparisonChange } = statItem;
    currentDataSet.setAttribute('data-present', 'true');
    this.#fillDataSetIdentity(currentDataSet, statItem);

    const valueElement = currentDataSet.querySelector<HTMLElement>(`.lovely-chart--tooltip-dataset-value`);

    if (valueElement) {
      this.#fillValue(valueElement, value, comparisonChange);
    }

    this.#renderPercentageValue(currentDataSet, value!, totalValue);
  }

  // A zoom swaps the datasets under the same keys, names, colours, dashes and dots included
  #fillDataSetIdentity(dataSet: HTMLElement, { key, name, isComparison }: StatisticsItem) {
    const swatchElement = dataSet.querySelector<HTMLElement>('.lovely-chart--tooltip-swatch')!;
    const dataset = this.#data.datasets.find((item) => item.key === key);
    const pattern = dataset && getDrawnPattern(dataset);
    // The comparison line is dashed, like the lines and steps of dashed datasets
    const isDashed = Boolean(isComparison) || pattern === 'dashed';

    dataSet.setAttribute('data-name', name);
    dataSet.querySelector('.lovely-chart--dataset-title')!.textContent = name;
    swatchElement.style.setProperty('--lovely-chart-series-color', this.#data.colors[key]);
    swatchElement.toggleAttribute('data-dashed', isDashed);
    swatchElement.toggleAttribute('data-dotted', pattern === 'dotted');
  }

  #fillValue(valueElement: HTMLElement, value: number | null, change?: number) {
    if (value === GAP || change === undefined) {
      valueElement.textContent = this.#formatValue(value);
      return;
    }

    const rounded = Math.round(change);
    const changeElement = createElement<HTMLSpanElement>('span');
    changeElement.className = 'lovely-chart--tooltip-change';
    changeElement.dataset.tone = rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral';
    changeElement.textContent = `${rounded > 0 ? '+' : ''}${rounded}%`;
    valueElement.replaceChildren(`${this.#formatValue(value)} · `, changeElement);
  }

  #formatValue(value: number | null): string {
    if (value === GAP) {
      return NO_VALUE;
    }

    const formatted = this.#data.formatTooltipValue ? this.#data.formatTooltipValue(value) : formatInteger(value);
    const prefix = this.#data.valuePrefix || '';
    const suffix = this.#data.valueSuffix || '';
    if (this.#data.isCurrencyPrefix && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }

  #renderPercentageValue(dataSet: HTMLElement, value: number, totalValue: number) {
    if (!this.#data.isPercentage) {
      return;
    }

    if (this.#data.isCircle) {
      Array.from(dataSet.querySelectorAll(`.lovely-chart--percentage-title`)).forEach((element) => element.remove());
      return;
    }

    const precision = this.#data.percentPrecision ?? 0;
    const percentageValue = totalValue ? (value / totalValue * 100).toFixed(precision) : (0).toFixed(precision);
    // Three digits and a sign, plus the point and the digits a precision adds
    const percentageWidth = precision > 0 ? `${4 + precision + 1}ch` : '';
    const percentageElement = dataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);

    if (!percentageElement) {
      const newPercentageTitle = createElement<HTMLSpanElement>('span');
      newPercentageTitle.className = 'lovely-chart--percentage-title lovely-chart--position-left';
      newPercentageTitle.style.setProperty('--lovely-chart-percentage-width', percentageWidth);
      newPercentageTitle.textContent = `${percentageValue}%`;
      dataSet.prepend(newPercentageTitle);
    } else {
      (percentageElement as HTMLElement).style.setProperty('--lovely-chart-percentage-width', percentageWidth);
      percentageElement.textContent = `${percentageValue}%`;
    }
  }

  #updateDataSets(statistics: StatisticsItem[], resolvedTotal?: number | null) {
    const dataSetContainer = this.#balloon.children[1] as HTMLElement;
    if (this.#data.isCircle) {
      dataSetContainer.classList.add('lovely-chart--tooltip-legend-circle');
    }

    Array.from(dataSetContainer.children).forEach((dataSet) => {
      if (!this.#data.isCircle && dataSetContainer.classList.contains('lovely-chart--tooltip-legend-circle')) {
        dataSet.remove();
      } else {
        dataSet.setAttribute('data-present', 'false');
      }
    });

    const totalValue = statistics.reduce((a, x) => (x.isComparison ? a : a + (x.value ?? 0)), 0);
    const pointerVector = this.#getPointerVector();
    // The comparison row stays first, its value missing or zero included
    const filteredStatistics = statistics.filter(({ value, isComparison }) => (
      isComparison || (value !== 0 && value !== GAP)
    ));
    const sortedStatistics = filteredStatistics.sort((a, b) => (
      Number(Boolean(b.isComparison)) - Number(Boolean(a.isComparison)) || b.value! - a.value!
    ));
    const limitedStatistics = sortedStatistics.slice(0, MAX_TOOLTIP_ITEMS);
    // A fixed order lists the largest rows, the ones that fit, in the order of the legend
    if (this.#data.isTooltipOrderFixed) {
      limitedStatistics.sort((a, b) => (
        Number(Boolean(b.isComparison)) - Number(Boolean(a.isComparison)) || a.originalIndex - b.originalIndex
      ));
    }
    const finalStatistics = this.#data.isCircle
      ? limitedStatistics.filter(
        (statItem) => this.#isCircleSectorSelected(statistics, statItem, totalValue, pointerVector),
      )
      : limitedStatistics;

    finalStatistics.forEach((statItem) => {
      const currentDataSet = Array.from(dataSetContainer.children)
        .find((element) => (element as HTMLElement).dataset.key === statItem.key) as HTMLElement | undefined;

      if (!currentDataSet) {
        this.#insertNewDataSet(dataSetContainer, statItem, totalValue);
      } else {
        this.#updateDataSet(currentDataSet, statItem, totalValue);
        dataSetContainer.appendChild(currentDataSet);
      }
    });

    const { isBars, isSteps, isAreas, isStacked, isShares, isTooltipTotalInTitle } = this.#data;
    const total = resolvedTotal !== undefined ? resolvedTotal : totalValue;
    const totalText = (isBars || isSteps || isAreas) && (isStacked || isShares) ? this.#formatValue(total) : undefined;
    if (totalText !== undefined && !isTooltipTotalInTitle) {
      this.#renderTotal(dataSetContainer, totalText);
    }
    this.#renderTitleTotal(isTooltipTotalInTitle ? totalText : undefined);

    if (this.#data.secondaryYAxis) {
      this.#renderSecondaryTotal(dataSetContainer, total);
    }

    // Re-append total rows to keep them at the bottom after sort reordering
    Array.from(dataSetContainer.querySelectorAll('[data-total="true"]'))
      .forEach((element) => dataSetContainer.appendChild(element));

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  #updateContent(title: string | undefined, statistics: StatisticsItem[], resolvedTotal?: number | null) {
    this.#updateTitle(title);
    this.#updateDataSets(statistics, resolvedTotal);
  }

  #renderTitleTotal(totalText: string | undefined) {
    const titleContainer = this.#balloon.children[0] as HTMLElement;
    let totalElement = titleContainer.querySelector('.lovely-chart--tooltip-title-total');

    // Data a zoom swaps in can have no title total, which takes away the one on screen
    if (totalText === undefined) {
      totalElement?.remove();
      return;
    }

    if (!totalElement) {
      totalElement = createElement<HTMLSpanElement>('span');
      totalElement.className = 'lovely-chart--tooltip-title-total';
      titleContainer.appendChild(totalElement);
    }

    totalElement.textContent = totalText;
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

  #renderSecondaryTotal(dataSetContainer: HTMLElement, total: number | null) {
    const { label, multiplier, prefix = '', suffix = '' } = this.#data.secondaryYAxis!;
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;

    const secondaryValue = total === GAP ? NO_VALUE : `${prefix}${(total * multiplier).toFixed(2)}${suffix}`;

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
      valueElement.textContent = secondaryValue;
      newTotalText.appendChild(valueElement);

      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(
        `.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`,
      )!;
      valueElement.textContent = secondaryValue;
    }
  }

  #hideBalloon() {
    this.#balloon.classList.remove('lovely-chart--state-shown');
  }

  #getPointerVector(): PointerVector {
    // #offsetX/Y are relative to the element, while the chart is drawn on the
    // canvas, which sits lower within it (margin-top) — translate the pointer
    // into canvas space and measure from the projection's center, where the    // pie is actually drawn
    const elementRect = this.#element.getBoundingClientRect();
    const canvasRect = this.#canvas.getBoundingClientRect();
    const pointerX = this.#offsetX! - (canvasRect.left - elementRect.left);
    const pointerY = this.#offsetY! - (canvasRect.top - elementRect.top);

    const center = this.#data.isCircle && this.#projection
      ? this.#projection.getCenter()
      : [canvasRect.width / 2, canvasRect.height / 2];
    const angle = Math.atan2(pointerY - center[1], pointerX - center[0]);
    const distance = Math.sqrt((pointerX - center[0]) ** 2 + (pointerY - center[1]) ** 2);

    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance,
    };
  }

  #getPageOffset(element: HTMLElement): DOMRect {
    return element.getBoundingClientRect();
  }
}
