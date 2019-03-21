import { Viewport } from './Viewport';
import { Axes } from './Axes';
import { Minimap } from './Minimap';
import { analyzeData } from './analyzeData';
import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';
import { setupCanvas } from './setupCanvas';
import { X_AXIS_HEIGHT, PLOT_WH_RATIO, DATASET_WIDTH } from './constants';

export class LovelyChart {
  constructor(parentContainerId, data) {
    this._data = data;

    this._onViewportUpdate = this._onViewportUpdate.bind(this);
    this._onRangeChange = this._onRangeChange.bind(this);

    this._setupContainer(parentContainerId);

    this._analyzeData();

    this._setupViewport();
    this._setupPlot();
    this._setupMinimap();
    // this._setupTools();
  }

  _analyzeData() {
    this._dataInfo = analyzeData(this._data);
  }

  _setupContainer(parentContainerId) {
    const container = document.createElement('div');
    container.className = 'lovely-chart';

    const parentContainer = document.getElementById(parentContainerId);
    parentContainer.appendChild(container);

    this._container = container;
  }

  _setupViewport() {
    this._viewport = new Viewport(this._dataInfo, this._onViewportUpdate);
  }

  _setupPlot() {
    const width = this._container.clientWidth;
    const height = width * PLOT_WH_RATIO;

    const { canvas, context } = setupCanvas({ width, height });

    this._container.appendChild(canvas);
    this._plot = canvas;
    this._context = context;

    this._setupAxes();
  }

  _clearPlotCanvas() {
    this._context.clearRect(0, 0, this._plot.width, this._plot.height);
  }

  _setupAxes() {
    this._axes = new Axes(this._context, this._dataInfo, this._getPlotSize());
  }

  _setupMinimap() {
    this._minimap = new Minimap(this._container, this._dataInfo, this._data.options, this._onRangeChange);
  }

  _getPlotSize() {
    return this._plot.getBoundingClientRect();
  }

  _onViewportUpdate(state) {
    this._clearPlotCanvas();

    this._drawAxes(state);
    this._drawDatasets(state);
  }

  _drawAxes(state) {
    this._axes.draw(state);
  }

  _drawDatasets(state) {
    const { width, height } = this._getPlotSize();
    const availableSize = {
      width,
      height: height - X_AXIS_HEIGHT,
    };

    this._dataInfo.datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      const options = {
        color: this._data.options[i].color,
        lineWidth: DATASET_WIDTH,
      };

      drawDataset(
        this._context,
        valuesByLabelIndex,
        createProjectionFn(state, availableSize),
        options,
      );
    });
  }

  _onRangeChange(range) {
    this._viewport.update(range);
  }
}
