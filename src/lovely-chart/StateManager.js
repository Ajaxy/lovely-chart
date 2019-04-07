import { createTransitionManager } from './TransitionManager';
import { createThrottledUntilRaf, getMaxMin, mergeArrays, proxyMerge } from './fast';
import {
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  X_AXIS_HEIGHT,
  ANIMATE_PROPS,
} from './constants';
import { buildSkinState } from './skin';
import { xStepToScaleLevel, yStepToScaleLevel } from './formulas';

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
    _callback(proxyMerge(_state, _transitions.getState()));
  }

  return { update };
}

function calculateState(data, viewportSize, range, filter, prevState) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length - 1;

  const labelFromIndex = Math.max(0, Math.ceil(totalXWidth * begin));
  const labelToIndex = Math.min(Math.floor(totalXWidth * end), totalXWidth);

  const filteredValues = data.datasets.filter(({ key }) => filter[key]).map(({ values }) => values);
  const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));

  const { min: yMinFilteredReal = prevState.yMinFiltered, max: yMaxFiltered = prevState.yMaxFiltered }
    = getMaxMin(mergeArrays(filteredValues));
  const yMinFiltered = yMinFilteredReal / yMaxFiltered > 0.5 ? yMinFilteredReal : 0;

  const { min: yMinViewportReal = prevState.yMin, max: yMaxViewport = prevState.yMax }
    = getMaxMin(mergeArrays(viewportValues));
  const yMinViewport = yMinFilteredReal / yMaxFiltered > 0.5 ? yMinViewportReal : 0;

  const xAxisScale = calculateXAxisScale(data.xLabels.length, viewportSize.width, begin, end);
  const yAxisScale = calculateYAxisScale(viewportSize.height, yMinViewport, yMaxViewport);

  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  return Object.assign(
    {
      xOffset: begin * totalXWidth,
      xWidth: (end - begin) * totalXWidth,
      yMinFiltered,
      yMaxFiltered,
      yMin: yMinViewport,
      yMax: yMaxViewport,
      xAxisScale,
      yAxisScale,
      labelFromIndex: Math.max(0, labelFromIndex - 1),
      labelToIndex: Math.min(labelToIndex + 1, totalXWidth),
      filter,
    },
    datasetsOpacity,
    buildSkinState(),
    range,
  );
}

function calculateXAxisScale(labelsCount, plotWidth, begin, end) {
  const viewportLabelsCount = labelsCount * (end - begin);
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);

  return xStepToScaleLevel(viewportLabelsCount / maxColumns);
}

function calculateYAxisScale(plotHeight, yMin, yMax) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);

  return yStepToScaleLevel(viewportLabelsCount / maxRows);
}
