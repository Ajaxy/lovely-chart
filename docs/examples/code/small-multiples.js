import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const period = 28;
const labels = days(period);
const color = '#3497ED';
const grid = document.querySelector('.grid');

['North', 'South', 'East', 'West'].forEach((region, i) => {
  const values = series(period * 2, {
    start: 900 + i * 350, trend: 0.004, volatility: 0.06, seed: 211 + i,
  });
  const recent = values.slice(period);

  const cell = document.createElement('div');
  cell.innerHTML = `<div class="cell-head">${region}<span>${recent[period - 1].toLocaleString('en-US')}</span></div>`;
  grid.appendChild(cell);

  new LovelyChart(cell, {
    type: 'line',
    labels,
    datasets: [
      { name: 'Last 4 weeks', color, values: recent },
      { name: 'The 4 weeks before', color, values: values.slice(0, period), isDashed: true },
    ],
    ariaLabel: `${region}: the last 4 weeks against the 4 before`,
    plotHeight: 110,
    // The axes and the plot alone: the page draws one key for every chart
    noHeader: true,
    noTooltip: true,
    legendContainer: document.createElement('div'),
    areLabelsContrast: true,
    isUtc: true,
  });
});
