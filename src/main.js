import { LovelyChart } from './lovely-chart/LovelyChart';

fetch('./chart_data.json')
  .then((response) => response.json())
  .then((data) => {
    const charts = data.map((chartData) => new LovelyChart('container', chartData));

    document.getElementById('skin-switcher').addEventListener('click', (e) => {
      e.preventDefault();

      document.body.classList.toggle('skin-night');
      e.target.innerText = `Switch to ${document.body.classList.contains('skin-night') ? 'Day' : 'Night'} Mode`;
      charts.forEach((chart) => {
        chart.redraw();
      });
    });

  });
