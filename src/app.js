const CHARTS = [{
  containerId: 'container',
  title: 'Followers',
  dataSource: 'data/1',
}, {
  containerId: 'container',
  title: 'Interactions',
  dataSource: 'data/2',
}, {
  containerId: 'container',
  title: 'Messages',
  dataSource: 'data/3',
}, {
  containerId: 'container',
  title: 'Views',
  dataSource: 'data/4',
  noMinimapOnZoom: true,
}, {
  containerId: 'container',
  title: 'Apps',
  dataSource: 'data/5',
  zoomToPie: true,
}];

let charts = [];

document.addEventListener('DOMContentLoaded', () => {
  fetch('./data/colors.json')
    .then((response) => response.json())
    .then((colors) => {
      CHARTS.forEach((params) => {
        charts.push(LovelyChart.create(params));
      });

      document.querySelector('#spinner-main').classList.add('hidden');
    });

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('dark');

    const skin = document.documentElement.classList.contains('dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;

    LovelyChart.changeSkin(skin);
    charts.forEach((chart) => {
      chart.redraw();
    });
  });
});
