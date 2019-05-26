(() => {
  function tick() {
    console.timeEnd('between ticks');

    requestAnimationFrame(() => tick());

    console.time('between ticks');
  }
})();
