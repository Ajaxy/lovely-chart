import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(90);
const color = { light: '#2373DB', dark: '#48AAF0' };

new LovelyChart(document.getElementById('chart'), {
  title: 'Revenue',
  type: 'area',
  labels,
  datasets: [{
    name: 'Revenue',
    color,
    values: series(90, { start: 12400, trend: 0.005, volatility: 0.05, seed: 21 }),
  }],
  areaOpacity: 0.18,
  areaBorderColor: color,
  valuePrefix: '$',
  isYAxisOutward: true,
});
