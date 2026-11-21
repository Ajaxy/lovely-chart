import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(60);
const legend = document.getElementById('legend');
const hidden = document.getElementById('hidden');
const move = document.getElementById('move');
const regions = ['Europe', 'North America', 'Latin America', 'Asia', 'Africa', 'Oceania'];

const chart = new LovelyChart(document.getElementById('chart'), {
  title: 'Active users by region',
  type: 'area',
  isStacked: true,
  labels,
  datasets: regions.map((name, i) => ({
    name,
    values: series(60, { start: 9000 / (i + 1), trend: 0.003, volatility: 0.04, seed: 150 + i }),
  })),
  legendContainer: legend,
  onHiddenSeriesChange: (names) => {
    hidden.textContent = names.length ? `Hidden: ${names.join(', ')}` : '';
  },
});

let isInChart = false;
move.addEventListener('click', () => {
  isInChart = !isInChart;
  // Moves the live legend without a rebuild: hidden regions stay hidden
  chart.setLegendContainer(isInChart ? undefined : legend);
  move.textContent = isInChart ? 'Move the legend to the panel' : 'Move the legend into the chart';
});
