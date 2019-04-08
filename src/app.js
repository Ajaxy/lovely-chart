// TODO titles
const DATA_SOURCES = ['data/1', 'data/2', 'data/3', 'data/4', 'data/5'];

let charts = [];
let snow;

document.addEventListener('DOMContentLoaded', () => {
  DATA_SOURCES.forEach((dataSource) => {
    charts.push(LovelyChart.create('container', { dataSource }));
  });

  fetch('./data/chart_data.json')
    .then((response) => response.json())
    .then((data) => {
      data.forEach((chartData) => charts.push(
        LovelyChart.create('container', chartData),
      ));
    });

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.body.classList.toggle('skin-night');
    e.target.innerText = `Switch to ${document.body.classList.contains('skin-night') ? 'Day' : 'Night'} Mode`;

    charts.forEach((chart) => {
      chart.redraw();
    });
  });

  document.getElementById('killer-feature').addEventListener('click', (e) => {
    e.preventDefault();

    e.currentTarget.classList.toggle('checked');

    if (!snow) {
      snow = document.createElement('div');
      let html = '';
      for (let i = 0; i < 12; i++) {
        html += '<div class="flake">❄️</div>';
      }
      snow.innerHTML = html;
    }

    if (snow.parentNode) {
      document.body.removeChild(snow);
    } else {
      document.body.appendChild(snow);
    }
  });
});
