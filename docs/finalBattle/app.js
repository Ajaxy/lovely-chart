const CHARTS = [{
  title: 'Followers',
}, {
  title: 'Interactions',
}, {
  title: 'Messages',
}, {
  title: 'Views',
  noMinimapOnZoom: true,
}, {
  title: 'Apps',
  zoomToPie: true,
}];

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');

  Promise.all(CHARTS.map(({ title }, i) => {
    return fetch(`data/${i + 1}/overview.json`)
      .then((response) => response.json())
      .then((data) => {
        function onZoom(date) {
          return fetchDayData(`data/${i + 1}`, date);
        }

        const params = Object.assign({ title }, data);
        if (i < 4) {
          params.x_on_zoom = onZoom;
        }

        Chart.render(container, params);
      });
  }))
    .then(() => {
      document.querySelector('#spinner-main').classList.add('hidden');
    });

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('dark');
    document.documentElement.dispatchEvent(new Event('darkmode'));

    const skin = document.documentElement.classList.contains('dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});

function fetchDayData(dataSource, timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

  return fetch(`${dataSource}/${path}.json`)
    .then((response) => response.json());
}
