import type {
  AnalyzedData, AnalyzedDataset, EventLine, HatchedRange, LabelRange, LabelType, LovelyChartParams, Range, ThemedColor,
  XLabel,
} from './types.js';

import { AXES_FONT_SIZE, MILLISECONDS_IN_DAY } from './constants.js';
import {
  formatDay, formatDayHour, formatMin, formatMonth,
  formatText, formatWeek, formatYear,
} from './format.js';
import { getLabelFraction } from './formulas.js';
import { getMaxMin } from './utils.js';

/** The colour of the `comparison` line, and of its swatches in the legend and the tooltip, when it sets none. */
export const DEFAULT_COMPARISON_COLOR = '#6B7280';
const HALF_LABEL = 0.5;

/**
 * The eight default dataset colours, in order. A chart of fewer datasets takes a subset of them, as `getDefaultColors`
 * returns it.
 */
export const DEFAULT_COLORS: readonly string[] = Object.freeze([
  '#3497ED', '#2373DB', '#9ED448', '#5FB641',
  '#F5BD25', '#F79E39', '#E65850', '#5D5CDC',
]);

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

export function analyzeData(
  data: LovelyChartParams,
  fallbackLabelType?: LabelType,
  datasetColors?: Record<string, ThemedColor>,
  fallbackColors?: Record<string, ThemedColor>,
): AnalyzedData {
  const {
    title, labelFormatter: labelFormatterRaw, tooltipFormatter, dateLocale, isStacked, isPercentage,
    percentPrecision, secondaryYAxis, areLinesSmooth, areaOpacity, areaBorderColor,
    isUtc, colorScheme, referenceLines, hatchedRanges, eventLines, comparison,
    isTooltipOrderFixed, isTooltipTotalInTitle, formatTooltipValue, resolveTooltipTotal, resolveTooltipNotes,
    isKeyboardSelectable, plotHeight, isSparkline, isLoading, noHeader, noTooltip, areLabelsContrast,
    isYAxisOutward, noFloatSteps, axisFontSize, axisTextColor, backgroundColor,
    hasSecondYAxis, onZoom, noZoom, zoomType, zoomToShares, circleLabelsAround,
    withMinimap, minimapRange, noCaption, zoomOutLabel, noZoomOutControl,
    valuePrefix, valueSuffix, isCurrencyPrefix, limitDate, onLimitedRangeClick, initialZoom,
  } = data;
  const isPie = data.type === 'pie';
  const isDonut = data.type === 'donut';
  const isCircle = isPie || isDonut;
  const labelType = data.labelType || inferLabelType(data.labels) || fallbackLabelType;
  const labelFormatter = labelFormatterRaw || (labelType ? LABEL_TYPE_TO_FORMATTER[labelType] : undefined);
  const { datasets, labels } = prepareDatasets(data, datasetColors, fallbackColors);
  // Bars or steps among the datasets give every label a column
  const hasColumns = datasets.some(({ type }) => type === 'bar' || type === 'step');

  const isShares = Boolean(isPercentage) || isCircle;
  const analyzedComparison = comparison && !isShares
    ? { ...comparison, color: comparison.color ?? DEFAULT_COMPARISON_COLOR }
    : undefined;
  const colors: Record<string, ThemedColor> = {};
  if (analyzedComparison) {
    colors.comparison = analyzedComparison.color;
  }
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
      xLabels = formatYear(labels as number[]);
      break;
    case 'statsFormatMonth':
      xLabels = formatMonth(labels as number[], dateLocale);
      break;
    case 'statsFormatWeek':
      xLabels = formatWeek(labels as number[]);
      break;
    case 'statsFormatDayHour':
      xLabels = formatDayHour(labels as number[], dateLocale, isUtc);
      break;
    case 'statsFormat(\'day\')':
      xLabels = formatDay(labels as number[], dateLocale, isUtc);
      break;
    case 'statsFormat(\'hour\')':
    case 'statsFormat(\'5min\')':
      xLabels = formatMin(labels as number[], isUtc);
      break;
    default:
      xLabels = formatText(labels);
      break;
  }

  let limitBegin: number | undefined;
  if (limitDate !== undefined) {
    const index = labels.findIndex((label) => (label as number) >= limitDate);
    if (index > 0) {
      limitBegin = getLabelFraction(index, labels.length - 1);
    }
  }

  const shouldZoomToShares = !onZoom && !noZoom && Boolean(isPercentage || zoomToShares);
  const isZoomable = !noZoom && (Boolean(onZoom) || shouldZoomToShares);

  const analyzed: AnalyzedData = {
    title,
    labelType,
    labelFormatter,
    tooltipFormatter,
    dateLocale,
    xLabels,
    datasets,
    isStacked,
    isPercentage,
    percentPrecision,
    isShares,
    plotHeight,
    isSparkline,
    isLoading,
    noHeader,
    noTooltip,
    areLabelsContrast,
    isYAxisOutward,
    noFloatSteps,
    axisFontSize: axisFontSize !== undefined && axisFontSize > 0 ? axisFontSize : AXES_FONT_SIZE,
    axisTextColor,
    backgroundColor,
    referenceLines: isCircle ? [] : (referenceLines ?? []).filter(({ value }) => Number.isFinite(value)),
    hatchedRanges: isCircle ? [] : prepareHatchedRanges(hatchedRanges ?? [], xLabels.length),
    eventLines: isCircle ? [] : prepareEventLines(eventLines ?? [], xLabels.length, hasColumns),
    isUtc,
    colorScheme,
    comparison: analyzedComparison,
    isTooltipOrderFixed,
    isTooltipTotalInTitle,
    formatTooltipValue,
    resolveTooltipTotal,
    resolveTooltipNotes,
    isKeyboardSelectable,
    areLinesSmooth,
    areaOpacity,
    areaBorderColor,
    secondaryYAxis,
    hasSecondYAxis,
    valuePrefix,
    valueSuffix,
    isCurrencyPrefix,
    onZoom,
    type: data.type,
    isLines: data.type === 'line',
    isBars: data.type === 'bar',
    isSteps: data.type === 'step',
    isAreas: data.type === 'area',
    hasBars: datasets.some(({ type }) => type === 'bar'),
    hasSteps: datasets.some(({ type }) => type === 'step'),
    isPie,
    isDonut,
    isCircle,
    withGradient: Boolean(data.withGradient),
    yMin: totalYMin,
    yMax: totalYMax,
    colors,
    withMinimap: Boolean(withMinimap),
    minimapRange: buildMinimapRange(minimapRange, xLabels.length, hasColumns || isCircle),
    noCaption,
    zoomOutLabel,
    noZoomOutControl,
    limitBegin,
    onLimitedRangeClick,
    shouldZoomToShares,
    circleLabelsAround,
    zoomType: zoomType || 'pie',
    isZoomable,
    initialZoomIndex: resolveInitialZoomIndex(initialZoom, isZoomable, xLabels.length),
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
  // a month step is 28–31 days, so the bounds are inclusive of the minimums
  if (step >= 365 * MILLISECONDS_IN_DAY) {
    return 'year';
  }

  if (step >= 28 * MILLISECONDS_IN_DAY) {
    return 'month';
  }

  if (step >= 7 * MILLISECONDS_IN_DAY) {
    return 'week';
  }

  if (step >= MILLISECONDS_IN_DAY) {
    return 'day';
  }

  if (step >= MILLISECONDS_IN_DAY / 24) {
    return 'hour';
  }

  return '5min';
}

