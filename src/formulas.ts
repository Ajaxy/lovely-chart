import type { Projection } from './Projection.js';
import type { AnalyzedDataset, ChartState, LabelRange, LinePattern, Rect, XLabel } from './types.js';

import {
  AXES_MAX_ROW_HEIGHT, GUTTER, MILLISECONDS_IN_DAY, PLOT_CIRCLE_RADIUS_FACTOR, PLOT_TOP_PADDING, SIMPLIFIER_MIN_POINTS,
  X_AXIS_HEIGHT, Y_AXIS_LABEL_GAP, Y_AXIS_ZERO_BASED_THRESHOLD,
} from './constants.js';

const EDGE_FADE_DISTANCE = GUTTER * 4;
const EDGE_PIN_DISTANCE = GUTTER * 2;
const CONSTANT_RANGE_EPSILONS = 4;
// A value within this fraction of a step from a step multiple counts as on it, so float error never moves it a step
const STEP_EPSILON = 1e-9;
const MIN_LEGIBLE_Y_LABELS = 2;
// Height of the band under the plot top where the axis labels fade out (`applyXEdgeOpacity`)
const Y_AXIS_TOP_FADE_HEIGHT = GUTTER * 3 - PLOT_TOP_PADDING;

export function xScaleLevelToStep(scaleLevel: number): number {
  return Math.pow(2, scaleLevel);
}

export function xStepToScaleLevel(step: number): number {
  return Math.ceil(Math.log2(step || 1));
}

// Every step is 1, 2 or 5 times a power of ten (2.5 in place of 2 from 250 up), so axis labels land on numbers
// a reader rounds to anyway. Past the last rung the ladder continues as 1, 2.5 and 5 times a power of ten.
const SCALE_LEVELS = [
  // Sub-unit steps for fine-grained data (e.g. portfolio P&L denominated in cents)
  0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5,
  1, 2, 5, 10, 20, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
  250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
];
const LAST_SCALE_LEVEL = SCALE_LEVELS.length - 1;
const LAST_SCALE_STEP = SCALE_LEVELS[LAST_SCALE_LEVEL];
const EXTENDED_SCALE_FACTORS = [1, 2.5, 5];
const MIN_INTEGER_Y_SCALE_LEVEL = yStepToScaleLevel(1);

export function yScaleLevelToStep(scaleLevel: number): number {
  if (!(scaleLevel > LAST_SCALE_LEVEL)) {
    return SCALE_LEVELS[scaleLevel] ?? LAST_SCALE_STEP;
  }

  const offset = scaleLevel - LAST_SCALE_LEVEL;
  const factor = EXTENDED_SCALE_FACTORS[offset % EXTENDED_SCALE_FACTORS.length];
  const power = Math.floor(offset / EXTENDED_SCALE_FACTORS.length);
  return Math.min(Number.MAX_VALUE, LAST_SCALE_STEP * factor * 10 ** power);
}

export function yStepToScaleLevel(neededStep: number): number {
  // `findIndex` returns 0 when the first level already fits; `0 || fallback`
  // would incorrectly switch to the largest step, so test for -1 explicitly
  const idx = SCALE_LEVELS.findIndex((step) => step >= neededStep);
  if (idx !== -1) {
    return idx;
  }

  if (!Number.isFinite(neededStep)) {
    return LAST_SCALE_LEVEL;
  }

  const power = Math.floor(Math.log10(neededStep / LAST_SCALE_STEP));
  const fraction = neededStep / (LAST_SCALE_STEP * 10 ** power);
  const factorIndex = EXTENDED_SCALE_FACTORS.findIndex((factor) => fraction <= factor);

  return LAST_SCALE_LEVEL + power * EXTENDED_SCALE_FACTORS.length
    + (factorIndex === -1 ? EXTENDED_SCALE_FACTORS.length : factorIndex);
}

export function calculateYAxisScale(plotHeight: number, yMin: number, yMax: number, noFloatSteps = false): number {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  // A constant range labels its one value and takes the step of the range from 0 to it, which suits the ranges that
  // a transition into or out of it passes
  const viewportLabelsCount = isConstantRange(yMin, yMax) ? Math.max(Math.abs(yMin), Math.abs(yMax)) : yMax - yMin;
  const level = yStepToScaleLevel(viewportLabelsCount / getYAxisRowCount(plotHeight));

  // Labels in the band under the top edge fade out, so a coarse step that leaves a short plot fewer than
  // two legible labels takes the next finer one
  const plotSpan = availableHeight - PLOT_TOP_PADDING;
  const legibleCount = viewportLabelsCount * (plotSpan - Y_AXIS_TOP_FADE_HEIGHT) / plotSpan;
  const legibleLevel = level > 0 && legibleCount / yScaleLevelToStep(level) < MIN_LEGIBLE_Y_LABELS ? level - 1 : level;

  return noFloatSteps ? Math.max(legibleLevel, MIN_INTEGER_Y_SCALE_LEVEL) : legibleLevel;
}

