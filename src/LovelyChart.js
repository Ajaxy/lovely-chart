import CanvasScales from './CanvasScales';
import { buildIntegerLabels, buildDayLabels } from './labels';
import { mergeArrays, getMaxMinBy, toYByX } from './fast';
import { getState } from './state';
import { drawChart } from './DatasetChart';

class LovelyChart {
  constructor(containerId, data) {
    const container = document.getElementById(containerId);

    if (!container) {
      throw new Error('Container not found');
    }

    this._container = container;
    this._data = data;

    this._analyzeData();

    this._viewport = {
      begin: 0,
      end: 1,
      yFrom: 0,
      yTo: this._dataInfo.yLabels.length - 1,
    };

    this._setupCanvas();
    this._drawScales();
    this._drawPlots();
  }

  _setViewport({ begin, end, yFrom, yTo }) {
    const viewport = this._viewport;

    // TODO Use for optimization
    // let isXChanged = false;
    // TODO Animate Y scale level change
    // let isYChanged = false;

    function findLastBefore(labels, value) {
      return labels.find((label) => label.value >= label.value);
    }

    function findFirstAfter(labels, value) {

    }

    if (begin !== undefined) {
      viewport.begin = begin;
      // isXChanged = true;
    }

    if (end !== undefined) {
      viewport.end = end;
      // isXChanged = true;
    }

    // TODO Move outta here
    const { datasetsByLabelIndex } = this._dataInfo;
    const canvasSize = this._canvas.getBoundingClientRect();
    const { yMin, yMax } = getState(this._viewport, datasetsByLabelIndex, this._dataInfo, canvasSize);

    viewport.yFrom = yMin;
    viewport.yTo = yMax;

    this._clearCanvas();

    this._scales.setViewport(viewport);
    this._scales.draw();

    this._drawPlots();
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

  _drawScales() {
    this._scales = new CanvasScales(this._canvas, this._context);
    this._scales.setData(this._data, this._dataInfo);
    this._scales.setViewport(this._viewport);
    this._scales.draw();
  }

  _drawPlots() {
    const { datasetsByLabelIndex } = this._dataInfo;
    const canvasSize = this._canvas.getBoundingClientRect();
    const state = getState(this._viewport, datasetsByLabelIndex, this._dataInfo, canvasSize);

    datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      drawChart(this._canvas, this._context, valuesByLabelIndex, this._dataInfo, state, this._data.options[i]);
    });
  }
}

LovelyChart.XTypeInteger = 1;
LovelyChart.XTypeDate = 2;
// No support
// LovelyChart.XTypeFloat = 3;

export default LovelyChart;
