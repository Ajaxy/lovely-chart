import type { AnalyzedData, ChartState, Filter, FocusOn, PointerVector, Range, Size } from './types.js';

import {
  ANIMATE_PROPS,
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  CIRCLE_STATIC_PROPS,
  GAP,
  GUTTER,
  NO_FOCUS,
  PLOT_CIRCLE_RADIUS_FACTOR,
  PLOT_TOP_PADDING,
  TRANSITION_DEFAULT_DURATION,
  X_AXIS_HEIGHT,
  Y_AXIS_ZERO_BASED_THRESHOLD,
} from './constants.js';
import {
  floorToStep, isConstantRange, xStepToScaleLevel, yScaleLevelToStep, yStepToScaleLevel,
} from './formulas.js';
import { TransitionManager } from './TransitionManager.js';
import { getMaxMin, mergeProxied, throttleWithRaf } from './utils.js';

const MIN_LEGIBLE_Y_LABELS = 2;
const MIN_INTEGER_Y_SCALE_LEVEL = yStepToScaleLevel(1);
// Height of the band under the plot top where the axis labels fade out (`applyXEdgeOpacity`)
const Y_AXIS_TOP_FADE_HEIGHT = GUTTER * 3 - PLOT_TOP_PADDING;

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
  readonly #data: AnalyzedData;
  readonly #viewportSize: Size;
  readonly #callback: (state: ChartState) => void;

  readonly #range: Range = { begin: 0, end: 1 };
  readonly #filter: Filter;
  #transitionConfig: TransitionConfigItem[];
  readonly #transitions: TransitionManager;
  readonly #runCallbackOnRaf: () => void;

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

  /**
   * Zooming replaces the chart type in place, and the transition config depends
   * on it — a circle animates its summed values and not its x-range.
   */
  refreshTransitionConfig() {
    this.#transitionConfig = this.#buildTransitionConfig();
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

  getFilter(): Filter {
    return { ...this.#filter };
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
    const datasetCircleShifts = this.#data.datasets.map(({ key }) => `circleShift#${key} 200`);
    // A circle draws one summed value per dataset, so that is what has to
    // animate; its own x-range props describe nothing it draws, and animating
    // them would walk the aggregation through label windows it never selected
    const datasetCircleSums = this.#data.isCircle
      ? this.#data.datasets.map(({ key }) => `circleSum#${key} ${TRANSITION_DEFAULT_DURATION}`)
      : [];
    const animateProps = this.#data.isCircle
      ? ANIMATE_PROPS.filter((prop) => !CIRCLE_STATIC_PROPS.includes(prop.split(' ')[0]))
      : ANIMATE_PROPS;

    [
      ...animateProps,
      ...datasetVisibilities,
      ...datasetCircleShifts,
      ...datasetCircleSums,
    ].forEach((transition) => {
      const [prop, duration, ...options] = transition.split(' ');
      transitionConfig.push({ prop, duration: duration ? Number(duration) : undefined, options });
    });

    return transitionConfig;
  }

  #buildDefaultFilter(): Filter {
    const filter: Filter = {};

    this.#data.datasets.forEach(({ key, isInitiallyHidden }) => {
      filter[key] = !isInitiallyHidden;
    });

    return filter;
  }

  readonly #runCallback = () => {
    if (this.#isDestroyed) return;
    const state = this.#transitions.isFast()
      ? mergeProxied(this.#state, this.#transitions.getState())
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
  const lastLabelIndex = data.xLabels.length - 1;
  // A single label takes a column centered in the plot, which a window over a part of the axis leaves out
  const { begin, end } = lastLabelIndex === 0 ? { begin: 0, end: 1 } : range;

  const labelFromIndex = Math.max(0, Math.ceil(lastLabelIndex * begin));
  const labelToIndex = Math.min(Math.floor(lastLabelIndex * end), lastLabelIndex);

  const xAxisScale = calculateXAxisScale(viewportSize.width, labelFromIndex, labelToIndex);

  const yRanges = data.isStacked || data.isShares
    ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState)
    : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);

  const yAxisScale = calculateYAxisScale(
    viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport, data.noFloatSteps,
  );
  const yAxisScaleSecond = data.hasSecondYAxis && calculateYAxisScale(
    viewportSize.height, yRanges.yMinViewportSecond!, yRanges.yMaxViewportSecond!, data.noFloatSteps,
  );

  // A constant range keeps its one value for the axis to label at the middle height, so it does not round its bottom
  // down to a step
  if (!isConstantRange(yRanges.yMinViewport, yRanges.yMaxViewport)) {
    yRanges.yMinViewport = floorToStep(yRanges.yMinViewport, yScaleLevelToStep(yAxisScale));
  }

  if (
    typeof yAxisScaleSecond === 'number'
    && !isConstantRange(yRanges.yMinViewportSecond!, yRanges.yMaxViewportSecond!)
  ) {
    yRanges.yMinViewportSecond = floorToStep(yRanges.yMinViewportSecond!, yScaleLevelToStep(yAxisScaleSecond));
  }

  const datasetsOpacity: Record<string, number> = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  const datasetsCircleSum: Record<string, number> = {};
  if (data.isCircle) {
    data.datasets.forEach(({ key, values }) => {
      let sum = 0;
      for (let i = labelFromIndex; i <= labelToIndex; i++) {
        sum += values[i] ?? 0;
      }
      datasetsCircleSum[`circleSum#${key}`] = sum;
    });
  }

  // Line and bar charts need one label of margin per side so segments crossing
  // the viewport edge are drawn. A circle has no edges to draw, and the extra
  // labels would silently widen the range its sectors are summed over — a pie
  // zoomed to one label would aggregate that label plus both its neighbours.
  const extendedLabelFromIndex = data.isCircle ? labelFromIndex : Math.max(0, labelFromIndex - 1);
  const extendedLabelToIndex = data.isCircle ? labelToIndex : Math.min(labelToIndex + 1, lastLabelIndex);
  const resolvedFocusOn = focusOn !== undefined ? focusOn : prevState.focusOn;

  const datasetsCircleShift = data.isCircle
    ? calculateCircleShifts(
      // For circle charts `focusOn` is never a plain label index
      data, viewportSize, filter, resolvedFocusOn as Exclude<FocusOn, number> | undefined,
      extendedLabelFromIndex, extendedLabelToIndex,
    )
    : undefined;

  // TODO perf
  return {
    lastLabelIndex,
    xAxisScale,
    yAxisScale,
    yAxisScaleSecond,
    labelFromIndex: extendedLabelFromIndex,
    labelToIndex: extendedLabelToIndex,
    filter: { ...filter },
    focusOn: resolvedFocusOn,
    minimapDelta: minimapDelta !== undefined ? minimapDelta : prevState.minimapDelta,
    ...yRanges,
    ...datasetsOpacity,
    ...datasetsCircleSum,
    ...datasetsCircleShift,
    begin,
    end,
  };
}

