import type { Projection } from './Projection.js';
import type { XLabel } from './types.js';

import { GUTTER, MILLISECONDS_IN_DAY, PLOT_CIRCLE_RADIUS_FACTOR, SIMPLIFIER_MIN_POINTS } from './constants.js';

const EDGE_FADE_DISTANCE = GUTTER * 4;
const EDGE_PIN_DISTANCE = GUTTER * 2;
const CONSTANT_RANGE_EPSILONS = 4;
// A value within this fraction of a step from a step multiple counts as on it, so float error never moves it a step
const STEP_EPSILON = 1e-9;

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
  plotWidth: number,
  startPin: number,
  endPin: number,
): number {
  const startOpacity = fadeTowardEdge(opacity, xPx + GUTTER, startPin);
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

export function getCircleRadius(projection: Projection): number {
  return Math.max(0, Math.min(...projection.getSize())) * PLOT_CIRCLE_RADIUS_FACTOR;
}

export function getCircleTextSize(percent: number, radius: number): number {
  return (radius + percent * 200) / 10;
}

export function getCircleTextShift(percent: number, radius: number): number {
  return percent >= 0.99 ? 0 : Math.min(1 - Math.log(percent * 30) / 5, 4 / 5) * radius;
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
