import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars.json').then((response) => response.json());

// The hours of a day: `data/zoom_bars/2028-06/01.json` holds a full set of params of its own
function fetchDay(timestamp) {
  const [year, month, day] = new Date(timestamp).toISOString().slice(0, 10).split('-');
  return fetch(`../data/zoom_bars/${year}-${month}/${day}.json`).then((response) => response.json());
}

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Deliveries',
  // Called with the timestamp of the clicked day
  onZoom: fetchDay,
});
