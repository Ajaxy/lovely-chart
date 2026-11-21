import LovelyChart from 'lovely-chart';

const data = await fetch('../data/donut.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit in stock',
  withGradient: true,
});
