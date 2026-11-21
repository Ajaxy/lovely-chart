import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(120);
const values = series(120, { start: 2600, trend: 0.004, volatility: 0.05, seed: 161 });
const releaseIndex = 100;
const element = document.getElementById('chart');

const badge = document.createElement('div');
badge.className = 'badge';
badge.textContent = `Total: ${values.reduce((sum, value) => sum + value, 0).toLocaleString('en-US')}`;
element.appendChild(badge);

let plotArea;
const chart = new LovelyChart(element, {
  title: 'Downloads',
  type: 'line',
  labels,
  datasets: [{ name: 'Downloads', color: '#3497ED', values }],
  withMinimap: true,
  eventLines: [{ labelIndex: releaseIndex, isDotted: true, color: '#E65850' }],
  onPlotAreaChange: (area) => {
    plotArea = area;
    placeLink();
  },
  // Each frame of a pan reports the labels, and the link follows its label
  onRangeChange: placeLink,
});

const link = document.createElement('a');
link.className = 'release';
link.href = 'https://github.com/Ajaxy/lovely-chart/blob/master/CHANGELOG.md';
link.target = '_blank';
link.textContent = 'v2.0';
link.hidden = true;
element.appendChild(link);

function placeLink() {
  const x = plotArea ? chart.getLabelX(releaseIndex) : undefined;
  link.hidden = x === undefined;
  if (x !== undefined) {
    link.style.left = `${plotArea.left + x}px`;
  }
}
