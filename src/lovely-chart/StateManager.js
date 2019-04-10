import { createTransitionManager } from './TransitionManager';
import { createThrottledUntilRaf, getMaxMin, mergeArrays, proxyMerge, sumArrays } from './fast';
import {
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  X_AXIS_HEIGHT,
  ANIMATE_PROPS,
  Y_AXIS_ZERO_BASED_THRESHOLD,
} from './constants';
import { buildSkinState } from './skin';
import { xStepToScaleLevel, yStepToScaleLevel } from './formulas';

export function createStateManager(data, viewportSize, callback) {
  const _data = data;
  const _viewportSize = viewportSize;
  const _callback = callback;

  const _range = { begin: 0, end: 1 };
  const _filter = _buildDefaultFilter();
  const _transitionConfig = _buildTransitionConfig();
  const _transitions = createTransitionManager(_runCallback);
  const _runCallbackOnRaf = createThrottledUntilRaf(_runCallback);

  let _state = {};

  function update({ range = {}, filter = {} } = {}) {
    Object.assign(_range, range);
    Object.assign(_filter, filter);

    const prevState = _state;
    _state = calculateState(_data, _viewportSize, _range, _filter, prevState);

    _transitionConfig.forEach(({ prop, duration, options }) => {
      const transition = _transitions.get(prop);
      const currentTarget = transition ? transition.to : prevState[prop];

      if (currentTarget !== undefined && currentTarget !== _state[prop]) {
        const current = transition
          ? (options.includes('fast') ? prevState[prop] : transition.current)
          : prevState[prop];

        if (transition) {
          _transitions.remove(prop);
        }

        _transitions.add(prop, current, _state[prop], duration, options);
      }
    });

    if (!_transitions.isRunning()) {
      _runCallbackOnRaf();
    }
  }

  function _buildTransitionConfig() {
    const transitionConfig = [];

    mergeArrays([
      ANIMATE_PROPS,
      _data.datasets.map(({ key }) => `opacity#${key}`),
    ]).forEach((transition) => {
      const [prop, duration, ...options] = transition.split(' ');
      // TODO size obj -> array;
      transitionConfig.push({ prop, duration, options });
    });

    return transitionConfig;
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

  const xAxisScale = calculateXAxisScale(data.xLabels.length, viewportSize.width, begin, end);

  const yRanges = data.isStacked
    ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState)
    : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);

  const yAxisScale = calculateYAxisScale(viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport);
  const yAxisScaleSecond = data.hasSecondYAxis &&
    calculateYAxisScale(viewportSize.height, yRanges.yMinViewportSecond, yRanges.yMaxViewportSecond);

  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  return Object.assign(
    {
      totalXWidth,
      xAxisScale,
      yAxisScale,
      yAxisScaleSecond,
      labelFromIndex: Math.max(0, labelFromIndex - 1),
      labelToIndex: Math.min(labelToIndex + 1, totalXWidth),
      filter,
    },
    yRanges,
    datasetsOpacity,
    buildSkinState(),
    range,
  );
}

function calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState) {
  const secondaryYAxisDataset = data.hasSecondYAxis && data.datasets.slice(-1)[0];

  const filteredDatasets = data.datasets.filter((d) => filter[d.key] && d !== secondaryYAxisDataset);
  const filteredValues = filteredDatasets.map(({ values }) => values);
  const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));

  // TODO perf cache
  const { min: yMinMinimapReal = prevState.yMinMinimap, max: yMaxMinimap = prevState.yMaxMinimap }
    = getMaxMin(mergeArrays(filteredValues));
  const yMinMinimap = yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapReal : 0;

  const { min: yMinViewportReal = prevState.yMinViewport, max: yMaxViewport = prevState.yMaxViewport }
    = getMaxMin(mergeArrays(viewportValues));
  const yMinViewport = yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportReal : 0;

  let yMinViewportSecond = null;
  let yMaxViewportSecond = null;
  let yMinMinimapSecond = null;
  let yMaxMinimapSecond = null;

  if (secondaryYAxisDataset && filter[secondaryYAxisDataset.key]) {
    // TODO perf cache
    const minimapMaxMin = getMaxMin(secondaryYAxisDataset.values);
    const yMinMinimapRealSecond = minimapMaxMin.min || prevState.yMinMinimapSecond;
    yMaxMinimapSecond = minimapMaxMin.max || prevState.yMaxMinimapSecond;
    yMinMinimapSecond =
      yMinMinimapRealSecond / yMaxMinimapSecond > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapRealSecond : 0;

    const viewportMaxMin = getMaxMin(secondaryYAxisDataset.values.slice(labelFromIndex, labelToIndex + 1));
    const yMinViewportRealSecond = viewportMaxMin.min || prevState.yMinViewportSecond;
    yMaxViewportSecond = viewportMaxMin.max || prevState.yMaxViewportSecond;
    yMinViewportSecond =
      yMinMinimapRealSecond / yMaxMinimapSecond > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportRealSecond : 0;
  }

  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap,
    yMinViewportSecond,
    yMaxViewportSecond,
    yMinMinimapSecond,
    yMaxMinimapSecond,
  };
}

function calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState) {
  const filteredDatasets = data.datasets.filter((d) => filter[d.key]);
  const filteredValues = filteredDatasets.map(({ values }) => values);

  const sums = filteredValues.length ? sumArrays(filteredValues) : [];
  // TODO perf cache
  const { max: yMaxMinimap = prevState.yMaxMinimap } = getMaxMin(sums);
  const { max: yMaxViewport = prevState.yMaxViewport } = getMaxMin(sums.slice(labelFromIndex, labelToIndex + 1));

  return {
    yMinViewport: 0,
    yMaxViewport,
    yMinMinimap: 0,
    yMaxMinimap,
  };
}

// TODO use labels indexes
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
