# Minimap and ranges

A long series reads best a window at a time. The minimap under the plot draws all of the data in miniature, with a window over the part the plot shows: drag the window to pan, or drag its edges to widen or narrow it. This page covers the minimap, the window a chart opens on, locked data, selecting a range on the plot itself, and following the range from your code.

## Adding the minimap

Set [`withMinimap: true`](api.md#withMinimap):

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Daily active users',
  type: 'line',
  labels: days(365),
  datasets: [
    {
      name: 'Mobile',
      values: series(365, { start: 18000, trend: 0.002, volatility: 0.04, seasonality: 0.12, seed: 41 }),
    },
    {
      name: 'Desktop',
      values: series(365, { start: 11000, trend: 0.001, volatility: 0.04, seasonality: 0.18, seed: 42 }),
    },
  ],
  withMinimap: true,
  isUtc: true,
});
```

- The window opens on the last 20% of the labels. Drag it across to pan, or drag one of the handles at its sides, its ears, to resize it. It can't get narrower than the two ears.
- As the window moves, the plot shows the labels under it, the [Y range](axes.md#the-y-axis-range) fits their values, and the [header caption](dates.md#the-header-caption) names their dates.
- The minimap draws the datasets the [legend](legend.md) shows, and fades out the ones the reader hides.

## The opening window

[`minimapRange`](api.md#minimapRange) sets the window the chart opens on, in one of three forms:

| Value | Opens on |
|---|---|
| `{ from, to }` | The labels from index `from` to index `to`, both included: `{ from: 0, to: 6 }` for the first week of daily labels |
| `[begin, end]` | That part of the axis, in fractions from 0 to 1: `[0.8, 1]` for the last 20% |
| `'full'` | Every label |

It defaults to `[0.8, 1]` with the minimap and to `'full'` without it.

`{ from, to }` counts labels, so it opens on whole days, weeks or months whatever the length of the data:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(180);

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'bar',
  labels,
  datasets: [
    { name: 'Orders', color: '#F79E39', values: series(180, { start: 260, seasonality: 0.25, seed: 7 }) },
  ],
  withMinimap: true,
  // The last 30 days
  minimapRange: { from: labels.length - 30, to: labels.length - 1 },
  isUtc: true,
});
```

