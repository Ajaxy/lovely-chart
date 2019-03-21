import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';
import { calculateState } from './calculateState';
import { setupDrag } from './setupDrag';
import { setupCanvas } from './setupCanvas';
import { DEFAULT_RANGE, MINIMAP_HEIGHT, MINIMAP_EAR_WIDTH, MINIMAP_RULER_HTML } from './constants';

export class Minimap {
  constructor(container, dataInfo, dataOptions, rangeCallback) {
    this._container = container;
    this._dataInfo = dataInfo;
    this._dataOptions = dataOptions;
    this._rangeCallback = rangeCallback;

    this._onDragCapture = this._onDragCapture.bind(this);
    this._onSliderDrag = this._onSliderDrag.bind(this);
    this._onLeftEarDrag = this._onLeftEarDrag.bind(this);
    this._onRightEarDrag = this._onRightEarDrag.bind(this);

    this._setupLayout();
    this._drawDatasets();
    this._updateRange(DEFAULT_RANGE);
  }

  _setupLayout() {
    const element = document.createElement('div');

    element.className = 'minimap';
    element.appendChild(this._setupCanvas());
    element.appendChild(this._setupRuler());

    this._container.appendChild(element);
  }

  _setupCanvas() {
    const width = this._container.clientWidth;

    const { canvas, context } = setupCanvas({ width, height: MINIMAP_HEIGHT });

    this._canvas = canvas;
    this._context = context;

    return canvas;
  }

  _setupRuler() {
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

    return ruler;
  }

  _drawDatasets() {
    const state = calculateState(this._dataInfo);

    this._dataInfo.datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      const options = {
        color: this._dataOptions[i].color,
        lineWidth: 1,
      };

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
    const containerWidth = this._container.clientWidth;
    const slider = this._ruler.children[1];

    const minX1 = 0;
    const maxX1 = containerWidth - slider.offsetWidth;

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
    const newX1 = Math.min(maxX1, Math.max(minX1, pointerMinimapOffset - captureEvent.offsetX));
    const newX2 = newX1 + slider.offsetWidth;
    const begin = newX1 / containerWidth;
    const end = newX2 / containerWidth;

    this._updateRange({ begin, end });
  }

  _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const containerWidth = this._container.clientWidth;
    const slider = this._ruler.children[1];

    const minX1 = 0;
    const maxX1 = slider.offsetLeft + slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
    const newX1 = Math.min(maxX1, Math.max(minX1, pointerMinimapOffset - captureEvent.offsetX));
    const begin = newX1 / containerWidth;

    this._updateRange({ begin });
  }

  _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const containerWidth = this._container.clientWidth;
    const slider = this._ruler.children[1];

    const minX2 = slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = containerWidth;

    const pointerMinimapOffset = this._dragCapturePointerMinimapOffset + dragOffsetX;
    const newX2 = Math.min(maxX2, Math.max(minX2, pointerMinimapOffset - captureEvent.offsetX));
    const end = newX2 / containerWidth;

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
