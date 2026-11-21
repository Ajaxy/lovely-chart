import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(60);

new LovelyChart(document.getElementById('chart'), {
  title: 'API response time, p95',
  type: 'line',
  labels,
  datasets: [
    {
      name: 'Checkout',
      color: '#3497ED',
      values: series(60, { start: 230, volatility: 0.09, seed: 81 }),
    },
    {
      name: 'Search',
      color: '#9ED448',
      values: series(60, { start: 160, volatility: 0.09, seed: 82 }),
    },
  ],
  valueSuffix: ' ms',
  referenceLines: [
    { value: 250, label: 'Target', color: { light: '#1A7F37', dark: '#56D364' } },
    { value: 400, label: 'Alert', color: { light: '#E65850', dark: '#F07068' } },
    // Starts the range at zero and draws nothing
    { value: 0, color: 'transparent' },
  ],
  noFloatSteps: true,
});
