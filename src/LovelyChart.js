import { mergeArrays, getMaxMinBy, toYByX } from './fast';
import { buildIntegerLabels, buildDayLabels } from './labels';
import { Viewport } from './Viewport';
import { Axes } from './Axes';
import { Minimap } from './Minimap';
import { drawDataset } from './drawDataset';
import { createProjectionFn } from './createProjectionFn';
import { X_SCALE_HEIGHT } from './constants';

const WH_RATIO = (2 / 3);

class LovelyChart {
  constructor(parentContainerId, data) {
    this._data = data;

    this._onViewportUpdate = this._onViewportUpdate.bind(this);
    this._onRangeChange = this._onRangeChange.bind(this);

    this._setupContainer(parentContainerId);

    this._analyzeData();
    this._setupViewport();

    this._setupPlot();
    this._setupMinimap();
    // this._setupTools();
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

  _setupContainer(parentContainerId) {
    const container = document.createElement('div');
    container.className = 'lovely-chart';

    const parentContainer = document.getElementById(parentContainerId);
    parentContainer.appendChild(container);

    this._container = container;
  }

  _setupViewport() {
    this._viewport = new Viewport(this._dataInfo, this._onViewportUpdate);
  }

  _setupPlot() {
    const dpr = window.devicePixelRatio || 1;

    const width = this._container.clientWidth;
    const height = width * WH_RATIO;

    const plot = document.createElement('canvas');
    plot.className = 'plot';
    plot.width = width * dpr;
    plot.height = height * dpr;
    plot.style.width = '100%';
    plot.style.height = `${height}px`;

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
    this._minimap = new Minimap(this._container, this._dataInfo, this._data.options, this._onRangeChange);
  }

  _getPlotSize() {
    return this._plot.getBoundingClientRect();
  }

  _onViewportUpdate(state) {
    this._clearPlotCanvas();

    this._drawAxes(state);
    this._drawDatasets(state);
  }

  _drawAxes(state) {
    this._axes.draw(state);
  }

  _drawDatasets(state) {
    const { width, height } = this._getPlotSize();
    const availableSize = {
      width,
      height: height - X_SCALE_HEIGHT,
    };

    this._dataInfo.datasetsByLabelIndex.forEach((valuesByLabelIndex, i) => {
      const options = {
        color: this._data.options[i].color,
        lineWidth: 2,
      };

      drawDataset(
        this._context,
        valuesByLabelIndex,
        createProjectionFn(state, availableSize),
        options,
      );
    });
  }

  _onRangeChange(range) {
    this._viewport.update(range);
  }
}

LovelyChart.XTypeInteger = 1;
LovelyChart.XTypeDate = 2;
// No support
// LovelyChart.XTypeFloat = 3;

export default LovelyChart;
