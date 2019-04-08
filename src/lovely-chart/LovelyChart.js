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
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
} from './constants';

export function createLovelyChart(parentContainerId, dataOptions) {
  let _data;

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

  _fetchData(dataOptions).then((data) => {
    _data = analyzeData(data);
    _setupComponents();
  });

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

  function _fetchData(dataOptions) {
    const { dataSource } = dataOptions;

    if (dataSource) {
      // TODO spinner
      return fetch(`${dataSource}/overview.json`)
        .then((response) => response.json());
    } else {
      return Promise.resolve(dataOptions);
    }
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

    _axes.drawYAxis(state, projection);
    _drawDatasets(state, projection);
    // TODO isChanged
    _axes.drawXAxis(state, projection);
    _minimap.update(state);
    _tooltip.update(state, projection);
  }

  function _drawDatasets(state, projection) {
    const bounds = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
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
