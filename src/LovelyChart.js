import CanvasScales from './CanvasScales';
import { buildIntegerLabels, buildDayLabels } from './labels';
import { mergeArrays, getMaxMinBy, toYByX } from './fast';
import { getState } from './state';
import { drawChart } from './DatasetChart';
import { Viewport } from './Viewport';

class LovelyChart {
  constructor(containerId, data) {
    const container = document.getElementById(containerId);

    if (!container) {
      throw new Error('Container not found');
    }

    this._container = container;
    this._data = data;

    this._analyzeData();
    this._setupCanvas();
    this._setupViewport();
    this._setupScales();
  }

  _setViewport({ begin, end }) {
    this._viewport.update({ begin, end });
  }

  _analyzeData() {
    const { datasets } = this._data;

    const merged = mergeArrays(datasets);
    const { min: yMin, max: yMax } = getMaxMinBy(merged, 'y');

    const firsts = datasets.map((dataset) => dataset[0]);
    const lasts = datasets.map((dataset) => dataset[dataset.length - 1]);
    const { min: xMin } = getMaxMinBy(firsts, 'x');
    const { max: xMax } = getMaxMinBy(lasts, 'x');

    const dataInfo = {
      xLabels: [],
      yMin,
      yMax,
      xMin,
      xMax,
    };

    if (this._data.xType === LovelyChart.XTypeDate) {
      dataInfo.xLabels = buildDayLabels(dataInfo.xMin, dataInfo.xMax);
    } else {
      dataInfo.xLabels = buildIntegerLabels(dataInfo.xMin, dataInfo.xMax);
    }

    dataInfo.yLabels = buildIntegerLabels(dataInfo.yMin, dataInfo.yMax);

    dataInfo.datasetsByLabelIndex = datasets.map((dataset) => {
      const valuesByLabel = toYByX(dataset);
      return dataInfo.xLabels.map((label) => valuesByLabel[String(label.value)]);
    });

    this._dataInfo = dataInfo;
  }

  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.width = this._container.clientWidth * dpr;
    canvas.height = this._container.clientHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);

    this._container.appendChild(canvas);
    this._canvas = canvas;
    this._context = context;
  }

  _clearCanvas() {
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  _setupViewport() {
    const canvasSize = this._canvas.getBoundingClientRect();
    this._viewport = new Viewport(this._dataInfo, this._onViewportUpdate.bind(this));
  }

  _setupScales() {
    this._scales = new CanvasScales(this._canvas, this._context);
    this._scales.setData(this._data, this._dataInfo);
  }

  _onViewportUpdate(viewportData) {
    this._clearCanvas();

    this._drawScales(viewportData);
    this._drawPlots(viewportData);
  }

  _drawScales(viewportData) {
    this._scales.setViewport(viewportData);
    this._scales.draw();
  }

  _drawPlots(viewportData) {
    const { datasetsByLabelIndex } = this._dataInfo;
    const canvasSize = this._canvas.getBoundingClientRect();
    const state = getState(viewportData, canvasSize);

    datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      drawChart(this._canvas, this._context, valuesByLabelIndex, state, this._data.options[i]);
    });
  }
}

LovelyChart.XTypeInteger = 1;
LovelyChart.XTypeDate = 2;
// No support
// LovelyChart.XTypeFloat = 3;

export default LovelyChart;
