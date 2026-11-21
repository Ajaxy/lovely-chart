import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);
const metrics = [
  {
    name: 'Visitors',
    type: 'area',
    color: '#3497ED',
    values: series(30, { start: 4200, trend: 0.01, seed: 201 }),
  },
  {
    name: 'Sign-ups',
    type: 'bar',
    color: '#5FB641',
    values: series(30, { start: 310, volatility: 0.15, seed: 202 }),
  },
  {
    name: 'Revenue',
    type: 'line',
    color: '#F79E39',
    values: series(30, { start: 9800, trend: 0.004, seed: 203 }),
  },
  {
    name: 'Churn',
    type: 'line',
    color: '#E65850',
    values: series(30, { start: 42, trend: -0.01, seed: 204 }),
  },
];
const body = document.querySelector('.metrics tbody');

metrics.forEach(({ name, type, color, values }) => {
  const today = values[values.length - 1];
  const change = ((today - values[0]) / values[0]) * 100;
  const row = body.insertRow();
  row.insertCell().textContent = name;
  const cell = row.insertCell();
  row.insertCell().textContent = today.toLocaleString('en-US');
  const changeCell = row.insertCell();
  changeCell.textContent = `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}%`;
  changeCell.className = change >= 0 ? 'up' : 'down';

  new LovelyChart(cell, {
    type,
    labels,
    datasets: [{ name, color, values }],
    // The plot alone: no axes, grid, header or legend
    isSparkline: true,
    plotHeight: 36,
    areaOpacity: 0.25,
    areaBorderColor: color,
    ariaLabel: `${name}, last 30 days`,
    noZoom: true,
  });
});
