import LovelyChart from './LovelyChart';
import { prepareData } from './prepareData';

const data = require('../chart_data.json');

data.forEach((chartData) => {
  new LovelyChart('container', prepareData(chartData));
});
