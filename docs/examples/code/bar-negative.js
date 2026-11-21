import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-negative.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Net revenue',
  valuePrefix: '$',
  // `-$120` in place of `$-120`
  isCurrencyPrefix: true,
  isTooltipTotalInTitle: true,
});
