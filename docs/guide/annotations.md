# Annotations

Annotations are marks the chart draws on the canvas together with your data: horizontal rules at values, hatched runs of labels, vertical rules at moments, and a dashed line for a previous period. They move with the data through every pan, resize and skin change, with no code of your own.

## Which one to use

| Option | Draws | Use it for |
|---|---|---|
| [`referenceLines`](api.md#referenceLines) | Dashed horizontal rules at values of the Y axis | Targets, limits, thresholds, pinning the Y range |
| [`hatchedRanges`](api.md#hatchedRanges) | Diagonal hatching over a run of labels | Forecasts, estimates, periods still filling up |
| [`eventLines`](api.md#eventLines) | Vertical rules, optionally with a pin head | Launches, outages, a change in how data is collected |
| [`comparison`](api.md#comparison) | A dashed line of a previous period | "This month against last month", with the change in the tooltip |

All four are ignored on pie and donut charts. When you need something the canvas can't draw, such as a link or a button at a label, see [Overlays and custom marks](overlays.md).

## Reference lines

A reference line is a dashed rule across the plot at a fixed value of the main Y axis. Each entry takes a `value`, an optional `label` drawn above the right end of the line, and an optional `color`, which defaults to the colour of the Y-axis labels.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'API latency, p95',
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'p95', color: '#3497ED', values: series(30, { start: 180, volatility: 0.06, seed: 11 }) },
  ],
  valueSuffix: ' ms',
  referenceLines: [
    // Above every value: the Y range stretches to show it
    { value: 250, label: 'SLO · 250 ms', color: { light: '#E65850', dark: '#F07068' } },
    { value: 200, label: 'Alert' },
  ],
  isUtc: true,
});
```

The Y range always reaches every reference value, stacked charts included. That's why the 250 ms line above shows even though no value reaches it: a target never falls off the top of the plot.

### Pinning the Y range

Because the range always reaches each value, a line you can't see is a handy way to fix one end of the axis. Give it `color: 'transparent'` and it draws nothing:

```js
new LovelyChart(element, {
  type: 'bar',
  labels,
  datasets: [{ name: 'Kiwi', values }],
  // Starts the bars at zero, however close together their values are
  referenceLines: [{ value: 0, color: 'transparent' }],
});
```

Pin the top the same way, as `{ value: 100, color: 'transparent' }` for a score out of 100 that should never look full at 80.

### Percentage charts

On a chart with `isPercentage`, `value` is a percentage from 0 to 100, and the range stays 0–100%:

```js
new LovelyChart(element, {
  type: 'area',
  isPercentage: true,
  labels,
  datasets,
  // Half of the total, whatever the values
  referenceLines: [{ value: 50, label: 'Half' }],
});
```

> [!NOTE]
> A `label` reads in the direction of the page, so on a right-to-left page a sign before a number moves after it. Wrap the number in U+2066 and U+2069, as `'\u2066-1.2K\u2069'`, to keep its sign first.

See [`referenceLines`](api.md#referenceLines) for every rule.

## Hatched ranges

A hatched range marks a run of labels whose values aren't plain actuals: a forecast, an estimate, a partial count. `from` and `to` are inclusive label indexes, and the hatch shows on the plot and on the minimap.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const actualDays = 28;
const forecastDays = 7;
const values = series(actualDays + forecastDays, { start: 1200, trend: 0.004, seasonality: 0.12, seed: 3 });

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'line',
  labels: days(actualDays + forecastDays),
  datasets: [{ name: 'Orders', color: '#3497ED', values }],
  hatchedRanges: [{
    from: actualDays,
    to: actualDays + forecastDays - 1,
    label: 'Forecast',
    hasEdge: true,
    color: { light: '#108BE3', dark: '#48AAF0' },
    note: 'Forecast from the trend of the last 4 weeks',
  }],
  isUtc: true,
});
```

Where the hatch starts and ends depends on the chart type:

- A `bar` or `step` chart hatches the columns of the range.
- A `line` or `area` chart starts the hatch at the point *before* the range, since the segment leading into an estimated value is estimated too, and ends it halfway to the label after the range.

### Labels and edges

- `label` is drawn at the bottom left of the hatch, in the axis font size. It keeps clear of the Y-axis labels and of the next range's label, and is dropped where it has no room.
- `hasEdge` draws a dashed rule where the hatch starts, as the line between actuals and a forecast. A range that starts at the first label gets no edge.
- `color` sets the hatch, the edge and the label together, and defaults to the colour of the Y-axis labels.

