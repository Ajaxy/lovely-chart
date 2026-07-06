import type { Header } from './Header';
import type { Minimap } from './Minimap';
import type { StateManager } from './StateManager';
import type { Tools } from './Tools';
import type { Tooltip } from './Tooltip';
import type { AnalyzedData, ChartColors, ChartState, Filter, LovelyChartParams, Range, XLabel } from './types';

import { MILLISECONDS_IN_DAY, NO_FOCUS, ZOOM_RANGE_DELTA, ZOOM_RANGE_MIDDLE, ZOOM_TIMEOUT } from './constants';
import { analyzeData } from './data';
import { getFullLabelDate } from './format';
import { getLabelFraction } from './formulas';
import { createColors } from './skin';

const ZOOM_ANIMATING_TIMEOUT = 1_000;
// Days taken around the zoomed label to build the circle data
const CIRCLE_LABELS_AROUND = 3;

export class Zoomer {
  readonly #data: AnalyzedData;
  readonly #overviewData: LovelyChartParams;
  readonly #colors: ChartColors;
  readonly #stateManager: StateManager;
  readonly #container: HTMLElement;
  readonly #header: Header;
  readonly #minimap: Minimap | undefined;
  readonly #tooltip: Tooltip;
  readonly #tools: Tools;

  #isZoomed = false;
  #isDestroyed = false;
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
    header: Header,
    minimap: Minimap | undefined,
    tooltip: Tooltip,
    tools: Tools,
  ) {
    this.#data = data;
    this.#overviewData = overviewData;
    this.#colors = colors;
    this.#stateManager = stateManager;
    this.#container = container;
    this.#header = header;
    this.#minimap = minimap;
    this.#tooltip = tooltip;
    this.#tools = tools;
  }

  // `instant` opens directly in the final zoomed view, with no overview morph
  zoomIn(state: ChartState, labelIndex: number, instant = false) {
    if (this.#isZoomed) {
      return;
    }

    const label = this.#data.xLabels[labelIndex];

    this.#stateBeforeZoomIn = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(true);
    if (this.#data.shouldZoomToShares) {
      this.#container.classList.add('lovely-chart--state-zoomed-in');
      // `state-animating` drives the CSS circle morph — skipped for the instant view
      if (!instant) {
        this.#container.classList.add('lovely-chart--state-animating');
      }
    }
    if (instant) {
      // Hide the freshly-rendered overview until the zoomed view is drawn so it
      // never paints (matters for async `onZoom`, where the swap lands a frame later)
      this.#container.style.visibility = 'hidden';
    }

    const { value } = label;
    const dataPromise = this.#data.shouldZoomToShares
      ? Promise.resolve(this.#generateCircleData(labelIndex))
      : this.#data.onZoom!(value);
    // A rejected `onZoom` is treated like resolved-`undefined`: abort the zoom and
    // (in the instant path) reveal the container instead of leaving it hidden forever
    void dataPromise.then(
      (newData) => this.#replaceData(newData, labelIndex, label, instant),
      () => this.#replaceData(undefined, labelIndex, label, instant),
    );
  }

  zoomOut(state: ChartState) {
    if (!this.#isZoomed) {
      return;
    }

    this.#stateBeforeZoomOut = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(false);
    if (this.#data.shouldZoomToShares) {
      this.#container.classList.remove('lovely-chart--state-zoomed-in');
      this.#container.classList.add('lovely-chart--state-animating');
    }

    const labelIndex = Math.round((state.labelFromIndex + state.labelToIndex) / 2);
    this.#replaceData(this.#overviewData, labelIndex);
  }

  isZoomed(): boolean {
    return this.#isZoomed;
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

  #replaceData(
    newRawData: LovelyChartParams | undefined, labelIndex: number, zoomInLabel?: XLabel, instant = false,
  ) {
    if (this.#isDestroyed) return;

    if (!newRawData) {
      this.#tooltip.toggleLoading(false);
      this.#tooltip.toggleIsZoomed(false);
      this.#header.toggleIsZooming(false);
      // Reveal the overview fallback so the chart is not stuck hidden
      if (instant) {
        this.#container.style.visibility = '';
      }

      return;
    }

    this.#tooltip.toggleLoading(false);

    const newData = analyzeData(newRawData, this.#isZoomed || this.#data.shouldZoomToShares ? 'day' : 'hour');
    const shouldZoomToLines = Object.keys(this.#data.datasets).length !== Object.keys(newData.datasets).length;

    if (instant) {
      // Jump to the zoomed view in place (no collapse morph), then reveal it
      this.#applyZoomData(newData, newRawData, shouldZoomToLines, zoomInLabel, true);
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

    this.#swapDataTimeout = window.setTimeout(() => {
      this.#swapDataTimeout = undefined;
      this.#applyZoomData(newData, newRawData, shouldZoomToLines, zoomInLabel, false);
    }, this.#stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);

    this.#stateAnimatingTimeout = window.setTimeout(() => {
      this.#stateAnimatingTimeout = undefined;
      if (this.#data.shouldZoomToShares) {
        this.#container.classList.remove('lovely-chart--state-animating');
      }
    }, this.#stateManager.hasAnimations() ? ZOOM_ANIMATING_TIMEOUT : 0);
  }

  // Swaps in the zoomed dataset and applies the final range/filter. Shared by the
  // click-driven morph (`instant=false`, called after the collapse timeout) and the
  // start-zoomed path (`instant=true`, jumps with no transition).
  #applyZoomData(
    newData: AnalyzedData,
    newRawData: LovelyChartParams,
    shouldZoomToLines: boolean,
    zoomInLabel: XLabel | undefined,
    instant: boolean,
  ) {
    Object.assign(this.#data, newData);

    if (shouldZoomToLines && newRawData.colors) {
      Object.assign(this.#colors, createColors(newRawData.colors));
    }

    if (shouldZoomToLines) {
      this.#minimap?.toggle(this.#isZoomed);
      this.#tools.redraw();
      this.#container.style.width = `${this.#container.scrollWidth}px`;
      this.#container.style.height = `${this.#container.scrollHeight}px`;
    }

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
        this.#data.datasets.forEach(({ key }) => filter[key] = true);
      } else {
        // The clicked day is not necessarily in the window middle — at the data
        // edges the window is clamped, so the day is located by timestamp
        range = this.#data.shouldZoomToShares
          ? this.#buildDayRange(newData.xLabels, zoomInLabel!.value) ?? centeredDayRange
          : newData.minimapRange
            ?? this.#buildDayRange(newData.xLabels, zoomInLabel!.value)
            ?? centeredDayRange;
        filter = this.#stateBeforeZoomIn!.filter;
      }
    }

    if (instant) {
      // Jump straight to the final zoomed range/filter with no transition
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

    if (zoomInLabel) {
      this.#header.zoom(getFullLabelDate(zoomInLabel));
    }

    this.#isZoomed = !this.#isZoomed;
    this.#header.toggleIsZooming(false);
  }

  // The hourly window in zoomed data may be clamped at the data edges, so the
  // requested day is not necessarily in its middle — locate it by timestamp
  #buildDayRange(xLabels: XLabel[], dayValue: number): Range | undefined {
    const dayStart = xLabels.findIndex(({ value }) => value === dayValue);
    if (dayStart === -1) {
      return undefined;
    }

    const lastLabelIndex = xLabels.length - 1;
    let dayEnd = dayStart;
    while (dayEnd < lastLabelIndex && xLabels[dayEnd + 1].value < dayValue + MILLISECONDS_IN_DAY) {
      dayEnd++;
    }

    // Half-label margins keep the day's lateral columns fully selected
    return {
      begin: Math.max(0, (dayStart - 0.5) / lastLabelIndex),
      end: Math.min(1, (dayEnd + 0.5) / lastLabelIndex),
    };
  }

  #generateCircleData(labelIndex: number): LovelyChartParams {
    // A negative `slice` start would wrap around to the array end near the left data edge
    const from = Math.max(0, labelIndex - CIRCLE_LABELS_AROUND);
    const to = labelIndex + CIRCLE_LABELS_AROUND + 1;

    return {
      ...this.#overviewData,
      type: this.#data.zoomType,
      labels: this.#overviewData.labels.slice(from, to),
      datasets: this.#overviewData.datasets.map((dataset) => {
        return {
          ...dataset,
          values: dataset.values.slice(from, to),
        };
      }),
    };
  }
}
