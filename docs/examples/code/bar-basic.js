import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);

new LovelyChart(document.getElementById('chart'), {
  title: 'Sign-ups',
  type: 'bar',
  labels,
  datasets: [{
    name: 'Sign-ups',
    color: '#5FB641',
    values: series(30, { start: 340, volatility: 0.12, seasonality: 0.25, seed: 14 }),
  }],
  // Bars fit the Y range to their values; a transparent line at 0 starts the range at zero
  referenceLines: [{ value: 0, color: 'transparent' }],
  isUtc: true,
});