// Accepts a `[begin, end]` tuple of 0..1 fractions, the 'full' keyword or inclusive label indexes,
// normalized to the `{ begin, end }` shape used internally
function buildMinimapRange(
  minimapRange: LovelyChartParams['minimapRange'], labelsCount: number, hasColumns: boolean,
): Range | undefined {
  if (!minimapRange) {
    return undefined;
  }

  if (minimapRange === 'full') {
    return { begin: 0, end: 1 };
  }

  if (Array.isArray(minimapRange)) {
    const [begin, end] = minimapRange;
    return { begin, end };
  }

  return buildLabelWindow(minimapRange, labelsCount, hasColumns);
}

// Columns, and a single label, take the slots of their labels. Points take half an interval past either end, within
// the axis: the end points stay off the plot edges, and the edges of the window, half a label from any label, round to
// the end labels whatever the float error.
function buildLabelWindow({ from, to }: LabelRange, labelsCount: number, hasColumns: boolean): Range | undefined {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;

  const first = Math.max(0, Math.round(from));
  const last = Math.min(labelsCount - 1, Math.round(to));
  if (first > last) return undefined;

  if (hasColumns || labelsCount === 1) {
    return { begin: first / labelsCount, end: (last + 1) / labelsCount };
  }

  const lastLabelIndex = labelsCount - 1;
  return {
    begin: Math.max(0, (first - HALF_LABEL) / lastLabelIndex),
    end: Math.min(1, (last + HALF_LABEL) / lastLabelIndex),
  };
}

