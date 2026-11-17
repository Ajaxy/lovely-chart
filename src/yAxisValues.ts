import type { AnalyzedData } from './types.js';

import { getComparisonValues } from './comparison.js';
import { GAP } from './constants.js';
import {
  calculateYAxisScale, ceilToStep, floorToStep, getYAxisRowCount, getYRangeBottom, isConstantRange, yScaleLevelToStep,
} from './formulas.js';
import { getMaxMin } from './utils.js';

const DECIMAL_BASE = 10;

interface Series {
  values: (number | null)[];
  // The comparison line while this dataset is the only one on screen
  previousValues: (number | null)[];
}

interface Bounds {
  min: number;
  max: number;
}

interface LatestValue {
  value: number;
  labelIndex: number;
  narrowestRange: number;
}

/**
 * The values the main Y axis can label for the data, whatever window the reader picks and whichever datasets they
 * hide: the one value of each constant window and, at every step a window can take, the longest labels of each
 * order of magnitude that window reaches.
 */
export function listYAxisValues(data: AnalyzedData, plotHeight: number): number[] {
  const { isStacked, noFloatSteps } = data;
  const length = data.xLabels.length;
  const series = data.datasets.flatMap(({ values, hasOwnYAxis }, i): Series[] => (
    isStacked || !hasOwnYAxis ? [{ values, previousValues: data.comparison?.values[i] ?? [] }] : []
  ));
  const dataValues = series.flatMap(({ values }) => values.filter((value): value is number => value !== GAP));
  const references = data.referenceLines.map(({ value }) => value);
  const previousTotals = data.comparison ? getComparisonValues(data, data.datasets.map(() => 1)) : [];
  const { min = 0, max = 0 } = getMaxMin([
    ...dataValues,
    // A stacked window always spans 0
    ...(isStacked ? [0, ...listSubsetTotalBounds(series.map(({ values }) => values), length)] : []),
    ...references,
  ]);
  // The comparison line draws the previous total of the datasets on screen, which no subset takes past these bounds
  const comparison = getMaxMin(listSubsetTotalBounds(series.map(({ previousValues }) => previousValues), length));
  const bottom = Math.min(isStacked ? min : getYRangeBottom(min, max), comparison.min ?? Infinity);
  const top = Math.max(max, comparison.max ?? -Infinity);

  if (isConstantRange(bottom, top)) {
    return [bottom];
  }

  const referenceBounds = { min: Math.min(...references), max: Math.max(...references) };
  // A stacked window always spans 0, so its labels reach out from there
  const narrowestRanges = isStacked
    ? new Map([[0, getNarrowestStackRange(series, dataValues, referenceBounds)]])
    : getNarrowestRanges(series, previousTotals, referenceBounds);
  const anchors = Float64Array.from(narrowestRanges.keys()).sort();
  const anchorRanges = anchors.map((value) => narrowestRanges.get(value)!);
  const narrowestRange = anchorRanges.reduce((narrowest, range) => Math.min(narrowest, range), top - bottom);
  const rowCount = getYAxisRowCount(plotHeight);
  const finestLevel = calculateYAxisScale(plotHeight, 0, narrowestRange, noFloatSteps);
  const coarsestLevel = calculateYAxisScale(plotHeight, bottom, top, noFloatSteps);
  const values = isStacked ? [] : listConstantValues(series, references, length);
  const reachedValues = new Float64Array(anchors.length);

  // Every step labels 0 when the range spans it, also where no other label of that step fits
  if (bottom <= 0 && top >= 0) {
    values.push(0);
  }

  for (let level = finestLevel; level <= coarsestLevel; level++) {
    const step = yScaleLevelToStep(level);
    // The widest range that takes this step, past which the next coarser one does
    const widestRange = rowCount * yScaleLevelToStep(level + 1);
    let reachedCount = 0;

    for (let i = 0; i < anchors.length; i++) {
      if (anchorRanges[i] <= widestRange) {
        reachedValues[reachedCount++] = anchors[i];
      }
    }

    values.push(...listStepValues(
      reachedValues.subarray(0, reachedCount), floorToStep(bottom, step), floorToStep(top, step), step,
      widestRange + step,
    ));
  }

  return values;
}

// Per label, the lowest and the highest total of some of the values: the sum of the negative ones and the sum of
// the positive ones
function listSubsetTotalBounds(valueLists: (number | null)[][], length: number): number[] {
  const bounds: number[] = [];

  for (let i = 0; i < length; i++) {
    let negativeSum = 0;
    let positiveSum = 0;
    let hasNegative = false;
    let hasPositive = false;

    valueLists.forEach((values) => {
      const value = values[i];
      if (value === GAP || value === undefined) return;

      if (value < 0) {
        negativeSum += value;
        hasNegative = true;
      } else {
        positiveSum += value;
        hasPositive = true;
      }
    });

    if (hasNegative) bounds.push(negativeSum);
    if (hasPositive) bounds.push(positiveSum);
  }

  return bounds;
}

/**
 * A stacked window spans 0 and the total of the datasets on screen, so none is narrower than one value, or than the
 * reference lines alone where the datasets on screen have no value.
 */
function getNarrowestStackRange(series: Series[], dataValues: number[], references: Bounds): number {
  const narrowestValueRange = dataValues.reduce((narrowest, value) => (
    narrowDown(narrowest, getWindowRange(Math.min(0, value), Math.max(0, value), references))
  ), Infinity);
  const hasGap = series.some(({ values }) => values.includes(GAP));

  return hasGap ? narrowDown(narrowestValueRange, getWindowRange(0, 0, references)) : narrowestValueRange;
}

