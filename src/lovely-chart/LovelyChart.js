import { createStateManager } from './StateManager';
import { createAxes } from './Axes';
import { createMinimap } from './Minimap';
import { createTools } from './Tools';
import { createTooltip } from './Tooltip';
import { analyzeData } from './analyzeData';
import { drawDataset } from './drawDataset';
import { createProjection } from './createProjection';
import { setupCanvas, clearCanvas } from './canvas';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  EDGE_POINTS_BUDGET,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
} from './constants';

export function createLovelyChart(parentContainerId, data) {
  const _data = analyzeData(data);

  let _container;
  let _plot;
  let _context;
  let _plotSize;

  let _axes;
  let _stateManager;
  let _minimap;
  let _tooltip;

  _setupContainer(parentContainerId);
  _setupPlotCanvas();
  _setupComponents();

  function redraw() {
    _stateManager.update();
  }

  function _setupContainer(parentContainerId) {
    _container = document.createElement('div');
    _container.className = 'lovely-chart';

    const parentContainer = document.getElementById(parentContainerId);
    parentContainer.appendChild(_container);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_container, {
      width: _container.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;
    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _setupComponents() {
    _axes = createAxes(_context, _data, _plotSize);
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _minimap = createMinimap(_container, _data, _onRangeChange);
    _tooltip = createTooltip(_container, _data, _plotSize);
    createTools(_container, _data, _onFilterChange);
  }

  function _getAvailablePlotSize() {
    const { width, height } = _plotSize;

    return {
      width,
      height: height - X_AXIS_HEIGHT,
    };
  }

  function _onStateUpdate(state) {
    const projection = createProjection(state, _getAvailablePlotSize(), {
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
    });

    clearCanvas(_plot, _context);

    _axes.update(state, projection);
    _drawDatasets(state, projection);
    _minimap.update(state);
    _tooltip.update(state, projection);
  }

  function _drawDatasets(state, projection) {
    const bounds = {
      from: Math.max(0, state.labelFromIndex - EDGE_POINTS_BUDGET),
      to: Math.min(state.labelToIndex + EDGE_POINTS_BUDGET, _data.xLabels.length - 1),
    };

    _data.datasets.forEach(({ key, color, values }) => {
      const options = {
        color,
        opacity: state[`opacity#${key}`],
        lineWidth: PLOT_LINE_WIDTH,
      };

      drawDataset(_context, values, projection, options, bounds);
    });
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  return { redraw };
}

window.LovelyChart = {
  create: createLovelyChart,
};
