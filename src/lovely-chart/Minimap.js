import { setupCanvas, clearCanvas } from './canvas';
import { preparePoints } from './points';
import { createProjection } from './createProjection';
import { drawDatasets } from './drawDatasets';
import { setupDrag } from './setupDrag';
import {
  DEFAULT_RANGE,
  MINIMAP_HEIGHT,
  MINIMAP_EAR_WIDTH,
  MINIMAP_MARGIN,
  MINIMAP_LINE_WIDTH,
} from './constants';
import { throttleWithRaf } from './fast';
import { createElement } from './minifiers';
import { getDatasetMinimapVisibility } from './formulas';

export function createMinimap(container, data, palette, rangeCallback) {
  let _element;
  let _canvas;
  let _context;
  let _canvasSize;
  let _ruler;
  let _slider;

  let _capturedOffset;
  let _range = {};
  let _state;

  const _updateRulerOnRaf = throttleWithRaf(_updateRuler);

  _setupLayout();
  _updateRange(DEFAULT_RANGE);

  function update(newState) {
    const { begin, end } = newState;
    if (!_capturedOffset) {
      _updateRange({ begin, end }, true);
    }

    if (!_isStateChanged(newState)) {
      return;
    }

    _state = newState;
    clearCanvas(_canvas, _context);
    _drawDatasets(newState);
  }

  function _setupLayout() {
    _element = createElement();

    _element.className = 'minimap';
    _element.style.height = `${MINIMAP_HEIGHT}px`;

    _setupCanvas();
    _setupRuler();

    container.appendChild(_element);

    _canvasSize = {
      width: _canvas.offsetWidth,
      height: _canvas.offsetHeight,
    };
  }

  function _getSize() {
    return {
      width: container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT,
    };
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, _getSize());

    _canvas = canvas;
    _context = context;
  }

  function _setupRuler() {
    _ruler = createElement();
    _ruler.className = 'ruler';
    _ruler.innerHTML =
      '<div class="mask"></div>' +
      '<div class="slider"><div class="handle"><span></span></div><div class="inner"></div><div class="handle"><span></span></div></div>' +
      '<div class="mask"></div>';

    _slider = _ruler.children[1];

    setupDrag(
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onSliderDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'grabbing',
      },
    );

    setupDrag(
      _slider.children[0],
      {
        onCapture: _onDragCapture,
        onDrag: _onLeftEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    setupDrag(
      _slider.children[2],
      {
        onCapture: _onDragCapture,
        onDrag: _onRightEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    _element.appendChild(_ruler);
  }

  function _isStateChanged(newState) {
    if (!_state) {
      return true;
    }

    const keys = data.datasets.map(({ key }) => `opacity#${key}`);
    keys.push('yMaxMinimap');

    return keys.some((key) => _state[key] !== newState[key]);
  }

  function _drawDatasets(state = {}) {
    const { datasets } = data;
    const range = {
      from: 0,
      to: state.totalXWidth,
    };
    const boundsAndParams = {
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: _canvasSize.width,
      availableHeight: _canvasSize.height,
      yPadding: 1,
    };
    const visibilities = datasets.map(({ key }) => getDatasetMinimapVisibility(state, key));
    const points = preparePoints(data, datasets, range, visibilities, boundsAndParams, true);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = { yMin: state.yMinMinimapSecond, yMax: state.yMaxMinimapSecond };
      secondaryPoints = preparePoints(data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    drawDatasets(
      _context, state, data,
      range, points, projection, secondaryPoints, secondaryProjection,
      MINIMAP_LINE_WIDTH, visibilities, palette, true,
    );
  }

  function _onDragCapture(e) {
    _capturedOffset = e.target.offsetLeft;
  }

  function _onDragRelease() {
    _capturedOffset = null;
  }

  function _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX1 = 0;
    const maxX1 = _canvasSize.width - _slider.offsetWidth;

    const newX1 = Math.max(minX1, Math.min(_capturedOffset + dragOffsetX - MINIMAP_EAR_WIDTH, maxX1));
    const newX2 = newX1 + _slider.offsetWidth;
    const begin = newX1 / _canvasSize.width;
    const end = newX2 / _canvasSize.width;

    _updateRange({ begin, end });
  }

  function _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX1 = 0;
    const maxX1 = _slider.offsetLeft + _slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const newX1 = Math.min(maxX1, Math.max(minX1, _capturedOffset + dragOffsetX));
    const begin = newX1 / _canvasSize.width;

    _updateRange({ begin });
  }

  function _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX2 = _slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = _canvasSize.width;

    const newX2 = Math.max(minX2, Math.min(_capturedOffset + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / _canvasSize.width;

    _updateRange({ end });
  }

  function _updateRange(range, isExternal) {
    const nextRange = Object.assign({}, _range, range);
    if (nextRange.begin === _range.begin && nextRange.end === _range.end) {
      return;
    }

    _range = nextRange;
    _updateRulerOnRaf();

    if (!isExternal) {
      rangeCallback(_range);
    }
  }

  function _updateRuler() {
    const { begin, end } = _range;

    _ruler.children[0].style.width = `${begin * 100}%`;
    _ruler.children[1].style.width = `${(end - begin) * 100}%`;
    _ruler.children[2].style.width = `${(1 - end) * 100}%`;
  }

  return { update };
}
