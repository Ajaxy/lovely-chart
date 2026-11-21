# Your first chart

This page takes you from an empty element to an interactive chart with a minimap, then shows you how to give it new data and how to remove it. Each step builds on the one before, and every example runs right here on the page.

## Before you start

[Install the package](installation.md), then add an element for the chart to your page:

```html
<div id="chart"></div>
```

Import the class and the stylesheet in your script:

```js
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';
```

The chart fills the width of its element, so a block element such as a `<div>` works best. Its height comes from its content: the header, the plot, which is 320px high by default, and the minimap and legend when it has them.

> [!NOTE]
> The examples import made-up data from `./demo-data.js`, a helper of these docs. `days(count)` returns `count` daily timestamps at UTC midnight, and `series(count, options)` returns `count` values of a random walk. The same call gives the same numbers on every visit. In your app, the labels and values come from your own data.

## Draw a line

A chart needs three things: a `type`, the `labels` along the X axis, and the `datasets` to draw, each with a `name` and one value per label.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'Visitors', values: series(30, { start: 3300, seasonality: 0.2, seed: 1 }) },
  ],
  isUtc: true,
});
```

- `labels` are UNIX timestamps in milliseconds, one per day here. They can be text too: see [Data format](data.md#labels).
- `isUtc: true` reads the dates in UTC, as `days()` makes them, so readers in every time zone see the same days.

Without any more options, you already get:

- A header with the dates on screen.
- A Y axis that fits the values, and dates along the X axis.
- A tooltip with the value at the label under the pointer, or under your finger on a touch screen.
- The day or night skin of the page.

A chart of a single dataset has no legend, as there's nothing to switch between.

## Add a title and a second dataset

Add a `title` to the header, and a second dataset. Each dataset can take a `color`; the ones without take a colour from the [default palette](data.md#default-colours).

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Visitors',
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'Desktop', color: '#3497ED', values: series(30, { start: 1200, seasonality: 0.2, seed: 1 }) },
    { name: 'Mobile', color: '#5FB641', values: series(30, { start: 2100, seasonality: 0.2, seed: 2 }) },
  ],
  isUtc: true,
});
```

With two datasets, the chart adds a legend. Click a button to hide or show its dataset, and the Y axis animates to fit the datasets on screen. The legend never lets the reader hide every dataset. The tooltip now lists both datasets, the larger value first.

## Add a minimap

For a longer period, add `withMinimap: true`. The minimap draws every label under the plot, with a window over the ones the plot shows. The reader drags the window to move through the period and pulls its edges to show more or fewer labels.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Visitors',
  type: 'line',
  labels: days(180),
  datasets: [
    { name: 'Desktop', color: '#3497ED', values: series(180, { start: 1200, seasonality: 0.2, seed: 1 }) },
    { name: 'Mobile', color: '#5FB641', values: series(180, { start: 2100, seasonality: 0.2, seed: 2 }) },
  ],
  withMinimap: true,
  // Open on the last 30 days: inclusive label indexes
  minimapRange: { from: 150, to: 179 },
  isUtc: true,
});
```

Without `minimapRange`, the window opens on the last 20% of the labels. Besides label indexes, it takes fractions of the whole period, such as `[0.5, 1]` for the second half, or `'full'` for all of it. See [`minimapRange`](api.md#minimapRange) for every rule, and [Minimap](minimap.md) for more.

## Give it new data

Call [`update()`](api.md#update) with a new params object, of the same shape as the one you created the chart with. The chart rebuilds itself from it, in the same element. With the [`isAnimated`](api.md#isAnimated) option, the old chart cross-fades into the new one.

```html live
<div class="periods">
  <button type="button" data-days="30">30 days</button>
  <button type="button" data-days="90">90 days</button>
  <button type="button" data-days="365">A year</button>
</div>
<div id="visitors-chart"></div>

<style>
  .periods { display: flex; gap: 8px; padding: 0 10px 10px; }
</style>

<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(365);
  const desktop = series(365, { start: 1200, trend: 0.001, volatility: 0.03, seasonality: 0.2, seed: 1 });
  const mobile = series(365, { start: 2100, trend: 0.001, volatility: 0.03, seasonality: 0.2, seed: 2 });

  // A new params object for each period
  const getParams = (count) => ({
    title: 'Visitors',
    type: 'line',
    labels: labels.slice(-count),
    datasets: [
      { name: 'Desktop', color: '#3497ED', values: desktop.slice(-count) },
      { name: 'Mobile', color: '#5FB641', values: mobile.slice(-count) },
    ],
    isUtc: true,
  });

  const chart = new LovelyChart(document.getElementById('visitors-chart'), getParams(30));

  document.querySelectorAll('[data-days]').forEach((button) => {
    button.addEventListener('click', () => {
      chart.update(getParams(Number(button.dataset.days)), { isAnimated: true });
    });
  });
</script>
```

A few things to know about `update()`:

- **Pass a new object.** The chart keeps a reference to the params you give it and builds from them again on a window resize, so a change you make to that object later shows up at an unexpected moment. Build a new object for new data, as `getParams()` does here. See [Data format](data.md#passing-new-data).
- **It resets the view.** The zoom, the window, the datasets hidden in the legend and the selected label start afresh, unless you keep them with the update options [`shouldKeepFilter`](api.md#shouldKeepFilter), [`shouldKeepZoom`](api.md#shouldKeepZoom) and [`shouldKeepSelection`](api.md#shouldKeepSelection).
- **Motion is optional.** `isAnimated` is ignored while the reader's system asks for reduced motion, and the data swaps at once.

[Updating](updating.md) goes through live data, polling and keeping the reader's view.

## Remove the chart

When the chart's element leaves the page, call [`destroy()`](api.md#destroy). It removes everything the chart added to the element, detaches its listeners from the window and the document, and cancels its pending animation frames and timers. After that, the instance does nothing, and the element is free for a new chart.

```html live
<button type="button" id="toggle-chart">Remove the chart</button>
<div id="orders-chart"></div>

<style>
  #toggle-chart { margin: 0 10px 10px; }
</style>

<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const element = document.getElementById('orders-chart');
  const button = document.getElementById('toggle-chart');
  const params = {
    title: 'Orders',
    type: 'bar',
    labels: days(14),
    datasets: [{ name: 'Orders', values: series(14, { start: 640, seasonality: 0.25, seed: 4 }) }],
    isUtc: true,
  };
  let chart = new LovelyChart(element, params);

  button.addEventListener('click', () => {
    if (chart) {
      chart.destroy();
      chart = undefined;
      button.textContent = 'Create the chart';
    } else {
      chart = new LovelyChart(element, params);
      button.textContent = 'Remove the chart';
    }
  });
</script>
```

`destroy()` is safe to call more than once. In a framework, call it from the cleanup hook of the component that created the chart: see [Using with frameworks](frameworks.md).

## Next steps

- [Data format](data.md): text labels, gaps, dashed lines and colours.
- [Chart types](chart-types.md): areas, bars, steps, pies and donuts, and how to mix them.
- [Tooltip](tooltip.md), [Legend](legend.md) and [Zoom](zoom.md): what the reader can do with a chart, and how to shape it.
- [Theming](theming.md): colours and the day and night skins.
