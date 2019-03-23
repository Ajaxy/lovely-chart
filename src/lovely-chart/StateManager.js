import { TransitionManager } from './TransitionManager';
import { getMaxMin, mergeArrays } from './fast';
import { AXES_MAX_COLUMN_WIDTH, AXES_MAX_ROW_HEIGHT, X_AXIS_HEIGHT } from './constants';

const ANIMATE_PROPS = ['yMax', 'xAxisScale', 'yAxisScale', 'yMinFiltered', 'yMaxFiltered'];

export class StateManager {
  constructor(data, viewportSize, callback) {
    this._data = data;
    this._viewportSize = viewportSize;
    this._callback = callback;

    this._runCallback = this._runCallback.bind(this);

    this._range = { begin: 0, end: 1 };
    this._filter = this._buildDefaultFilter();
    this._animateProps = this._buildAnimateProps();
    this._state = {};

    this._transitions = new TransitionManager(this._runCallback);
  }

  update({ range = {}, filter = {} }) {
    Object.assign(this._range, range);
    Object.assign(this._filter, filter);

    const prevState = this._state;
    this._state = calculateState(this._data, this._viewportSize, this._range, this._filter, prevState);

    this._animateProps.forEach((prop) => {
      const transition = this._transitions.get(prop);
      const currentTarget = transition ? transition.to : prevState[prop];

      if (currentTarget !== undefined && currentTarget !== this._state[prop]) {
        const current = transition ? transition.current : prevState[prop];

        if (transition) {
          this._transitions.remove(prop);
        }

        this._transitions.add(prop, current, this._state[prop]);
      }
    });

    requestAnimationFrame(this._runCallback);
  }

  _buildAnimateProps() {
    return mergeArrays([
      ANIMATE_PROPS,
      this._data.datasets.map(({ key }) => `opacity#${key}`),
    ]);
  }

  _buildDefaultFilter() {
    const filter = {};

    this._data.datasets.forEach(({ key }) => {
      filter[key] = true;
    });

    return filter;
  }

  _runCallback() {
    this._callback({
      ...this._state,
      ...this._transitions.getState(),
    });
  }
}

function calculateState(data, viewportSize, range, filter, prevState) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length;
  const labelFromIndex = Math.max(0, Math.floor(totalXWidth * begin));
  const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * end));

  const filteredDatasets = filter ? data.datasets.filter(({ key }) => filter[key]) : data.datasets;
  const filteredValues = filteredDatasets.map(({ values }) => values);
  const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex));

  const { max: yMaxFiltered = prevState.yMaxFiltered } = getMaxMin(mergeArrays(filteredValues));
  const yMinFiltered = 0; // TODO maybe needed real
  const { max: yMaxViewport = prevState.yMax } = getMaxMin(mergeArrays(viewportValues));
  const yMinViewport = 0; // TODO maybe needed real

  const datasetsOpacity = {};

  if (filter) {
    data.datasets.forEach(({ key }) => {
      datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
    });
  }

  return {
    xShift: begin * totalXWidth,
    xWidth: (end - begin) * totalXWidth,
    yMinFiltered,
    yMaxFiltered,
    yMin: yMinViewport,
    yMax: yMaxViewport,
    xAxisScale: calculateXAxisScale(data.xLabels.length, viewportSize.width, begin, end),
    yAxisScale: calculateYAxisScale(viewportSize.height, yMinViewport, yMaxViewport),
    ...datasetsOpacity,
    ...range,
    filter,
  };
}

function calculateXAxisScale(labelsCount, plotWidth, begin, end) {
  const viewportPercent = end - begin;
  const viewportLabelsCount = labelsCount * viewportPercent;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);
  const hiddenLabelsFactor = viewportLabelsCount / maxColumns;

  return Math.ceil(Math.log2(hiddenLabelsFactor));
}

function calculateYAxisScale(plotHeight, yMin, yMax) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);
  const hiddenLabelsFactor = viewportLabelsCount / maxRows;

  return Math.ceil(Math.sqrt(hiddenLabelsFactor / 2));
}
