import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const period = 28;
const labels = days(period);
const revenue = (start, seed) => series(period * 2, {
  start, trend: 0.004, volatility: 0.06, seasonality: 0.15, seed,
});
const web = revenue(8200, 111);
const app = revenue(5400, 112);

new LovelyChart(document.getElementById('chart'), {
  title: 'Revenue',
  type: 'area',
  isStacked: true,
  labels,
  datasets: [
    { name: 'Web', color: '#3497ED', values: web.slice(period) },
    { name: 'App', color: '#9ED448', values: app.slice(period) },
  ],
  // The four weeks before, a value per dataset per label; the line draws their sum
  comparison: { name: 'Previous 4 weeks', values: [web.slice(0, period), app.slice(0, period)] },
  valuePrefix: '$',
  isTooltipTotalInTitle: true,
  isUtc: true,
});
