import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const actualDays = 42;
const forecastDays = 14;
const labels = days(actualDays + forecastDays, { end: Date.UTC(2026, 10, 14) });
const values = series(actualDays + forecastDays, {
  start: 980, trend: 0.004, volatility: 0.05, seasonality: 0.12, seed: 91,
});

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'line',
  labels,
  datasets: [{ name: 'Orders', color: '#3497ED', values }],
  hatchedRanges: [{
    from: actualDays,
    to: actualDays + forecastDays - 1,
    label: 'Forecast',
    hasEdge: true,
    color: { light: '#108BE3', dark: '#48AAF0' },
    // A line under the rows of the tooltip at each day of the range
    note: 'Forecast, ±8% at 90% confidence',
  }],
  isUtc: true,
});
