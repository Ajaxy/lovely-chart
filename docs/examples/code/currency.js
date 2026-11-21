import LovelyChart from 'lovely-chart';
import { days, random } from './demo-data.js';

const labels = days(45);
const nextRandom = random(61);
// A wave of good and bad weeks, with noise
const profit = labels.map((_, i) => Math.round(Math.sin(i / 6) * 3800 + (nextRandom() - 0.4) * 2600));
const dollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

new LovelyChart(document.getElementById('chart'), {
  title: 'Daily profit',
  type: 'line',
  labels,
  datasets: [{ name: 'Profit', color: '#5FB641', values: profit }],
  valuePrefix: '$',
  // `-$1,250` in place of `$-1,250`
  isCurrencyPrefix: true,
  formatTooltipValue: (value) => dollars.format(value),
  // The labels stand in a column left of the plot, so the line never runs under them
  isYAxisOutward: true,
  referenceLines: [{ value: 0, label: 'Break-even' }],
});
