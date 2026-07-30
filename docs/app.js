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
    ]);

    data.forEach((chart, i) => {
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

    new LovelyChart(container, { ...data[5], title: 'Lovely Shares — Start Zoomed', initialZoom: 'last' });
    new LovelyChart(container, { ...data[2], title: 'Lovely Bars — Start Zoomed', initialZoom: 'last' });

    // Absolute stacked bars (no `isPercentage`) drilling into a single label's shares
    new LovelyChart(container, {
      ...data[2],
      onZoom: undefined,
      title: 'Lovely Bars — Zoom to Shares',
      zoomToShares: true,
      circleLabelsAround: 0,
      zoomType: 'donut',
      initialZoom: 'last',
    });

    // Only the middle label is lopsided, so a zoom that leaked its neighbours
    // into the sectors would read ~50/50 instead of 1/99
    new LovelyChart(container, {
      type: 'bar',
      isStacked: true,
      title: 'Lovely Bars — Zoom to Shares (single label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((m) => Date.UTC(2029, m, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 1, 500, 500] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 999, 500, 500] },
      ],
      withMinimap: true,
      initialZoom: 2,
    });

    // Zoomed onto the final label, where the half-label margin falls off the axis
    new LovelyChart(container, {
      type: 'bar',
      isStacked: true,
      title: 'Lovely Bars — Zoom to Shares (last label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((m) => Date.UTC(2029, m, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 500, 500, 1] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 500, 500, 999] },
      ],
      withMinimap: true,
      initialZoom: 'last',
    });
  })();

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('theme-dark');

    const skin = document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});
