import type { AnalyzedData, ChartState, Filter, FocusOn, PointerVector, Range, Size } from './types';

import {
  ANIMATE_PROPS,
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  GAP,
  NO_FOCUS,
  PLOT_PIE_RADIUS_FACTOR,
  PLOT_TOP_PADDING,
  TRANSITION_DEFAULT_DURATION,
  X_AXIS_HEIGHT,
  Y_AXIS_ZERO_BASED_THRESHOLD,
} from './constants';
import { xStepToScaleLevel, yScaleLevelToStep, yStepToScaleLevel } from './formulas';
import { TransitionManager } from './TransitionManager';
import { getMaxMin, mergeArrays, proxyMerge, throttleWithRaf } from './utils';

interface StateUpdate {
  range?: Partial<Range>;
  filter?: Filter;
  focusOn?: FocusOn;
  minimapDelta?: number;
}

interface TransitionConfigItem {
  prop: string;
  duration: number | undefined;
  options: string[];
}

interface YRanges {
  yMinViewport: number;
  yMaxViewport: number;
  yMinMinimap: number;
  yMaxMinimap: number;
  yMinViewportSecond?: number;
  yMaxViewportSecond?: number;
  yMinMinimapSecond?: number;
  yMaxMinimapSecond?: number;
}

export class StateManager {
  #data: AnalyzedData;
  #viewportSize: Size;
  #callback: (state: ChartState) => void;

  #range: Range = { begin: 0, end: 1 };
  #filter: Filter;
  #transitionConfig: TransitionConfigItem[];
  #transitions: TransitionManager;
  #runCallbackOnRaf: () => void;

  #state = {} as ChartState;
  #isDestroyed = false;

  constructor(data: AnalyzedData, viewportSize: Size, callback: (state: ChartState) => void) {
    this.#data = data;
    this.#viewportSize = viewportSize;
    this.#callback = callback;

    this.#filter = this.#buildDefaultFilter();
    this.#transitionConfig = this.#buildTransitionConfig();
    this.#transitions = new TransitionManager(this.#runCallback);
    this.#runCallbackOnRaf = throttleWithRaf(this.#runCallback);
  }

  update({ range = {}, filter = {}, focusOn, minimapDelta }: StateUpdate = {}, noTransition?: boolean) {
    if (this.#isDestroyed) return;
    Object.assign(this.#range, range);
    Object.assign(this.#filter, filter);

    const prevState = this.#state;
    this.#state = calculateState(
      this.#data, this.#viewportSize, this.#range, this.#filter, focusOn, minimapDelta, prevState,
    );

    if (!noTransition) {
      this.#transitionConfig.forEach(({ prop, duration, options }) => {
        const transition = this.#transitions.get(prop);
        const currentTarget = transition ? transition.to : prevState[prop];

        if (currentTarget !== undefined && currentTarget !== this.#state[prop]) {
          const current = transition
            ? (options.includes('fast') ? prevState[prop] : transition.current)
            : prevState[prop];

          if (transition) {
            this.#transitions.remove(prop);
          }

          this.#transitions.add(prop, current, this.#state[prop], duration, options);
        }
      });
    }

    if (!this.#transitions.isRunning() || !this.#transitions.isFast()) {
      this.#runCallbackOnRaf();
    }
  }

  hasAnimations(): boolean {
    return this.#transitions.isFast();
  }

  destroy() {
    this.#isDestroyed = true;
    this.#transitions.destroy();
  }

  #buildTransitionConfig(): TransitionConfigItem[] {
    const transitionConfig: TransitionConfigItem[] = [];
    const datasetVisibilities = this.#data.datasets.map(({ key }) => `opacity#${key} ${TRANSITION_DEFAULT_DURATION}`);
    const datasetPieShifts = this.#data.datasets.map(({ key }) => `pieShift#${key} 200`);

    mergeArrays([
      ANIMATE_PROPS,
      datasetVisibilities,
      datasetPieShifts,
    ]).forEach((transition) => {
      const [prop, duration, ...options] = transition.split(' ');
      transitionConfig.push({ prop, duration: duration ? Number(duration) : undefined, options });
    });

