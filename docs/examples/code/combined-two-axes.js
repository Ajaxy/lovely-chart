import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);
const orders = [
  {
    name: 'Apples',
    color: '#E65850',
    values: series(30, { start: 420, volatility: 0.12, seed: 41 }),
  },
  {
    name: 'Oranges',
    color: '#F79E39',
    values: series(30, { start: 310, volatility: 0.12, seed: 42 }),
  },
  {
    name: 'Lemons',
    color: '#F5BD25',
    values: series(30, { start: 180, volatility: 0.12, seed: 43 }),
  },
];
const appleShare = labels.map((_, i) => {
  const total = orders.reduce((sum, { values }) => sum + values[i], 0);
  return Math.round((orders[0].values[i] / total) * 1000) / 10;
});

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders and the share of apples',
  type: 'bar',
  isStacked: true,
  // The last dataset takes a Y axis of its own, at the right
  hasSecondYAxis: true,
  labels,
  datasets: [...orders, { name: 'Apples, %', type: 'line', color: '#2373DB', values: appleShare }],
  areLabelsContrast: true,
});
