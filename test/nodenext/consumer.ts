// Resolves `lovely-chart` through the package's own `exports`, so it checks the built `dist/` declarations
/* eslint-disable no-null/no-null -- The public API takes `null` for a gap and for an unknown total */
import LovelyChart, {
  type ChartType, type Comparison, type DateLocale, type LabelType, type LovelyChartDatasetParams,
  type LovelyChartInstance, type LovelyChartParams, type ReferenceLine, type SecondaryYAxisConfig, type ThemedColor,
} from 'lovely-chart';

declare const element: HTMLElement;

const labels = [1, 2, 3];
const datasets: LovelyChartDatasetParams[] = [
  { name: 'A', values: [1, null, 3], isDashed: true, isInitiallyHidden: false },
  { name: 'B', values: [2, 1, null], isDotted: true },
];
const comparison: Comparison = { name: 'Previous period', values: [[1, null, 3]] };
const reference: ReferenceLine = { value: 0, color: 'transparent' };
const surface: ThemedColor = { light: '#F5F6F7', dark: '#212A33' };
const dateLocale: DateLocale = { weekOf: 'Semana de' };
const secondaryYAxis: SecondaryYAxisConfig = { label: 'x', multiplier: 1 };
const type: ChartType = 'area';
const labelType: LabelType = 'day';

const params: LovelyChartParams = {
  type,
  isStacked: true,
  labels,
  labelType,
  tooltipFormatter: 'statsTooltipFormat(\'week\')',
  datasets,
  comparison,
  referenceLines: [reference, { value: 1200, label: 'Stall', color: surface }],
  isTooltipOrderFixed: true,
  isTooltipTotalInTitle: true,
  formatTooltipValue: (value) => value.toFixed(1),
  resolveTooltipTotal: (labelValue, datasetIndexes) => (datasetIndexes.length ? labelValue : null),
  isYAxisOutward: true,
  areLabelsContrast: true,
  noFloatSteps: true,
  backgroundColor: surface,
  axisTextColor: '#656C7A',
  colorScheme: 'system',
  isUtc: true,
  plotHeight: 52,
  isSparkline: false,
  axisFontSize: 11,
  areLinesSmooth: true,
  areaOpacity: 0.5,
  areaBorderColor: surface,
  legendContainer: element,
  dateLocale,
  secondaryYAxis,
  onZoom: (labelValue) => Promise.resolve({ type: 'line', labels: [labelValue], datasets, colors: { y0: '#3497ED' } }),
  onZoomChange: (labelValue) => labelValue?.toFixed(),
  onHiddenSeriesChange: (names, datasetIndexes) => names.length + datasetIndexes.length,
  onSelectedIndexChange: (labelIndex) => labelIndex?.toFixed(),
};

const chart = new LovelyChart(element, params);
chart.selectLabel(2);
chart.selectLabel(undefined);

const handle: LovelyChartInstance = chart;
handle.update({ ...params, colorScheme: 'htmlClassName' });

// @ts-expect-error A misspelled option fails, so the params are typed rather than `any`
const misspelled: LovelyChartParams = { type: 'line', labels, datasets, sparkline: true };

export { misspelled };
