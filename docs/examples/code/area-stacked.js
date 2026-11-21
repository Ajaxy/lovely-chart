import LovelyChart from 'lovely-chart';

const data = await fetch('../data/areas-absolute.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  title: 'Fruit harvest',
  type: 'area',
  isStacked: true,
  labels: data.labels,
  datasets: data.datasets,
  withMinimap: true,
  valueSuffix: ' kg',
});
