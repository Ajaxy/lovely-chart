import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(60);
const color = '#3497ED';

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders against the plan',
  type: 'line',
  labels,
  datasets: [
    {
      name: 'Actual',
      color,
      values: series(60, { start: 820, trend: 0.004, volatility: 0.05, seasonality: 0.1, seed: 8 }),
    },
    {
      name: 'Plan',
      color,
      values: labels.map((_, i) => Math.round(800 * 1.004 ** i)),
      isDashed: true,
    },
    {
      name: 'Last year',
      color,
      values: series(60, { start: 690, trend: 0.003, volatility: 0.05, seed: 9 }),
      isDotted: true,
    },
  ],
  isUtc: true,
});
