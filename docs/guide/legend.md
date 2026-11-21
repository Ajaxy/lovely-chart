# Legend

A chart of more than one dataset ends with a legend: a button for each dataset, which hides it or shows it again. This page covers toggling, datasets that start hidden, reacting to the reader's choice, a legend elsewhere on the page, and the look of its buttons.

## Toggling datasets

- A click or a tap on a button hides its dataset, and another shows it again. The plot, the Y range, the minimap and the tooltip follow.
- Press and hold a button for half a second to show its dataset alone. Hold the button of the only dataset on screen to show all the others in its place.
- The last dataset on screen stays: its button shakes rather than hide it, as a chart of nothing would say nothing.
- Each button is in the tab order, with `role="button"` and `aria-pressed`, and toggles on Enter or Space.

A chart with a [`comparison`](annotations.md#comparison-with-a-previous-period) names it in the legend too, beside a dashed swatch. That entry is a name, not a button: the comparison line follows the datasets on screen.

## Starting with datasets hidden

Set [`isInitiallyHidden: true`](api.md#datasets-isInitiallyHidden) on a dataset to start it hidden, its button unchecked, so the reader can show it from the legend. It suits a dataset that's useful on demand but crowds the chart, such as a small series beside large ones:

```js
new LovelyChart(element, {
  type: 'line',
  labels,
  datasets: [
    { name: 'Apples', values: apples },
    { name: 'Oranges', values: oranges },
    { name: 'Kiwi', values: kiwi, isInitiallyHidden: true },
  ],
});
```

A lone dataset that starts hidden keeps its legend, as the legend is the way to show it.

## Reacting to the legend

[`onHiddenSeriesChange`](api.md#onHiddenSeriesChange) is called whenever the reader shows or hides a dataset in the legend, with the names and the indexes of the datasets now hidden:

```html live
<style>
  .hidden-status {
    margin: 0 10px;
    font: 14px system-ui, sans-serif;
  }
</style>
<div id="fruit-chart"></div>
<p class="hidden-status" id="hidden-status"></p>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const status = document.getElementById('hidden-status');
  const describe = (names) => {
    status.textContent = names.length ? `Hidden: ${names.join(', ')}` : 'Every fruit is shown';
  };

  const datasets = [
    { name: 'Apples', values: series(30, { start: 420, seed: 1 }) },
    { name: 'Oranges', values: series(30, { start: 310, seed: 2 }) },
    { name: 'Kiwi', values: series(30, { start: 120, seed: 3 }), isInitiallyHidden: true },
  ];

  new LovelyChart(document.getElementById('fruit-chart'), {
    title: 'Fruit sold',
    type: 'line',
    labels: days(30),
    datasets,
    isUtc: true,
    onHiddenSeriesChange: (names) => describe(names),
  });
  // The datasets the data starts hidden go unreported
  describe(datasets.filter(({ isInitiallyHidden }) => isInitiallyHidden).map(({ name }) => name));
</script>
```

The datasets that `isInitiallyHidden` starts hidden go unreported, on creation and on `update()`, as the page knows them already.

Together, the two let the chart remember the reader's choice across visits:

```js
const hidden = JSON.parse(localStorage.getItem('fruit-hidden') ?? '[]');

new LovelyChart(element, {
  ...params,
  datasets: params.datasets.map((dataset) => ({
    ...dataset,
    isInitiallyHidden: hidden.includes(dataset.name),
  })),
  onHiddenSeriesChange: (names) => localStorage.setItem('fruit-hidden', JSON.stringify(names)),
});
```

Within one visit, `update()` resets the legend unless you pass [`shouldKeepFilter: true`](api.md#shouldKeepFilter), which keeps the datasets the reader hid: see [Updating data](updating.md).

## A legend elsewhere on the page

[`legendContainer`](api.md#legendContainer) takes an element of the page that holds the legend in place of the end of the chart, as in a toolbar above it. The legend takes its spacing variables from that element and its ancestors, and, while `--lovely-chart-font-family` is unset, the font family of that element.

[`setLegendContainer(element)`](api.md#setLegendContainer) moves the legend later, without a rebuild: its buttons keep the datasets they hide, and the chart its zoom, range and selection. `setLegendContainer(undefined)` moves it back to the end of the chart.

```html live
<style>
  .region-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin: 0 10px 8px;
    font: 14px system-ui, sans-serif;
  }

  /* The legend takes its font and its spacing from the element that holds it */
  #region-legend {
    font-family: system-ui, sans-serif;
    --lovely-chart-legend-padding-bottom: 8px;
  }
</style>
<div class="region-toolbar">
  <strong>Sales by region</strong>
  <button type="button" id="move-legend">Move the legend into the chart</button>
</div>
<div id="region-legend"></div>
<div id="region-chart"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const legend = document.getElementById('region-legend');
  const button = document.getElementById('move-legend');

  const chart = new LovelyChart(document.getElementById('region-chart'), {
    type: 'area',
    isStacked: true,
    labels: days(60),
    datasets: [
      { name: 'Europe', values: series(60, { start: 3200, seed: 91 }) },
      { name: 'Americas', values: series(60, { start: 2700, seed: 92 }) },
      { name: 'Asia', values: series(60, { start: 2100, seed: 93 }) },
      { name: 'Africa', values: series(60, { start: 600, seed: 94 }) },
    ],
    legendContainer: legend,
    isUtc: true,
  });

  let isInToolbar = true;
  button.addEventListener('click', () => {
    isInToolbar = !isInToolbar;
    chart.setLegendContainer(isInToolbar ? legend : undefined);
    button.textContent = isInToolbar ? 'Move the legend into the chart' : 'Move the legend to the top';
  });
</script>
```

The legend stays where `setLegendContainer()` put it through a zoom, a resize and an orientation change. `update()` places it by the `legendContainer` of its new data, so pass the element in every update that should keep it there.

## Hiding the legend

- A chart of a single dataset shows no legend, unless the dataset starts hidden or the chart has a `comparison`.
- A [sparkline](api.md#isSparkline) has no legend.
- For a chart of several datasets, point `legendContainer` at an element the page never shows, such as one left out of the document. The legend goes there, out of sight, and the reader can no longer hide a dataset:

```js
new LovelyChart(card, {
  ...params,
  // The legend goes to an element left out of the document
  legendContainer: document.createElement('div'),
});
```

An element with the `hidden` attribute works the same way. To show the datasets' names elsewhere in the colours the chart gives them, see [`getDefaultColors()`](api.md#getDefaultColors).

## Spacing and styling

These CSS variables space the legend and size its buttons. They apply from the chart's element, any ancestor of it or `.lovely-chart--container`, and for a legend in `legendContainer`, from that element and its ancestors:

| Variable | Sets | Default |
|---|---|---|
| [`--lovely-chart-legend-gap`](css.md#--lovely-chart-legend-gap) | The space between the buttons, as the CSS `gap`: one length, or a row gap and a column gap | `8px 6px` |
| [`--lovely-chart-legend-padding-bottom`](css.md#--lovely-chart-legend-padding-bottom) | The space under the last row; `0` ends the chart at the legend | `24px` |
| [`--lovely-chart-button-padding`](css.md#--lovely-chart-button-padding) | The padding on every side of a button, which also places its check mark | `7px` |
| [`--lovely-chart-button-radius`](css.md#--lovely-chart-button-radius) | The corner radius of a button | `18px` |
| [`--lovely-chart-button-font-size`](css.md#--lovely-chart-button-font-size) | The font size of the buttons and of the comparison entry | The size around them, the chart's `13px` |
| [`--lovely-chart-inset`](css.md#--lovely-chart-inset) | The side inset of the legend, the header and the minimap | `10px` |

```html live
<style>
  /* Small pills, close together */
  #pill-chart {
    --lovely-chart-legend-gap: 4px;
    --lovely-chart-button-padding: 4px;
    --lovely-chart-button-radius: 8px;
    --lovely-chart-button-font-size: 12px;
  }
</style>
<div id="pill-chart"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/areas-absolute.json').then((response) => response.json());

  new LovelyChart(document.getElementById('pill-chart'), { ...data, title: 'Fruit sold', isUtc: true });
</script>
```

Each button takes its outline, its label and its checked fill from [`--lovely-chart-series-color`](css.md#--lovely-chart-series-color), which the chart sets on it to the colour of its dataset in the skin on screen. A checked button keeps a white label while it reads clearly on the fill, and takes a dark one on a pale fill, such as the light green `#9ED448`. The buttons take the font of the chart's text: see [Theming](theming.md).

## Dashed and dotted entries

A `line` or `step` dataset drawn with [`isDashed`](api.md#datasets-isDashed) or [`isDotted`](api.md#datasets-isDotted) shows the dashes or the dots on the outline of its button, and on its tooltip swatch, so datasets of one colour still tell apart:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Sign-ups by platform',
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'iOS', color: '#3497ED', values: series(30, { start: 820, seed: 31 }) },
    { name: 'Android', color: '#3497ED', values: series(30, { start: 640, seed: 32 }), isDashed: true },
    { name: 'Web', color: '#3497ED', values: series(30, { start: 410, seed: 33 }), isDotted: true },
  ],
  isUtc: true,
});
```

The button of such a dataset carries a `data-dashed` or a `data-dotted` attribute. Datasets of other types ignore both options, in the legend too.
