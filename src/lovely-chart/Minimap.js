import { setupCanvas, clearCanvas } from './canvas';
import { drawDataset } from './drawDataset';
import { createProjection } from './createProjection';
import { setupDrag } from './setupDrag';
import { DEFAULT_RANGE, MINIMAP_HEIGHT, MINIMAP_EAR_WIDTH, MINIMAP_RULER_HTML, MINIMAP_MARGIN } from './constants';

export function createMinimap(container, data, rangeCallback) {
  const _container = container;
  const _data = data;
  const _rangeCallback = rangeCallback;

  let _element;
  let _canvas;
  let _context;
  let _ruler;
  let _slider;
  let _capturedOffset;
  let _range;

  _setupLayout();
  _updateRange(DEFAULT_RANGE);

  function update(state) {
    clearCanvas(_canvas, _context);
    _drawDatasets(state);
  }

  function _setupLayout() {
    _element = document.createElement('div');

    _element.className = 'minimap';
    _element.style.height = `${MINIMAP_HEIGHT}px`;

    _setupCanvas();
    _setupRuler();

    _container.appendChild(_element);
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
    _ruler = document.createElement('div');
    _ruler.className = 'ruler';
    _ruler.innerHTML = MINIMAP_RULER_HTML;

    _slider = _ruler.children[1];

    setupDrag(
      _slider,
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
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onRightEarDrag,
        draggingCursor: 'ew-resize',
      },
    );

    _element.appendChild(_ruler);
  }

  function _drawDatasets(state = {}) {
    const canvasSize = _getCanvasSize();

    _data.datasets.forEach(({ key, color, values }) => {
      const opacity = state[`opacity#${key}`];
      // By video prototype hiding dataset does not expand.
      // TODO lags on the last chart
      const shouldUseYTotal = _shouldUseYTotal(state, key);
      const bounds = {
        xOffset: 0,
        xWidth: _data.xLabels.length,
        yMin: shouldUseYTotal ? _data.yMin : state.yMinFiltered,
        yMax: shouldUseYTotal ? _data.yMax : state.yMaxFiltered,
      };
      const projection = createProjection(bounds, canvasSize);
      const options = {
        color,
        opacity,
        lineWidth: 1,
      };

      drawDataset(_context, values, projection, options);
    });
  }

  function _getCanvasSize() {
    return { width: _canvas.offsetWidth, height: _canvas.offsetHeight };
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

  function _updateRange(range) {
    _range = Object.assign(_range || {}, range);
    const { begin, end } = _range;

    // TODO throttle until next raf
    requestAnimationFrame(() => {
      _ruler.children[0].style.width = `${begin * 100}%`;
      _ruler.children[1].style.width = `${(end - begin) * 100}%`;
      _ruler.children[2].style.width = `${(1 - end) * 100}%`;
    });

    _rangeCallback({ begin, end });
  }

  function _shouldUseYTotal(state, key) {
    if (state.filter) {
      const opacity = state[`opacity#${key}`];
      const totalShown = Object.values(state.filter).filter((v) => v === true).length;
      const currentShowing = state.filter[key];
      const othersShown = currentShowing ? totalShown > 1 : totalShown > 0;
      return opacity < 1 && othersShown;
    }

    return false;
  }

  return { update };
}
