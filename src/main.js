import { LovelyChart } from './lovely-chart/LovelyChart';

fetch('./chart_data.json')
  .then((response) => response.json())
  .then((data) => {
    data.forEach((chartData) => {
      new LovelyChart('container', chartData);
    });
  });
