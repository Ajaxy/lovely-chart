import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(40);

new LovelyChart(document.getElementById('chart'), {
  title: 'Sign-ups',
  type: 'bar',
  labels,
  datasets: [{
    name: 'Sign-ups',
    color: '#5FB641',
    values: series(40, { start: 520, trend: 0.01, volatility: 0.08, seed: 101 }),
  }],
  eventLines: [
    // At the start of the day's column
    { labelIndex: 12, offset: 0, label: 'Version 2.0' },
    {
      labelIndex: 27,
      label: 'Outage',
      color: { light: '#E65850', dark: '#F07068' },
      isDashed: true,
      // A pin with a head over the axis labels, and a note in the tooltip of its day
      withHead: true,
      hint: 'Sign-ups were down\nfor 40 minutes',
    },
  ],
  referenceLines: [{ value: 0, color: 'transparent' }],
  isUtc: true,
});
