import { mergeArrays, getMaxMinBy, toYByX } from './fast';
import { buildIntegerLabels, buildDayLabels } from './labels';
import { Viewport } from './Viewport';
import { Axes } from './Axes';
import { Minimap } from './Minimap';
import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';

class LovelyChart {
  constructor(containerId, data) {
    this._data = data;

    this._setupContainer(containerId);

    this._analyzeData();
    this._setupViewport();

    this._setupPlot();
    // this._setupMinimap();
    // this._setupTools();
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

  _setupContainer(containerId) {
    this._container = document.getElementById(containerId);
    this._container.className = 'lovely-chart';
  }

  _setupViewport() {
    this._viewport = new Viewport(this._dataInfo, this._onViewportUpdate.bind(this));
  }

  _setupPlot() {
    const dpr = window.devicePixelRatio || 1;

    const plot = document.createElement('canvas');
    plot.width = this._container.clientWidth * dpr;
    plot.height = this._container.clientHeight * dpr;
    plot.style.width = '100%';
    plot.style.height = '100%';

    const context = plot.getContext('2d');
    context.scale(dpr, dpr);

    this._container.appendChild(plot);
    this._plot = plot;
    this._context = context;

    this._setupAxes();
  }

  _clearPlotCanvas() {
    this._context.clearRect(0, 0, this._plot.width, this._plot.height);
  }

  _setupAxes() {
    this._axes = new Axes(this._context, this._dataInfo, this._getPlotSize());
  }

  _setupMinimap() {
    // this._minimap = new Minimap();
  }

  _getPlotSize() {
    return this._plot.getBoundingClientRect();
  }

  _onViewportUpdate(viewportState) {
    this._clearPlotCanvas();

    this._drawAxes(viewportState);
    this._drawDatasets(viewportState);
  }

  _drawAxes(viewportState) {
    this._axes.draw(viewportState);
  }

  _drawDatasets(viewportState) {
    this._dataInfo.datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      drawDataset(
        this._context,
        valuesByLabelIndex,
        createProjectionFn(viewportState, this._getPlotSize()),
        this._data.options[i],
      );
    });
  }
}

LovelyChart.XTypeInteger = 1;
LovelyChart.XTypeDate = 2;
// No support
// LovelyChart.XTypeFloat = 3;

export default LovelyChart;
