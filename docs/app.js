import LovelyChart from './LovelyChart.js';

function fetchJson(path) {
  return fetch(path).then((response) => response.json());
}

function fetchDayData(dataSource, timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

  return fetchJson(`${dataSource}/${path}.json`);
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');

  (async () => {
    const data = await Promise.all([
      fetchJson('./data/lines.json'),
      fetchJson('./data/lines-negative.json'),
      fetchJson('./data/bars.json'),
      fetchJson('./data/bars-negative.json'),
      fetchJson('./data/areas-absolute.json'),
      fetchJson('./data/areas.json'),
      fetchJson('./data/donut.json'),
      fetchJson('./data/steps.json'),
      fetchJson('./data/bars-monthly.json'),
    ]);

    data.slice(0, 8).forEach((chart, i) => {
      if (i === 2) {
        chart.onZoom = (date) => fetchDayData('data/zoom_bars', date);
      }

      // "Lovely Areas with Zoom" — limit selection to September 1, 2025 onwards
      if (i === 5) {
        chart.limitDate = 1756684800000;
        chart.onLimitedRangeClick = () => alert('Data before September 2025 is not available');
      }

      new LovelyChart(container, chart);
    });

    // Monthly stacked bars of absolute values, drilling into a single month's
    // composition — `zoomToShares` keeps the bar heights the overview is for,
    // and `circleLabelsAround` lets the zoomed minimap reach every month
    new LovelyChart(container, data[8]);
  })();

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('theme-dark');

    const skin = document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});
