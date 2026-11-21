import LovelyChart from 'lovely-chart';
import { hours, series } from './demo-data.js';

const labels = hours(48);
const readings = series(48, {
  start: 21.5, volatility: 0.015, seasonality: 0.05, period: 24, decimals: 1, seed: 12,
});

// The sensor was offline for six hours: `null` leaves a gap
const values = readings.map((value, i) => (i >= 26 && i < 32 ? null : value));

new LovelyChart(document.getElementById('chart'), {
  title: 'Server room temperature',
  type: 'line',
  labels,
  datasets: [{ name: 'Sensor 1', color: '#E65850', values }],
  valueSuffix: ' °C',
  isUtc: true,
});
