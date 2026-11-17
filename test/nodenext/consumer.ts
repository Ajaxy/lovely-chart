// Resolves `lovely-chart` through the package's own `exports`, so it checks the built `dist/` declarations
/* eslint-disable no-null/no-null -- The public API takes `null` for a gap */
import LovelyChart, {
  type ChartType, type LabelType, type LovelyChartDatasetParams, type LovelyChartInstance, type LovelyChartParams,
  type SecondaryYAxisConfig,
} from 'lovely-chart';

declare const element: HTMLElement;

const labels = [1, 2, 3];
const datasets: LovelyChartDatasetParams[] = [
  { name: 'A', values: [1, null, 3] },
];
const secondaryYAxis: SecondaryYAxisConfig = { label: 'x', multiplier: 1 };
const type: ChartType = 'area';
const labelType: LabelType = 'day';

const params: LovelyChartParams = {
  type,
  isStacked: true,
  labels,
  labelType,
  tooltipFormatter: 'statsTooltipFormat(\'day\')',
  datasets,
  secondaryYAxis,
};

const chart = new LovelyChart(element, params);

const handle: LovelyChartInstance = chart;
handle.update(params);

// @ts-expect-error A misspelled option fails, so the params are typed rather than `any`
const misspelled: LovelyChartParams = { type: 'line', labels, datasets, sparkline: true };

export { misspelled };
