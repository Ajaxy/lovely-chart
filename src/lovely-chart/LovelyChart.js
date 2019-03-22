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

    this._analyzeData();

    this._setupContainer(parentContainerId);
    this._setupViewport();
    this._setupPlotCanvas();
    this._setupAxes();
    this._setupMinimap();
    this._setupTools();
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

  _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(this._container, {
      width: this._container.clientWidth,
      height: this._container.clientWidth * PLOT_WH_RATIO,
    });

    this._plot = canvas;
    this._context = context;
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

  _setupTools() {
    // this._tools = new Tools(this._container, this._dataInfo, this._data.options, this._onFilterChange);
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

  // _onFilterChange(filter) {
  // }
}
