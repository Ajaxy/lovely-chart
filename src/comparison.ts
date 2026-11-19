import type { AnalyzedData, Filter } from './types.js';

import { GAP } from './constants.js';
import { isInTotal } from './formulas.js';
import { getMaxMin } from './utils.js';

interface ComparableRanges {
  yMinViewport: number;
  yMaxViewport: number;
  yMinMinimap: number;
  yMaxMinimap: number;
}

// The comparison line is the previous total of the datasets on screen: a dataset fading in or out adds its
// share in proportion, and a missing previous value of any of them leaves a gap
export function getComparisonValues(data: AnalyzedData, visibilities: number[]): (number | null)[] {
  return data.xLabels.map((_, index) => {
    let total = 0;
    let isAnyVisible = false;

    for (let i = 0; i < data.datasets.length; i++) {
      if (!visibilities[i] || !isInTotal(data.datasets[i])) continue;

      isAnyVisible = true;
      const value = data.comparison!.values[i]?.[index];
      if (value === GAP || value === undefined) return GAP;

      total += value * visibilities[i];
    }

    return isAnyVisible ? total : GAP;
  });
}

// The previous values share the main axis without stacking onto the current ones
export function extendComparisonRanges(
  data: AnalyzedData, filter: Filter, labelFromIndex: number, labelToIndex: number, ranges: ComparableRanges,
) {
  if (!data.comparison) return;

  const values = getComparisonValues(data, data.datasets.map(({ key }) => (filter[key] ? 1 : 0)));
  const full = getMaxMin(values);
  const visible = getMaxMin(values.slice(labelFromIndex, labelToIndex + 1));

  ranges.yMinMinimap = extendBound(ranges.yMinMinimap, full.min, Math.min);
  ranges.yMaxMinimap = extendBound(ranges.yMaxMinimap, full.max, Math.max);
  ranges.yMinViewport = extendBound(ranges.yMinViewport, visible.min, Math.min);
  ranges.yMaxViewport = extendBound(ranges.yMaxViewport, visible.max, Math.max);
}

function extendBound(bound: number | undefined, value: number | undefined, pick: (a: number, b: number) => number) {
  if (value === undefined) return bound!;

  return bound === undefined || Number.isNaN(bound) ? value : pick(bound, value);
}
