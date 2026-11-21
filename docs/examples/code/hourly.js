import LovelyChart from 'lovely-chart';
import { hours, series } from './demo-data.js';

const labels = hours(72);
const traffic = (start, seed) => series(72, {
  start, volatility: 0.05, seasonality: 0.45, period: 24, seed,
});

new LovelyChart(document.getElementById('chart'), {
  title: 'Requests per hour',
  type: 'area',
  isStacked: true,
  labels,
  labelType: 'hour',
  // `18 Nov 14:00` on the axis and in the tooltip, in UTC whatever the reader's time zone
  labelFormatter: 'statsFormatDayHour',
  tooltipFormatter: 'statsFormatDayHourFull',
  isUtc: true,
  datasets: [
    { name: 'Europe', color: '#3497ED', values: traffic(5200, 71) },
    { name: 'Americas', color: '#9ED448', values: traffic(4100, 72) },
    { name: 'Asia', color: '#F5BD25', values: traffic(2900, 73) },
  ],
  withMinimap: true,
  minimapRange: 'full',
});
