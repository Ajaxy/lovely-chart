import type { Projection } from './Projection.js';
import type {
  AnalyzedData, ChartColors, ChartState, FocusOn, LabelRange, Pixel, Point, PointerVector, Size, StatisticsItem,
  TooltipContent, TooltipNotes,
} from './types.js';

import { clearCanvas, setupCanvas } from './canvas.js';
import { getComparisonValues } from './comparison.js';
import { BALLOON_OFFSET, GAP, MAX_TOOLTIP_ITEMS, NO_FOCUS, SPARKLINE_PADDING, X_AXIS_HEIGHT } from './constants.js';
import { formatDayHourFull, formatInteger, getLabelDate, getLabelTime } from './format.js';
import { getCircleRadius, getDrawnPattern, getVisibleLabelRange } from './formulas.js';
import { addEventListener, createElement, removeEventListener } from './minifiers.js';
import { getCssColor } from './skin.js';
import { throttle, throttleWithRaf } from './utils.js';

const CONTENT_THROTTLE_MS = 100;
const NO_VALUE = '—';
const WEEK_OF = 'Week of';
const TOTAL_TITLE = 'Total';
const CIRCLE_RADIUS = 4;
const CIRCLE_LINE_WIDTH = 2;
const ARROW_KEY_STEPS: Record<string, number | undefined> = { ArrowLeft: -1, ArrowRight: 1 };

export class Tooltip {
  readonly #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #plotSize: Size;
  readonly #colors: ChartColors;
  readonly #onZoom: (labelIndex: number) => void;
  readonly #onFocus: (focusOn: FocusOn) => void;
  readonly #onContentChange: (content: TooltipContent | undefined) => void;

  #state?: ChartState;
  #points?: Point[][];
  #projection?: Projection;
  #secondaryPoints?: Point[];
  #secondaryProjection?: Projection;

  #element!: HTMLElement;
  #canvas!: HTMLCanvasElement;
  #context!: CanvasRenderingContext2D;
  #balloon!: HTMLElement;
  #notes!: HTMLElement;

  #offsetX?: number;
  #offsetY?: number;
  #clickedOnLabel?: number;
  // The label `selectLabel()` selected: it follows its label through range changes, and only a pointer over the
  // chart or a call takes it back
  #calledLabelIndex?: number;

  #isZoomed = false;
  #isZooming = false;
  #isDestroyed = false;
  // Numbers each selection and clear: a callback of their reports can select or clear again, and only the latest one
  // reports its content
  #selectionCount = 0;
  #documentMoveEvent?: string;

