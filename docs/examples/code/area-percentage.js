import LovelyChart from 'lovely-chart';

const data = await fetch('../data/areas.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  title: 'Share of the market',
  type: 'area',
  isPercentage: true,
  labels: data.labels,
  datasets: data.datasets,
  withMinimap: true,
  // A click on a day opens a pie of its shares
  zoomType: 'pie',
});
