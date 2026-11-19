import type { Header } from './Header.js';
import type { Minimap } from './Minimap.js';
import type { StateManager } from './StateManager.js';
import type { Tools } from './Tools.js';
import type { Tooltip } from './Tooltip.js';
import type { AnalyzedData, ChartColors, ChartState, Filter, LovelyChartParams, Range, Size, XLabel } from './types.js';

import {
  MILLISECONDS_IN_DAY, NO_FOCUS, PLOT_CIRCLE_SHIFT, ZOOM_RANGE_DELTA, ZOOM_RANGE_MIDDLE, ZOOM_TIMEOUT,
} from './constants.js';
import { analyzeData } from './data.js';
import { getZoomCaption } from './format.js';
import { getDrawnPattern, getLabelFraction, getPlotCircle } from './formulas.js';
import { recreateColors } from './skin.js';

const ZOOM_ANIMATING_TIMEOUT = 1_000;
// Days taken around the zoomed label to build the circle data
const CIRCLE_LABELS_AROUND = 3;
const CIRCLE_CLIP_PROPERTY = '--lovely-chart-circle-clip';
const CIRCLE_CENTER_Y_PROPERTY = '--lovely-chart-circle-center-y';

export class Zoomer {
  readonly #data: AnalyzedData;
  readonly #overviewData: LovelyChartParams;
  readonly #colors: ChartColors;
  readonly #stateManager: StateManager;
  readonly #container: HTMLElement;
  readonly #plotSize: Size;
  readonly #header: Header;
  readonly #minimap: Minimap | undefined;
  readonly #tooltip: Tooltip;
  readonly #tools: Tools;
  readonly #onZoomStart: () => void;
  readonly #onZoomChange: (labelValue: number | undefined, labelIndex: number | undefined) => void;

  #isZoomed = false;
  #isZoomedIntoShares = false;
  #isDestroyed = false;
  // The label of the zoomed view, while it shows or is on its way in
  #zoomedLabelIndex?: number;
  // Whether the zoom went to datasets of its own, which leave the overview's filter as the zoom in saved it
  #isZoomedToLines = false;
  #stateBeforeZoomIn?: ChartState;
  #stateBeforeZoomOut?: ChartState;
  #swapDataTimeout?: number;
  #stateAnimatingTimeout?: number;

  constructor(
    data: AnalyzedData,
    overviewData: LovelyChartParams,
    colors: ChartColors,
    stateManager: StateManager,
    container: HTMLElement,
    plotSize: Size,
    header: Header,
    minimap: Minimap | undefined,
    tooltip: Tooltip,
    tools: Tools,
    onZoomStart: () => void,
    onZoomChange: (labelValue: number | undefined, labelIndex: number | undefined) => void,
  ) {
    this.#data = data;
    this.#overviewData = overviewData;
    this.#colors = colors;
    this.#stateManager = stateManager;
    this.#container = container;
    this.#plotSize = plotSize;
    this.#header = header;
    this.#minimap = minimap;
    this.#tooltip = tooltip;
    this.#tools = tools;
    this.#onZoomStart = onZoomStart;
    this.#onZoomChange = onZoomChange;
  }

