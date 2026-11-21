import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(180);

new LovelyChart(document.getElementById('chart'), {
  title: 'Daily active users',
  type: 'line',
  labels,
  datasets: [
    {
      name: 'Android',
      color: '#9ED448',
      values: series(180, { start: 52000, trend: 0.002, volatility: 0.03, seed: 2 }),
    },
    {
      name: 'iOS',
      color: '#3497ED',
      values: series(180, { start: 41000, trend: 0.003, volatility: 0.03, seed: 1 }),
    },
    {
      name: 'Web',
      color: '#F79E39',
      values: series(180, { start: 18000, volatility: 0.04, seasonality: 0.2, seed: 3 }),
    },
  ],
  withMinimap: true,
});
