import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);
const sales = (start, seed) => series(30, { start, volatility: 0.14, seed });

new LovelyChart(document.getElementById('chart'), {
  title: 'Fruit sales',
  type: 'line',
  labels,
  datasets: [
    { name: 'Apples', color: '#E65850', values: sales(140, 4) },
    { name: 'Oranges', color: '#F79E39', values: sales(95, 5) },
    // Starts unchecked in the legend
    { name: 'Kiwi', color: '#5FB641', values: sales(60, 6), isInitiallyHidden: true },
  ],
  areLinesSmooth: true,
});
