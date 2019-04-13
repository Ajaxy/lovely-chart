import './styles/index.scss';

const CHARTS = [{
  containerId: 'container',
  title: 'Followers',
  palette: 'type-1',
  dataSource: 'data/1',
  datasetColors: {
    y0: 'green',
    y1: 'red',
  },
}, {
  containerId: 'container',
  title: 'Interactions',
  palette: 'type-1',
  dataSource: 'data/2',
  datasetColors: {
    y0: 'blue',
    y1: 'yellow',
  },
}, {
  containerId: 'container',
  title: 'Messages',
  palette: 'type-2',
  dataSource: 'data/3',
  datasetColors: {
    y0: 'light-blue',
    y1: 'blue',
    y2: 'light-green',
    y3: 'green',
    y4: 'yellow',
    y5: 'orange',
    y6: 'red',
  },
}, {
  containerId: 'container',
  title: 'Views',
  palette: 'type-3',
  dataSource: 'data/4',
  datasetColors: {
    y0: 'blue',
    y1: 'light-blue',
    y2: 'dark-blue',
  },
}, {
  containerId: 'container',
  title: 'Apps',
  palette: 'type-2',
  dataSource: 'data/5',
  datasetColors: {
    y0: 'light-blue',
    y1: 'blue',
    y2: 'light-green',
    y3: 'green',
    y4: 'yellow',
    y5: 'orange',
  },
}];

const originalDatasetColors = {
  y0: 'red',
  y1: 'green',
  y2: 'light-blue',
  y3: 'blue',
};

let charts = [];
let snow;

document.addEventListener('DOMContentLoaded', () => {
  CHARTS.forEach((params) => {
    charts.push(LovelyChart.create(params));
  });

  fetch('./data/chart_data.json')
    .then((response) => response.json())
    .then((chartsData) => {
      chartsData.forEach((data) => charts.push(
        LovelyChart.create({
          containerId: 'container',
          data,
          palette: 'type-original',
          datasetColors: originalDatasetColors
        }),
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
