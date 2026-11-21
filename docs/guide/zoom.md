# Zoom and drill-down

A chart can drill into a label: a click on a day opens the hours of that day, or the shares of its datasets in a pie. This page covers what a click does, loading detail data, zooming into shares, opening a chart zoomed, following the zoom from your code, and a zoom-out control of your own.

## What a click does

A chart zooms when it has somewhere to go:

- With [`onZoom`](api.md#onZoom), it loads detail data for the label: see [Loading detail data](#loading-detail-data).
- A percentage chart, or one with `zoomToShares`, opens a pie or a donut of the label's shares: see [Zooming into shares](#zooming-into-shares).

Any other chart, or one with [`noZoom`](#turning-zoom-off), doesn't zoom: a click on its plot does nothing the hover doesn't. On a chart that zooms:

- A click on the plot zooms into the label under the pointer. On a touch screen, a tap selects a label, and a tap on its tooltip balloon zooms into it.
- The tooltip title ends with a chevron, a sign that the label opens. While the detail data loads, the balloon shows a spinner.
- The plot closes in on the label and opens on the zoomed view. The title in the header gives way to a zoom-out control, a magnifier and `Zoom out`, which returns to the overview, on the window it left.
- The zoom goes one level deep: the zoomed view zooms no further.

## Loading detail data

[`onZoom`](api.md#onZoom) takes the value of the clicked label, its timestamp or the index of a text label, and returns a promise of the params of the zoomed view: its `type`, `labels`, `datasets` and the options it needs, the same shape the chart itself takes. If the promise rejects or resolves to `undefined`, the chart stays on its overview.

Here a click on a day loads its hours, kept in a JSON file per day:

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars.json').then((response) => response.json());

// The hours of a day are in zoom_bars/YYYY-MM/DD.json
async function fetchDay(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const response = await fetch(`../data/zoom_bars/${date.getFullYear()}-${month}/${day}.json`);
  // A day with no file stays on the overview
  return response.ok ? response.json() : undefined;
}

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit sold',
  onZoom: fetchDay,
});
```

Each file holds the hours of a week around its day, so the reader can pan to the days either side from the minimap.

### What the zoomed data sets

The zoomed view takes its options from the data `onZoom` returns, not from the chart: [`areLinesSmooth`](api.md#areLinesSmooth), [`isYAxisOutward`](api.md#isYAxisOutward), the [`isDashed`](api.md#datasets-isDashed) of each dataset, the value formatting, [`hatchedRanges`](api.md#hatchedRanges), [`eventLines`](api.md#eventLines) and so on. Repeat the ones it shares with the chart:

```js
const shared = { valuePrefix: '$', isYAxisOutward: true, areLinesSmooth: true };

new LovelyChart(element, {
  ...overview,
  ...shared,
  onZoom: async (timestamp) => ({ ...(await loadHours(timestamp)), ...shared }),
});
```

A few things stay the chart's while it's zoomed:

- The header: its title and zoom-out control, and whether it shows a caption. A chart with [`noCaption`](api.md#noCaption) or text labels shows none while zoomed either, with no `noCaption` needed in the zoomed data.
- [`axisTextColor`](api.md#axisTextColor), [`backgroundColor`](api.md#backgroundColor), [`colorScheme`](api.md#colorScheme) and [`ariaLabel`](api.md#ariaLabel).
- The `on…` callbacks. [`onTooltipChange`](api.md#onTooltipChange) and [`onRangeChange`](api.md#onRangeChange) go on reporting, with the indexes of the zoomed view's labels from its first frame.

The zoomed datasets take their own colours: by key in [`colors`](api.md#colors), `y0` for the first, `y1` for the second and so on, or from each dataset's `color`. A dataset with neither keeps the colour of the chart's dataset at its place, and one past the chart's datasets takes a default colour.

### The zoomed window

- The zoomed view opens on the clicked day: the labels from the clicked label's timestamp to a day later, when its labels hold that timestamp. A [`minimapRange`](minimap.md#the-opening-window) in the zoomed data, counting its own labels, opens it on another window.
- Data with as many datasets as the chart keeps the minimap, which shows the zoomed data and moves its window in steps of the width it opened on, a day for the clicked day. The legend keeps the datasets the reader hid.
- Data with another number of datasets shows in full, without the minimap, with a legend of its own datasets.

## Zooming into shares

Without `onZoom`, a chart can open a pie or a donut of the shares its datasets have at the clicked label, with no data to load:

- A percentage chart does it by itself.
- [`zoomToShares: true`](api.md#zoomToShares) opts any other chart in, as a stacked chart of absolute values, which would lose the values the overview is for if you made it a percentage chart. It's ignored when `onZoom` is given.
- [`zoomType`](api.md#zoomType) picks `'pie'`, the default, or `'donut'`.
- [`circleLabelsAround`](api.md#circleLabelsAround) sets how many labels either side of the clicked one the zoomed chart covers, `3` by default, which suits daily data. With the minimap, the window opens on the clicked label and the reader can drag it across those labels, the pie summing the ones in the window. `0` drills into the clicked label alone.

```js live
import LovelyChart from 'lovely-chart';
import { months, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Support tickets by channel',
  type: 'bar',
  isStacked: true,
  labels: months(12),
  datasets: [
    { name: 'Email', values: series(12, { start: 820, seed: 2 }) },
    { name: 'Chat', values: series(12, { start: 640, trend: 0.03, seed: 5 }) },
    { name: 'Phone', values: series(12, { start: 310, trend: -0.02, seed: 9 }) },
  ],
  withMinimap: true,
  minimapRange: 'full',
  zoomToShares: true,
  zoomType: 'donut',
  // Any month reaches the whole year in the zoomed minimap
  circleLabelsAround: 11,
});
```

The pie or donut lists the sector under the pointer in its tooltip, and [`withGradient`](api.md#withGradient) shades its sectors. A dataset drawn as [another type](api.md#datasets-type) than the chart's, such as a line over the bars, takes no share.

## Opening zoomed

[`initialZoom`](api.md#initialZoom) opens the chart already zoomed into a label, a label index or `'last'`, with no overview shown first and no transition. It works for shares and for `onZoom` alike, and the zoom out behaves as usual:

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-monthly.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Monthly spending',
  initialZoom: 'last',
  zoomOutLabel: 'All months',
});
```

