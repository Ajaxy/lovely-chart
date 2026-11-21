import LovelyChart from 'lovely-chart';

const data = await fetch('../data/lines.json').then((response) => response.json());
const range = document.getElementById('range');
const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Reviews',
  isRangeSelectable: true,
  onRangeChange: (visible) => {
    range.textContent = visible
      ? `Showing ${formatDate(data.labels[visible.from])} — ${formatDate(data.labels[visible.to])}`
      : '';
  },
});