  zoomIn(state: ChartState, labelIndex: number, isInstant = false) {
    if (this.#isZoomed) {
      return;
    }

    this.#zoomedLabelIndex = labelIndex;
    const label = this.#data.xLabels[labelIndex];

    this.#stateBeforeZoomIn = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(true);
    if (this.#data.shouldZoomToShares) {
      this.#isZoomedIntoShares = true;
      this.#container.classList.add('lovely-chart--state-zoomed-in');
      // Cancel CSS animation for `isInstant` display
      if (!isInstant) {
        this.#startCircleTransition();
      }
    }
    if (isInstant) {
      // Hide the freshly-rendered overview until the zoomed view is drawn so it
      // never paints (matters for async `onZoom`, where the swap lands a frame later)
      this.#container.style.visibility = 'hidden';
    }

    const { value } = label;
    const dataPromise = this.#data.shouldZoomToShares
      ? Promise.resolve(this.#generateCircleData(labelIndex))
      : this.#data.onZoom!(value);
    // The custom `onZoom` function may return a rejected promise instead of resolving,
    // which would leave the entire container invisible, so restore it in that case
    void dataPromise.then(
      (newData) => this.#replaceData(newData, labelIndex, label, isInstant),
      () => this.#replaceData(undefined, labelIndex, label, isInstant),
    );
  }

  zoomOut(state: ChartState) {
    if (!this.#isZoomed) {
      return;
    }

    this.#zoomedLabelIndex = undefined;
    this.#stateBeforeZoomOut = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(false);
    if (this.#data.shouldZoomToShares) {
      this.#isZoomedIntoShares = false;
      this.#container.classList.remove('lovely-chart--state-zoomed-in');
      this.#startCircleTransition();
    }

    const labelIndex = Math.round((state.labelFromIndex + state.labelToIndex) / 2);
    this.#replaceData(this.#overviewData, labelIndex);
  }

  getZoomedLabelIndex(): number | undefined {
    return this.#zoomedLabelIndex;
  }

  // A zoom into lines fixes the size of the chart with the legend where it was, so a move of the legend releases it
  releaseSize() {
    this.#container.style.removeProperty('width');
    this.#container.style.removeProperty('height');
  }

  // From the start of a zoom into shares, ahead of the swap of the data, to the start of the zoom out of them
  isZoomedIntoShares(): boolean {
    return this.#isZoomedIntoShares;
  }

  // While a zoomed view shows, or one is on its way in or out, the overview's range lives only in the state saved before
  // the zoom in. So does its filter, unless the zoomed view shares the overview's datasets: the legend drives the live
  // filter while that view shows, and a zoom out on its way saves it as it clears it.
  getOverviewState(): (Range & { filter: Filter }) | undefined {
    if (!this.#isZoomed && this.#swapDataTimeout === undefined) return undefined;

    const { begin, end, filter } = this.#stateBeforeZoomIn!;
    if (!this.#isZoomed || this.#isZoomedToLines) return { begin, end, filter };

    const zoomedFilter = this.#swapDataTimeout !== undefined
      ? this.#stateBeforeZoomOut!.filter
      : this.#stateManager.getFilter();
    return { begin, end, filter: zoomedFilter };
  }

  destroy() {
    this.#isDestroyed = true;
    if (this.#swapDataTimeout !== undefined) {
      clearTimeout(this.#swapDataTimeout);
      this.#swapDataTimeout = undefined;
    }
    if (this.#stateAnimatingTimeout !== undefined) {
      clearTimeout(this.#stateAnimatingTimeout);
      this.#stateAnimatingTimeout = undefined;
    }
  }

  // The CSS transition turns the plot canvas about the circle and closes its clip on it, leaving room for a focused
  // sector's shift
  #startCircleTransition() {
    const { centerY, radius } = getPlotCircle(this.#plotSize, this.#data.isSparkline);
    this.#container.style.setProperty(CIRCLE_CLIP_PROPERTY, `${radius + PLOT_CIRCLE_SHIFT}px`);
    this.#container.style.setProperty(CIRCLE_CENTER_Y_PROPERTY, `${centerY}px`);
    this.#container.classList.add('lovely-chart--state-animating');
  }

  #replaceData(
    newRawData: LovelyChartParams | undefined, labelIndex: number, zoomInLabel?: XLabel, isInstant = false,
  ) {
    if (this.#isDestroyed) return;

    if (!newRawData) {
      this.#zoomedLabelIndex = undefined;
      this.#tooltip.toggleLoading(false);
      this.#tooltip.toggleIsZoomed(false);
      this.#header.toggleIsZooming(false);
      // Reveal the overview fallback so the chart is not stuck hidden
      if (isInstant) {
        this.#container.style.visibility = '';
      }

      // A page that knows the chart as zoomed, after `update()` kept the zoom, learns that the overview stays
      this.#onZoomChange(undefined, undefined);
      return;
    }

    this.#tooltip.toggleLoading(false);

    // Only data that `onZoom` returns colours its datasets by `colors`, and a dataset of it with no colour of its own
    // keeps the colour of the chart's dataset of its key
    const isOnZoomData = !this.#isZoomed && !this.#data.shouldZoomToShares;
    const newData = isOnZoomData
      ? analyzeData(newRawData, 'hour', newRawData.colors, this.#data.colors)
      : analyzeData(newRawData, 'day');
    const shouldZoomToLines = Object.keys(this.#data.datasets).length !== Object.keys(newData.datasets).length;

    if (isInstant) {
      this.#applyZoomData(newData, shouldZoomToLines, zoomInLabel, labelIndex, true);
      this.#container.style.visibility = '';

      return;
    }

    const labelWidth = 1 / this.#data.xLabels.length;
    const labelMiddle = getLabelFraction(labelIndex, this.#data.xLabels.length - 1);
    const filter: Filter = {};
    this.#data.datasets.forEach(({ key }) => filter[key] = false);

    this.#stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
      filter,
    });

    // A zoom that closely follows the last one takes over its timeouts, which would end its transition early
    clearTimeout(this.#swapDataTimeout);
    clearTimeout(this.#stateAnimatingTimeout);
    this.#swapDataTimeout = window.setTimeout(() => {
      this.#swapDataTimeout = undefined;
      this.#applyZoomData(newData, shouldZoomToLines, zoomInLabel, labelIndex, false);
    }, this.#stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);

    this.#stateAnimatingTimeout = window.setTimeout(() => {
      this.#stateAnimatingTimeout = undefined;
      if (this.#data.shouldZoomToShares) {
        this.#container.classList.remove('lovely-chart--state-animating');
      }
    }, this.#stateManager.hasAnimations() ? ZOOM_ANIMATING_TIMEOUT : 0);

    // The labels start to move with the range above, and the report goes last, as its callback can update or destroy
    // the chart
    this.#onZoomStart();
  }

  #applyZoomData(
    newData: AnalyzedData,
    shouldZoomToLines: boolean,
    zoomInLabel: XLabel | undefined,
    labelIndex: number,
    isInstant: boolean,
  ) {
    const legendBefore = describeLegend(this.#data);
    // The skin belongs to the page around the chart, which a zoom leaves as it is
    const { axisTextColor, backgroundColor, colorScheme } = this.#overviewData;
    Object.assign(this.#data, newData, { axisTextColor, backgroundColor, colorScheme });
    this.#stateManager.refreshTransitionConfig();
    // The datasets of either view, and its comparison, take their own colours in the chart's skin
    recreateColors(this.#colors, newData.colors, this.#data);

    const daysCount = this.#isZoomed || this.#data.shouldZoomToShares
      ? this.#data.xLabels.length
      : this.#data.xLabels.length / 24;
    const halfDayWidth = (1 / daysCount) / 2;
    const centeredDayRange = {
      begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
      end: ZOOM_RANGE_MIDDLE + halfDayWidth,
    };

    let range: Range;
    let filter: Filter;

    this.#isZoomedToLines = shouldZoomToLines;
    if (this.#isZoomed) {
      range = {
        begin: this.#stateBeforeZoomIn!.begin,
        end: this.#stateBeforeZoomIn!.end,
      };
      filter = shouldZoomToLines ? this.#stateBeforeZoomIn!.filter : this.#stateBeforeZoomOut!.filter;
    } else {
      if (shouldZoomToLines) {
        range = {
          begin: 0,
          end: 1,
        };
        filter = {};
        this.#data.datasets.forEach(({ key, isInitiallyHidden }) => filter[key] = !isInitiallyHidden);
      } else {
        // The clicked day is not necessarily in the window middle — at the data
        // edges the window is clamped, so the day is located by timestamp
        range = this.#data.shouldZoomToShares
          ? this.#buildDayRange(newData, zoomInLabel!.value) ?? centeredDayRange
          : newData.minimapRange
            ?? this.#buildDayRange(newData, zoomInLabel!.value)
            ?? centeredDayRange;
        filter = this.#stateBeforeZoomIn!.filter;
      }
    }

    if (shouldZoomToLines) {
      this.#minimap?.toggle(this.#isZoomed);
      this.#tools.redraw(filter);
      this.#container.style.width = `${this.#container.scrollWidth}px`;
      this.#container.style.height = `${this.#container.scrollHeight}px`;
    } else if (describeLegend(this.#data) !== legendBefore) {
      this.#tools.redraw(filter);
    } else {
      // The legend compares the colours as given, and a `var()` among them may compute to another colour by now
      this.#tools.updateColors();
    }

    if (isInstant) {
      this.#stateManager.update({
        range,
        filter,
        focusOn: NO_FOCUS,
        minimapDelta: this.#isZoomed ? 0 : range.end - range.begin,
      }, true);
    } else {
      // For shares zoom the range is applied directly: animating it from the
      // placeholder would draw the circle from wrong label windows (and thus wrong
      // slice proportions) during the CSS transition
      this.#stateManager.update({
        range: this.#data.shouldZoomToShares ? range : {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
        focusOn: NO_FOCUS,
      }, true);

      this.#stateManager.update({
        range,
        filter,
        // 0 disables discrete range snapping (when zooming back out)
        minimapDelta: this.#isZoomed ? 0 : range.end - range.begin,
      });
    }

    this.#isZoomed = !this.#isZoomed;
    // Cleared before `zoom()`, which sets the caption and is otherwise ignored while zooming
    this.#header.toggleIsZooming(false);

    if (zoomInLabel) {
      this.#header.zoom(getZoomCaption(zoomInLabel, this.#data.labelType, this.#data.dateLocale));
    }

    // The report goes last, as its callback can update or destroy the chart
    if (zoomInLabel) {
      this.#onZoomChange(zoomInLabel.value, labelIndex);
    } else {
      this.#onZoomChange(undefined, undefined);
    }
  }

  // The hourly window in zoomed data may be clamped at the data edges, so the
  // requested day is not necessarily in its middle — locate it by timestamp
  #buildDayRange(data: AnalyzedData, dayValue: number): Range | undefined {
    const { xLabels } = data;
    const dayStart = xLabels.findIndex(({ value }) => value === dayValue);
    if (dayStart === -1) {
      return undefined;
    }

    const lastLabelIndex = xLabels.length - 1;
    let dayEnd = dayStart;
    while (dayEnd < lastLabelIndex && xLabels[dayEnd + 1].value < dayValue + MILLISECONDS_IN_DAY) {
      dayEnd++;
    }

    // Half-label margins keep the day's lateral columns fully selected. At the
    // data edges the margin falls outside the axis, so the window is shifted
    // inward rather than truncated — truncating would halve it, which shows as a
    // half-width selection and, since `minimapDelta` is taken from this width,
    // halves the drag step too. The epsilon keeps the neighbouring label out.
    // Columns occupy a slot each, so a label spans [i, i + 1] of `length` slots;
    // points sit *on* the axis, so a label is the half-label margin either side
    // of `i` across `length - 1` intervals. Using the point grid for a column
    // chart leaves the selection overhanging its column by half a slot, which is
    // visible as a sliver of the neighbouring column inside the minimap slider.
    if (data.hasBars || data.isCircle) {
      return {
        begin: dayStart / xLabels.length,
        end: (dayEnd + 1) / xLabels.length,
      };
    }

    // Half-label margins keep the day's lateral columns fully selected
    return {
      begin: Math.max(0, (dayStart - 0.5) / lastLabelIndex),
      end: Math.min(1, (dayEnd + 0.5) / lastLabelIndex),
    };
  }

  #generateCircleData(labelIndex: number): LovelyChartParams {
    const around = this.#data.circleLabelsAround ?? CIRCLE_LABELS_AROUND;
    // A negative `slice` start would wrap around to the array end near the left data edge
    const from = Math.max(0, labelIndex - around);
    const to = labelIndex + around + 1;

    return {
      ...this.#overviewData,
      type: this.#data.zoomType,
      labels: this.#overviewData.labels.slice(from, to),
      datasets: this.#overviewData.datasets.map((dataset, i) => {
        const values = dataset.values.slice(from, to);
        return {
          ...dataset,
          // A dataset of another type than the chart's is out of the total, so it takes no share
          values: this.#data.datasets[i].hasOwnType ? values.map(() => 0) : values,
        };
      }),
    };
  }
}

// What the legend shows of the data: the name, colour and pattern of each dataset, and the comparison's name and colour
function describeLegend({ datasets, colors, comparison }: AnalyzedData): string {
  return JSON.stringify([
    datasets.map((dataset) => [dataset.name, colors[dataset.key], getDrawnPattern(dataset)]),
    comparison && [comparison.name, comparison.color],
  ]);
}
