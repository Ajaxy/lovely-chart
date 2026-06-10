import type { AnalyzedData, AnalyzedDataset, LabelType, LovelyChartParams, Range, XLabel } from './types';

import { MILISECONDS_IN_DAY } from './constants';
import {
  statsFormatDay, statsFormatDayHour, statsFormatMin, statsFormatMonth,
  statsFormatText, statsFormatWeek, statsFormatYear,
} from './format';
import { getMaxMin } from './utils';

const DEFAULT_COLORS = [
  '#3497ED', '#2373DB', '#9ED448', '#5FB641',
  '#F5BD25', '#F79E39', '#E65850', '#5D5CDC',
];

// For fewer datasets, a curated subset of `DEFAULT_COLORS` is used (indexed by dataset count).
// Each step adds one color: lightblue, +lightgreen, +darkorange, +violet, +lightorange, +darkblue,
// +darkgreen, +red. The original palette order is always preserved.
const DEFAULT_COLORS_SUBSETS = [
  [],
  [0],
  [0, 2],
  [0, 2, 5],
  [0, 2, 5, 7],
  [0, 2, 4, 5, 7],
  [0, 1, 2, 4, 5, 7],
  [0, 1, 2, 3, 4, 5, 7],
];

const LABEL_TYPE_TO_FORMATTER: Record<LabelType, string | undefined> = {
  year: 'statsFormatYear',
  month: 'statsFormatMonth',
  week: 'statsFormatWeek',
  day: 'statsFormat(\'day\')',
  hour: 'statsFormat(\'hour\')',
  '5min': 'statsFormat(\'5min\')',
  dayHour: 'statsFormatDayHour',
  text: undefined,
};

export function analyzeData(data: LovelyChartParams, fallbackLabelType?: LabelType): AnalyzedData {
  const {
    title, labelFormatter: labelFormatterRaw, tooltipFormatter, isStacked, isPercentage, secondaryYAxis,
    hasSecondYAxis, onZoom, withMinimap, minimapRange, noCaption, zoomOutLabel, valuePrefix, valueSuffix,
    prefixIsCurrency, limitDate, onLimitedRangeClick,
  } = data;
  const labelType = data.labelType || inferLabelType(data.labels) || fallbackLabelType;
  const labelFormatter = labelFormatterRaw || (labelType ? LABEL_TYPE_TO_FORMATTER[labelType] : undefined);
  const { datasets, labels } = prepareDatasets(data);

  const colors: Record<string, string> = {};
  let totalYMin = Infinity;
  let totalYMax = -Infinity;
  datasets.forEach(({ key, color, yMin, yMax }) => {
    colors[key] = color;

    if (yMin !== undefined && yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax !== undefined && yMax > totalYMax) {
      totalYMax = yMax;
    }
  });

  let xLabels: XLabel[];
  switch (labelFormatter) {
    case 'statsFormatYear':
      xLabels = statsFormatYear(labels as number[]);
      break;
    case 'statsFormatMonth':
      xLabels = statsFormatMonth(labels as number[]);
      break;
    case 'statsFormatWeek':
      xLabels = statsFormatWeek(labels as number[]);
      break;
    case 'statsFormatDayHour':
      xLabels = statsFormatDayHour(labels as number[]);
      break;
    case 'statsFormat(\'day\')':
      xLabels = statsFormatDay(labels as number[]);
      break;
    case 'statsFormat(\'hour\')':
    case 'statsFormat(\'5min\')':
      xLabels = statsFormatMin(labels as number[]);
      break;
    default:
      xLabels = statsFormatText(labels);
      break;
  }

  let limitBegin: number | undefined;
  if (limitDate !== undefined) {
    const totalXWidth = labels.length - 1;
    const idx = labels.findIndex((l) => (l as number) >= limitDate);
    if (idx > 0) {
      limitBegin = idx / totalXWidth;
    }
  }

  const shouldZoomToPie = !onZoom && Boolean(isPercentage);

  const analyzed: AnalyzedData = {
    title,
    labelType,
    labelFormatter,
    tooltipFormatter,
    xLabels,
    datasets,
    isStacked,
    isPercentage,
    secondaryYAxis,
    hasSecondYAxis,
    valuePrefix,
    valueSuffix,
    prefixIsCurrency,
    onZoom,
    isLines: data.type === 'line',
    isBars: data.type === 'bar',
    isSteps: data.type === 'step',
    isAreas: data.type === 'area',
    isPie: data.type === 'pie',
    isDonut: Boolean(data.isDonut),
    withGradient: Boolean(data.withGradient),
    yMin: totalYMin,
    yMax: totalYMax,
    colors,
    withMinimap: Boolean(withMinimap),
    minimapRange: buildMinimapRange(minimapRange),
    noCaption,
    zoomOutLabel,
    limitBegin,
    onLimitedRangeClick,
    shouldZoomToPie,
    isZoomable: Boolean(onZoom) || shouldZoomToPie,
  };

  return analyzed;
}

function inferLabelType(labels: (number | string)[]): LabelType | undefined {
  const [first, second] = labels;

  if (typeof first === 'string') {
    return 'text';
  }

  if (typeof first !== 'number') {
    return undefined;
  }

  // A single timestamp has no step to infer granularity from
  if (typeof second !== 'number') {
    return 'day';
  }

  const step = Math.abs(second - first);

  // Calendar steps are irregular: a year step is 365–366 days,
  // a month step is 28–31 days, so the bounds are inclusive of the minimums.
  if (step >= 365 * MILISECONDS_IN_DAY) {
    return 'year';
  }

  if (step >= 28 * MILISECONDS_IN_DAY) {
    return 'month';
  }

  if (step >= 7 * MILISECONDS_IN_DAY) {
    return 'week';
  }

  if (step >= MILISECONDS_IN_DAY) {
    return 'day';
  }

  if (step >= MILISECONDS_IN_DAY / 24) {
    return 'hour';
  }

  return '5min';
}

// Accepts a `[begin, end]` tuple of 0..1 fractions or the 'full' keyword,
// normalized to the `{ begin, end }` shape used internally.
function buildMinimapRange(minimapRange?: [number, number] | 'full'): Range | undefined {
  if (!minimapRange) {
    return undefined;
  }

  if (minimapRange === 'full') {
    return { begin: 0, end: 1 };
  }

  const [begin, end] = minimapRange;
  return { begin, end };
}

function prepareDatasets(data: LovelyChartParams): { labels: (number | string)[]; datasets: AnalyzedDataset[] } {
  const { type, labels, datasets, hasSecondYAxis } = data;

  const defaultColors = getDefaultColors(datasets.length);
  let nextDefaultColor = 0;

  return {
    labels: cloneArray(labels),
    datasets: datasets.map(({ name, color, values }, i) => {
      const { min: yMin, max: yMax } = getMaxMin(values);

      return {
        type,
        key: `y${i}`,
        name,
        color: color || defaultColors[nextDefaultColor++ % defaultColors.length],
        values: cloneArray(values),
        hasOwnYAxis: hasSecondYAxis && i === datasets.length - 1,
        yMin,
        yMax,
      };
    }),
  };
}

function getDefaultColors(datasetsCount: number): string[] {
  const subset = DEFAULT_COLORS_SUBSETS[datasetsCount];
  return subset ? subset.map((index) => DEFAULT_COLORS[index]) : DEFAULT_COLORS;
}

function cloneArray<T>(array: T[]): T[] {
  return array.slice(0);
}
