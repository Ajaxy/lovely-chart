import { createThrottledUntilRaf } from './fast';

export const hideOnScroll = (() => {
  const charts = [];

  function setup(chart) {
    charts.push(chart);

    if (charts.length === 1) {
      // TODO throttle to 1 second
      window.onscroll = createThrottledUntilRaf(onScroll);
    }
  }

  function onScroll() {
    charts.forEach((chart) => {
      const { top, bottom } = chart.getBoundingClientRect();
      const shouldHide = bottom < 0 || top > window.innerHeight;
      chart.classList.toggle('hidden', shouldHide);
    });
  }

  return setup;
})();
