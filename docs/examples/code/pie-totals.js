import LovelyChart from 'lovely-chart';

new LovelyChart(document.getElementById('chart'), {
  title: 'Traffic sources',
  type: 'pie',
  // One label, each dataset's `values` holding its total
  labels: ['Total'],
  datasets: [
    { name: 'Search', values: [48210] },
    { name: 'Direct', values: [27940] },
    { name: 'Social', values: [16380] },
    { name: 'Referral', values: [9120] },
    { name: 'Email', values: [5470] },
  ],
});
