import { createStateManager } from './StateManager';
import { createHeader } from './Header';
import { createAxes } from './Axes';
import { createMinimap } from './Minimap';
import { createTooltip } from './Tooltip';
import { createTools } from './Tools';
import { createZoomer } from './Zoomer';
import { createColors } from './skin';
import { fetchData, analyzeData } from './data';
import { setupCanvas, clearCanvas } from './canvas';
import { preparePoints } from './preparePoints';
import { createProjection } from './Projection';
import { drawDatasets } from './drawDatasets';
import { createElement } from './minifiers';
import { hideOnScroll } from './hideOnScroll';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  DEFAULT_PALETTE,
} from './constants';

export function createLovelyChart(params) {
  let _data;

  let _stateManager;

  let _container;
  let _plot;
  let _context;
  let _plotSize;

  let _header;
  let _axes;
  let _minimap;
  let _tooltip;
  let _tools;
  let _zoomer;

  let _state;

  const _colors = createColors(params.palette);

  fetchData(params).then((data) => {
    _data = analyzeData(data, params.datasetColors);
    _setupComponents();
  });

  function redraw() {
    _stateManager.update();
  }

  function _setupComponents() {
    _setupContainer();
    _header = createHeader(_container, params.title, _onZoomOut);
    _setupPlotCanvas();
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _axes = createAxes(_context, _data, _plotSize, _colors);
    _minimap = createMinimap(_container, _data, _colors, _onRangeChange);
    _tooltip = createTooltip(_container, _data, _plotSize, _colors, _onZoomIn, _onFocus);
    _tools = createTools(_container, _data, _onFilterChange);
    _zoomer = createZoomer(_data, params, _stateManager, _header, _minimap, _tooltip, _tools);
  }

  function _setupContainer() {
    _container = createElement();
    _container.className = `lovely-chart palette-${params.palette || DEFAULT_PALETTE}`;

    hideOnScroll(_container);

    const parentContainer = document.getElementById(params.containerId);
    parentContainer.appendChild(_container);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_container, {
      width: _container.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;

    // TODO support resize
    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _onStateUpdate(state) {
    _state = state;

    const { datasets } = _data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const boundsAndParams = {
      begin: state.begin,
      end: state.end,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: _plotSize.width,
      availableHeight: _plotSize.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`]);
    const points = preparePoints(_data, datasets, range, visibilities, boundsAndParams);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (_data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = {
        yMin: state.yMinViewportSecond,
        yMax: state.yMaxViewportSecond,
      };
      secondaryPoints = preparePoints(_data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    _header.setCaption(
      `${_data.xLabels[state.labelFromIndex + 1].text} — ${_data.xLabels[state.labelToIndex - 1].text}`,
    );

    clearCanvas(_plot, _context);
    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, _colors,
    );
    if (!_data.isPie) {
      _axes.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      _axes.drawXAxis(state, projection);
    }
    _minimap.update(state);
    _tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  function _onFocus(focusOn) {
    if (_data.isBars || _data.isPie) {
      // TODO animate
      _stateManager.update({ focusOn });
    }
  }

  function _onZoomIn(labelIndex) {
    _zoomer.zoomIn(_state, labelIndex);
  }

  function _onZoomOut() {
    _zoomer.zoomOut(_state);
  }

  return { redraw };
}
