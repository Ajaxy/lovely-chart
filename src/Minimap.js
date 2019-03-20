import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';
import { getMaxMin } from './fast';
import { calculateState } from './calculateState';

const MINIMAP_HEIGHT = 50;

export class Minimap {
  constructor(container, dataInfo, dataOptions) {
    this._dataInfo = dataInfo;
    this._dataOptions = dataOptions;

    this._setupLayout(container);
    this._drawDatasets();
  }

  _setupLayout(container) {
    this._setupCanvas(container);

    const element = document.createElement('div');
    element.className = 'minimap';
    element.appendChild(this._canvas);
    element.appendChild(this._buildRuler());
    container.appendChild(element);
  }

  _setupCanvas(container) {
    const dpr = window.devicePixelRatio || 1;

    const width = container.clientWidth;
    const height = MINIMAP_HEIGHT;

    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);

    this._canvas = canvas;
    this._context = context;
  }

  _buildRuler() {
    const ruler = document.createElement('div');

    ruler.className = 'ruler';
    ruler.innerHTML = '<div class="mask"></div><div class="slider"></div><div class="mask"></div>';

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
}