    return transitionConfig;
  }

  #buildDefaultFilter(): Filter {
    const filter: Filter = {};

    this.#data.datasets.forEach(({ key }) => {
      filter[key] = true;
    });

    return filter;
  }

  #runCallback = () => {
    if (this.#isDestroyed) return;
    const state = this.#transitions.isFast()
      ? proxyMerge(this.#state, this.#transitions.getState())
      : this.#state;
    state.static = this.#state;
    this.#callback(state);
  };
}

function calculateState(
  data: AnalyzedData,
  viewportSize: Size,
  range: Range,
  filter: Filter,
  focusOn: FocusOn | undefined,
  minimapDelta: number | undefined,
  prevState: ChartState,
): ChartState {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length - 1;

  const labelFromIndex = Math.max(0, Math.ceil(totalXWidth * begin));
  const labelToIndex = Math.min(Math.floor(totalXWidth * end), totalXWidth);

  const xAxisScale = calculateXAxisScale(viewportSize.width, labelFromIndex, labelToIndex);

  const yRanges = data.isStacked
    ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState)
    : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);

  const yAxisScale = calculateYAxisScale(viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport);
  const yAxisScaleSecond = data.hasSecondYAxis
    && calculateYAxisScale(viewportSize.height, yRanges.yMinViewportSecond!, yRanges.yMaxViewportSecond!);

  const yStep = yScaleLevelToStep(yAxisScale);
  yRanges.yMinViewport = Math.floor(yRanges.yMinViewport / yStep) * yStep;

  if (yAxisScaleSecond) {
    const yStepSecond = yScaleLevelToStep(yAxisScaleSecond);
    yRanges.yMinViewportSecond = Math.floor(yRanges.yMinViewportSecond! / yStepSecond) * yStepSecond;
  }

  const datasetsOpacity: Record<string, number> = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  const extendedLabelFromIndex = Math.max(0, labelFromIndex - 1);
  const extendedLabelToIndex = Math.min(labelToIndex + 1, totalXWidth);
  const resolvedFocusOn = focusOn !== undefined ? focusOn : prevState.focusOn;

  const datasetsPieShift = data.isPie
    ? calculatePieShifts(
      // For pie charts `focusOn` is never a plain label index
      data, viewportSize, filter, resolvedFocusOn as Exclude<FocusOn, number> | undefined,
      extendedLabelFromIndex, extendedLabelToIndex,
    )
    : undefined;

  // TODO perf
  return Object.assign(
    {
      totalXWidth,
      xAxisScale,
      yAxisScale,
      yAxisScaleSecond,
      labelFromIndex: extendedLabelFromIndex,
      labelToIndex: extendedLabelToIndex,
      filter: Object.assign({}, filter),
      focusOn: resolvedFocusOn,
      minimapDelta: minimapDelta !== undefined ? minimapDelta : prevState.minimapDelta,
    },
    yRanges,
    datasetsOpacity,
    datasetsPieShift,
    range,
  ) as ChartState;
}

// Targets (0 or 1) for the animated `pieShift#*` props: 1 for the sector
// currently under the pointer. Mirrors the sector containment test used by
// the tooltip, with angles growing from -PI/2 over the filtered totals.
function calculatePieShifts(
  data: AnalyzedData,
  viewportSize: Size,
  filter: Filter,
  // A vector while the pointer is over the pie, NO_FOCUS after a clear,
  // or undefined before any interaction.
  pointerVector: PointerVector | typeof NO_FOCUS | undefined,
  labelFromIndex: number,
  labelToIndex: number,
): Record<string, number> {
  const radius = Math.max(0, Math.min(
    viewportSize.width,
    viewportSize.height - X_AXIS_HEIGHT - PLOT_TOP_PADDING,
  )) * PLOT_PIE_RADIUS_FACTOR;

  const sums = data.datasets.map(({ key, values }) => (
    filter[key]
      ? values.slice(labelFromIndex, labelToIndex + 1).reduce<number>((a, x) => a + (x || 0), 0)
      : 0
  ));
  const total = sums.reduce((a, x) => a + x, 0);

  const shifts: Record<string, number> = {};
  let offset = 0;
  data.datasets.forEach(({ key }, i) => {
    const beginAngle = offset / total * Math.PI * 2 - Math.PI / 2;
    offset += sums[i];
    const endAngle = offset / total * Math.PI * 2 - Math.PI / 2;

    const isFocused = Boolean(
      pointerVector
      && pointerVector !== NO_FOCUS
      && beginAngle <= pointerVector.angle
      && pointerVector.angle < endAngle
      && pointerVector.distance <= radius,
    );

    shifts[`pieShift#${key}`] = isFocused ? 1 : 0;
  });

  return shifts;
}

