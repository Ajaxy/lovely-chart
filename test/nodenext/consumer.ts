// Resolves `lovely-chart` through the package's own `exports`, so it checks the built `dist/` declarations
/* eslint-disable no-null/no-null -- The public API takes `null` for a gap and for an unknown total */
import LovelyChart, {
  type ChartType, type Comparison, type DateLocale, DEFAULT_COLORS, DEFAULT_COMPARISON_COLOR, type EventLine,
  getDefaultColors, type HatchedRange, type LabelType, type LovelyChartDatasetParams, type LovelyChartInstance,
  type LovelyChartParams, type LovelyChartUpdateOptions, type ReferenceLine, type SecondaryYAxisConfig,
  type ThemedColor, type TooltipContent, type TooltipNotes,
} from 'lovely-chart';

declare const element: HTMLElement;

const labels = [1, 2, 3];
const datasets: LovelyChartDatasetParams[] = [
  { name: 'A', values: [1, null, 3], isDashed: true, isInitiallyHidden: false, color: 'var(--color-accent)' },
  { name: 'B', values: [2, 1, null], isDotted: true, type: 'line', color: { light: '#3497ED', dark: '#48AAF0' } },
];
const comparison: Comparison = { name: 'Previous period', values: [[1, null, 3]], color: 'var(--color-text-muted)' };
const reference: ReferenceLine = { value: 0, color: 'transparent' };
const surface: ThemedColor = { light: '#F5F6F7', dark: '#212A33' };
const forecast: HatchedRange = { from: 1, to: 2, label: 'Forecast', hasEdge: true, isAccruing: false, color: surface };
const estimate: HatchedRange = { from: 0, to: 0, note: 'Estimated\nFrom partial data', titleNote: 'est.' };
const notes: TooltipNotes = { titleNote: 'upd. 14:05 UTC', notes: ['Today is still in progress'] };
const launch: EventLine = { labelIndex: 1, offset: 0.5, label: 'Launch', color: surface };
const dateLocale: DateLocale = { weekOf: 'Semana de' };
const secondaryYAxis: SecondaryYAxisConfig = { label: 'x', multiplier: 1 };
const type: ChartType = 'area';
const labelType: LabelType = 'day';
const readTooltip = (tooltip: TooltipContent | undefined) => [
  tooltip?.labelIndex.toFixed(), tooltip?.title, tooltip?.total?.toFixed(), tooltip?.comparison?.change?.toFixed(),
  tooltip?.comparison?.value?.toFixed(), tooltip?.comparison?.name,
  tooltip?.rows.map(({ datasetIndex, name, value }) => `${datasetIndex} ${name} ${value ?? '—'}`),
];

const params: LovelyChartParams = {
  type,
  ariaLabel: 'Orders by platform',
  isStacked: true,
  labels,
  labelType,
  tooltipFormatter: 'statsTooltipFormat(\'week\')',
  datasets,
  comparison,
  referenceLines: [reference, { value: 1200, label: 'Stall', color: surface }],
  hatchedRanges: [forecast, { from: 0, to: 0, color: 'rgba(0, 0, 0, 0.5)' }, estimate],
  eventLines: [launch, { labelIndex: 0, color: 'rgba(0, 0, 0, 0.5)' }],
  isTooltipOrderFixed: true,
  isTooltipTotalInTitle: true,
  formatTooltipValue: (value) => value.toFixed(1),
  resolveTooltipTotal: (labelValue, datasetIndexes, labelIndex) => (datasetIndexes.length ? labels[labelIndex] : null),
  resolveTooltipNotes: (labelValue, datasetIndexes, labelIndex) => (
    labelIndex === labels.length - 1 && datasetIndexes.length ? notes : undefined
  ),
  isYAxisOutward: true,
  areLabelsContrast: true,
  noFloatSteps: true,
  backgroundColor: surface,
  axisTextColor: '#656C7A',
  colorScheme: 'system',
  isUtc: true,
  plotHeight: 52,
  isSparkline: false,
  isLoading: false,
  noHeader: true,
  noTooltip: false,
  noCaption: true,
  noZoomOutControl: true,
  axisFontSize: 11,
  areLinesSmooth: true,
  areaOpacity: 0.5,
  areaBorderColor: surface,
  legendContainer: element,
  withMinimap: true,
  minimapRange: { from: 1, to: 2 },
  dateLocale,
  secondaryYAxis,
  onZoom: (labelValue) => Promise.resolve({ type: 'line', labels: [labelValue], datasets, colors: { y0: surface } }),
  onZoomChange: (labelValue, labelIndex) => [labelValue?.toFixed(), labelIndex?.toFixed()],
  onHiddenSeriesChange: (names, datasetIndexes) => names.length + datasetIndexes.length,
  onSelectedIndexChange: (labelIndex) => labelIndex?.toFixed(),
  isKeyboardSelectable: true,
  onTooltipChange: readTooltip,
  onPlotAreaChange: (area) => (area ? area.left + area.top + area.width + area.height : undefined),
};

const chart = new LovelyChart(element, params);
chart.selectLabel(2);
chart.selectLabel(undefined);
chart.refreshColors();
chart.setLegendContainer(element);
chart.setLegendContainer(undefined);
const labelX: number | undefined = chart.getLabelX(1, 0.5) ?? chart.getLabelX(1);
chart.zoomOut();
chart.setLoading(true);

const keptView: LovelyChartUpdateOptions = { shouldKeepFilter: true, shouldKeepZoom: true, shouldKeepSelection: false };
chart.update(params, keptView);
chart.update(params, { ...keptView, isAnimated: true });

const handle: LovelyChartInstance = chart;
handle.update({ ...params, colorScheme: 'htmlClassName' });
handle.update(params, { shouldKeepSelection: true });
handle.update({ ...params, labels: [], datasets: [{ name: 'A', values: [] }], isLoading: true });

// @ts-expect-error A misspelled option fails, so the params are typed rather than `any`
const misspelled: LovelyChartParams = { type: 'line', labels, datasets, sparkline: true };

// Swatches of the page in the default colours of a chart of two datasets and of its comparison line
const swatches: string[] = [...getDefaultColors(2), DEFAULT_COMPARISON_COLOR];
// @ts-expect-error The exported palette is read-only
DEFAULT_COLORS[0] = DEFAULT_COMPARISON_COLOR;

export { labelX, misspelled, swatches };
