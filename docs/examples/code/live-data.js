import LovelyChart from 'lovely-chart';
import { random } from './demo-data.js';

const MINUTE = 60 * 1000;
const count = 60;
const nextRandom = random(181);
const nextValue = (previous) => Math.max(200, Math.round(previous + (nextRandom() - 0.5) * 120));

let labels = Array.from({ length: count }, (_, i) => Date.UTC(2026, 10, 20, 12) + i * MINUTE);
let values = labels.reduce((all) => [...all, nextValue(all[all.length - 1] ?? 1200)], []);

const getParams = () => ({
  title: 'Active connections',
  type: 'area',
  labels,
  labelType: '5min',
  datasets: [{ name: 'Connections', color: '#3497ED', values }],
  areaOpacity: 0.2,
  areaBorderColor: '#3497ED',
  isUtc: true,
});

const chart = new LovelyChart(document.getElementById('chart'), getParams());

// A minute of data every second: the oldest leaves, the newest arrives
setInterval(() => {
  labels = [...labels.slice(1), labels[count - 1] + MINUTE];
  values = [...values.slice(1), nextValue(values[count - 1])];
  chart.update(getParams(), { shouldKeepFilter: true, shouldKeepSelection: true });
}, 1000);