function calculateYRanges(
  data: AnalyzedData,
  filter: Filter,
  labelFromIndex: number,
  labelToIndex: number,
  prevState: ChartState,
): YRanges {
  const secondaryYAxisDataset = data.hasSecondYAxis ? data.datasets.slice(-1)[0] : undefined;
  const filteredDatasets = data.datasets.filter((d) => filter[d.key] && d !== secondaryYAxisDataset);

  const yRanges: YRanges = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, filteredDatasets);

  if (secondaryYAxisDataset) {
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

function calculateYRangesForGroup(
  data: AnalyzedData,
  labelFromIndex: number,
  labelToIndex: number,
  prevState: ChartState,
  datasets: AnalyzedData['datasets'],
): YRanges {
  const { min: yMinMinimapReal = prevState.yMinMinimap, max: yMaxMinimap = prevState.yMaxMinimap }
    = getMaxMin(mergeArrays(datasets.map(({ yMax, yMin }) => [yMax, yMin])));
  const yMinMinimap = yMinMinimapReal < 0
    ? yMinMinimapReal
    : (yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapReal : 0);

  let yMinViewport;
  let yMaxViewport;

  if (labelFromIndex === 0 && labelToIndex === data.xLabels.length - 1) {
    yMinViewport = yMinMinimap;
    yMaxViewport = yMaxMinimap;
  } else {
    const filteredValues = datasets.map(({ values }) => values);
    const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));
    const viewportMaxMin = getMaxMin(mergeArrays(viewportValues));
    const yMinViewportReal: number = viewportMaxMin.min !== undefined ? viewportMaxMin.min : prevState.yMinViewport;
    yMaxViewport = viewportMaxMin.max !== undefined ? viewportMaxMin.max : prevState.yMaxViewport;
    yMinViewport = yMinViewportReal < 0
      ? yMinViewportReal
      : (yMinViewportReal / yMaxViewport > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportReal : 0);
  }

  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap,
  };
}

function calculateYRangesStacked(
  data: AnalyzedData,
  filter: Filter,
  labelFromIndex: number,
  labelToIndex: number,
  prevState: ChartState,
): YRanges {
  const filteredDatasets = data.datasets.filter((d) => filter[d.key]);
  const filteredValues = filteredDatasets.map(({ values }) => values);

  const length = filteredValues[0] ? filteredValues[0].length : 0;
  const posSums = new Array(length).fill(0);
  const negSums = new Array(length).fill(0);
  for (let i = 0; i < filteredValues.length; i++) {
    for (let j = 0; j < length; j++) {
      const v = filteredValues[i][j];
      if (v === GAP) continue;
      if (v >= 0) {
        posSums[j] += v;
      } else {
        negSums[j] += v;
      }
    }
  }

  const { max: yMaxMinimap = prevState.yMaxMinimap } = getMaxMin(posSums);
  const { min: yMinMinimap = prevState.yMinMinimap } = getMaxMin(negSums);
  const { max: yMaxViewport = prevState.yMaxViewport } = getMaxMin(posSums.slice(labelFromIndex, labelToIndex + 1));
  const { min: yMinViewport = prevState.yMinViewport } = getMaxMin(negSums.slice(labelFromIndex, labelToIndex + 1));

  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap,
  };
}

function calculateXAxisScale(plotWidth: number, labelFromIndex: number, labelToIndex: number): number {
  const viewportLabelsCount = labelToIndex - labelFromIndex;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);

  return xStepToScaleLevel(viewportLabelsCount / maxColumns);
}

function calculateYAxisScale(plotHeight: number, yMin: number, yMax: number): number {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);

  return yStepToScaleLevel(viewportLabelsCount / maxRows);
}
