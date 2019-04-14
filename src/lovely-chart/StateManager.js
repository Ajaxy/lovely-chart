import { createTransitionManager } from './TransitionManager';
import { throttleWithRaf, getMaxMin, mergeArrays, proxyMerge, sumArrays } from './fast';
import {
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  X_AXIS_HEIGHT,
  ANIMATE_PROPS,
  Y_AXIS_ZERO_BASED_THRESHOLD,
} from './constants';
import { buildSkinState, buildSkinStateKeys } from './skin';
import { xStepToScaleLevel, yScaleLevelToStep, yStepToScaleLevel } from './formulas';

export function createStateManager(data, viewportSize, callback) {
  const _data = data;
  const _viewportSize = viewportSize;
  const _callback = callback;

  const _range = { begin: 0, end: 1 };
  const _filter = _buildDefaultFilter();
  const _transitionConfig = _buildTransitionConfig();
  const _transitions = createTransitionManager(_runCallback);
  const _runCallbackOnRaf = throttleWithRaf(_runCallback);

  let _state = {};

  function update({ range = {}, filter = {} } = {}, noTransition) {
    Object.assign(_range, range);
    Object.assign(_filter, filter);

    const prevState = _state;
    _state = calculateState(_data, _viewportSize, _range, _filter, prevState);

    if (!noTransition) {
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
    }

    if (!_transitions.isRunning()) {
      _runCallbackOnRaf();
    }
  }

  function _buildTransitionConfig() {
    const transitionConfig = [];
    // TODO too fast, not synced on area charts
    const datasetVisibilities = _data.datasets.map(({ key }) => `opacity#${key} 200`);
    const skinColors = buildSkinStateKeys().map((key) => `${key} 300`);

    mergeArrays([
      ANIMATE_PROPS,
      datasetVisibilities,
      skinColors,
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

  const xAxisScale = calculateXAxisScale(viewportSize.width, labelFromIndex, labelToIndex);

  const yRanges = data.isStacked
    ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState)
    : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);

  const yAxisScale = calculateYAxisScale(viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport);
  const yAxisScaleSecond = data.hasSecondYAxis &&
    calculateYAxisScale(viewportSize.height, yRanges.yMinViewportSecond, yRanges.yMaxViewportSecond);

  const yStep = yScaleLevelToStep(yAxisScale);
  yRanges.yMinViewport -= yRanges.yMinViewport % yStep;

  if (yAxisScaleSecond) {
    const yStepSecond = yScaleLevelToStep(yAxisScaleSecond);
    yRanges.yMinViewportSecond -= yRanges.yMinViewportSecond % yStepSecond;
  }

  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  // TODO perf
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
    // TODO perf ?
    buildSkinState(),
    range,
  );
}

function calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState) {
  const secondaryYAxisDataset = data.hasSecondYAxis && data.datasets.slice(-1)[0];
  const filteredDatasets = data.datasets.filter((d) => filter[d.key] && d !== secondaryYAxisDataset);

  const yRanges = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, filteredDatasets);

  if (secondaryYAxisDataset) {
    const group = filter[secondaryYAxisDataset.key] ? [secondaryYAxisDataset] : [];
    const {
      yMinViewport: yMinViewportSecond,
      yMaxViewport: yMaxViewportSecond,
      yMinMinimap: yMinMinimapSecond,
      yMaxMinimap: yMaxMinimapSecond,
    } = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, [secondaryYAxisDataset]);

    Object.assign(yRanges, {
      yMinViewportSecond,
      yMaxViewportSecond,
      yMinMinimapSecond,
      yMaxMinimapSecond,
    });
  }

  return yRanges;
}

function calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, datasets) {
  const { min: yMinMinimapReal = prevState.yMinMinimap, max: yMaxMinimap = prevState.yMaxMinimap }
    = getMaxMin(mergeArrays(datasets.map(({ yMax, yMin }) => [yMax, yMin])));
  const yMinMinimap = yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapReal : 0;

  let yMinViewport;
  let yMaxViewport;

  if (labelFromIndex === 0 && labelToIndex === data.xLabels.length - 1) {
    yMinViewport = yMinMinimap;
    yMaxViewport = yMaxMinimap;
  } else {
    const filteredValues = datasets.map(({ values }) => values);
    const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));
    const viewportMaxMin = getMaxMin(mergeArrays(viewportValues));
    const yMinViewportReal = viewportMaxMin.min || prevState.yMinViewport;
    yMaxViewport = viewportMaxMin.max || prevState.yMaxViewport;
    yMinViewport = yMinViewportReal / yMaxViewport > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportReal : 0;
  }

  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap,
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
function calculateXAxisScale(plotWidth, labelFromIndex, labelToIndex) {
  const viewportLabelsCount = labelToIndex - labelFromIndex;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);

  return xStepToScaleLevel(viewportLabelsCount / maxColumns);
}

function calculateYAxisScale(plotHeight, yMin, yMax) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);

  return yStepToScaleLevel(viewportLabelsCount / maxRows);
}
