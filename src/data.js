import { getMaxMin } from './utils.js';
import { statsFormatDay, statsFormatDayHour, statsFormatText, statsFormatMin } from './format.js';
import { MILISECONDS_IN_DAY } from './constants.js';

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

const LABEL_TYPE_TO_FORMATTER = {
  'day': "statsFormat('day')",
  'hour': "statsFormat('hour')",
  '5min': "statsFormat('5min')",
  'dayHour': 'statsFormatDayHour',
  'text': undefined,
};

export function analyzeData(data, fallbackLabelType) {
  const { title, labelFormatter: labelFormatterRaw, tooltipFormatter, isStacked, isPercentage, secondaryYAxis, hasSecondYAxis, onZoom, withMinimap, minimapRange, noCaption, zoomOutLabel, valuePrefix, valueSuffix, prefixIsCurrency, limitDate, onLimitedRangeClick } = data;
  const labelType = data.labelType || inferLabelType(data.labels) || fallbackLabelType;
  const labelFormatter = labelFormatterRaw || (labelType && LABEL_TYPE_TO_FORMATTER[labelType]);
  const { datasets, labels } = prepareDatasets(data);

  const colors = {};
  let totalYMin = Infinity;
  let totalYMax = -Infinity;
  datasets.forEach(({ key, color, yMin, yMax }) => {
    colors[key] = color;

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }
  });

  let xLabels;
  switch (labelFormatter) {
    case 'statsFormatDayHour':
      xLabels = statsFormatDayHour(labels);
      break;
    case 'statsFormat(\'day\')':
      xLabels = statsFormatDay(labels);
      break;
    case 'statsFormat(\'hour\')':
    case 'statsFormat(\'5min\')':
      xLabels = statsFormatMin(labels);
      break;
    default:
      xLabels = statsFormatText(labels);
      break;
  }

  let limitBegin = null;
  if (limitDate != null) {
    const totalXWidth = labels.length - 1;
    const idx = labels.findIndex((l) => l >= limitDate);
    if (idx > 0) {
      limitBegin = idx / totalXWidth;
    }
  }

  const analyzed = {
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
  };

  analyzed.shouldZoomToPie = !analyzed.onZoom && analyzed.isPercentage;
  analyzed.isZoomable = analyzed.onZoom || analyzed.shouldZoomToPie;

  return analyzed;
}

function inferLabelType(labels) {
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
function buildMinimapRange(minimapRange) {
  if (!minimapRange) {
    return undefined;
  }

  if (minimapRange === 'full') {
    return { begin: 0, end: 1 };
  }

  const [begin, end] = minimapRange;
  return { begin, end };
}

function prepareDatasets(data) {
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

function getDefaultColors(datasetsCount) {
  const subset = DEFAULT_COLORS_SUBSETS[datasetsCount];
  return subset ? subset.map((index) => DEFAULT_COLORS[index]) : DEFAULT_COLORS;
}

function cloneArray(array) {
  return array.slice(0);
}