- `from` and `to` are rounded and clamped to the labels. A range of no labels, as one with `from` after `to`, takes the default.
- A `bar` or `step` chart opens on the columns of those labels. A `line` or `area` chart opens on their points with half an interval past either end, within the axis, so the end points stay off the edges of the plot. A pie or a donut sums those labels.
- `minimapRange` works without the minimap too, for a chart that shows part of its data. The reader then has no window to drag, but can still [pick a range on the plot](#selecting-a-range-on-the-plot) with `isRangeSelectable`, and double-click it to see every label.

See [`minimapRange`](api.md#minimapRange) for every rule.

## Locking older data

[`limitDate`](api.md#limitDate) locks the labels before a timestamp, as data the reader has no access to, such as the history beyond a free plan. The minimap covers them with a blurred mask, a dashed edge and a lock, and its window starts no earlier than the first label at or after `limitDate`, wherever the reader drags it. [`onLimitedRangeClick`](api.md#onLimitedRangeClick) is called when the reader clicks the mask, to offer what it locks:

```html live
<style>
  .limit-note {
    min-height: 1.5em;
    margin: 0 10px;
    font: 14px system-ui, sans-serif;
  }
</style>
<div id="revenue-chart"></div>
<p class="limit-note" id="limit-note"></p>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(180);
  const note = document.getElementById('limit-note');

  new LovelyChart(document.getElementById('revenue-chart'), {
    title: 'Revenue',
    type: 'area',
    labels,
    datasets: [
      { name: 'Revenue', values: series(180, { start: 5400, trend: 0.002, seasonality: 0.15, seed: 17 }) },
    ],
    valuePrefix: '$',
    withMinimap: true,
    // The free plan shows the last 90 days
    limitDate: labels[labels.length - 90],
    onLimitedRangeClick: () => {
      note.textContent = 'Upgrade to see the 90 days before.';
    },
    isUtc: true,
  });
</script>
```

- Without `onLimitedRangeClick`, the mask lets the pointer through.
- A `minimapRange` that starts before the first open label starts on it, keeping its width.
- `limitDate` needs the minimap. It's ignored when it falls at or before the first label, which locks nothing, or after the label before the last, which would leave the window a single label.

> [!WARNING]
> The locked labels are still in the data you give the chart, so anyone can read them from the page. Leave out of it whatever the reader must not see.

## Selecting a range on the plot

With [`isRangeSelectable: true`](api.md#isRangeSelectable), a mouse can pick the range on the plot itself: press, drag across the labels to look at, and release. The chart draws a band in [`--range-selection-color`](css.md#--range-selection-color) while you drag, then opens a window on the labels under it, through the transition of a minimap drag. A double click shows the whole range again.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Website visits',
  type: 'line',
  labels: days(120),
  datasets: [
    { name: 'Visits', values: series(120, { start: 3300, seasonality: 0.2, seed: 1 }) },
    { name: 'Sign-ups', values: series(120, { start: 900, seasonality: 0.2, seed: 2 }) },
  ],
  // Drag across the plot to look closer, and double-click to see it all
  isRangeSelectable: true,
  isUtc: true,
});
```

- The window takes the labels whose point, or the centre of whose column, the band holds. A `line` or `area` chart takes two points at least, so a band over one point leaves the range as it was.
- With a minimap, its window follows the range, starting no earlier than `limitDate` allows and no narrower than its ears. Without one, as here, the plot takes the range alike.
- A press that moves less than 4px is a click, and Escape ends a drag with no change.
- On a chart that [zooms](zoom.md) on a click, the click that ends a drag zooms into nothing, and a double click zooms rather than showing the whole range.
- A touch keeps selecting a label, as without the option.
- The option is ignored on pie and donut charts, while the chart is zoomed, and with `noTooltip`.

## Following the range

[`onRangeChange`](api.md#onRangeChange) tells you which labels are on screen, as `{ from, to }`, inclusive indexes in `labels`. The chart calls it on its first paint and after each frame that moves the labels: through a drag of the minimap, the transition to a range selected on the plot, a zoom, an `update()` and a resize. Use it to sum up the window, or to move another view of the same data along:

```html live
<style>
  .range-summary {
    min-height: 1.5em;
    margin: 0 10px;
    font: 14px system-ui, sans-serif;
  }
</style>
<div id="tickets-chart"></div>
<p class="range-summary" id="range-summary"></p>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(365);
  const values = series(365, { start: 940, trend: 0.001, seasonality: 0.2, seed: 12 });
  const summary = document.getElementById('range-summary');
  const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

  new LovelyChart(document.getElementById('tickets-chart'), {
    title: 'Tickets closed',
    type: 'bar',
    labels,
    datasets: [{ name: 'Tickets', color: '#5D5CDC', values }],
    withMinimap: true,
    isUtc: true,
    onRangeChange: (range) => {
      if (!range) return;
      const { from, to } = range;
      const total = values.slice(from, to + 1).reduce((sum, value) => sum + value, 0);
      summary.textContent = `${formatDate(labels[from])} – ${formatDate(labels[to])}: `
        + `${total.toLocaleString('en-GB')} tickets in ${to - from + 1} days`;
    },
  });
</script>
```

- The callback runs at most once a frame, but on every frame of a drag, so keep it light.
- It's called with `undefined` when no labels are on screen: on a pie or a donut, from the start of a [zoom into shares](zoom.md#zooming-into-shares) until the zoom out, and as `destroy()` tears the chart down.
- While zoomed into [detail data](zoom.md#loading-detail-data), the indexes count the labels of that data.

The range means what it means in `minimapRange`, so passing it back reopens the same window. Store the values of its labels rather than their indexes, which shift as new data arrives:

```js
const saved = JSON.parse(localStorage.getItem('orders-range') ?? 'null');
const from = saved ? labels.indexOf(saved.from) : -1;
const to = saved ? labels.indexOf(saved.to) : -1;

new LovelyChart(element, {
  ...params,
  labels,
  withMinimap: true,
  minimapRange: from !== -1 && to !== -1 ? { from, to } : undefined,
  onRangeChange: (range) => {
    if (range) {
      const ends = { from: labels[range.from], to: labels[range.to] };
      localStorage.setItem('orders-range', JSON.stringify(ends));
    }
  },
});
```

`update()` opens its new data on the window of its own `minimapRange`, unless [`shouldKeepZoom: true`](api.md#shouldKeepZoom) keeps the one the reader has while the labels stay the same: see [Updating data](updating.md). To place an element of the page at a label as the window moves, pair `onRangeChange` with [`getLabelX()`](api.md#getLabelX): see [Overlays](overlays.md).

## Touch screens

- A swipe across the window drags it, and a swipe across an ear resizes it.
- A swipe up or down the window or an ear scrolls the page, and leaves the window where it was. The touch decides its way within its first 6px.
- Where the pointer is coarse, as on a phone, the ears take touches a little wider than they look.
- [Selecting a range on the plot](#selecting-a-range-on-the-plot) is for a mouse: a touch on the plot selects a label.

## Spacing

The minimap is 40px high. Two CSS variables place it:

- [`--lovely-chart-inset`](css.md#--lovely-chart-inset), `10px` by default, insets it from the sides, as it does the header and the legend. The minimap canvas takes the width it leaves.
- [`--lovely-chart-minimap-margin-bottom`](css.md#--lovely-chart-minimap-margin-bottom), `16px` by default, sets the space under it.

The colours of its mask and window come from the skin, as `--minimap-limit-color` gives the mask of `limitDate`: see [Theming](theming.md).
