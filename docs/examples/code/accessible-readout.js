import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(21);
const live = document.getElementById('live');

new LovelyChart(document.getElementById('chart'), {
  title: 'Steps',
  // The name assistive technology reads for the plot, in place of the summary of the data
  ariaLabel: 'Daily steps over the last three weeks, against a goal of 10,000',
  type: 'bar',
  labels,
  datasets: [{
    name: 'Steps',
    color: '#5FB641',
    values: series(21, { start: 9400, volatility: 0.12, seed: 241 }),
  }],
  referenceLines: [{ value: 10000, label: 'Goal' }, { value: 0, color: 'transparent' }],
  isUtc: true,
  // The plot takes the focus in the tab order; the arrows step through the days
  isKeyboardSelectable: true,
  // A polite live region of the page reads the selected day aloud
  onTooltipChange: (tooltip) => {
    const steps = tooltip?.rows[0].value;
    live.textContent = tooltip ? `${tooltip.title}: ${steps.toLocaleString('en-US')} steps` : '';
  },
});
