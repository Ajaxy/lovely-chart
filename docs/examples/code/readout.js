import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const count = 14;
const labels = days(count);
// Four weeks of each channel: the last two on the chart, the two before as its comparison
const channels = [
  { name: 'Delivery', color: '#3497ED', seed: 131 },
  { name: 'Pickup', color: '#9ED448', seed: 132 },
  { name: 'Dine-in', color: '#F5BD25', seed: 133 },
].map(({ name, color, seed }) => ({
  name,
  color,
  values: series(count * 2, { start: 300, volatility: 0.12, seed }),
}));
const readout = document.querySelector('.readout');
const format = (value) => (value === null ? '—' : value.toLocaleString('en-US'));

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders by channel',
  type: 'bar',
  isStacked: true,
  labels,
  datasets: channels.map(({ name, color, values }) => ({ name, color, values: values.slice(count) })),
  comparison: { name: 'Two weeks before', values: channels.map(({ values }) => values.slice(0, count)) },
  isKeyboardSelectable: true,
  onTooltipChange: renderReadout,
});
renderReadout(undefined);

// What the tooltip would show: the day, its total, a row per dataset on screen and the change against the comparison
function renderReadout(tooltip) {
  if (!tooltip) {
    readout.innerHTML = '<p class="hint">Point at a day, or focus the chart and press ← or →</p>';
    return;
  }
  const { title, total, rows, comparison } = tooltip;
  const { change } = comparison;
  const changeHtml = change === undefined
    ? ''
    : ` <span class="change" data-tone="${change < 0 ? 'negative' : 'positive'}">`
      + `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(1)}%</span>`;
  const rowHtml = ({ datasetIndex, name, value }) => `
    <div class="readout-line">
      <span class="swatch" style="background: ${channels[datasetIndex].color}"></span>
      ${name}<b>${format(value)}</b>
    </div>`;

  readout.innerHTML = `
    <div class="readout-line readout-title">${title}<b>${format(total)}</b></div>
    ${rows.map(rowHtml).join('')}
    <div class="readout-line readout-comparison">
      ${comparison.name}<b>${format(comparison.value)}${changeHtml}</b>
    </div>`;
}
