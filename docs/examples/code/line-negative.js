import LovelyChart from 'lovely-chart';

const { labels, datasets } = await fetch('../data/lines-negative.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  title: 'Average temperature',
  type: 'line',
  labels,
  datasets: datasets.map((dataset, i) => ({ ...dataset, name: ['Oslo', 'Berlin', 'Lisbon'][i] })),
  valueSuffix: '°C',
  referenceLines: [{ value: 0, label: 'Freezing', color: { light: '#2373DB', dark: '#7FB8F0' } }],
  areLinesSmooth: true,
});
