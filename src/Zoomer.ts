import type { Header } from './Header';
import type { Minimap } from './Minimap';
import type { StateManager } from './StateManager';
import type { Tools } from './Tools';
import type { Tooltip } from './Tooltip';
import type { AnalyzedData, ChartColors, ChartState, Filter, LovelyChartParams, Range, XLabel } from './types';

import { NO_FOCUS, ZOOM_RANGE_DELTA, ZOOM_RANGE_MIDDLE, ZOOM_TIMEOUT } from './constants';
import { analyzeData } from './data';
import { getFullLabelDate } from './format';
import { createColors } from './skin';

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

  zoomIn(state: ChartState, labelIndex: number) {
    if (this.#isZoomed) {
      return;
    }

    const label = this.#data.xLabels[labelIndex];

    this.#stateBeforeZoomIn = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(true);
    if (this.#data.shouldZoomToPie) {
      this.#container.classList.add('lovely-chart--state-zoomed-in');
      this.#container.classList.add('lovely-chart--state-animating');
    }

    const { value } = label;
    const dataPromise = this.#data.shouldZoomToPie
      ? Promise.resolve(this.#generatePieData(labelIndex))
      : this.#data.onZoom!(value);
    void dataPromise.then((newData) => this.#replaceData(newData, labelIndex, label));
  }

  zoomOut(state: ChartState) {
    if (!this.#isZoomed) {
      return;
    }

    this.#stateBeforeZoomOut = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(false);
    if (this.#data.shouldZoomToPie) {
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

  #replaceData(newRawData: LovelyChartParams | undefined, labelIndex: number, zoomInLabel?: XLabel) {
    if (this.#isDestroyed) return;

    if (!newRawData) {
      this.#tooltip.toggleLoading(false);
      this.#tooltip.toggleIsZoomed(false);
      this.#header.toggleIsZooming(false);

      return;
    }

    this.#tooltip.toggleLoading(false);

    const labelWidth = 1 / this.#data.xLabels.length;
    const labelMiddle = labelIndex / (this.#data.xLabels.length - 1);
    const filter: Filter = {};
    this.#data.datasets.forEach(({ key }) => filter[key] = false);
    const newData = analyzeData(newRawData, this.#isZoomed || this.#data.shouldZoomToPie ? 'day' : 'hour');
    const shouldZoomToLines = Object.keys(this.#data.datasets).length !== Object.keys(newData.datasets).length;

    this.#stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
      filter,
    });

    this.#swapDataTimeout = window.setTimeout(() => {
      this.#swapDataTimeout = undefined;
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

      this.#stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
        focusOn: NO_FOCUS,
      }, true);

      const daysCount = this.#isZoomed || this.#data.shouldZoomToPie
        ? this.#data.xLabels.length
        : this.#data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;

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
          range = this.#data.shouldZoomToPie || !newData.minimapRange ? {
            begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
            end: ZOOM_RANGE_MIDDLE + halfDayWidth,
          } : newData.minimapRange;
          filter = this.#stateBeforeZoomIn!.filter;
        }
      }

      this.#stateManager.update({
        range,
        filter,
        // 0 disables discrete range snapping (when zooming back out)
        minimapDelta: this.#isZoomed ? 0 : range.end - range.begin,
      });

      if (zoomInLabel) {
        this.#header.zoom(getFullLabelDate(zoomInLabel));
      }

      this.#isZoomed = !this.#isZoomed;
      this.#header.toggleIsZooming(false);
    }, this.#stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);

    this.#stateAnimatingTimeout = window.setTimeout(() => {
      this.#stateAnimatingTimeout = undefined;
      if (this.#data.shouldZoomToPie) {
        this.#container.classList.remove('lovely-chart--state-animating');
      }
    }, this.#stateManager.hasAnimations() ? 1000 : 0);
  }

  #generatePieData(labelIndex: number): LovelyChartParams {
    return {
      ...this.#overviewData,
      type: 'pie',
      labels: this.#overviewData.labels.slice(labelIndex - 3, labelIndex + 4),
      datasets: this.#overviewData.datasets.map((dataset) => {
        return {
          ...dataset,
          values: dataset.values.slice(labelIndex - 3, labelIndex + 4),
        };
      }),
    };
  }
}
