import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(60);

new LovelyChart(document.getElementById('chart'), {
  title: 'Revenue in Stars',
  type: 'bar',
  labels,
  datasets: [{
    name: 'Stars',
    color: '#F5BD25',
    values: series(60, { start: 52000, trend: 0.006, volatility: 0.1, seed: 51 }),
  }],
  valueSuffix: ' ⭐',
  // The same values in dollars, at the right of the plot and as a row of the tooltip
  secondaryYAxis: { label: 'In dollars', multiplier: 0.013, prefix: '$' },
  formatTooltipValue: (value) => Math.round(value).toLocaleString('en-US'),
  referenceLines: [{ value: 0, color: 'transparent' }],
});
