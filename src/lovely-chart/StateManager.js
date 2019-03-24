import { createTransitionManager } from './TransitionManager';
import { createThrottledUntilRaf, getMaxMin, mergeArrays } from './fast';
import {
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  X_AXIS_HEIGHT,
  ANIMATE_PROPS,
  PREDICTION_FACTOR,
} from './constants';
import { buildSkinState } from './skin';

export function createStateManager(data, viewportSize, callback) {
  const _data = data;
  const _viewportSize = viewportSize;
  const _callback = callback;

  const _range = { begin: 0, end: 1 };
  const _filter = _buildDefaultFilter();
  const _animateProps = _buildAnimateProps();
  const _transitions = createTransitionManager(_runCallback);
  const _runCallbackOnRaf = createThrottledUntilRaf(_runCallback);

  let _state = {};

  function update({ range = {}, filter = {} } = {}) {
    Object.assign(_range, range);
    Object.assign(_filter, filter);

    const prevState = _state;
    _state = calculateState(_data, _viewportSize, _range, _filter, prevState);

    _animateProps.forEach((prop) => {
      const transition = _transitions.get(prop);
      const currentTarget = transition ? transition.to : prevState[prop];

      if (currentTarget !== undefined && currentTarget !== _state[prop]) {
        const current = transition ? transition.current : prevState[prop];

        if (transition) {
          _transitions.remove(prop);
        }

        _transitions.add(prop, current, _state[prop]);
      }
    });

    if (!_transitions.isRunning()) {
      _runCallbackOnRaf();
    }
  }

  function _buildAnimateProps() {
    return mergeArrays([
      ANIMATE_PROPS,
      _data.datasets.map(({ key }) => `opacity#${key}`),
    ]);
  }

  function _buildDefaultFilter() {
    const filter = {};

    _data.datasets.forEach(({ key }) => {
      filter[key] = true;
    });

    return filter;
  }

  function _runCallback() {
    _callback({
      ..._state,
      ..._transitions.getState(),
    });
  }

  return { update };
}

function calculateState(data, viewportSize, range, filter, prevState) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length - 1;
  const labelFromIndex = Math.max(0, Math.ceil(totalXWidth * begin));
  const labelToIndex = Math.min(totalXWidth, Math.floor(totalXWidth * end));

  // const [predictedLabelFromIndex, predictedLabelToIndex]
  //   = calculatePredictions(totalXWidth, begin, end, prevState, labelFromIndex, labelToIndex);

  const filteredDatasets = data.datasets.filter(({ key }) => filter[key]);
  const filteredValues = filteredDatasets.map(({ values }) => values);
  const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));
  const { max: yMaxFiltered = prevState.yMaxFiltered } = getMaxMin(mergeArrays(filteredValues));
  const yMinFiltered = 0;
  const { max: yMaxViewport = prevState.yMax } = getMaxMin(mergeArrays(viewportValues));
  const yMinViewport = 0;

  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  return {
    xOffset: begin * totalXWidth,
    xWidth: (end - begin) * totalXWidth,
    yMinFiltered,
    yMaxFiltered,
    yMin: yMinViewport,
    yMax: yMaxViewport,
    xAxisScale: calculateXAxisScale(data.xLabels.length, viewportSize.width, begin, end),
    yAxisScale: calculateYAxisScale(viewportSize.height, yMinViewport, yMaxViewport),
    labelFromIndex,
    labelToIndex,
    ...datasetsOpacity,
    ...buildSkinState(),
    ...range,
    filter,
  };
}

function calculatePredictions(totalXWidth, begin, end, prevState, labelFromIndex, labelToIndex) {
  const progress = end - begin;
  const dBegin = Math.max(-0.35, Math.min((begin - prevState.begin) * PREDICTION_FACTOR, 0.35));
  const dEnd = Math.max(-0.35, Math.min((end - prevState.end) * PREDICTION_FACTOR, 0.35));
  const predictedBegin = Math.max(0, Math.min(begin + dBegin, 1 - progress));
  const predictedEnd = Math.max(progress, Math.min(end + dEnd, 1));
  const predictedLabelFromIndex = Math.abs(dBegin) > 0.1 ?
    Math.max(0, Math.ceil(totalXWidth * predictedBegin)) :
    labelFromIndex;
  const predictedLabelToIndex = Math.abs(dEnd) > 0.1 ?
    Math.max(0, Math.ceil(totalXWidth * predictedEnd)) :
    labelToIndex;

  return [predictedLabelFromIndex, predictedLabelToIndex];
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
