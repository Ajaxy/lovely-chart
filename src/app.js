document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');

  (() => {
    const chart = {
      title: 'Lovely Line',
      type: 'line',
      labels: [
        1554249600000,
        1554336000000,
        1554422400000,
        1554508800000
      ],
      labelType: 'day',
      datasets: [
        {
          name: 'My Line',
          color: '#ff0000',
          values: [123, 324, 435, 456]
        },
        {
          name: 'My Line 2',
          color: '#6699cc',
          values: [765, 79, 89, 2423]
        }
      ],
      isStacked: false,
      isPercentage: false,
      hasSecondYAxis: false,
      onZoom: null
    };

    Graph.render(container, chart);
  })();

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('dark');
    document.documentElement.dispatchEvent(new Event('darkmode'));

    const skin = document.documentElement.classList.contains('dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});
