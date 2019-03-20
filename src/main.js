import LovelyChart from './LovelyChart';
import { prepareData } from './prepareData';

const data = require('../chart_data.json');
const chart = new LovelyChart('container', prepareData(data[0]));

setupViewportControls();

function setupViewportControls() {
  const beginElement = document.getElementById('viewport-begin');
  const endElement = document.getElementById('viewport-end');

  beginElement.getElementsByTagName('input')[0].addEventListener('input', (e) => {
    const value = Number(e.target.value);
    beginElement.getElementsByTagName('span')[0].innerText = value;
    chart._setViewport({ begin: value });
  });

  endElement.getElementsByTagName('input')[0].addEventListener('input', (e) => {
    const value = Number(e.target.value);
    endElement.getElementsByTagName('span')[0].innerText = value;
    chart._setViewport({ end: value });
  });
}

