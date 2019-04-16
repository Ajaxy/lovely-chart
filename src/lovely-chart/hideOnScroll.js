import { debounce } from './utils';

export const hideOnScroll = (() => {
  const charts = [];
  const showAllDebounced = debounce(showAll, 500, true, false);
  const hideScrolledDebounced = debounce(hideScrolled, 500, false, true);

  function setup(chart) {
    charts.push(chart);

    if (charts.length === 1) {
      window.onscroll = () => {
        showAllDebounced();
        hideScrolledDebounced();
      };
    }
  }

  function showAll() {
    charts.forEach((chart) => {
      chart.classList.remove('hidden');
    });
  }

  function hideScrolled() {
    charts.forEach((chart) => {
      const { top, bottom } = chart.getBoundingClientRect();
      const shouldHide = bottom < 0 || top > window.innerHeight;
      chart.classList.toggle('hidden', shouldHide);
    });
  }

  return setup;
})();
