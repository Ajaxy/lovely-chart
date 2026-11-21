import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(90);
const card = document.querySelector('.card');

const chart = new LovelyChart(document.getElementById('chart'), {
  type: 'area',
  isStacked: true,
  labels,
  datasets: [
    // Colours from the page's custom properties, computed inside the chart's element
    {
      name: 'Monthly',
      color: 'var(--brand-1)',
      values: series(90, { start: 2400, trend: 0.004, seed: 221 }),
    },
    {
      name: 'Yearly',
      color: 'var(--brand-2)',
      values: series(90, { start: 1100, trend: 0.006, seed: 222 }),
    },
    {
      name: 'Trials',
      color: 'color-mix(in srgb, var(--brand-1) 35%, var(--card-surface))',
      values: series(90, { start: 600, volatility: 0.1, seed: 223 }),
    },
  ],
  axisTextColor: 'var(--card-muted)',
  backgroundColor: 'var(--card-surface)',
  withMinimap: true,
  noHeader: true,
  isUtc: true,
});

card.querySelectorAll('[data-palette]').forEach((button, i, buttons) => {
  button.addEventListener('click', () => {
    buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    card.dataset.palette = button.dataset.palette;
    // The chart reads its `var()` colours again: the palette changed on another trigger than the skin
    chart.refreshColors();
  });
});
