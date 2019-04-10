import { createStateManager } from './StateManager';
import { createAxes } from './Axes';
import { createMinimap } from './Minimap';
import { createTools } from './Tools';
import { createTooltip } from './Tooltip';
import { analyzeData } from './analyzeData';
import { drawDatasets } from './drawDatasets';
import { createProjection, setPercentage, setStacked } from './createProjection';
import { setupCanvas, clearCanvas } from './canvas';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
} from './constants';
import { createElement } from './minifiers';

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
    _container = createElement('div');
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

  function _onStateUpdate(state) {
    const { datasets } = _data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const projection = createProjection({
      begin: state.begin,
      end: state.end,
      xOffset: state.xOffset,
      xWidth: state.xWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: _plotSize.width,
      availableHeight: _plotSize.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
    });
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`]);

    let coords = projection.prepareCoords(datasets, range);
    if (_data.isPercentage) {
      coords = setPercentage(coords, visibilities);
    }
    if (_data.isStacked) {
      coords = setStacked(coords, visibilities);
    }

    let secondaryProjection = null;
    let secondaryCoords = null;
    if (_data.hasSecondYAxis) {
      secondaryProjection = projection.copy({
        yMin: state.yMinViewportSecond,
        yMax: state.yMaxViewportSecond,
      });
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      secondaryCoords = secondaryProjection.prepareCoords([secondaryDataset], range)[0];
    }

    clearCanvas(_plot, _context);
    drawDatasets(_context, state, _data, range, projection, coords, secondaryCoords, PLOT_LINE_WIDTH, visibilities);
    _axes.drawYAxis(state, projection, secondaryProjection);
    // TODO isChanged
    _axes.drawXAxis(state, projection);
    _minimap.update(state);
    // TODO maybe `secondaryProjection` is enough, then many calculations above may be incapsulated in `drawDatasets`
    _tooltip.update(state, projection, coords, secondaryCoords);
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
