# Events and external control

A chart talks to your page in both directions. Callbacks in its params tell you what the reader does, as selecting a day or hiding a dataset, and instance methods let your page drive the chart, as selecting a label from a list or zooming out from a button of your own.

## Callbacks

Callbacks are params like any other: pass them to the constructor, and again in every [`update()`](api.md#update), since the new params replace the old ones whole.

| Callback | Called with | When |
|---|---|---|
| [`onSelectedIndexChange`](api.md#onSelectedIndexChange) | `labelIndex`, or `undefined` | The selected label changes, by pointer, touch, keyboard or `selectLabel()`; `undefined` once nothing is selected |
| [`onTooltipChange`](api.md#onTooltipChange) | `{ labelIndex, title, rows, total?, comparison? }`, or `undefined` | What the tooltip shows changes, as another label is selected or a dataset is shown or hidden; called after `onSelectedIndexChange` |
| [`onHiddenSeriesChange`](api.md#onHiddenSeriesChange) | `names`, `datasetIndexes` of the hidden datasets | The reader shows or hides a dataset in the legend |
| [`onZoomChange`](api.md#onZoomChange) | `labelValue`, `labelIndex`, or `undefined` for both | A zoom into a label settles, or the chart is back in its overview |
| [`onRangeChange`](api.md#onRangeChange) | `{ from, to }` label indexes, or `undefined` | A frame draws the labels at a new x: the first paint, each frame of a minimap drag or of a zoom's transition, the first paint after `update()` or a resize |
| [`onPlotAreaChange`](api.md#onPlotAreaChange) | `{ left, top, width, height }`, or `undefined` | The first paint, and each change of the data area of the plot |
| [`onLimitedRangeClick`](api.md#onLimitedRangeClick) | nothing | The reader clicks the locked part of the minimap that [`limitDate`](api.md#limitDate) masks |
| [`onZoom`](api.md#onZoom) | `labelValue` | The chart zooms into a label and needs its data: return a `Promise` of the params of the zoomed chart |

Here is each callback reporting as you use the chart. Point at a month, hide a category, drag the minimap, or click a month to zoom into its shares:

```html live
<div id="spending"></div>
<dl class="callback-log">
  <dt>onSelectedIndexChange</dt><dd data-for="selected">—</dd>
  <dt>onTooltipChange</dt><dd data-for="tooltip">—</dd>
  <dt>onHiddenSeriesChange</dt><dd data-for="hidden">—</dd>
  <dt>onRangeChange</dt><dd data-for="range">—</dd>
  <dt>onZoomChange</dt><dd data-for="zoom">—</dd>
</dl>
<style>
  .callback-log { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 10px; }
  .callback-log dt { font-family: ui-monospace, monospace; font-size: 13px; }
  .callback-log dd { margin: 0; font-variant-numeric: tabular-nums; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/bars-monthly.json').then((response) => response.json());
  const show = (name, text) => { document.querySelector(`[data-for="${name}"]`).textContent = text; };
  const month = (index) => new Date(data.labels[index]).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

  new LovelyChart(document.getElementById('spending'), {
    ...data,
    onSelectedIndexChange: (index) => show('selected', index === undefined ? 'undefined' : `${index} (${month(index)})`),
    onTooltipChange: (tooltip) => show('tooltip', tooltip ? `${tooltip.title}: $${tooltip.total.toLocaleString('en-US')}` : 'undefined'),
    onHiddenSeriesChange: (names) => show('hidden', names.length ? names.join(', ') : 'none hidden'),
    onRangeChange: (range) => show('range', range ? `${month(range.from)} – ${month(range.to)}` : 'undefined'),
    onZoomChange: (labelValue, labelIndex) => show('zoom', labelIndex === undefined ? 'undefined' : month(labelIndex)),
  });
</script>
```

A few things worth knowing:

- **Indexes, not values.** `onSelectedIndexChange`, `onTooltipChange` and `onRangeChange` give indexes in `labels`. Look the label up in your own data when you need its date.
- **`undefined` means "nothing".** The callbacks report the end of what they track with `undefined`: nothing selected, an empty tooltip, the overview after a zoom, no labels on screen, a destroyed chart.
- **What the reader starts with goes unreported.** `onHiddenSeriesChange` isn't called for the datasets that start hidden by `isInitiallyHidden`, on creation or on `update()`.
- **`onRangeChange` runs on every frame of a pan.** Keep it light, and don't call `update()` from it unconditionally: the first frame of the new data reports again, so the chart would rebuild on every frame.

### Remembering what the reader hid

`onHiddenSeriesChange` and [`isInitiallyHidden`](api.md#datasets-isInitiallyHidden) together let a chart come back as the reader left it:

```js
const STORAGE_KEY = 'orders-chart-hidden';
const hiddenNames = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

new LovelyChart(element, {
  ...params,
  datasets: params.datasets.map((dataset) => ({
    ...dataset,
    isInitiallyHidden: hiddenNames.includes(dataset.name),
  })),
  onHiddenSeriesChange: (names) => localStorage.setItem(STORAGE_KEY, JSON.stringify(names)),
});
```

### Linking to a zoomed label

`onZoomChange` reports the index of the zoomed label, and [`initialZoom`](api.md#initialZoom) opens a chart zoomed into one, so a URL can carry the zoom:

```js
const url = new URL(location.href);
const day = url.searchParams.get('day');

new LovelyChart(element, {
  ...params,
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

See [Zoom](zoom.md) for zooming in depth.

## Driving the chart from the page

The instance that `new LovelyChart()` returns has methods for everything a page commonly needs to do to a chart. Each one does nothing after [`destroy()`](api.md#destroy).

| Method | Does |
|---|---|
| [`selectLabel(labelIndex)`](api.md#selectLabel) | Selects a label as hovering it would; `undefined` clears the selection |
| [`zoomOut()`](api.md#zoomOut) | Zooms a zoomed chart out to its overview |
| [`setLegendContainer(element)`](api.md#setLegendContainer) | Moves the legend into an element of the page, or back with `undefined` |
| [`refreshColors()`](api.md#refreshColors) | Reads the `var()` colours of the params again; see [Theming and colours](theming.md) |
| [`setLoading(isLoading)`](api.md#setLoading) | Shows the data as loading, or as loaded; see [Updating data and loading](updating.md) |
| [`getLabelX(labelIndex, offset?)`](api.md#getLabelX) | The x of a label on the plot; see [Overlays and custom marks](overlays.md) |

### Selecting a label

`selectLabel(labelIndex)` does what hovering the label would: it shows its tooltip, focuses its bar, and calls `onSelectedIndexChange` and `onTooltipChange`. Unlike a hover, the selection holds while the pointer moves elsewhere on the page, and follows its label as the window pans. The pointer takes it over as it enters the chart, and it clears once its label leaves the visible range.

`selectLabel(undefined)` clears the selection.

> [!WARNING]
> The chart ignores `selectLabel()` before its first paint, the frame after it's created or updated. To select a label right away, wait a frame:
>
> ```js
> const chart = new LovelyChart(element, params);
> requestAnimationFrame(() => chart.selectLabel(params.labels.length - 1));
> ```
>
> It's also ignored for an index outside the visible range, on pie and donut charts, and with `noTooltip`.

### A zoom-out control of your own

The chart shows a zoom-out control in its header while zoomed. To place your own instead, as in a toolbar of the page, set [`noZoomOutControl`](api.md#noZoomOutControl) and call `zoomOut()`, using `onZoomChange` to know when to show the control:

```html live
<div class="toolbar">
  <button type="button" id="back-to-year" hidden>← Back to the year</button>
</div>
<div id="budget"></div>
<style>
  .toolbar { display: flex; justify-content: flex-end; min-height: 32px; margin: 0 10px; }
  .toolbar button { font: inherit; padding: 4px 12px; border-radius: 16px; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/bars-monthly.json').then((response) => response.json());
  const backButton = document.getElementById('back-to-year');

  const chart = new LovelyChart(document.getElementById('budget'), {
    ...data,
    title: 'Monthly spending',
    noZoomOutControl: true,
    onZoomChange: (labelValue) => {
      backButton.hidden = labelValue === undefined;
    },
  });

  backButton.addEventListener('click', () => chart.zoomOut());
</script>
```

Click a month to zoom into its shares, then use the button. `zoomOut()` starts on the next frame, and only if the chart is zoomed in by then: from the moment `onZoomChange` reports a zoom until a zoom out starts.

### Moving the legend

`setLegendContainer(element)` moves the legend into an element of your page without rebuilding the chart: the buttons keep the datasets they hide, and the chart its zoom, range and selection. Pass `undefined` to move it back to the end of the chart. For example, into a sidebar on wide screens:

```js
const wideScreen = matchMedia('(min-width: 60rem)');
const placeLegend = () => chart.setLegendContainer(wideScreen.matches ? sidebar : undefined);

placeLegend();
wideScreen.addEventListener('change', placeLegend);
```

The legend stays there through a zoom, a resize and an orientation change. `update()` places it by the [`legendContainer`](api.md#legendContainer) of its new params, so pass the element there too once you've moved it. See [A legend elsewhere on the page](legend.md#a-legend-elsewhere-on-the-page) for more.

## Keyboard selection

With [`isKeyboardSelectable`](api.md#isKeyboardSelectable), the plot joins the tab order of the page. Once it has the focus:

| Key | Selects |
|---|---|
| <kbd>←</kbd> / <kbd>→</kbd> | The previous or the next label; with nothing selected, the last label |
| <kbd>Home</kbd> / <kbd>End</kbd> | The first or the last label of the visible range |

A key pressed with <kbd>Alt</kbd>, <kbd>Ctrl</kbd> or <kbd>Meta</kbd> is left to the browser, so shortcuts such as <kbd>Alt</kbd> + <kbd>←</kbd> for "back" keep working. A selection by the keyboard holds, as one by `selectLabel()` does, and reports through the same callbacks as a hover.

The plot keeps the focus through `update()` and a resize. The option is ignored on pie and donut charts, and with `noTooltip`; the pie or donut a zoom opens leaves the tab order while it shows. See [Accessibility](accessibility.md#keyboard) for what else the keyboard reaches.

## Selecting a range with the mouse

With [`isRangeSelectable`](api.md#isRangeSelectable), a mouse can drag across the plot to narrow the window to a run of labels. A band in [`--range-selection-color`](css.md#--range-selection-color) follows the drag, and the release moves the window onto the labels under it, as a drag of the minimap would. On a chart that doesn't zoom in on a click, a double click shows the whole range again. <kbd>Escape</kbd> cancels a drag, and a touch keeps selecting a label.

```js
new LovelyChart(element, { ...params, isRangeSelectable: true });
```

`onRangeChange` reports each frame of the transition. The option is ignored on pie and donut charts, while zoomed and with `noTooltip`. See [Selecting a range on the plot](minimap.md#selecting-a-range-on-the-plot) for the details.

## Linking a chart with a list

A chart often sits beside a list or a table of the same data. Linking them both ways makes the pair easier to read:

- **List → chart:** each row calls `selectLabel()` on hover and focus.
- **Chart → list:** `onSelectedIndexChange` marks the row of the selected label.
- **Steps:** buttons step the selection from the last selected label, as the arrow keys do on the focused plot.

```html live
<div id="kiwi"></div>
<div class="day-picker">
  <div class="day-steps">
    <button type="button" data-step="-1">‹ Previous day</button>
    <button type="button" data-step="1">Next day ›</button>
  </div>
  <ol class="day-list" aria-label="Last week"></ol>
</div>
<style>
  .day-picker { margin: 0 10px; }
  .day-picker button { font: inherit; color: inherit; background: none; cursor: pointer; }
  .day-steps { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .day-steps button { padding: 4px 12px; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 16px; }
  .day-list { margin: 0; padding: 0; list-style: none; }
  .day-list button { display: flex; justify-content: space-between; width: 100%; padding: 6px 10px; border: 0; }
  .day-list button[aria-current] { background: rgba(95, 182, 65, 0.15); font-weight: bold; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(30);
  const values = series(30, { start: 5200, seasonality: 0.15, seed: 9 });
  const dayButtons = [];
  let lastIndex;

  const chart = new LovelyChart(document.getElementById('kiwi'), {
    title: 'Kiwi sold',
    type: 'bar',
    labels,
    datasets: [{ name: 'Kiwi', color: '#5FB641', values }],
    // The list reads its dates in UTC too
    isUtc: true,
    isKeyboardSelectable: true,
    onSelectedIndexChange: (index) => {
      // A pointer selection clears as the pointer leaves the chart, so the steps go on from the last one
      lastIndex = index ?? lastIndex;
      dayButtons.forEach((button) => {
        if (Number(button.value) === index) button.setAttribute('aria-current', 'date');
        else button.removeAttribute('aria-current');
      });
    },
  });

  labels.slice(-7).forEach((label, i) => {
    const index = labels.length - 7 + i;
    const button = document.createElement('button');
    button.type = 'button';
    button.value = String(index);
    const date = new Date(label).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    button.append(date, Object.assign(document.createElement('span'), { textContent: values[index].toLocaleString('en-US') }));
    button.addEventListener('mouseenter', () => chart.selectLabel(index));
    button.addEventListener('focus', () => chart.selectLabel(index));
    dayButtons.push(button);
    const item = document.createElement('li');
    item.append(button);
    document.querySelector('.day-list').append(item);
  });

  document.querySelectorAll('[data-step]').forEach((stepButton) => {
    stepButton.addEventListener('click', () => {
      const step = Number(stepButton.dataset.step);
      const last = labels.length - 1;
      chart.selectLabel(lastIndex === undefined ? last : Math.min(last, Math.max(0, lastIndex + step)));
    });
  });
</script>
```

The rows mark the selected day with `aria-current="date"`, which both styles the row and tells assistive technology which day the chart shows. `isUtc` makes the chart read its dates in UTC, as the list does, so both name the same day.
