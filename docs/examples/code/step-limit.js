import LovelyChart from 'lovely-chart';

const data = await fetch('../data/steps.json').then((response) => response.json());
const plannedDays = 5;

new LovelyChart(document.getElementById('chart'), {
  title: 'Storage quotas',
  type: 'step',
  labels: data.labels,
  datasets: [
    { ...data.datasets[0], color: '#3497ED' },
    { ...data.datasets[1], color: '#3497ED', isDashed: true },
  ],
  valueSuffix: ' GB',
  referenceLines: [{ value: 2600, label: 'Limit', color: { light: '#E65850', dark: '#F07068' } }],
  hatchedRanges: [{
    from: data.labels.length - plannedDays,
    to: data.labels.length - 1,
    label: 'Planned',
    hasEdge: true,
  }],
  isUtc: true,
});
