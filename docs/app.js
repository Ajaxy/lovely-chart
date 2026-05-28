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
      fetchJson('./data/pie.json'),
    ]);

    data.forEach((chart, i) => {
      if (i === 2) {
        chart.onZoom = (date) => fetchDayData('data/zoom_bars', date);
      }

      // "Lovely Areas with Zoom" — limit selection to September 1, 2018 onwards
      if (i === 5) {
        chart.limitDate = 1535760000000;
        chart.onLimitedRangeClick = () => alert('Data before September 2018 is not available');
      }

      LovelyChart.create(container, chart);
    });

    setupLifecycleDemo(data[0], data[1]);
  })();

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('theme-dark');

    const skin = document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});

function setupLifecycleDemo(dataA, dataB) {
  const target = document.getElementById('lifecycle-container');
  const updateBtn = document.getElementById('lifecycle-update');
  const destroyBtn = document.getElementById('lifecycle-destroy');
  const recreateBtn = document.getElementById('lifecycle-recreate');

  let chart = LovelyChart.create(target, dataA);
  let showingA = true;

  updateBtn.addEventListener('click', () => {
    if (!chart) return;
    chart.update(showingA ? dataB : dataA);
    showingA = !showingA;
  });

  destroyBtn.addEventListener('click', () => {
    if (!chart) return;
    chart.destroy();
    chart = null;
    updateBtn.disabled = true;
    destroyBtn.disabled = true;
    recreateBtn.disabled = false;
  });

  recreateBtn.addEventListener('click', () => {
    if (chart) return;
    chart = LovelyChart.create(target, showingA ? dataA : dataB);
    updateBtn.disabled = false;
    destroyBtn.disabled = false;
    recreateBtn.disabled = true;
  });
}
