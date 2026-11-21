import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const year = days(365);
const sources = [
  {
    name: 'Organic',
    color: '#3497ED',
    values: series(365, { start: 3200, trend: 0.002, volatility: 0.04, seed: 171 }),
  },
  {
    name: 'Paid',
    color: '#F79E39',
    values: series(365, { start: 1400, trend: 0.003, volatility: 0.06, seed: 172 }),
  },
  {
    name: 'Social',
    color: '#9ED448',
    values: series(365, { start: 900, volatility: 0.07, seed: 173 }),
  },
];

// A new object for each period: the chart keeps a reference to the one it builds from
function getParams(count) {
  return {
    title: 'Visitors',
    type: 'line',
    labels: year.slice(-count),
    datasets: sources.map(({ name, color, values }) => ({ name, color, values: values.slice(-count) })),
    withMinimap: count > 90,
    isUtc: true,
  };
}

const chart = new LovelyChart(document.getElementById('chart'), getParams(30));

document.querySelectorAll('[data-days]').forEach((button, i, buttons) => {
  button.addEventListener('click', () => {
    buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    // Cross-fades into the new period; the sources hidden in the legend stay hidden
    chart.update(getParams(Number(button.dataset.days)), {
      isAnimated: true, shouldKeepFilter: true,
    });
  });
});
