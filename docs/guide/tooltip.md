# Tooltip

Point at a label, or touch it, and the chart shows its values in a balloon beside the pointer. This page covers what the balloon shows and in what order, its totals and notes, a readout of your own in its place, and how to style it or turn it off.

## What the tooltip shows

From top to bottom, the balloon holds:

1. **The title**: the label as the X axis shows it, or in the format of [`tooltipFormatter`](dates.md#tooltip-title-formats). A [title note](#notes) can follow it, and with `isTooltipTotalInTitle` the [total](#totals) stands at its far end. On a chart that [zooms](zoom.md), a chevron at the end of the title shows that a click zooms in.
2. **The comparison row**, on a chart with a [`comparison`](annotations.md#comparison-with-a-previous-period): the value of the previous period in a muted colour, with the change of the current total in percent, set apart from the rows under it by a rule.
3. **A row for each dataset on screen** with a value at the label: a swatch of its colour, its name and its value, from the largest value down. The swatch of a dashed or dotted line is a dashed or dotted outline. A dataset hidden in the legend, or with a gap or a zero at the label, has no row, and the balloon holds 12 rows at most.
4. **The Total row**, on a stacked or percentage bar, step or area chart.
5. **The row of a second unit**, with a [`secondaryYAxis`](axes.md#a-second-unit-on-the-same-axis).
6. **Notes**, under a rule: see [Notes](#notes).

A percentage chart prints the share of each dataset at the start of its row. A pie or a donut lists the sector under the pointer alone.

On the plot, a line or an area chart draws a vertical line at the label, a chart with bars or steps masks the columns around the focused one instead, and each line dataset gets a dot at the label.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

// Eight weeks of visits: the last four on the chart, the four before as the comparison
const channels = [['Search', 5200, 1], ['Direct', 3100, 2], ['Social', 1900, 3], ['Email', 900, 4]]
  .map(([name, start, seed]) => ({ name, values: series(56, { start, seasonality: 0.15, seed }) }));

new LovelyChart(document.getElementById('chart'), {
  title: 'Visits by channel',
  type: 'bar',
  isStacked: true,
  labels: days(28),
  datasets: channels.map(({ name, values }) => ({ name, values: values.slice(28) })),
  comparison: { name: 'Four weeks before', values: channels.map(({ values }) => values.slice(0, 28)) },
  isUtc: true,
});
```

## Formatting values

The tooltip prints each number in full, its thousands set apart by a space, as `12 500`. These options change that:

```js
new LovelyChart(element, {
  ...params,
  // Wraps every value and total of the tooltip, and the Y-axis labels
  valuePrefix: '$',
  // -$9.1 rather than $-9.1, on the Y axis too
  isCurrencyPrefix: true,
  // The number between the prefix and the suffix, in the tooltip alone
  formatTooltipValue: (value) => value.toLocaleString('en-US', { maximumFractionDigits: 1 }),
});
```

See [Formatting values](axes.md#formatting-values) for each of them, and [`valueSuffix`](api.md#valueSuffix) for units after the number.

## Totals

A stacked or percentage `bar`, `step` or `area` chart adds a Total row: the sum of the rows on screen. A dataset on a [second Y axis](axes.md#a-second-y-axis), or drawn as [another type](api.md#datasets-type) than the chart's, stays out of it. Two options change where the total stands and what it is:

- [`isTooltipTotalInTitle`](api.md#isTooltipTotalInTitle) puts the total at the end of the title, in place of the Total row.
- [`resolveTooltipTotal`](api.md#resolveTooltipTotal) gives the total yourself, for a total that isn't the sum of its parts. It takes `(labelValue, datasetIndexes, labelIndex)`: the label's timestamp, or the index of a text label, the indexes of the datasets on screen, and the label's index. Return a number, `null` to show `—`, or `undefined` to keep the sum.

Here a person active on more than one platform counts once in the total, which holds while every platform is shown:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(30);
const ios = series(30, { start: 4200, seed: 61 });
const android = series(30, { start: 5300, seed: 62 });
const web = series(30, { start: 2700, seed: 63 });
// People on more than one platform count once
const uniqueUsers = labels.map((_, i) => Math.round((ios[i] + android[i] + web[i]) * 0.86));

new LovelyChart(document.getElementById('chart'), {
  title: 'Active users',
  type: 'bar',
  isStacked: true,
  labels,
  datasets: [
    { name: 'iOS', values: ios },
    { name: 'Android', values: android },
    { name: 'Web', values: web },
  ],
  isTooltipTotalInTitle: true,
  // With a platform hidden, the sum of the rows stands
  resolveTooltipTotal: (labelValue, datasetIndexes, labelIndex) => (
    datasetIndexes.length === 3 ? uniqueUsers[labelIndex] : undefined
  ),
  isUtc: true,
});
```

The change against a [`comparison`](api.md#comparison) and the total on a [`secondaryYAxis`](api.md#secondaryYAxis) scale read this total too.

On a percentage chart, the share at the start of each row is a whole percent by default. Where shares sit close together, [`percentPrecision`](api.md#percentPrecision) adds digits after the point:

```js
new LovelyChart(element, {
  type: 'area',
  isPercentage: true,
  labels,
  datasets,
  // 12.5% rather than 13%
  percentPrecision: 1,
});
```

## Row order

The rows run from the largest value down, so they change places as the reader moves along the labels. On a stacked chart, where the order of the stack means something, [`isTooltipOrderFixed`](api.md#isTooltipOrderFixed) lists them in the order of the legend instead, after the comparison row:

```js
new LovelyChart(element, {
  type: 'area',
  isStacked: true,
  labels,
  datasets,
  isTooltipOrderFixed: true,
  isTooltipTotalInTitle: true,
});
```

When more than 12 rows would show, the largest values still decide which ones do.

## Notes

Notes are muted lines under the rows, and a muted word or two beside the title, that explain a label: an estimate, an outage, a promotion. They come from three places, in this order:

1. The `note` of each of the [`hatchedRanges`](annotations.md#notes-in-the-tooltip) that hold the label, and the `titleNote` of the first one that has one.
2. The `hint` of each of the [`eventLines`](annotations.md#event-lines) at the label.
3. [`resolveTooltipNotes`](api.md#resolveTooltipNotes), a function of `(labelValue, datasetIndexes, labelIndex)`, as `resolveTooltipTotal` takes them, that returns `{ titleNote?, notes? }` or `undefined`.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const promoDays = [18, 19, 20, 21];

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'bar',
  labels: days(30),
  datasets: [{ name: 'Orders', values: series(30, { start: 640, seasonality: 0.2, seed: 71 }) }],
  // The last three days are still being counted
  hatchedRanges: [{
    from: 27,
    to: 29,
    label: 'Partial',
    titleNote: 'partial',
    note: 'Late orders are still arriving',
  }],
  eventLines: [{
    labelIndex: 10,
    label: 'Outage',
    isDashed: true,
    hint: 'Checkout was down\nfor 40 minutes',
  }],
  resolveTooltipNotes: (labelValue, datasetIndexes, labelIndex) => (
    promoDays.includes(labelIndex) ? { titleNote: 'promo', notes: ['Autumn sale: 15% off'] } : undefined
  ),
  isUtc: true,
});
```

- A `\n` splits a note into lines, and a line shown already is left out.
- Notes show as text, never as HTML.
- The `titleNote` of `resolveTooltipNotes` wins over that of a range.
- The notes change with the rows, for a pointer, a touch or [`selectLabel()`](api.md#selectLabel). Pie and donut charts show none.

## Your own readout

To show the tooltip's content somewhere else on the page, such as a panel under the chart on a phone, use [`onTooltipChange`](api.md#onTooltipChange). The chart calls it whenever what the tooltip shows changes, as another label is selected or a dataset is shown or hidden, and with `undefined` once nothing is selected. It passes:

| Field | Holds |
|---|---|
| `labelIndex` | The index of the label in `labels` |
| `title` | The title of the tooltip |
| `rows` | Each dataset on screen, in the order of `datasets`, as `{ datasetIndex, name, value }`: a zero included, and `null` for a gap |
| `total` | On a stacked or percentage bar, step or area chart, the total the tooltip shows |
| `comparison` | With a `comparison`, `{ name, value, change? }`: the previous value and the change in percent, unrounded |

A pie or a donut reports nothing.

Then hide the balloon with the [`--lovely-chart-balloon-display`](css.md#--lovely-chart-balloon-display) CSS variable. `none`, on the chart's element or an ancestor, hides the balloon alone: the hover line, the dots, the focus of a bar and the callbacks all stay.

```html live
<style>
  .readout-chart {
    --lovely-chart-balloon-display: none;
  }

  /* Holds the height of a full readout, so the page stays still as the selection comes and goes */
  .readout {
    min-height: 6.5em;
    margin: 0 10px;
    font: 14px/1.6 system-ui, sans-serif;
  }
</style>
<div class="readout-chart" id="readout-chart"></div>
<div class="readout" id="readout"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const readout = document.getElementById('readout');
  const format = (value) => (value === null ? '—' : value.toLocaleString('en-US'));

  function showTooltip(tooltip) {
    if (!tooltip) {
      readout.textContent = 'Point at a day, or focus the chart and press ← or →';
      return;
    }
    const title = document.createElement('strong');
    title.textContent = `${tooltip.title}: ${format(tooltip.total)} orders`;
    const rows = tooltip.rows.map(({ name, value }) => {
      const row = document.createElement('div');
      row.textContent = `${name}: ${format(value)}`;
      return row;
    });
    readout.replaceChildren(title, ...rows);
  }

  new LovelyChart(document.getElementById('readout-chart'), {
    title: 'Orders by channel',
    type: 'bar',
    isStacked: true,
    labels: days(14),
    datasets: [
      { name: 'Web', values: series(14, { start: 540, seed: 51 }) },
      { name: 'App', values: series(14, { start: 380, seed: 52 }) },
      { name: 'Phone', values: series(14, { start: 90, seed: 53 }) },
    ],
    isKeyboardSelectable: true,
    isUtc: true,
    onTooltipChange: showTooltip,
  });
  showTooltip(undefined);
</script>
```

To swap the balloon for the readout on narrow screens alone, set the variable in a media query:

```css
@media (max-width: 40rem) {
  .readout-chart {
    --lovely-chart-balloon-display: none;
  }
}
```

[`isKeyboardSelectable`](api.md#isKeyboardSelectable), set above, lets the reader step through the labels with the arrow keys. See [Interaction](interaction.md) for it, for [`onSelectedIndexChange`](api.md#onSelectedIndexChange) and for selecting a label from the page with `selectLabel()`.

## Styling

The balloon's text takes the `--text-color` of the skin, and its background `--tooltip-background`. A few more variables style the rest:

| Variable | Styles | Default |
|---|---|---|
| [`--tooltip-border`](css.md#--tooltip-border) | The border of the balloon, as `1px solid #D2D5D7` | `none` |
| [`--tooltip-muted-text-color`](css.md#--tooltip-muted-text-color) | The comparison row and the notes | A mix of 70% `--text-color` and 30% `--tooltip-background` |
| [`--tooltip-separator-color`](css.md#--tooltip-separator-color) | The rules under the comparison row and over the notes | `--grid-lines` |
| `--tooltip-change-positive`, `--tooltip-change-negative` | A rise and a fall against the comparison | A blue and a red of the skin |

They're colours of the skin, set on `.lovely-chart--container`, so set yours there too, and one for each skin where day and night differ: see [Theming](theming.md).

For anything else, the tooltip keeps these classes from release to release; its other classes are internal:

| Class | Element |
|---|---|
| [`.lovely-chart--tooltip-balloon`](css.md#lovely-chart--tooltip-balloon) | The balloon: its shadow, padding and radius |
| [`.lovely-chart--tooltip-title`](css.md#lovely-chart--tooltip-title) | The title |
| [`.lovely-chart--tooltip-title-total`](css.md#lovely-chart--tooltip-title-total) | The total beside the title |
| [`.lovely-chart--tooltip-title-note`](css.md#lovely-chart--tooltip-title-note) | The note beside the title |
| [`.lovely-chart--tooltip-dataset`](css.md#lovely-chart--tooltip-dataset) | A row, the comparison, Total and second-unit rows included |
| [`.lovely-chart--tooltip-dataset-value`](css.md#lovely-chart--tooltip-dataset-value) | The value of a row |
| [`.lovely-chart--tooltip-dataset-comparison`](css.md#lovely-chart--tooltip-dataset-comparison) | The comparison row |
| [`.lovely-chart--tooltip-swatch`](css.md#lovely-chart--tooltip-swatch) | The swatch of a row, in `--lovely-chart-series-color` |
| [`.lovely-chart--tooltip-change[data-tone]`](css.md#lovely-chart--tooltip-change) | The change against the comparison: `positive`, `negative` or `neutral` |
| [`.lovely-chart--tooltip-notes`](css.md#lovely-chart--tooltip-notes) | The notes under the rows, a `<div>` per line |

```html live
<style>
  /* A hairline border in the colour of the grid, which follows the skin */
  #styled-chart .lovely-chart--container {
    --tooltip-border: 1px solid var(--grid-lines);
  }

  #styled-chart .lovely-chart--tooltip-balloon {
    border-radius: 4px;
    box-shadow: none;
  }

  #styled-chart .lovely-chart--tooltip-title {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Round swatches */
  #styled-chart .lovely-chart--tooltip-swatch {
    border-radius: 50%;
  }
</style>
<div id="styled-chart"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  new LovelyChart(document.getElementById('styled-chart'), {
    title: 'Storage used, GB',
    type: 'area',
    isStacked: true,
    labels: days(30),
    datasets: [
      { name: 'Photos', values: series(30, { start: 420, trend: 0.01, volatility: 0.02, seed: 81 }) },
      { name: 'Videos', values: series(30, { start: 260, trend: 0.015, volatility: 0.03, seed: 82 }) },
      { name: 'Documents', values: series(30, { start: 90, trend: 0.005, volatility: 0.02, seed: 83 }) },
    ],
    isUtc: true,
  });
</script>
```

> [!TIP]
> Scope your rules to the chart's element, as `#styled-chart` above, so that they win over the library's own rules wherever its stylesheet loads.

## Turning it off

[`noTooltip: true`](api.md#noTooltip) leaves out the whole hover layer: the line, the dots and the balloon, and the pointer handling of the plot. No pointer selects a label or a range, focuses a bar or zooms in, and `selectLabel()`, `isKeyboardSelectable` and `isRangeSelectable` are ignored. [`initialZoom`](zoom.md#opening-zoomed) still opens a zoom. It suits small multiples and thumbnails that read at a glance.

To keep the hover line and the callbacks and drop the balloon alone, use `--lovely-chart-balloon-display: none`, as in [Your own readout](#your-own-readout).

## Touch screens

- A touch on the plot selects the label under the finger, and a move along the plot follows it. A touch elsewhere on the page clears it.
- On a chart that zooms, a tap on the balloon zooms into its label, as a click on the plot does with a mouse. With `--lovely-chart-balloon-display: none` there's no balloon to tap, so that zoom goes too.
- A drag across the plot keeps selecting labels: [selecting a range](minimap.md#selecting-a-range-on-the-plot) on the plot is for a mouse.