// Targets (0 or 1) for the animated `circleShift#*` props: 1 for the sector
// currently under the pointer. Mirrors the sector containment test used by
// the tooltip, with angles growing from -PI/2 over the filtered totals.
function calculateCircleShifts(
  data: AnalyzedData,
  viewportSize: Size,
  filter: Filter,
  // A vector while the pointer is over the circle, NO_FOCUS after a clear,
  // or undefined before any interaction
  pointerVector: PointerVector | typeof NO_FOCUS | undefined,
  labelFromIndex: number,
  labelToIndex: number,
): Record<string, number> {
  const radius = Math.max(0, Math.min(
    viewportSize.width,
    viewportSize.height - X_AXIS_HEIGHT - PLOT_TOP_PADDING,
  )) * PLOT_CIRCLE_RADIUS_FACTOR;

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

    shifts[`circleShift#${key}`] = isFocused ? 1 : 0;
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
  const secondaryYAxisDataset = data.hasSecondYAxis ? data.datasets.at(-1) : undefined;
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
    = getMaxMin(datasets.flatMap(({ yMax, yMin }) => [yMax, yMin]));
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
    const viewportMaxMin = getMaxMin(viewportValues.flat());
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
      const value = filteredValues[i][j];
      if (value === GAP) continue;
      if (value >= 0) {
        posSums[j] += value;
      } else {
        negSums[j] += value;
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

function calculateYAxisScale(plotHeight: number, yMin: number, yMax: number, noFloatSteps = false): number {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.max(1, Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT));
  const level = yStepToScaleLevel(viewportLabelsCount / maxRows);

  // Labels in the band under the top edge fade out, so a coarse step that leaves a short plot fewer than
  // two legible labels takes the next finer one
  const plotSpan = availableHeight - PLOT_TOP_PADDING;
  const legibleCount = viewportLabelsCount * (plotSpan - Y_AXIS_TOP_FADE_HEIGHT) / plotSpan;
  const legibleLevel = level > 0 && legibleCount / yScaleLevelToStep(level) < MIN_LEGIBLE_Y_LABELS ? level - 1 : level;

  return noFloatSteps ? Math.max(legibleLevel, MIN_INTEGER_Y_SCALE_LEVEL) : legibleLevel;
}
