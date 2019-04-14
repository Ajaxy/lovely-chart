import { createStateManager } from './StateManager';
import { createHeader } from './Header';
import { createAxes } from './Axes';
import { createMinimap } from './Minimap';
import { createTools } from './Tools';
import { createTooltip } from './Tooltip';
import { analyzeData } from './analyzeData';
import { preparePoints } from './points';
import { createProjection } from './createProjection';
import { drawDatasets } from './drawDatasets';
import { setupCanvas, clearCanvas } from './canvas';
import { hideOnScroll } from './hideOnScroll';
import { createElement } from './minifiers';
import { setupColors } from './skin';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  ZOOM_RANGE_DELTA,
  ZOOM_TIMEOUT,
  ZOOM_RANGE_MIDDLE,
  ZOOM_HALF_DAY_WIDTH, DEFAULT_PALETTE,
} from './constants';

function createLovelyChart(params) {
  let _params = params;

  let _data;

  let _container;
  let _plot;
  let _context;
  let _plotSize;

  let _header;
  let _axes;
  let _stateManager;
  let _minimap;
  let _tooltip;

  _setupContainer();

  _fetchData().then((data) => {
    _data = analyzeData(data, _params.datasetColors);
    _setupComponents();
  });

  function redraw() {
    _stateManager.update();
  }

  function _setupContainer() {
    _container = createElement();
    _container.className = `lovely-chart palette-${_params.palette || DEFAULT_PALETTE}`;

    hideOnScroll(_container);

    const parentContainer = document.getElementById(_params.containerId);
    parentContainer.appendChild(_container);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_container, {
      width: _container.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;
    // TODO resize
    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _fetchData() {
    const { data, dataSource } = _params;

    if (data) {
      return Promise.resolve(data);
    } else if (dataSource) {
      // TODO spinner
      return fetch(`${dataSource}/overview.json`)
        .then((response) => response.json());
    }
  }

  function _fetchDayData(date) {
    const { dataSource } = _params;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

    return fetch(`${dataSource}/${path}.json`)
      .then((response) => response.json());
  }

  function _setupComponents() {
    _header = createHeader(_container, _params.title, _onZoomOut);
    _setupPlotCanvas();
    _axes = createAxes(_context, _data, _plotSize, _params.palette);
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _minimap = createMinimap(_container, _data, _params.palette, _onRangeChange);
    _tooltip = createTooltip(_container, _data, _plotSize, _params.palette, _zoomToDay);
    createTools(_container, _data, _onFilterChange);
  }

  function _onStateUpdate(state) {
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

    _header.setCaption(`${_data.xLabels[state.labelFromIndex].text} — ${_data.xLabels[state.labelToIndex].text}`);
    clearCanvas(_plot, _context);
    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, _params.palette,
    );
    _axes.drawYAxis(state, projection, secondaryProjection);
    // TODO isChanged
    _axes.drawXAxis(state, projection);
    _minimap.update(state);
    _tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  function _zoomToDay(labelIndex) {
    if (!_params.dataSource) {
      return;
    }

    const { value: date, text: dateText } = _data.xLabels[labelIndex];

    _header.zoom(dateText);

    _fetchDayData(new Date(date))
      .then((data) => {
        const labelWidth = 1 / _data.xLabels.length;
        const labelMiddle = labelIndex / (_data.xLabels.length - 1);

        _stateManager.update({
          range: {
            begin: labelMiddle - labelWidth / 2,
            end: labelMiddle + labelWidth / 2,
          },
        });

        setTimeout(() => {
          Object.assign(_data, analyzeData(data, _params.datasetColors, 'hours'));
          _stateManager.update({
            range: {
              begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
              end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
            },
          }, true);

          _stateManager.update({
            range: {
              begin: ZOOM_RANGE_MIDDLE - ZOOM_HALF_DAY_WIDTH,
              end: ZOOM_RANGE_MIDDLE + ZOOM_HALF_DAY_WIDTH,
            },
          });
        }, ZOOM_TIMEOUT);
      });
  }

  function _onZoomOut() {
    // TODO implement
    setTimeout(() => {
      location.reload();
    }, 300);
  }

  return { redraw };
}

window.LovelyChart = {
  create: createLovelyChart,
  setupColors,
};