// Resolves the `initialZoom` param to a clamped label index, or `undefined` when not
// applicable (non-zoomable chart or empty series); out-of-range indexes are clamped
function resolveInitialZoomIndex(
  initialZoom: number | 'last' | undefined,
  isZoomable: boolean,
  labelsCount: number,
): number | undefined {
  if (initialZoom === undefined || !isZoomable || labelsCount === 0) {
    return undefined;
  }

  if (initialZoom === 'last') {
    return labelsCount - 1;
  }

  if (typeof initialZoom !== 'number') {
    return undefined;
  }

  return Math.max(0, Math.min(Math.round(initialZoom), labelsCount - 1));
}

function prepareHatchedRanges(ranges: HatchedRange[], labelsCount: number): HatchedRange[] {
  return ranges.flatMap((range) => {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) return [];

    const from = Math.max(0, Math.round(range.from));
    const to = Math.min(labelsCount - 1, Math.round(range.to));
    return from <= to ? [{ ...range, from, to }] : [];
  });
}

// The last point of a line or area chart has no interval after it, so a rule there stands at the point
function prepareEventLines(lines: EventLine[], labelsCount: number, hasColumns: boolean): EventLine[] {
  return lines.flatMap((line) => {
    const labelIndex = Math.round(line.labelIndex);
    const { offset } = line;
    if (!Number.isFinite(labelIndex) || labelIndex < 0 || labelIndex >= labelsCount) return [];
    if (offset === undefined) return [{ ...line, labelIndex }];
    if (!Number.isFinite(offset)) return [];

    const isLastPoint = !hasColumns && labelIndex === labelsCount - 1;
    return [{ ...line, labelIndex, offset: isLastPoint ? 0 : Math.min(1, Math.max(0, offset)) }];
  });
}

function prepareDatasets(
  data: LovelyChartParams,
  datasetColors: Record<string, ThemedColor> | undefined,
  fallbackColors: Record<string, ThemedColor> | undefined,
): { labels: (number | string)[]; datasets: AnalyzedDataset[] } {
  const { type, labels, datasets, hasSecondYAxis, isPercentage } = data;

  const defaultColors = getDefaultColors(datasets.length);
  let nextDefaultColor = 0;
  // The datasets of a percentage, pie or donut chart are shares of one whole, which takes the chart's type
  const canTakeOwnType = !isPercentage && type !== 'pie' && type !== 'donut';

  return {
    labels: [...labels],
    datasets: datasets.map(({ name, color, values, isInitiallyHidden, isDashed, isDotted, type: ownType }, i) => {
      const key = `y${i}`;
      const datasetType = (canTakeOwnType && ownType) || type;
      const { min: yMin, max: yMax } = getMaxMin(values);
      const ownColor = datasetColors?.[key] || color;
      // A dataset with no colour of its own holds its place among the default colours under a fallback colour, so
      // the next one takes a default colour apart from those the fallback colours took
      const defaultColor = ownColor ? undefined : defaultColors[nextDefaultColor++];

      return {
        type: datasetType,
        key,
        name,
        color: ownColor || fallbackColors?.[key] || defaultColor!,
        values: [...values],
        isInitiallyHidden,
        isDashed,
        isDotted,
        hasOwnYAxis: hasSecondYAxis && i === datasets.length - 1,
        hasOwnType: datasetType !== type,
        yMin,
        yMax,
      };
    }),
  };
}

/**
 * The default colours of a chart of `datasetCount` datasets, one per dataset. The chart gives them in order to the
 * datasets with no colour of their own, so where none has one, each dataset takes the colour at its index. Fewer than
 * eight datasets take a subset of `DEFAULT_COLORS` whose hues stand apart, and more take `DEFAULT_COLORS` again from
 * the first. Each call returns a new array.
 */
export function getDefaultColors(datasetCount: number): string[] {
  const subset = DEFAULT_COLORS_SUBSETS[datasetCount];
  if (subset) return subset.map((index) => DEFAULT_COLORS[index]);

  return Array.from({ length: datasetCount }, (_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
}
