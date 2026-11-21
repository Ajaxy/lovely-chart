import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const count = 30;
const labels = days(count);
const values = series(count, { start: 640, volatility: 0.1, seed: 121 });
const list = document.querySelector('.days-list');
const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
});
let lastIndex = count - 1;

const chart = new LovelyChart(document.getElementById('chart'), {
  title: 'Deliveries',
  type: 'bar',
  labels,
  datasets: [{ name: 'Deliveries', color: '#5FB641', values }],
  isUtc: true,
  isKeyboardSelectable: true,
  // Marks the row of the day the chart shows, however it was selected
  onSelectedIndexChange: (index) => {
    lastIndex = index ?? lastIndex;
    list.querySelectorAll('button').forEach((button) => {
      if (Number(button.dataset.index) === index) {
        button.setAttribute('aria-current', 'date');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  },
});

// The last week as a list whose rows select their day on hover and focus
labels.slice(-7).forEach((label, i) => {
  const index = count - 7 + i;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.index = String(index);
  button.innerHTML = `<span>${formatDate(label)}</span><b>${values[index].toLocaleString('en-US')}</b>`;
  button.addEventListener('mouseenter', () => chart.selectLabel(index));
  button.addEventListener('focus', () => chart.selectLabel(index));
  list.appendChild(document.createElement('li')).appendChild(button);
});

document.querySelectorAll('[data-step]').forEach((button) => {
  button.addEventListener('click', () => {
    chart.selectLabel(Math.min(count - 1, Math.max(0, lastIndex + Number(button.dataset.step))));
  });
});
