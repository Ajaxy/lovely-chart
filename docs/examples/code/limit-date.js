import LovelyChart from 'lovely-chart';

const data = await fetch('../data/areas-absolute.json').then((response) => response.json());
const message = document.getElementById('message');
const openDays = 120;

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit harvest',
  // The labels before it stay under a mask the window cannot enter
  limitDate: data.labels[data.labels.length - openDays],
  onLimitedRangeClick: () => {
    message.textContent = 'The full year comes with the Pro plan.';
  },
  minimapRange: { from: data.labels.length - 30, to: data.labels.length - 1 },
});