/**
 * The narrowest range of a window around each value, keyed by the value. A window that is not constant holds a value
 * apart from a reference line, two different values, the later of which meets the latest value of the other's
 * dataset, or a value apart from the previous one at its label.
 */
function getNarrowestRanges(
  series: Series[], previousTotals: (number | null)[], references: Bounds,
): Map<number, number> {
  const narrowestRanges = new Map<number, number>();
  const latestValues: LatestValue[] = [];
  const length = Math.max(...series.map(({ values }) => values.length));

  for (let labelIndex = 0; labelIndex < length; labelIndex++) {
    series.forEach(({ values, previousValues }, seriesIndex) => {
      const value = values[labelIndex];
      if (value === GAP) return;

      const ownLatest = latestValues[seriesIndex];
      // A window of this value alone still spans every reference line
      let narrowestRange = narrowDown(Infinity, getWindowRange(value, value, references));

      latestValues.forEach((latest, latestSeriesIndex) => {
        // A window back to the label of another dataset's value holds the latest value of this one too
        const isOwnLatestHeld = latestSeriesIndex !== seriesIndex && ownLatest !== undefined
          && ownLatest.labelIndex >= latest.labelIndex;
        const ownValue = isOwnLatestHeld ? ownLatest.value : value;
        const range = getWindowRange(
          Math.min(value, latest.value, ownValue), Math.max(value, latest.value, ownValue), references,
        );
        narrowestRange = narrowDown(narrowestRange, range);
        latest.narrowestRange = narrowDown(latest.narrowestRange, range);
      });

      [previousValues[labelIndex], previousTotals[labelIndex]].forEach((previousValue) => {
        if (previousValue === GAP || previousValue === undefined) return;

        narrowestRange = narrowDown(narrowestRange, getWindowRange(value, value, references, previousValue));
      });

      if (ownLatest !== undefined) keepNarrowest(ownLatest);
      latestValues[seriesIndex] = { value, labelIndex, narrowestRange };
    });
  }

  latestValues.forEach(keepNarrowest);

  return narrowestRanges;

  function keepNarrowest({ value, narrowestRange }: LatestValue) {
    narrowestRanges.set(value, Math.min(narrowestRanges.get(value) ?? Infinity, narrowestRange));
  }
}

/**
 * A window of one value labels that value alone, which every reference line has to equal. So does its previous
 * value, unless a dataset lacks one at its label: with that dataset on screen, the comparison line has a gap there.
 */
function listConstantValues(series: Series[], references: number[], length: number): number[] {
  const isPreviousMissing = Array.from({ length }, (_, i) => series.some(({ previousValues }) => (
    previousValues[i] === GAP || previousValues[i] === undefined
  )));
  const values = series.flatMap(({ values: seriesValues, previousValues }) => seriesValues.filter(
    (value, i): value is number => value !== GAP && (isPreviousMissing[i] || previousValues[i] === value),
  ));

  return [...new Set(values)].filter((value) => references.every((reference) => reference === value));
}

// A window spans its values and every reference line, from 0 when its lowest value is low enough, then its previous
// value, which the comparison line adds to the range after that
function getWindowRange(lowest: number, highest: number, references: Bounds, previousValue?: number): number {
  const max = Math.max(highest, references.max);
  const bottom = getYRangeBottom(Math.min(lowest, references.min), max);

  return previousValue === undefined
    ? max - bottom
    : Math.max(max, previousValue) - Math.min(bottom, previousValue);
}

// A window of a range of 0 is constant, which takes no step
function narrowDown(narrowest: number, range: number): number {
  return range > 0 ? Math.min(narrowest, range) : narrowest;
}

// Every order of magnitude has labels of one length at a step, the longest among the first two and the last two
function listStepValues(
  reachedValues: Float64Array, lowest: number, highest: number, step: number, reach: number,
): number[] {
  const values: number[] = [];
  const largest = Math.max(-lowest, highest);

  for (let exponent = Math.floor(Math.log10(step)); DECIMAL_BASE ** exponent <= largest; exponent++) {
    const first = ceilToStep(DECIMAL_BASE ** exponent, step);
    const last = floorToStep(DECIMAL_BASE ** (exponent + 1), step) - step;

    values.push(
      ...listReachedEnds(reachedValues, Math.max(first, lowest), Math.min(last, highest), step, reach),
      ...listReachedEnds(reachedValues, Math.max(-last, lowest), Math.min(-first, highest), step, reach),
    );
  }

  return values;
}

// The first two and the last two labels from `from` to `to` that a window around a reached value spans
function listReachedEnds(
  reachedValues: Float64Array, from: number, to: number, step: number, reach: number,
): number[] {
  if (from > to) return [];

  const firstIndex = findFirstIndex(reachedValues, from - reach, true);
  const lastIndex = findFirstIndex(reachedValues, to + reach, false) - 1;
  if (firstIndex > lastIndex) return [];

  const start = ceilToStep(Math.max(from, reachedValues[firstIndex] - reach), step);
  const end = floorToStep(Math.min(to, reachedValues[lastIndex] + reach), step);

  return [start, start + step, end - step, end].filter((value) => value >= start && value <= end);
}

// The index of the first sorted value above `value`, or at it when `isInclusive`
function findFirstIndex(sorted: Float64Array, value: number, isInclusive: boolean): number {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle] < value || (!isInclusive && sorted[middle] === value)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}
