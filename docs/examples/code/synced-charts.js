import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);
let isSyncing = false;

// Passes a selection on to the other chart, which reports it back: the flag ends the echo
const follow = (getOther) => (index) => {
  if (isSyncing) {
    return;
  }
  isSyncing = true;
  getOther().selectLabel(index);
  isSyncing = false;
};

const orders = new LovelyChart(document.getElementById('orders'), {
  title: 'Orders',
  type: 'bar',
  labels,
  datasets: [{
    name: 'Orders',
    color: '#3497ED',
    values: series(30, { start: 1200, volatility: 0.1, seed: 141 }),
  }],
  plotHeight: 180,
  onSelectedIndexChange: follow(() => revenue),
});

const revenue = new LovelyChart(document.getElementById('revenue'), {
  title: 'Revenue',
  type: 'line',
  labels,
  datasets: [{
    name: 'Revenue',
    color: '#5FB641',
    values: series(30, { start: 48000, volatility: 0.1, seed: 142 }),
  }],
  valuePrefix: '$',
  plotHeight: 180,
  onSelectedIndexChange: follow(() => orders),
});
