import type { AnalyzedData, AnalyzedDataset, LabelRange, Point } from './types';

import { GAP } from './constants';
import { sumArrays } from './utils';

export function preparePoints(
  data: AnalyzedData,
  datasets: AnalyzedDataset[],
  range: LabelRange,
  visibilities: number[],
  bounds: { yMin?: number; yMax?: number },
  shouldConvertToArea?: boolean,
): Point[][] {
  let values = datasets.map(({ values }) => (
    values.slice(range.from, range.to + 1)
  ));

  if (data.isCircle && !shouldConvertToArea) {
    values = prepareSumsByX(values);
  }

  const points = values.map((datasetValues, i) => (
    datasetValues.map((value, j) => {
      const isGap = value === GAP;
      let visibleValue = isGap ? 0 : value;

      if ((data.isStacked || data.isShares) && !isGap) {
        visibleValue *= visibilities[i];
      }

      return {
        labelIndex: range.from + j,
        value,
        visibleValue,
        stackOffset: 0,
        stackValue: visibleValue,
        isGap,
      };
    })
  ));

  if (data.isShares) {
    preparePercentage(points, bounds);
  }

  if (data.isStacked || data.isShares) {
    prepareStacked(points);
  }

  return points;
}

// TODO perf cache for [0..1], use in state
function preparePercentage(points: Point[][], bounds: { yMax?: number }) {
  const sumsByY = getSumsByY(points);

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      point.percent = point.visibleValue / sumsByY[j];
      point.visibleValue = point.percent * bounds.yMax!;
    });
  });
}

function getSumsByY(points: Point[][]): number[] {
  return sumArrays(points.map((datasetPoints) => (
    datasetPoints.map(({ visibleValue }) => visibleValue)
  )));
}

function prepareStacked(points: Point[][]) {
  const posAccum: number[] = [];
  const negAccum: number[] = [];

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      posAccum[j] ??= 0;
      negAccum[j] ??= 0;

      if (point.isGap) {
        point.stackOffset = posAccum[j];
        point.stackValue = posAccum[j];
        return;
      }

      if (point.visibleValue >= 0) {
        point.stackOffset = posAccum[j];
        posAccum[j] += point.visibleValue;
        point.stackValue = posAccum[j];
      } else {
        point.stackOffset = negAccum[j];
        negAccum[j] += point.visibleValue;
        point.stackValue = negAccum[j];
      }
    });
  });
}

function prepareSumsByX(values: (number | null)[][]): (number | null)[][] {
  return values.map((datasetValues) => (
    [datasetValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)]
  ));
}