`initialZoom` is ignored on a chart that doesn't zoom, and an index outside the labels is clamped to them. This data zooms into a donut of the month, as its `zoomToShares` and `zoomType` say.

## Following the zoom

[`onZoomChange`](api.md#onZoomChange) is called once a zoom settles, with the value of the label, its timestamp or the index of a text label, and its index in `labels`. Once the chart is zoomed out, it's called with `undefined` for both. Paired with `initialZoom`, it keeps the zoom in the page's address:

```js
const url = new URL(location.href);
const day = url.searchParams.get('day');

new LovelyChart(element, {
  ...params,
  onZoom: loadHours,
  initialZoom: day === null ? undefined : Number(day),
  onZoomChange: (labelValue, labelIndex) => {
    if (labelIndex === undefined) {
      url.searchParams.delete('day');
    } else {
      url.searchParams.set('day', String(labelIndex));
    }
    history.replaceState(null, '', url);
  },
});
```

> [!NOTE]
> `update()`, a resize of the window and an orientation change rebuild the chart on its overview, and `onZoomChange` reports the zoom out. [`update()` with `shouldKeepZoom: true`](api.md#shouldKeepZoom) keeps the zoom while the labels stay the same, calling `onZoom` again: see [Updating data](updating.md).

## Your own zoom-out control

For a page that draws its own header or back button, [`noZoomOutControl: true`](api.md#noZoomOutControl) leaves out the chart's control, and the header keeps its title while zoomed. Call [`zoomOut()`](api.md#zoomOut) from your control, and show the control while `onZoomChange` reports a zoom:

```html live
<style>
  .zoom-toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    min-height: 32px;
    margin: 0 10px 8px;
    font: 14px system-ui, sans-serif;
  }
</style>
<div class="zoom-toolbar">
  <button type="button" id="all-months" hidden>← All months</button>
  <span id="zoom-status">Pick a month to see where the money went</span>
</div>
<div id="spending-chart"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/bars-monthly.json').then((response) => response.json());
  const button = document.getElementById('all-months');
  const status = document.getElementById('zoom-status');
  const formatMonth = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  const chart = new LovelyChart(document.getElementById('spending-chart'), {
    ...data,
    title: 'Monthly spending',
    noZoomOutControl: true,
    onZoomChange: (labelValue) => {
      const isZoomed = labelValue !== undefined;
      button.hidden = !isZoomed;
      status.textContent = isZoomed ? formatMonth(labelValue) : 'Pick a month to see where the money went';
    },
  });

  button.addEventListener('click', () => chart.zoomOut());
</script>
```

`zoomOut()` starts on the next frame, and only if the chart is zoomed in then: from the moment `onZoomChange` reports a zoom until a zoom out starts. At any other time, it does nothing.

To keep the chart's control and change its words, set [`zoomOutLabel`](api.md#zoomOutLabel), `'Zoom out'` by default. With [`noHeader`](api.md#noHeader), or a header with nothing to show, the control floats over the plot while zoomed, at its top left, or its top right on a right-to-left page: see [Layout](layout.md).

## Turning zoom off

[`noZoom: true`](api.md#noZoom) turns zooming off, even on a percentage chart or one with `onZoom`, so a click only selects a label:

```js
new LovelyChart(element, {
  type: 'area',
  isPercentage: true,
  labels,
  datasets,
  // A share chart that stays a share chart
  noZoom: true,
});
```