export function getYAxisRowCount(plotHeight: number): number {
  return Math.max(1, Math.floor((plotHeight - X_AXIS_HEIGHT) / AXES_MAX_ROW_HEIGHT));
}

// A range of positive values starts at 0, unless its lowest value is more than three quarters of its highest
export function getYRangeBottom(yMin: number, yMax: number): number {
  return yMin < 0 || yMin / yMax > Y_AXIS_ZERO_BASED_THRESHOLD ? yMin : 0;
}

// A range whose ends differ by machine-precision noise around one value draws as constant: stretched to the full
// height, that noise would draw as a trend
export function isConstantRange(yMin: number, yMax: number): boolean {
  return Math.abs(yMax - yMin) <= CONSTANT_RANGE_EPSILONS * Number.EPSILON * Math.max(Math.abs(yMin), Math.abs(yMax));
}

export function floorToStep(value: number, step: number): number {
  return Math.floor(value / step + STEP_EPSILON) * step;
}

export function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step - STEP_EPSILON) * step;
}

// 1 when the edge is flush with its data boundary, easing to 0 as `hiddenPx` scrolls past
export function getEdgePin(hiddenPx: number): number {
  return Math.max(0, 1 - hiddenPx / EDGE_PIN_DISTANCE);
}

export function applyYEdgeOpacity(
  opacity: number,
  xPx: number,
  plotStart: number,
  plotWidth: number,
  startPin: number,
  endPin: number,
): number {
  const startOpacity = fadeTowardEdge(opacity, xPx - plotStart + GUTTER * 2, startPin);
  const endOpacity = fadeTowardEdge(opacity, plotWidth - xPx, endPin);
  return Math.min(opacity, startOpacity, endOpacity);
}

// Lift the edge fade by the pin factor so the boundary label recovers to full opacity,
// easing out over a span shorter than the fade zone so it still decays as it scrolls off
function fadeTowardEdge(opacity: number, offset: number, pin: number): number {
  if (offset > EDGE_FADE_DISTANCE) {
    return opacity;
  }

  const faded = Math.min(opacity, offset / EDGE_FADE_DISTANCE);
  return faded + (opacity - faded) * pin;
}

export function applyXEdgeOpacity(opacity: number, yPx: number): number {
  return (yPx - GUTTER <= GUTTER * 2)
    ? Math.min(1, opacity, (yPx - GUTTER) / (GUTTER * 2))
    : opacity;
}

// Only a line or a step draws the pattern of a dashed or dotted dataset, and the dots of one that is both
export function getDrawnPattern({ type, isDashed, isDotted }: AnalyzedDataset): LinePattern | undefined {
  if (type !== 'line' && type !== 'step') return undefined;
  if (isDotted) return 'dotted';
  return isDashed ? 'dashed' : undefined;
}

// The plot begins after the label column when the Y-axis labels have one
export function getPlotStart(labelColumnWidth: number | undefined): number {
  return labelColumnWidth !== undefined ? GUTTER + labelColumnWidth + Y_AXIS_LABEL_GAP : GUTTER;
}

export function getCircleRadius(projection: Projection): number {
  return Math.max(0, Math.min(...projection.getSize())) * PLOT_CIRCLE_RADIUS_FACTOR;
}

// The square around the circle of a pie or a donut
export function getCircleArea(projection: Projection): Rect {
  const [xCenter, yCenter] = projection.getCenter();
  const radius = getCircleRadius(projection);

  return { left: xCenter - radius, top: yCenter - radius, width: radius * 2, height: radius * 2 };
}

export function getCircleTextSize(percent: number, radius: number): number {
  return (radius + percent * 200) / 10;
}

export function getCircleTextShift(percent: number, radius: number): number {
  return percent >= 0.99 ? 0 : Math.min(1 - Math.log(percent * 30) / 5, 4 / 5) * radius;
}

// The state's label indexes reach one label past each edge for edge drawing, so the window comes from its fractions
export function getVisibleLabelRange({ lastLabelIndex, begin, end }: ChartState): LabelRange {
  return {
    from: Math.max(0, Math.ceil(lastLabelIndex * begin)),
    to: Math.min(Math.floor(lastLabelIndex * end), lastLabelIndex),
  };
}

export function getLabelFraction(labelIndex: number, lastLabelIndex: number): number {
  // A single label has no X-span — it sits at the plot middle
  return lastLabelIndex > 0 ? labelIndex / lastLabelIndex : 0.5;
}

export function isDataRange(labelFrom: XLabel, labelTo: XLabel): boolean {
  return Math.abs(labelTo.value - labelFrom.value) > MILLISECONDS_IN_DAY;
}

export function getSimplificationDelta(pointsLength: number): number {
  return pointsLength >= SIMPLIFIER_MIN_POINTS ? Math.min((pointsLength / 1000), 1) : 0;
}
