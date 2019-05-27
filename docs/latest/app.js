const CHARTS = [{
  title: 'Followers',
}, {
  title: 'Interactions',
}, {
  title: 'Messages',
}, {
  title: 'Views',
}, {
  title: 'Apps',
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

        Graph.render(container, location.search.includes('random') ? generateData(params) : params);
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

function generateData(data, xLen, colLen) {
  var xLen = 1460;
  var colLen = 50;
  var colors = ['#108BE3', '#3497ED', '#4BD964', '#64ADED', '#2373DB', '#E8AF14', '#FE3C30', '#9ED448', '#5FB641', '#F5BD25', '#F79E39', '#E65850'];

  var origColLen = data.columns.length - 1;
  var origXLen = data.columns[0].length - 1;
  var k = 1;
  for (var i = origColLen + 1; i <= colLen; i++) {
    data.types['y' + (i - 1)] = data.types['y0'];
    data.names['y' + (i - 1)] = 'Column ' + (i);
    data.colors['y' + (i - 1)] = colors[i % colors.length];
    data.columns[i] = data.columns[(i % origColLen) + 1].slice(0);

    k *= 0.9;
    data.columns[i][0] = 'y' + (i - 1);
    for (var j = 1; j < data.columns[i].length; j++) {
      data.columns[i][j] = Math.round(k * data.columns[i][j]);
    }
  }

  for (var i = 0; i <= colLen; i++) {
    for (var j = data.columns[i].length; j <= xLen; j++) {
      if (i == 0) {
        data.columns[i][j] = data.columns[i][j - 1] + (data.columns[i][2] - data.columns[i][1]);
      } else {
        data.columns[i][j] = data.columns[i][(j % origXLen) + 1];
      }
    }
  }

  return data;
}
