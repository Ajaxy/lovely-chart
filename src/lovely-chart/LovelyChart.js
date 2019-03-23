import { StateManager } from './StateManager';
import { Axes } from './Axes';
import { Minimap } from './Minimap';
import { Tools } from './Tools';
import { Tooltip } from './Tooltip';
import { analyzeData } from './analyzeData';
import { drawDataset } from './drawDataset';
import { createProjection } from './createProjection';
import { setupCanvas } from './setupCanvas';
import { X_AXIS_HEIGHT, PLOT_WH_RATIO, DATASET_WIDTH, GUTTER, EDGE_POINTS_BUDGET } from './constants';

export class LovelyChart {
  constructor(parentContainerId, data) {
    this._data = analyzeData(data);

    this._onStateUpdate = this._onStateUpdate.bind(this);
    this._onRangeChange = this._onRangeChange.bind(this);
    this._onFilterChange = this._onFilterChange.bind(this);

    this._setupContainer(parentContainerId);
    this._setupPlotCanvas();
    this._setupStateManager();
    this._setupAxes();
    this._setupMinimap();
    this._setupTools();
    this._setupTooltip();
  }

  _setupContainer(parentContainerId) {
    const container = document.createElement('div');
    container.className = 'lovely-chart';

    const parentContainer = document.getElementById(parentContainerId);
    parentContainer.appendChild(container);

    this._container = container;
  }

  _setupStateManager() {
    this._stateManager = new StateManager(this._data, this._getPlotSize(), this._onStateUpdate);
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
    this._axes = new Axes(this._context, this._data, this._getPlotSize());
  }

  _setupMinimap() {
    this._minimap = new Minimap(this._container, this._data, this._onRangeChange);
  }

  _setupTools() {
    this._tools = new Tools(this._container, this._data, this._onFilterChange);
  }

  _setupTooltip() {
    this._tooltip = new Tooltip(this._container, this._data, this._getPlotSize());
  }

  _getPlotSize() {
    return this._plot.getBoundingClientRect();
  }

  _getAvailablePlotSize() {
    const { width, height } = this._getPlotSize();

    return {
      width: width - GUTTER * 2,
      height: height - X_AXIS_HEIGHT,
    };
  }

  _onStateUpdate(state) {
    const projection = createProjection(state, this._getAvailablePlotSize(), { leftMargin: GUTTER });

    this._clearPlotCanvas();

    this._axes.update(state, projection);
    this._drawDatasets(state, projection);
    // TODO perf only for `yMinTotal, yMaxTotal, opacity#*`
    this._minimap.update(state);
    this._tooltip.update(state, projection);
  }

  _drawDatasets(state, projection) {
    const bounds = {
      from: state.labelFromIndex - EDGE_POINTS_BUDGET,
      to: state.labelToIndex + EDGE_POINTS_BUDGET,
    };

    this._data.datasets.forEach(({ key, color, values }) => {
      const options = {
        color,
        opacity: state[`opacity#${key}`],
        lineWidth: DATASET_WIDTH,
      };

      drawDataset(this._context, values, projection, options, bounds);
    });
  }

  _onRangeChange(range) {
    this._stateManager.update({ range });
  }

  _onFilterChange(filter) {
    this._stateManager.update({ filter });
  }
}
