import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-monthly.json').then((response) => response.json());
const halfYearBudgets = [2800, 3000];

new LovelyChart(document.getElementById('chart'), {
  title: 'Spending against the budget',
  type: 'bar',
  isStacked: true,
  labels: data.labels,
  labelType: 'month',
  datasets: [
    ...data.datasets,
    {
      name: 'Budget',
      // Drawn as steps over the bars, and kept out of the stack and the Total row
      type: 'step',
      color: '#2373DB',
      values: data.labels.map((_, i) => halfYearBudgets[Math.floor(i / 6)]),
      isDashed: true,
    },
  ],
  valuePrefix: '$',
  hatchedRanges: [{ from: 10, to: 11, label: 'Estimated' }],
});