Ranges of one colour that touch hatch as one band, while each keeps its own label and edge.

### Periods still filling up

For the current day or month, whose value is still growing, set `isAccruing`. A `line` or `area` chart then starts the hatch halfway from the point before, rather than at it:

```js live
import LovelyChart from 'lovely-chart';
import { months, series } from './demo-data.js';

const values = series(12, { start: 52000, trend: 0.02, volatility: 0.05, seed: 8 });
// The month in progress holds the revenue so far
values[11] = Math.round(values[11] * 0.55);

new LovelyChart(document.getElementById('chart'), {
  title: 'Monthly revenue',
  type: 'area',
  labels: months(12),
  datasets: [{ name: 'Revenue', color: '#5FB641', values }],
  areaOpacity: 0.3,
  valuePrefix: '$',
  hatchedRanges: [{
    from: 11,
    to: 11,
    isAccruing: true,
    titleNote: 'month to date',
    note: 'The month is still in progress',
  }],
});
```

### Notes in the tooltip

A range can explain itself in the tooltip at each of its labels:

- `note` adds a line under the tooltip rows. A `\n` splits it into several lines.
- `titleNote` stands beside the tooltip title, as "month to date" above.

The notes of the ranges come first, then the hints of [event lines](#event-lines), then the notes of [`resolveTooltipNotes`](api.md#resolveTooltipNotes); a line shown already is left out. Only one `titleNote` shows: the one of `resolveTooltipNotes` wins over a range's, and among ranges the first wins. See [Notes](tooltip.md#notes) in the tooltip guide for more.

> [!NOTE]
> The minimap draws the hatch alone, without labels or edges, and a sparkline draws the hatch and the edges. Data that [`onZoom`](api.md#onZoom) returns sets ranges of its own.

See [`hatchedRanges`](api.md#hatchedRanges) for every rule.

## Event lines

An event line is a vertical rule at a moment of your labels: a launch, an outage, a change in how the data is collected. It runs from the bottom of the Y range up through the room above it, and can carry a label, a pin head and a note in the tooltip.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const launchIndex = 9;
const outageIndex = 21;
const signups = series(30, { start: 420, volatility: 0.12, seed: 7 }).map((value, i) => (
  Math.round(value * (i >= launchIndex ? 1.4 : 1) * (i === outageIndex ? 0.6 : 1))
));

new LovelyChart(document.getElementById('chart'), {
  title: 'Sign-ups',
  type: 'bar',
  labels: days(30),
  datasets: [{ name: 'Sign-ups', color: '#5FB641', values: signups }],
  eventLines: [
    // At the start of the day's column: the launch went out at midnight
    { labelIndex: launchIndex, offset: 0, label: 'Launch' },
    {
      labelIndex: outageIndex,
      label: 'Outage',
      color: { light: '#E65850', dark: '#F07068' },
      isDashed: true,
      withHead: true,
      hint: 'Sign-ups were down for 40 minutes',
    },
  ],
  isUtc: true,
});
```

### Placing the rule with `offset`

`labelIndex` picks the label, and `offset`, from 0 to 1, places the rule that far through the label's interval, so an event at noon can stand halfway between two daily points:

| Chart | `offset: 0` | Default | `offset: 1` |
|---|---|---|---|
| `line`, `area` | At the label's point | `0`, the point | At the next point |
| `bar`, `step`, or with bars or steps among its datasets | Start of the column | `0.5`, the centre | End of the column |

The last point of a `line` or `area` chart has no next point, so its rule stays at the point whatever the offset.

### Rules and pins

- A rule is a solid 1px line. `isDashed` draws it in 6px dashes 4px apart and `isDotted` in 2px dots 3px apart, as the dashes and dots of [`datasets[*].isDashed`](api.md#datasets-isDashed) and [`datasets[*].isDotted`](api.md#datasets-isDotted) are.
- `withHead` turns the rule into a pin: a disc of its colour, 8px across and ringed in the background colour, at the top of the canvas, over the data and the axis labels.
- `color` sets the rule, the head and the label, and defaults to the colour of the Y-axis labels.

### Labels and hints

- `label` reads bottom to top from the top of the rule, or from under its head, in the axis font size. It stands before the rule, or after it where it would cover the Y-axis labels or leave the plot. It's dropped where it fits on neither side, runs longer than its rule, or where the label of a later rule crowds it, so keep labels short.
- `hint` is a note under the tooltip rows at the rule's label, after the notes of hatched ranges and before those of `resolveTooltipNotes`.

> [!NOTE]
> A sparkline draws the rules and their heads without labels, and the minimap draws no event lines. Data that [`onZoom`](api.md#onZoom) returns sets rules and hints of its own.

See [`eventLines`](api.md#eventLines) for every rule.

## Comparison with a previous period

`comparison` draws a previous period as a dashed line beside your data, and the tooltip lists it first, with the change of the current total in percent.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

// Eight weeks of orders: the last four on screen, the four before as the previous period
const orders = series(56, { start: 1000, trend: 0.005, seasonality: 0.12, seed: 5 });

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'line',
  labels: days(28),
  datasets: [{ name: 'Orders', color: '#3497ED', values: orders.slice(28) }],
  comparison: { name: 'Previous 4 weeks', values: [orders.slice(0, 28)] },
  isUtc: true,
});
```

`comparison` takes three fields:

- `name`, shown in the legend beside a dashed swatch and in the tooltip.
- `values`, the previous values **per dataset**, in the order of `datasets`, each aligned with `labels`. A `null` leaves a gap.
- `color`, which defaults to [`DEFAULT_COMPARISON_COLOR`](api.md#DEFAULT_COMPARISON_COLOR), `#6B7280`.

The line draws the sum of the previous values of the datasets on screen, so on a stacked chart it follows the total as the reader hides and shows datasets in the legend:

```js
new LovelyChart(element, {
  type: 'area',
  isStacked: true,
  labels: labels.slice(-56),
  datasets: datasets.map((dataset) => ({ ...dataset, values: dataset.values.slice(-56) })),
  comparison: {
    name: 'Week before',
    // Each dataset's values shifted back by a week
    values: datasets.map(({ values }) => values.slice(-63, -7)),
  },
});
```

In the tooltip, the comparison row is muted, and its change is bold and tinted by `--tooltip-change-positive` or `--tooltip-change-negative`; see [Styling](tooltip.md#styling) in the tooltip guide. To show the change elsewhere on your page, read `comparison` from [`onTooltipChange`](interaction.md).

> [!NOTE]
> `comparison` is ignored on percentage, pie and donut charts. A dataset drawn as another type than the chart's, through [`datasets[*].type`](api.md#datasets-type), stays out of it. On a `line` chart with `areLinesSmooth`, the comparison line curves like the datasets.

## How the layers stack

When you combine annotations, the chart paints them in a fixed order. From the bottom up:

1. Bars and area fills.
2. Hatches of `hatchedRanges`: over fills, where they still show, and under lines, so the lines stay clear.
3. Lines and steps.
4. The `comparison` line.
5. The mask over unfocused bars while one is hovered.
6. Labels of `hatchedRanges`.
7. `eventLines` and their labels.
8. `referenceLines` and their labels.
9. Axis labels.
10. Pin heads of `eventLines` with `withHead`.

The hover line, its dots and the tooltip balloon sit above all of these. Here everything together:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

// Ten weeks of orders: five on screen, the last of them a forecast, and the five before as the previous period
const orders = series(70, { start: 1000, trend: 0.005, seasonality: 0.12, seed: 5 });

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'line',
  labels: days(35),
  datasets: [{ name: 'Orders', color: '#3497ED', values: orders.slice(35) }],
  comparison: { name: 'Previous 5 weeks', values: [orders.slice(0, 35)] },
  referenceLines: [{ value: 1600, label: 'Target', color: { light: '#5FB641', dark: '#7BC862' } }],
  hatchedRanges: [{ from: 28, to: 34, label: 'Forecast', hasEdge: true, note: 'Forecast' }],
  eventLines: [{
    labelIndex: 14,
    label: 'Campaign',
    isDotted: true,
    withHead: true,
    hint: 'Autumn campaign starts',
  }],
  isUtc: true,
});
```

Every `color` here takes any of the forms described in [Theming and colours](theming.md). Reference lines, hatched ranges and event lines that leave `color` out take the colour of the Y-axis labels, so they follow [`axisTextColor`](api.md#axisTextColor) when you set it.
