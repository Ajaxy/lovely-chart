import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(90);
const daily = (start, seed) => series(90, { start, volatility: 0.1, seed });

new LovelyChart(document.getElementById('chart'), {
  title: 'Spending by category',
  type: 'pie',
  labels,
  datasets: [
    { name: 'Groceries', values: daily(42, 31) },
    { name: 'Transport', values: daily(18, 32) },
    { name: 'Eating out', values: daily(26, 33) },
    { name: 'Leisure', values: daily(15, 34) },
  ],
  valuePrefix: '$',
  // The pie sums the days of the window, the last two weeks to start with
  withMinimap: true,
  minimapRange: { from: 76, to: 89 },
});
