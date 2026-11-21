import LovelyChart from 'lovely-chart';

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders by weekday',
  type: 'bar',
  isStacked: true,
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    { name: 'Delivery', color: '#3497ED', values: [412, 398, 431, 456, 512, 604, 577] },
    { name: 'Pickup', color: '#9ED448', values: [188, 176, 194, 203, 241, 322, 298] },
    { name: 'Dine-in', color: '#F5BD25', values: [96, 102, 99, 118, 187, 264, 231] },
  ],
});
