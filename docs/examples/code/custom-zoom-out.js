import LovelyChart from 'lovely-chart';

const data = await fetch('../data/areas.json').then((response) => response.json());
const back = document.getElementById('back');
const status = document.getElementById('status');
const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});

const chart = new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Share of the market',
  withMinimap: true,
  // Opens on a pie of the last day, with no overview first
  initialZoom: 'last',
  // The page draws the control instead
  noZoomOutControl: true,
  onZoomChange: (labelValue) => {
    back.disabled = labelValue === undefined;
    status.textContent = labelValue === undefined
      ? 'Click a day to zoom in'
      : `Shares of ${formatDate(labelValue)}`;
  },
});

back.addEventListener('click', () => chart.zoomOut());
