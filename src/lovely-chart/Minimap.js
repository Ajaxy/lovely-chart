import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';
import { calculateState } from './calculateState';
import { setupDrag } from './setupDrag';
import { setupCanvas } from './setupCanvas';
import { DEFAULT_RANGE, MINIMAP_HEIGHT, MINIMAP_EAR_WIDTH, MINIMAP_RULER_HTML, MINIMAP_MARGIN } from './constants';

export class Minimap {
  constructor(container, dataInfo, rangeCallback) {
    this._container = container;
    this._dataInfo = dataInfo;
    this._rangeCallback = rangeCallback;

    this._onDragCapture = this._onDragCapture.bind(this);
    this._onSliderDrag = this._onSliderDrag.bind(this);
    this._onLeftEarDrag = this._onLeftEarDrag.bind(this);
    this._onRightEarDrag = this._onRightEarDrag.bind(this);

    this._setupLayout();
    this._updateRange(DEFAULT_RANGE);
    this._drawDatasets();
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

  _drawDatasets() {
    const state = calculateState(this._dataInfo, this._getCanvasSize(), { begin: 0, end: 1 });

    this._dataInfo.datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      const options = {
        color: this._dataInfo.options[i].color,
        lineWidth: 1,
      };

      // TODO console 12 times
      drawDataset(
        this._context,
        valuesByLabelIndex,
        createProjectionFn(state, this._getCanvasSize()),
        options,
      );
    });
  }

  _getCanvasSize() {
    return this._canvas.getBoundingClientRect();
  }

  _onDragCapture(e) {
    this._dragCapturePointerMinimapOffset = e.offsetX + e.target.offsetLeft;
  }

  _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const { width: minimapWidth } = this._getSize();
    const slider = this._ruler.children[1];

    const minX1 = 0;
    const maxX1 = minimapWidth - slider.offsetWidth;

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
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

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
    const newX1 = Math.min(maxX1, Math.max(minX1, pointerMinimapOffset - captureEvent.offsetX));
    const begin = newX1 / minimapWidth;

    this._updateRange({ begin });
  }

  // TODO jumps
  _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const { width: minimapWidth } = this._getSize();
    const slider = this._ruler.children[1];

    const minX2 = slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = minimapWidth;

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
    const newX2 = Math.min(maxX2, Math.max(minX2, pointerMinimapOffset - captureEvent.offsetX));
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
}
