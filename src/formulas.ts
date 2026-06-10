import type { Projection } from './Projection';
import type { XLabel } from './types';

import { GUTTER, MILLISECONDS_IN_DAY, PLOT_CIRCLE_RADIUS_FACTOR, SIMPLIFIER_MIN_POINTS } from './constants';

export function xScaleLevelToStep(scaleLevel: number): number {
  return Math.pow(2, scaleLevel);
}

export function xStepToScaleLevel(step: number): number {
  return Math.ceil(Math.log2(step || 1));
}

const SCALE_LEVELS = [
  // Sub-unit steps for fine-grained data (e.g. portfolio P&L denominated in cents)
  0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5,
  1, 2, 8, 18, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
  250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
];

export function yScaleLevelToStep(scaleLevel: number): number {
  return SCALE_LEVELS[scaleLevel] || SCALE_LEVELS.at(-1)!;
}

export function yStepToScaleLevel(neededStep: number): number {
  // `findIndex` returns 0 when the first level already fits; `0 || fallback`
  // would incorrectly switch to the largest step, so test for -1 explicitly
  const idx = SCALE_LEVELS.findIndex((step) => step >= neededStep);
  return idx === -1 ? SCALE_LEVELS.length - 1 : idx;
}

export function applyYEdgeOpacity(opacity: number, xPx: number, plotWidth: number): number {
  const edgeOffset = Math.min(xPx + GUTTER, plotWidth - xPx);
  if (edgeOffset <= GUTTER * 4) {
    opacity = Math.min(1, opacity, edgeOffset / (GUTTER * 4));
  }
  return opacity;
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

export function isDataRange(labelFrom: XLabel, labelTo: XLabel): boolean {
  return Math.abs(labelTo.value - labelFrom.value) > MILLISECONDS_IN_DAY;
}

export function getSimplificationDelta(pointsLength: number): number {
  return pointsLength >= SIMPLIFIER_MIN_POINTS ? Math.min((pointsLength / 1000), 1) : 0;
}
