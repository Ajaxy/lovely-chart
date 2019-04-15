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
  DEFAULT_PALETTE,
} from './constants';

function createLovelyChart(params) {
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

  let _state;
  let _isZoomed = false;
  let _stateBeforeZoom;

  _setupContainer();

  _fetchData().then((data) => {
    _data = analyzeData(data, params.datasetColors);
    _setupComponents();
  });

  function redraw() {
    _stateManager.update();
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
    // TODO resize
    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _fetchData() {
    const { data, dataSource } = params;

    if (data) {
      return Promise.resolve(data);
    } else if (dataSource) {
      // TODO spinner
      return fetch(`${dataSource}/overview.json`)
        .then((response) => response.json());
    }
  }

  function _fetchDayData(date) {
    const { dataSource } = params;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

    return fetch(`${dataSource}/${path}.json`)
      .then((response) => response.json());
  }

  function _setupComponents() {
    _header = createHeader(_container, params.title, _onZoomOut);
    _setupPlotCanvas();
    _axes = createAxes(_context, _data, _plotSize, params.palette);
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _minimap = createMinimap(_container, _data, params.palette, _onRangeChange);
    _tooltip = createTooltip(_container, _data, _plotSize, params.palette, _zoomToDay, _onFocus);
    createTools(_container, _data, _onFilterChange);
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

    _header.setCaption(`${_data.xLabels[state.labelFromIndex + 1].text} — ${_data.xLabels[state.labelToIndex - 1].text}`);
    clearCanvas(_plot, _context);
    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, params.palette,
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

  function _zoomToDay(labelIndex) {
    if (!params.dataSource || _isZoomed) {
      return;
    }

    _stateBeforeZoom = _state;
    const { value: date, text: dateText } = _data.xLabels[labelIndex];
    _header.zoom(dateText);
    const dataPromise = params.zoomToPie ? Promise.resolve(_generatePieData()) : _fetchDayData(new Date(date));
    dataPromise.then((data) => _replaceData(data, labelIndex));
  }

  function _onZoomOut() {
    if (!params.dataSource) {
      return;
    }

    const labelIndex = Math.round((_state.labelFromIndex + _state.labelToIndex) / 2);

    _fetchData().then((data) => _replaceData(data, labelIndex));
  }

  function _replaceData(data, labelIndex) {
    const labelWidth = 1 / _data.xLabels.length;
    const labelMiddle = labelIndex / (_data.xLabels.length - 1);

    _stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
    });

    setTimeout(() => {
      Object.assign(_data, analyzeData(data, params.datasetColors, _isZoomed || params.zoomToPie ? 'days' : 'hours'));

      _stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
      }, true);

      const daysCount = _isZoomed || params.zoomToPie ? _data.xLabels.length : _data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;

      _stateManager.update({
        range: _isZoomed ? {
          begin: _stateBeforeZoom.begin,
          end: _stateBeforeZoom.end,
        } : {
          begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
          end: ZOOM_RANGE_MIDDLE + halfDayWidth,
        },
      });

      _isZoomed = !_isZoomed;
    }, ZOOM_TIMEOUT);
  }

  function _generatePieData() {
    return _fetchData().then((sourceData) => {
      const pieData = Object.assign({}, sourceData);

      pieData.columns = sourceData.columns.map((c) => {
        const column = c.slice(_state.labelFromIndex + 1, _state.labelToIndex + 1);
        column.unshift(c[0]);
        return column;
      });

      Object.keys(pieData.types).forEach((key) => {
        if (key !== 'x') {
          pieData.types[key] = 'pie';
        }
      });

      pieData.pie = true;

      return pieData;
    });
  }

  function _onFocus(labelIndex) {
    if (_data.isBars || _data.isPie) {
      // TODO animate
      _stateManager.update({ focusOn: labelIndex });
    }
  }

  return { redraw };
}

window.LovelyChart = {
  create: createLovelyChart,
  setupColors,
};
