import { createLovelyChart } from './LovelyChart';
import { changeSkin, setupColors } from './skin';

window.LovelyChart = {
  create: createLovelyChart,
  setupColors,
  changeSkin,
};
