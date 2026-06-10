import { analyzeData } from './data.js';
import { getFullLabelDate } from './format.js';
import { ZOOM_RANGE_DELTA, ZOOM_RANGE_MIDDLE, ZOOM_TIMEOUT } from './constants.js';
import { createColors } from './skin.js';

export class Zoomer {
  #data;
  #overviewData;
  #colors;
  #stateManager;
  #container;
  #header;
  #minimap;
  #tooltip;
  #tools;

  #isZoomed = false;
  #isDestroyed = false;
  #stateBeforeZoomIn;
  #stateBeforeZoomOut;
  #swapDataTimeout = null;
  #stateAnimatingTimeout = null;

  constructor(data, overviewData, colors, stateManager, container, header, minimap, tooltip, tools) {
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

  zoomIn(state, labelIndex) {
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
      : this.#data.onZoom(value);
    dataPromise.then((newData) => this.#replaceData(newData, labelIndex, label));
  }

  zoomOut(state) {
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

  isZoomed() {
    return this.#isZoomed;
  }

  destroy() {
    this.#isDestroyed = true;
    if (this.#swapDataTimeout !== null) {
      clearTimeout(this.#swapDataTimeout);
      this.#swapDataTimeout = null;
    }
    if (this.#stateAnimatingTimeout !== null) {
      clearTimeout(this.#stateAnimatingTimeout);
      this.#stateAnimatingTimeout = null;
    }
  }

  #replaceData(newRawData, labelIndex, zoomInLabel) {
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
    const filter = {};
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

    this.#swapDataTimeout = setTimeout(() => {
      this.#swapDataTimeout = null;
      Object.assign(this.#data, newData);

      if (shouldZoomToLines && newRawData.colors) {
        Object.assign(this.#colors, createColors(newRawData.colors));
      }

      if (shouldZoomToLines) {
        if (this.#minimap) {
          this.#minimap.toggle(this.#isZoomed);
        }
        this.#tools.redraw();
        this.#container.style.width = `${this.#container.scrollWidth}px`;
        this.#container.style.height = `${this.#container.scrollHeight}px`;
      }

      this.#stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
        focusOn: null,
      }, true);

      const daysCount = this.#isZoomed || this.#data.shouldZoomToPie
        ? this.#data.xLabels.length
        : this.#data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;

      let range;
      let filter;

      if (this.#isZoomed) {
        range = {
          begin: this.#stateBeforeZoomIn.begin,
          end: this.#stateBeforeZoomIn.end,
        };
        filter = shouldZoomToLines ? this.#stateBeforeZoomIn.filter : this.#stateBeforeZoomOut.filter;
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
          filter = this.#stateBeforeZoomIn.filter;
        }
      }

      this.#stateManager.update({
        range,
        filter,
        minimapDelta: this.#isZoomed ? null : range.end - range.begin,
      });

      if (zoomInLabel) {
        this.#header.zoom(getFullLabelDate(zoomInLabel));
      }

      this.#isZoomed = !this.#isZoomed;
      this.#header.toggleIsZooming(false);
    }, this.#stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);

    this.#stateAnimatingTimeout = setTimeout(() => {
      this.#stateAnimatingTimeout = null;
      if (this.#data.shouldZoomToPie) {
        this.#container.classList.remove('lovely-chart--state-animating');
      }
    }, this.#stateManager.hasAnimations() ? 1000 : 0);
  }

  #generatePieData(labelIndex) {
    return Object.assign(
      {},
      this.#overviewData,
      {
        type: 'pie',
        labels: this.#overviewData.labels.slice(labelIndex - 3, labelIndex + 4),
        datasets: this.#overviewData.datasets.map((dataset) => {
          return {
            ...dataset,
            values: dataset.values.slice(labelIndex - 3, labelIndex + 4),
          };
        }),
      },
    );
  }
}
