import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const params = { title: 'Orders', type: 'line', withMinimap: true, isUtc: true };
const reload = document.getElementById('reload');

// Stands in for a request that takes a second and a half
function fetchOrders(seed) {
  const data = {
    labels: days(120),
    datasets: [
      {
        name: 'iOS',
        color: '#3497ED',
        values: series(120, { start: 640, volatility: 0.05, seed }),
      },
      {
        name: 'Android',
        color: '#9ED448',
        values: series(120, { start: 820, volatility: 0.05, seed: seed + 1 }),
      },
    ],
  };
  return new Promise((resolve) => setTimeout(() => resolve(data), 1500));
}

// Data with no labels draws a skeleton of the chart to come, a pill per legend entry
const chart = new LovelyChart(document.getElementById('chart'), {
  ...params,
  labels: [],
  datasets: [{ name: 'iOS', values: [] }, { name: 'Android', values: [] }],
  isLoading: true,
});

let seed = 191;
reload.addEventListener('click', async () => {
  reload.disabled = true;
  // The data on screen dims, keeping its window and hidden datasets, until the next arrives
  chart.setLoading(true);
  seed += 2;
  chart.update({ ...params, ...(await fetchOrders(seed)) });
  reload.disabled = false;
});

chart.update({ ...params, ...(await fetchOrders(seed)) });
reload.disabled = false;
