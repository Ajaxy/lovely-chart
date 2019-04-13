import { setupCanvas, clearCanvas } from './canvas';
import { drawDatasets } from './drawDatasets';
import { createProjection, setPercentage, setStacked } from './createProjection';
import { setupDrag } from './setupDrag';
import {
  DEFAULT_RANGE,
  MINIMAP_HEIGHT,
  MINIMAP_EAR_WIDTH,
  MINIMAP_RULER_HTML,
  MINIMAP_MARGIN,
  MINIMAP_LINE_WIDTH,
} from './constants';
import { createThrottledUntilRaf } from './fast';
import { createElement } from './minifiers';

export function createMinimap(container, data, palette, rangeCallback) {
  // TODO use scoped args
  const _container = container;
  const _data = data;
  const _palette = palette;
  const _rangeCallback = rangeCallback;

  let _element;
  let _canvas;
  let _context;
  let _canvasSize;
  let _ruler;
  let _slider;
  let _capturedOffset;
  let _range = {};
  let _state;

  const _updateRulerOnRaf = createThrottledUntilRaf(_updateRuler);

  _setupLayout();
  _updateRange(DEFAULT_RANGE);

  function update(newState) {
    const { begin, end } = newState;
    // TODO skip when is dragging
    _updateRange({ begin, end }, true);

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

    _container.appendChild(_element);

    _canvasSize = {
      width: _canvas.offsetWidth,
      height: _canvas.offsetHeight,
    };
  }

  function _getSize() {
    return {
      width: _container.offsetWidth - MINIMAP_MARGIN * 2,
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
    _ruler.innerHTML = MINIMAP_RULER_HTML;

    _slider = _ruler.children[1];

    setupDrag(
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onSliderDrag,
        draggingCursor: 'grabbing',
      },
    );

    setupDrag(
      _slider.children[0],
      {
        onCapture: _onDragCapture,
        onDrag: _onLeftEarDrag,
        draggingCursor: 'ew-resize',
      },
    );

    setupDrag(
      _slider.children[2],
      {
        onCapture: _onDragCapture,
        onDrag: _onRightEarDrag,
        draggingCursor: 'ew-resize',
      },
    );

    _element.appendChild(_ruler);
  }

  function _isStateChanged(newState) {
    if (!_state) {
      return true;
    }

    const keys = _data.datasets.map(({ key }) => `opacity#${key}`);
    keys.push('yMaxMinimap');

    return keys.some((key) => _state[key] !== newState[key]);
  }

  function _drawDatasets(state = {}) {
    const { datasets } = _data;
    const range = {
      from: 0,
      to: state.totalXWidth,
    };
    const projection = createProjection({
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: _canvasSize.width,
      availableHeight: _canvasSize.height,
      yPadding: 1,
    });
    const visibilities = datasets.map(({ key }) => {
      return Math.max(0, Math.min(state[`opacity#${key}`] * 2 - 1, 1));
    });

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
      secondaryProjection = projection.copy({ yMin: state.yMinMinimapSecond, yMax: state.yMaxMinimapSecond });
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      secondaryCoords = secondaryProjection.prepareCoords([secondaryDataset], range)[0];
    }

    drawDatasets(
      _context, state, _data, range, projection, coords, secondaryCoords, MINIMAP_LINE_WIDTH, visibilities, _palette
    );
  }

  function _onDragCapture(e) {
    _capturedOffset = e.target.offsetLeft;
  }

  function _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minimapWidth = _canvas.offsetWidth;

    const minX1 = 0;
    const maxX1 = minimapWidth - _slider.offsetWidth;

    const newX1 = Math.max(minX1, Math.min(_capturedOffset + dragOffsetX, maxX1));
    const newX2 = newX1 + _slider.offsetWidth;
    const begin = newX1 / minimapWidth;
    const end = newX2 / minimapWidth;

    _updateRange({ begin, end });
  }

  function _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minimapWidth = _canvas.offsetWidth;

    const minX1 = 0;
    const maxX1 = _slider.offsetLeft + _slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const newX1 = Math.min(maxX1, Math.max(minX1, _capturedOffset + dragOffsetX));
    const begin = newX1 / minimapWidth;

    _updateRange({ begin });
  }

  function _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minimapWidth = _canvas.offsetWidth;

    const minX2 = _slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = minimapWidth;

    const newX2 = Math.max(minX2, Math.min(_capturedOffset + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / minimapWidth;

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
      _rangeCallback(_range);
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