  readonly #selectLabelOnRaf = throttleWithRaf((isExternal?: boolean) => this.#selectLabel(isExternal));
  readonly #throttledUpdateContent = throttle(
    (
      title: string, statistics: StatisticsItem[], resolvedTotal: number | null | undefined, notes: TooltipNotes,
      labelIndex: number,
    ) => {
      this.#updateContent(title, statistics, resolvedTotal, notes);
      // A deferred update can land after the pointer has left the chart
      if (this.#offsetX !== undefined) {
        this.#placeBalloon(labelIndex);
      }
    },
    CONTENT_THROTTLE_MS,
    true,
  );

  constructor(
    container: HTMLElement,
    data: AnalyzedData,
    plotSize: Size,
    colors: ChartColors,
    onZoom: (labelIndex: number) => void,
    onFocus: (focusOn: FocusOn) => void,
    onContentChange: (content: TooltipContent | undefined) => void,
  ) {
    this.#container = container;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
    this.#onZoom = onZoom;
    this.#onFocus = onFocus;
    this.#onContentChange = onContentChange;

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

    if (this.#calledLabelIndex !== undefined) {
      if (!this.#isLabelVisible(this.#calledLabelIndex)) {
        this.#clear();
        return;
      }

      this.#offsetX = projection.toPixels(this.#calledLabelIndex, 0)[0];
    }

    this.#selectLabel(true);
  }

  // Selects a label as a pointer over it would, so a keyboard or another view can drive the selection
  selectLabel(labelIndex: number | undefined) {
    if (!this.#state || this.#data.isCircle) {
      return;
    }

    if (labelIndex === undefined) {
      if (this.#offsetX !== undefined) {
        this.#clear();
      }
      return;
    }

    if (!Number.isInteger(labelIndex) || !this.#isLabelVisible(labelIndex)) {
      return;
    }

    this.#calledLabelIndex = labelIndex;
    this.#offsetX = this.#projection!.toPixels(labelIndex, 0)[0];
    this.#offsetY = 0;
    this.#isZooming = false;
    this.#selectLabel();
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

    // The pie of a zoom takes no keys, so it leaves the tab order
    if (this.#data.isKeyboardSelectable && this.#data.shouldZoomToShares) {
      if (isZoomed) {
        this.#element.removeAttribute('tabindex');
      } else {
        this.#element.tabIndex = 0;
      }
    }
  }

  isFocused(): boolean {
    return this.#element.matches(':focus');
  }

  focus() {
    this.#element.focus({ preventScroll: true });
  }

  destroy() {
    this.#isDestroyed = true;
    removeEventListener(document, this.#documentMoveEvent!, this.#onDocumentMove);
    this.#documentMoveEvent = undefined;
    this.#selectLabelOnRaf.cancel();
    this.#throttledUpdateContent.cancel();
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

    if (this.#data.isKeyboardSelectable && !this.#data.isCircle) {
      this.#element.tabIndex = 0;
      addEventListener(this.#element, 'keydown', this.#onKeyDown);
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
      <div class="lovely-chart--spinner"></div>
      <div class="lovely-chart--tooltip-notes"></div>`;
    this.#notes = this.#balloon.lastElementChild as HTMLElement;

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
    this.#calledLabelIndex = undefined;

    const event = e as MouseEvent & TouchEvent;
    const pageOffset = this.#getPageOffset(this.#element);
    this.#offsetX = (event.touches ? event.touches[0].clientX : event.clientX) - pageOffset.left;
    this.#offsetY = (event.touches ? event.touches[0].clientY : event.clientY) - pageOffset.top;

    this.#selectLabelOnRaf();
  };

  readonly #onKeyDown = (e: KeyboardEvent) => {
    // A modifier leaves the key to the browser, as Alt and Arrow Left go back, and so does the pie of a zoom
    if (!this.#state || this.#data.isCircle || e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }

    const labelIndex = getKeyLabelIndex(
      e.key, this.#getSelectedLabelIndex(), getVisibleLabelRange(this.#state.static ?? this.#state),
    );
    if (labelIndex === undefined) {
      return;
    }

    e.preventDefault();
    this.selectLabel(labelIndex);
  };

  readonly #onDocumentMove = (e: MouseEvent | TouchEvent) => {
    if (
      this.#offsetX !== undefined && this.#calledLabelIndex === undefined
      && e.target !== this.#element && !this.#element.contains(e.target as Node)
    ) {
      this.#clear();
    }
  };

  readonly #onClick = (e: MouseEvent) => {
    // A click before the first frame of the data finds no label under it
    if (this.#isZooming || !this.#data.isZoomable || !this.#state) {
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
    const selectionCount = ++this.#selectionCount;
    this.#offsetX = undefined;
    this.#clickedOnLabel = undefined;
    this.#calledLabelIndex = undefined;
    clearCanvas(this.#canvas, this.#context);
    this.#hideBalloon();

    // The reports go last, as their callbacks can update or destroy the chart or select another label
    if (!isExternal) {
      this.#onFocus(NO_FOCUS);
    }
    if (!this.#isDestroyed && selectionCount === this.#selectionCount) {
      this.#onContentChange(undefined);
    }
  }

  #isLabelVisible(labelIndex: number): boolean {
    const { from, to } = getVisibleLabelRange(this.#state!.static ?? this.#state!);
    return labelIndex >= from && labelIndex <= to;
  }

  #getSelectedLabelIndex(): number | undefined {
    if (this.#calledLabelIndex !== undefined) {
      return this.#calledLabelIndex;
    }

    return this.#offsetX !== undefined ? this.#getLabelIndex() : undefined;
  }

  #getLabelIndex(): number | undefined {
    const labelIndex = this.#projection!.findClosestLabelIndex(this.#offsetX!);
    // A Y-axis label column hides the labels left of the window, which begins at its inset
    const firstLabelIndex = this.#projection!.getParams().xInsetStart !== undefined
      ? getVisibleLabelRange(this.#state!.static ?? this.#state!).from
      : this.#state!.labelFromIndex;
    // `NaN` (e.g. from an `#offsetX` cleared mid-interaction) fails both comparisons
    return Number.isNaN(labelIndex) || labelIndex < firstLabelIndex || labelIndex > this.#state!.labelToIndex
      ? undefined
      : labelIndex;
  }

  #selectLabel(isExternal?: boolean) {
    if (this.#offsetX === undefined || !this.#state || this.#isZooming) {
      return;
    }

    const selectionCount = ++this.#selectionCount;
    const labelIndex = this.#getLabelIndex();
    if (labelIndex === undefined) {
      this.#clear(isExternal);
      return;
    }

    const pointerVector = this.#getPointerVector();
    const shouldShowBalloon = this.#data.isCircle ? pointerVector.distance <= getCircleRadius(this.#projection!) : true;

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

    let content: TooltipContent | undefined;
    if (statistics.length && shouldShowBalloon) {
      content = this.#updateBalloon(statistics, labelIndex);
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

    // The reports go last, as their callbacks can update or destroy the chart or select another label
    if (!isExternal) {
      if (this.#data.isCircle) {
        this.#onFocus(pointerVector);
      } else {
        this.#onFocus(labelIndex);
      }
    }
    if (!this.#isDestroyed && selectionCount === this.#selectionCount) {
      this.#onContentChange(content);
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

  // The content it returns is what `onTooltipChange` reports, none for a pie or donut
  #updateBalloon(datasetStatistics: StatisticsItem[], labelIndex: number): TooltipContent | undefined {
    const resolvedTotal = this.#data.isCircle ? undefined : this.#data.resolveTooltipTotal?.(
      this.#data.xLabels[labelIndex].value, datasetStatistics.map(({ originalIndex }) => originalIndex), labelIndex,
    );
    const comparisonItem = this.#data.comparison
      ? this.#buildComparisonItem(datasetStatistics, labelIndex, resolvedTotal)
      : undefined;
    const statistics = comparisonItem ? [comparisonItem, ...datasetStatistics] : datasetStatistics;

    this.#balloon.classList.add('lovely-chart--state-shown');

    let content: TooltipContent | undefined;
    if (this.#data.isCircle) {
      this.#updateContent(undefined, statistics);
    } else {
      content = this.#buildContent(
        this.#getTitle(this.#data, labelIndex), datasetStatistics, comparisonItem, resolvedTotal, labelIndex,
      );
      // The notes are resolved with the title and the rows, as a zoom can swap the data before the update lands
      this.#throttledUpdateContent(
        content.title, statistics, resolvedTotal, this.#resolveNotes(datasetStatistics, labelIndex), labelIndex,
      );
    }

    // Placed after the content, whose width decides the place, and on each call to follow the pointer while a
    // throttled content update waits
    this.#placeBalloon(labelIndex);

    return content;
  }

  #buildContent(
    title: string,
    statistics: StatisticsItem[],
    comparisonItem: StatisticsItem | undefined,
    resolvedTotal: number | null | undefined,
    labelIndex: number,
  ): TooltipContent {
    const rows = statistics.map(({ originalIndex, name, value }) => ({ datasetIndex: originalIndex, name, value }));
    const content: TooltipContent = { labelIndex, title, rows };

    if (hasTooltipTotal(this.#data)) {
      content.total = resolvedTotal !== undefined
        ? resolvedTotal
        : rows.reduce((sum, { value }) => sum + (value ?? 0), 0);
    }

    if (comparisonItem) {
      content.comparison = { name: comparisonItem.name, value: comparisonItem.value };
      if (comparisonItem.comparisonChange !== undefined) {
        content.comparison.change = comparisonItem.comparisonChange;
      }
    }

    return content;
  }

  #placeBalloon(labelIndex: number) {
    this.#balloon.style.transform
      = `translate3D(${this.#getBalloonLeftOffset(labelIndex)}px, ${this.#getBalloonTopOffset()}, 0)`;
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
        return formatDayHourFull(data.xLabels[labelIndex].value, data.dateLocale, data.isUtc);
      case 'statsTooltipFormat(\'day\')':
        return getLabelDate(data.xLabels[labelIndex], { withYear: true }, data.dateLocale);
      case 'statsTooltipFormat(\'week\')':
        return `${data.dateLocale?.weekOf ?? WEEK_OF} ${getLabelDate(data.xLabels[labelIndex], {}, data.dateLocale)}`;
      case 'statsTooltipFormat(\'hour\')':
      case 'statsTooltipFormat(\'5min\')':
        return getLabelTime(data.xLabels[labelIndex], data.isUtc);
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

  #updateTitle(title: string | undefined, titleNote: string | undefined) {
    const titleContainer = this.#balloon.children[0] as HTMLElement;

    if (this.#data.isCircle) {
      titleContainer.style.display = 'none';
      return;
    }

    if (titleContainer.style.display === 'none') {
      titleContainer.style.display = '';
    }
    let currentTitle = titleContainer.querySelector(':not(.lovely-chart--state-hidden)');

    if (!titleContainer.textContent || !currentTitle) {
      currentTitle = createElement<HTMLSpanElement>('span');
      titleContainer.replaceChildren(currentTitle);
    }

    if (!titleNote) {
      currentTitle.textContent = title!;
      return;
    }

    // The note shares the flex item of the date, so a title total keeps the far end
    const noteElement = createElement<HTMLSpanElement>('span');
    noteElement.className = 'lovely-chart--tooltip-title-note';
    noteElement.textContent = titleNote;
    currentTitle.replaceChildren(title!, noteElement);
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

    const { isTooltipTotalInTitle } = this.#data;
    const total = resolvedTotal !== undefined ? resolvedTotal : totalValue;
    const totalText = hasTooltipTotal(this.#data) ? this.#formatValue(total) : undefined;
    if (totalText !== undefined && !isTooltipTotalInTitle) {
      this.#renderTotalRow(dataSetContainer, 'true', TOTAL_TITLE, totalText);
    }
    this.#renderTitleTotal(isTooltipTotalInTitle ? totalText : undefined);

    if (this.#data.secondaryYAxis) {
      this.#renderSecondaryTotal(dataSetContainer, total);
    }

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  // A pie or donut, which selects no label, passes no notes
  #updateContent(
    title: string | undefined, statistics: StatisticsItem[], resolvedTotal?: number | null, notes?: TooltipNotes,
  ) {
    this.#updateTitle(title, notes?.titleNote);
    this.#updateDataSets(statistics, resolvedTotal);
    this.#renderNotes(notes?.notes ?? []);
  }

  #resolveNotes(datasetStatistics: StatisticsItem[], labelIndex: number): TooltipNotes {
    const { hatchedRanges, resolveTooltipNotes, xLabels } = this.#data;
    const ranges = hatchedRanges.filter(({ from, to }) => labelIndex >= from && labelIndex <= to);
    const resolved = resolveTooltipNotes?.(
      xLabels[labelIndex].value, datasetStatistics.map(({ originalIndex }) => originalIndex), labelIndex,
    );
    const lines = [...ranges.map(({ note }) => note ?? ''), ...(resolved?.notes ?? [])]
      .flatMap((note) => note.split('\n'))
      .filter(Boolean);

    return {
      titleNote: resolved?.titleNote || ranges.find(({ titleNote }) => titleNote)?.titleNote,
      notes: [...new Set(lines)],
    };
  }

  #renderNotes(notes: string[]) {
    this.#notes.replaceChildren(...notes.map((note) => {
      const noteElement = createElement();
      noteElement.textContent = note;
      return noteElement;
    }));
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

  #renderSecondaryTotal(dataSetContainer: HTMLElement, total: number | null) {
    const { label, multiplier, prefix = '', suffix = '' } = this.#data.secondaryYAxis!;
    this.#renderTotalRow(
      dataSetContainer, 'secondary', label,
      total === GAP ? NO_VALUE : `${prefix}${(total * multiplier).toFixed(2)}${suffix}`,
    );
  }

  // Appending each row after the dataset rows keeps the total rows at the bottom, in the order they render
  #renderTotalRow(dataSetContainer: HTMLElement, totalKind: 'true' | 'secondary', title: string, valueText: string) {
    let row = dataSetContainer.querySelector<HTMLElement>(`[data-total="${totalKind}"]`);
    if (!row) {
      row = createElement();
      row.className = 'lovely-chart--tooltip-dataset lovely-chart--tooltip-dataset-total';
      row.setAttribute('data-total', totalKind);
      row.appendChild(createElement<HTMLSpanElement>('span'));

      const valueElement = createElement<HTMLSpanElement>('span');
      valueElement.className = 'lovely-chart--tooltip-dataset-value lovely-chart--position-right';
      row.appendChild(valueElement);
    }

    row.setAttribute('data-present', 'true');
    row.firstElementChild!.textContent = title;
    row.lastElementChild!.textContent = valueText;
    dataSetContainer.appendChild(row);
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

// A stacked or percentage bar, step or area chart totals its rows, in a Total row or by the title
function hasTooltipTotal({ isBars, isSteps, isAreas, isStacked, isShares }: AnalyzedData): boolean {
  return (isBars || isSteps || isAreas) && Boolean(isStacked || isShares);
}

// The label a key selects in the visible range, or `undefined` for a key that selects none
function getKeyLabelIndex(
  key: string, selectedIndex: number | undefined, { from, to }: LabelRange,
): number | undefined {
  if (key === 'Home') {
    return from;
  }
  if (key === 'End') {
    return to;
  }

  const step = ARROW_KEY_STEPS[key];
  if (step === undefined) {
    return undefined;
  }

  return selectedIndex === undefined ? to : Math.min(to, Math.max(from, selectedIndex + step));
}
