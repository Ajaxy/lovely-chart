# Updating data and loading

A chart holds one set of data at a time. `update()` swaps in the next one, `setLoading()` shows the chart as waiting for it, and `destroy()` tears the chart down when you're done.

## Replacing the data

Call [`update(newData, options?)`](api.md#update) with an object of the same shape you passed to the constructor. The chart rebuilds from it on the spot:

```js live
import LovelyChart from 'lovely-chart';
import { random } from './demo-data.js';

const STEP = 5 * 60 * 1000;
const nextRandom = random(4);
const nextValue = () => Math.round(300 + nextRandom() * 120);

let labels = Array.from({ length: 36 }, (_, i) => Date.UTC(2026, 9, 31, 9) + i * STEP);
let values = labels.map(nextValue);
const buildParams = () => ({
  title: 'Requests per 5 minutes',
  type: 'line',
  labels,
  datasets: [{ name: 'Requests', color: '#3497ED', values }],
});

const chart = new LovelyChart(document.getElementById('chart'), buildParams());

// Every 2 seconds a new point arrives and the oldest leaves
setInterval(() => {
  labels = [...labels.slice(1), labels[labels.length - 1] + STEP];
  values = [...values.slice(1), nextValue()];
  chart.update(buildParams(), { shouldKeepSelection: true });
}, 2000);
```

`newData` replaces the old params entirely, so it must be complete: the `type`, the options and the callbacks too, not only the `labels` and `datasets`. Keeping the fixed part in one object and spreading it into each update keeps this short:

```js
const params = {
  title: 'Orders',
  type: 'line',
  withMinimap: true,
  onSelectedIndexChange: (index) => highlightRow(index),
};

const chart = new LovelyChart(element, { ...params, ...(await fetchOrders('2026-10')) });

// Later
chart.update({ ...params, ...(await fetchOrders('2026-11')) });
```

> [!WARNING]
> The chart keeps a reference to the object you pass, and builds from it again on a resize or an orientation change. If you change that object afterwards, the change shows from the next rebuild on. Always pass a new object for new data, as the examples here do, rather than editing the one the chart holds.

A call to `update()` after `destroy()` does nothing.

## What `update()` resets

By default, `update()` gives the reader a fresh view of the new data. It resets:

- the zoom, returning a zoomed chart to its overview;
- the window, of the minimap or of a range selected on the plot;
- the datasets the reader showed or hid in the legend;
- the selected label and its tooltip;
- a drag, a long press or a hover in progress.

The callbacks report what ends: [`onSelectedIndexChange`](api.md#onSelectedIndexChange) and [`onTooltipChange`](api.md#onTooltipChange) with `undefined` when a selection ends, and [`onZoomChange`](api.md#onZoomChange) with `undefined` when a zoom ends. The new data's first frame then reports its labels through [`onRangeChange`](api.md#onRangeChange).

## Keeping the reader's view

When the new data is a refresh of the same view, as new values for the same days, resetting would throw away what the reader was looking at. The second argument of `update()` keeps parts of it:

| Option | Keeps |
|---|---|
| [`shouldKeepFilter`](api.md#shouldKeepFilter) | The datasets the reader showed or hid in the legend |
| [`shouldKeepZoom`](api.md#shouldKeepZoom) | The window and the zoom, while the labels stay the same |
| [`shouldKeepSelection`](api.md#shouldKeepSelection) | The selected label, while a label of the same value is in the window |
| [`isAnimated`](api.md#isAnimated) | Not a part of the view: cross-fades into the new data |

Each one is `false` by default. Try them here: hide a dataset, drag the minimap, point at a day, then refresh.

```html live
<div id="sessions"></div>
<form class="update-options">
  <label><input type="checkbox" name="shouldKeepFilter" checked> Keep hidden datasets</label>
  <label><input type="checkbox" name="shouldKeepZoom" checked> Keep window</label>
  <label><input type="checkbox" name="shouldKeepSelection" checked> Keep selection</label>
  <label><input type="checkbox" name="isAnimated" checked> Cross-fade</label>
  <button type="button">Refresh data</button>
</form>
<style>
  .update-options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin: 0 10px; }
  .update-options button { font: inherit; padding: 4px 12px; border-radius: 16px; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(90);
  let seed = 1;
  const buildParams = () => ({
    title: 'Sessions by platform',
    type: 'line',
    labels,
    datasets: [
      { name: 'iOS', values: series(90, { start: 5200, seasonality: 0.1, seed }) },
      { name: 'Android', values: series(90, { start: 4100, seasonality: 0.1, seed: seed + 100 }) },
      { name: 'Web', values: series(90, { start: 2600, seasonality: 0.15, seed: seed + 200 }) },
    ],
    withMinimap: true,
  });

  const chart = new LovelyChart(document.getElementById('sessions'), buildParams());

  document.querySelector('.update-options button').addEventListener('click', (event) => {
    seed += 1;
    const options = Object.fromEntries(
      [...event.target.form.elements].filter(({ type }) => type === 'checkbox').map(({ name, checked }) => [name, checked]),
    );
    chart.update(buildParams(), options);
  });
</script>
```

### Keeping hidden datasets

With `shouldKeepFilter`, each dataset of the new data starts shown or hidden as the matching one was. Datasets match by their place in `datasets`, or by `name` when the new data has another number of datasets. A dataset with no match, and every dataset when the match would hide them all, starts as its `isInitiallyHidden` says.

[`onHiddenSeriesChange`](api.md#onHiddenSeriesChange) is called once the new data is built, if the hidden datasets differ from those before.

### Keeping the window and the zoom

With `shouldKeepZoom`, the window stays where the reader put it, whether they dragged the minimap or selected a range on the plot, **as long as the new data has the same `labels`**. With other labels, the window and the zoom reset as usual.

A zoomed chart opens zoomed into the same label, with no overview shown and no transition, calling [`onZoom`](api.md#onZoom) again for it, and zooming out returns to the kept window. `onZoomChange` isn't called again for a zoom it already reported.

### Keeping the selection

With `shouldKeepSelection`, the selected label stays selected at the index of the label of the same value in the new data, as long as that label is in the window the chart opens on. That's what keeps the tooltip in place in the streaming example above, even as the labels shift by one.

- A selection by the keyboard or by [`selectLabel()`](api.md#selectLabel) holds.
- A selection by pointer or touch still clears as usual, once the pointer leaves the chart or a touch lands elsewhere.
- The selection ends when its label is gone or outside the window, or when a zoom shows or is kept.

`onSelectedIndexChange` is called on the first frame of the new data only if the index changes, and `onTooltipChange` only if what the tooltip shows changes.

## Cross-fading

`isAnimated: true` cross-fades the old chart into the new one over 400ms. It suits a change of subject, such as another period or another region, where the reader benefits from seeing that something changed.

During the fade, the old chart, with its plot, axes, header, minimap and legend, stays in the new chart's place, under it:

- It takes no room in the layout, so the page lays out around the new chart at once. While the old chart is taller than the new one, it covers the content that follows.
- No pointer, focus or assistive technology reaches it.
- A legend in [`legendContainer`](api.md#legendContainer) cross-fades in its place there.

Another `update()` with `isAnimated` fades the chart out from wherever its fade has reached. An `update()` without it, a resize, an orientation change or `destroy()` ends the fades at once.

> [!NOTE]
> When the reader's system asks for reduced motion (`prefers-reduced-motion: reduce`), `isAnimated` is ignored and the data swaps at once. See [Accessibility](accessibility.md#motion).

## Loading states

A chart that fetches its data has two waits to cover: before the first data arrives, and while the next data loads over data already on screen. [`isLoading`](api.md#isLoading) covers both, and the chart and its legend are `inert` while it's set: they take no pointer, focus or keyboard input and leave the accessibility tree.

### A skeleton before the first data

Pass `isLoading: true` with no labels, `labels: []`, and the chart draws a skeleton of itself in its own geometry: a block over the data area of the plot, the circle of a pie or the ring of a donut, the box of the minimap, and a pill for each legend entry. Give the datasets their names and empty `values`, and the pills take the size of the legend to come, so nothing jumps when the data arrives.

```html live
<div id="fruit" class="fruit-chart"></div>
<button type="button" class="reload">Reload</button>
<style>
  /* A skeleton in the accent of the page, one for each skin */
  .fruit-chart .lovely-chart--container {
    --skeleton-color: rgba(16, 139, 227, 0.12);
  }
  html.theme-dark .fruit-chart .lovely-chart--container:not(.lovely-chart--container-scheme-system) {
    --skeleton-color: rgba(72, 170, 240, 0.16);
  }
  .reload { font: inherit; margin: 0 10px; padding: 4px 12px; border-radius: 16px; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const names = ['Apples', 'Oranges', 'Lemons', 'Apricots', 'Kiwi', 'Mango'];
  const skeleton = {
    title: 'Fruit sold',
    type: 'donut',
    labels: [],
    datasets: names.map((name) => ({ name, values: [] })),
    isLoading: true,
  };
  const chart = new LovelyChart(document.getElementById('fruit'), skeleton);

  const load = async () => {
    // The pause stands in for a slow network
    const [data] = await Promise.all([
      fetch('../data/donut.json').then((response) => response.json()),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    chart.update({ ...data, title: 'Fruit sold' });
  };

  document.querySelector('.reload').addEventListener('click', () => {
    chart.update(skeleton);
    load();
  });
  load();
</script>
```

The header keeps its title, and the band of a caption of dates, so the plot doesn't move either. The skeleton pulses, unless the reader prefers reduced motion.

### Dimming the data while the next loads

Over data already on screen, `isLoading` dims the plot, the minimap and the legend instead. To set it without rebuilding the chart, call [`setLoading()`](api.md#setLoading):

```js
chart.setLoading(true);
const data = await fetchOrders(nextPeriod);
chart.update({ ...params, ...data });
```

`setLoading(true)` keeps the zoom, the range, the hidden datasets and the selected label as they are, and calls no callback. `setLoading(false)` shows the data in full again, for a load that fails or is cancelled. You rarely need it after a successful load: `update()` takes the loading state of its own params, so data without `isLoading` shows as loaded.

### Styling the skeleton

The skeleton takes the `--skeleton-color` custom property, a translucent tint by default. Set your own on `.lovely-chart--container`, one for each skin, as the example above does; see [Theming and colours](theming.md#writing-a-skin-of-your-own) for the selectors. A legend in a [`legendContainer`](api.md#legendContainer) of your own reads the property from that element or its ancestors, and takes a translucent grey while it's unset.

## A period switcher

Put together, these make the common pattern of a chart whose data comes from the network: a skeleton until the first response, then dimmed data and a cross-fade for each new period.

```html live
<div class="periods" role="group" aria-label="Period">
  <button type="button" value="7" aria-pressed="false">7 days</button>
  <button type="button" value="30" aria-pressed="true">30 days</button>
  <button type="button" value="90" aria-pressed="false">90 days</button>
</div>
<div id="orders"></div>
<style>
  .periods { display: flex; gap: 6px; margin: 0 10px 8px; }
  .periods button { font: inherit; padding: 4px 12px; border-radius: 16px; }
  .periods [aria-pressed='true'] { font-weight: bold; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  // Stands in for your API: the orders of the last `count` days, after a pause
  const fetchOrders = async (count) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      labels: days(count),
      datasets: [
        { name: 'Web', values: series(count, { start: 640, seasonality: 0.15, seed: count }) },
        { name: 'App', values: series(count, { start: 420, seasonality: 0.1, seed: count + 1 }) },
      ],
    };
  };

  const params = { title: 'Orders', type: 'bar', isStacked: true, isUtc: true };
  const chart = new LovelyChart(document.getElementById('orders'), {
    ...params,
    labels: [],
    datasets: [{ name: 'Web', values: [] }, { name: 'App', values: [] }],
    isLoading: true,
  });

  let lastRequest = 0;
  const showPeriod = async (count) => {
    const request = ++lastRequest;
    chart.setLoading(true);
    const data = await fetchOrders(count);
    // A slower response for an earlier click arrives too late to show
    if (request !== lastRequest) return;
    chart.update({ ...params, ...data }, { shouldKeepFilter: true, isAnimated: true });
  };

  document.querySelectorAll('.periods button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.periods button').forEach((other) => {
        other.setAttribute('aria-pressed', String(other === button));
      });
      showPeriod(Number(button.value));
    });
  });
  showPeriod(30);
</script>
```

A few things make this robust:

- **The skeleton names its datasets**, so the legend pills match the legend to come.
- **`setLoading(true)` before each request** dims the data on screen and makes the chart `inert`, so the reader can't select stale data while the new data loads.
- **The request counter** drops a response that arrives after a newer request, so a slow answer for "7 days" can't overwrite "90 days".
- **`shouldKeepFilter`** keeps the datasets the reader hid across periods. `shouldKeepZoom` would do nothing here, since each period brings labels of its own.

## Destroying a chart

Call [`destroy()`](api.md#destroy) when the chart leaves the page, as when its view closes in a single-page app. It:

- removes the chart's elements from `element`, along with the `--lovely-chart-plot-area-*` and `--lovely-chart-plot-padding-top` variables it set there;
- calls [`onPlotAreaChange`](api.md#onPlotAreaChange) with `undefined`, and [`onRangeChange`](api.md#onRangeChange) with `undefined` if it last reported labels, so overlays of your page can hide;
- detaches every global listener, including the window's `resize` and the observer of the theme, and cancels pending animation frames and timeouts;
- calls back nothing after that.

`destroy()` is idempotent, and every other method does nothing after it. In a framework, call it from the cleanup of the component that created the chart, as in React's `useEffect`:

```js
useEffect(() => {
  const chart = new LovelyChart(elementRef.current, params);
  return () => chart.destroy();
}, [params]);
```

See [Frameworks](frameworks.md) for more on charts in components.
