import { drawDataset } from './drawDataset';
import { createProjection } from './createProjection';
import { setupDrag } from './setupDrag';
import { setupCanvas } from './setupCanvas';
import { DEFAULT_RANGE, MINIMAP_HEIGHT, MINIMAP_EAR_WIDTH, MINIMAP_RULER_HTML, MINIMAP_MARGIN } from './constants';

export class Minimap {
  constructor(container, data, rangeCallback) {
    this._container = container;
    this._data = data;
    this._rangeCallback = rangeCallback;

    this._onDragCapture = this._onDragCapture.bind(this);
    this._onSliderDrag = this._onSliderDrag.bind(this);
    this._onLeftEarDrag = this._onLeftEarDrag.bind(this);
    this._onRightEarDrag = this._onRightEarDrag.bind(this);

    this._setupLayout();
    this._updateRange(DEFAULT_RANGE);
  }

  update(state) {
    this._clearCanvas();
    this._drawDatasets(state);
  }

  _setupLayout() {
    const element = document.createElement('div');
    this._element = element;

    element.className = 'minimap';
    element.style.height = `${MINIMAP_HEIGHT}px`;

    this._setupCanvas(element);
    this._setupRuler(element);

    this._container.appendChild(element);
  }

  _getSize() {
    return {
      width: this._container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT,
    };
  }

  _setupCanvas(element) {
    const { canvas, context } = setupCanvas(element, this._getSize());

    this._canvas = canvas;
    this._context = context;
  }

  _clearCanvas() {
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  _setupRuler(element) {
    const ruler = document.createElement('div');
    ruler.className = 'ruler';
    ruler.innerHTML = MINIMAP_RULER_HTML;

    const slider = ruler.children[1];

    setupDrag(
      slider,
      {
        onCapture: this._onDragCapture,
        onDrag: this._onSliderDrag,
        draggingCursor: 'grabbing',
      },
    );

    setupDrag(
      slider.children[0],
      {
        onCapture: this._onDragCapture,
        onDrag: this._onLeftEarDrag,
        draggingCursor: 'ew-resize',
      },
    );

    setupDrag(
      slider.children[1],
      {
        onCapture: this._onDragCapture,
        onDrag: this._onRightEarDrag,
        draggingCursor: 'ew-resize',
      },
    );

    this._ruler = ruler;

    element.appendChild(ruler);
  }

  _drawDatasets(state = {}) {
    this._data.datasets.forEach(({ key, color, values }) => {
      const opacity = state[`opacity#${key}`];
      // By video prototype hiding dataset does not expand.
      const shouldUseYTotal = this._shouldUseYTotal(state, key);
      const bounds = {
        xOffset: 0,
        xWidth: this._data.xLabels.length,
        yMin: shouldUseYTotal ? this._data.yMin : state.yMinFiltered,
        yMax: shouldUseYTotal ? this._data.yMax : state.yMaxFiltered,
      };
      const projection = createProjection(bounds, this._getCanvasSize());
      const options = {
        color,
        opacity,
        lineWidth: 1,
      };

      drawDataset(this._context, values, projection, options);
    });
  }

  _getCanvasSize() {
    return this._canvas.getBoundingClientRect();
  }

  _onDragCapture(e) {
    this._capturedMinimapOffset = e.offsetX + e.target.offsetLeft;
  }

  _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const { width: minimapWidth } = this._getSize();
    const slider = this._ruler.children[1];

    const minX1 = 0;
    const maxX1 = minimapWidth - slider.offsetWidth;

    const pointerMinimapOffset = this._capturedMinimapOffset + dragOffsetX;
    const newX1 = Math.min(maxX1, Math.max(minX1, pointerMinimapOffset - captureEvent.offsetX));
    const newX2 = newX1 + slider.offsetWidth;
    const begin = newX1 / minimapWidth;
    const end = newX2 / minimapWidth;

    this._updateRange({ begin, end });
  }

  _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const { width: minimapWidth } = this._getSize();
    const slider = this._ruler.children[1];

    const minX1 = 0;
    const maxX1 = slider.offsetLeft + slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const pointerMinimapOffset = this._capturedMinimapOffset + dragOffsetX;
    const newX1 = Math.min(maxX1, Math.max(minX1, pointerMinimapOffset - captureEvent.offsetX));
    const begin = newX1 / minimapWidth;

    this._updateRange({ begin });
  }

  _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const { width: minimapWidth } = this._getSize();
    const slider = this._ruler.children[1];

    const minX2 = slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = minimapWidth;

    const pointerMinimapOffset = this._capturedMinimapOffset + dragOffsetX;
    const newX2 = Math.max(minX2, Math.min((pointerMinimapOffset - captureEvent.offsetX) + MINIMAP_EAR_WIDTH, maxX2));
    const end = newX2 / minimapWidth;

    this._updateRange({ end });
  }

  _updateRange(range) {
    this._range = Object.assign(this._range || {}, range);
    const { begin, end } = this._range;

    // TODO perf remove raf
    requestAnimationFrame(() => {
      this._ruler.children[0].style.width = `${begin * 100}%`;
      this._ruler.children[1].style.width = `${(end - begin) * 100}%`;
      this._ruler.children[2].style.width = `${(1 - end) * 100}%`;
    });

    this._rangeCallback({ begin, end });
  }

  _shouldUseYTotal(state, key) {
    if (state.filter) {
      const opacity = state[`opacity#${key}`];
      const totalShown = Object.values(state.filter).filter((v) => v === true).length;
      const currentShowing = state.filter[key];
      const othersShown = currentShowing ? totalShown > 1 : totalShown > 0;
      return opacity < 1 && othersShown;
    }

    return false;
  }
}
