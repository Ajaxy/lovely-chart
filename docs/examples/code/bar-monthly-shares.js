import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-monthly.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  title: 'Monthly spending',
  type: 'bar',
  isStacked: true,
  labels: data.labels,
  labelType: 'month',
  datasets: data.datasets,
  valuePrefix: '$',
  // A click on a month opens a donut of its categories
  zoomToShares: true,
  zoomType: 'donut',
  // The donut covers the clicked month alone
  circleLabelsAround: 0,
});
