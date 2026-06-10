import { createStateManager } from './StateManager.js';
import { createHeader } from './Header.js';
import { createAxes } from './Axes.js';
import { createMinimap } from './Minimap.js';
import { createTooltip } from './Tooltip.js';
import { createTools } from './Tools.js';
import { createZoomer } from './Zoomer.js';
import { createColors } from './skin.js';
import { analyzeData } from './data.js';
import { setupCanvas, clearCanvas } from './canvas.js';
import { preparePoints } from './preparePoints.js';
import { createProjection } from './Projection.js';
import { drawDatasets } from './drawDatasets.js';
import { createElement } from './minifiers.js';
import { getFullLabelDate, getLabelDate } from './format.js';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  SIMPLIFIER_PLOT_FACTOR,
} from './constants.js';
import { getSimplificationDelta, isDataRange } from './formulas.js';
import { debounce } from './utils.js';
import './styles/index.scss';

function create(container, originalData) {
  let _stateManager;

  let _element;
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
  let _windowWidth = window.innerWidth;
  let _originalData = originalData;
  let _isDestroyed = false;

  let _themeObserver;
  let _onWindowResize;
  let _onWindowOrientationChange;

  const _data = analyzeData(_originalData);
  const _colors = createColors(_data.colors);
  const _redrawDebounced = debounce(_redraw, 500, false, true);

  _setupComponents();
  _setupGlobalListeners();

  function _setupComponents() {
    _setupContainer();
    _header = createHeader(_element, _data.title, _data.zoomOutLabel, _onZoomOut);
    _setupPlotCanvas();
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _axes = createAxes(_context, _data, _plotSize, _colors);
    if (_data.withMinimap) {
      // Triggers the initial render via the range callback.
      _minimap = createMinimap(_element, _data, _colors, _onRangeChange);
    } else {
      _stateManager.update({ range: _data.minimapRange });
    }
    _tooltip = createTooltip(_element, _data, _plotSize, _colors, _onZoomIn, _onFocus);
    _tools = createTools(_element, _data, _onFilterChange);
    _zoomer = _data.isZoomable && createZoomer(_data, _originalData, _colors, _stateManager, _element, _header, _minimap, _tooltip, _tools);
    // hideOnScroll(_element);
  }

  function _setupContainer() {
    _element = createElement();
    _element.className = `lovely-chart--container${_data.shouldZoomToPie ? ' lovely-chart--container-type-pie' : ''}`;

    container.appendChild(_element);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_element, {
      width: _element.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;

    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _onStateUpdate(state) {
    if (_isDestroyed) return;
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

    if (!_data.noCaption) {
      _header.setCaption(_getCaption(state));
    }

    clearCanvas(_plot, _context);

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_PLOT_FACTOR;

    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, _colors, false, simplification,
    );
    if (!_data.isPie) {
      _axes.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      _axes.drawXAxis(state, projection);
    }
    if (_minimap) {
      _minimap.update(state);
    }
    _tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  function _onFocus(focusOn) {
    if (_data.isBars || _data.isPie || _data.isSteps) {
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

  function _setupGlobalListeners() {
    _themeObserver = new MutationObserver(() => {
      if (_isDestroyed || !_stateManager) return;
      _stateManager.update();
    });
    _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    _onWindowResize = () => {
      if (window.innerWidth !== _windowWidth) {
        _windowWidth = window.innerWidth;
        _redrawDebounced();
      }
    };
    window.addEventListener('resize', _onWindowResize);

    _onWindowOrientationChange = () => {
      _redrawDebounced();
    };
    window.addEventListener('orientationchange', _onWindowOrientationChange);
  }

  function _destroyComponents() {
    if (_zoomer) _zoomer.destroy();
    if (_tooltip) _tooltip.destroy();
    if (_header) _header.destroy();
    if (_stateManager) _stateManager.destroy();

    if (_element && _element.parentNode) {
      _element.remove();
    }

    _element = null;
    _plot = null;
    _context = null;
    _header = null;
    _axes = null;
    _minimap = null;
    _tooltip = null;
    _tools = null;
    _zoomer = null;
    _stateManager = null;
  }

  function _redraw() {
    if (_isDestroyed) return;
    _destroyComponents();
    Object.assign(_data, analyzeData(_originalData));
    _setupComponents();
  }

  function update(newData) {
    if (_isDestroyed) return;
    _originalData = newData;
    _destroyComponents();
    const fresh = analyzeData(_originalData);
    Object.keys(_data).forEach((k) => { delete _data[k]; });
    Object.assign(_data, fresh);
    Object.assign(_colors, createColors(_data.colors));
    _setupComponents();
  }

  function destroy() {
    if (_isDestroyed) return;
    _isDestroyed = true;

    if (_themeObserver) {
      _themeObserver.disconnect();
      _themeObserver = null;
    }
    if (_onWindowResize) {
      window.removeEventListener('resize', _onWindowResize);
      _onWindowResize = null;
    }
    if (_onWindowOrientationChange) {
      window.removeEventListener('orientationchange', _onWindowOrientationChange);
      _onWindowOrientationChange = null;
    }

    _destroyComponents();
  }

  function _getCaption(state) {
    let startIndex;
    let endIndex;

    if (_zoomer && _zoomer.isZoomed()) {
      // TODO Fix label
      startIndex = state.labelFromIndex === 0 ? 0 : state.labelFromIndex + 1;
      endIndex = state.labelToIndex === state.totalXWidth - 1 ? state.labelToIndex : state.labelToIndex - 1;
    } else {
      startIndex = state.labelFromIndex;
      endIndex = state.labelToIndex;
    }

    if (_data.labelType === 'text') {
      const startText = _data.xLabels[startIndex].text;
      const endText = _data.xLabels[endIndex].text;

      return startText === endText ? startText : `${startText} — ${endText}`;
    }

    return isDataRange(_data.xLabels[startIndex], _data.xLabels[endIndex])
      ? (
        `${getLabelDate(_data.xLabels[startIndex])}` +
        ' — ' +
        `${getLabelDate(_data.xLabels[endIndex])}`
      )
      : getFullLabelDate(_data.xLabels[startIndex]);
  }

  return { update, destroy };
}

export { create };
export default { create };
