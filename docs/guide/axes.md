# Axes and values

Every chart but a pie, a donut and a sparkline draws a Y axis of values and an X axis of labels. This page shows how the chart picks the Y range and its steps, how values read on the axis and in the tooltip, how to add a second unit or a second axis, and how to place and style the labels.

## The Y axis range

You don't set the Y range yourself: the chart fits it to the data on screen, and fits it again, with an animation, whenever that changes.

- It covers the datasets shown, over the labels the plot shows. Pan the [minimap](minimap.md) or hide a dataset in the [legend](legend.md), and the range follows.
- A chart that doesn't stack starts at 0, unless the values go below 0 or their lowest is more than three quarters of their highest. A line between 20 and 90 starts at 0, while one between 80 and 90 starts near 80, so a small change stays visible.
- A stacked chart always spans 0, and so does an axis that bars share with lines or steps, so that heights compare.
- A percentage chart always spans 0–100%.
- The bottom of the range rounds down to an axis step, so the lowest grid line is labelled.

The axis steps in round numbers, 1, 2 or 5 times a power of ten (2.5 in place of 2 from 250 up), as many as the plot height has room for. A short plot takes a finer step, so at least two labels stay legible. The labels shorten thousands, millions, billions and trillions to `K`, `M`, `B` and `T`, with as many digits after the point as the step needs: `6.25K` in steps of 250, `6K` in steps of 1,000.

### Whole-number steps

For counts, a step of 0.5 makes no sense: a range of 0 to 2 would read 0, 0.5, 1, 1.5 and 2. Set `noFloatSteps: true` to step the main and the second Y axis in whole numbers, 1 at the finest:

```js live
import LovelyChart from 'lovely-chart';
import { days } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Production deploys',
  type: 'bar',
  labels: days(14),
  datasets: [
    { name: 'Deploys', color: '#5FB641', values: [1, 0, 2, 1, 1, 0, 0, 2, 1, 2, 1, 0, 0, 1] },
  ],
  noFloatSteps: true,
  isUtc: true,
});
```

### Pinning the range

A [reference line](annotations.md#reference-lines) always stays inside the Y range, and one with `color: 'transparent'` draws nothing, so it's the way to pin an end of the axis. Pin both ends to keep one scale while the reader pans, as for a load that can't pass 100%:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'CPU load',
  type: 'line',
  labels: days(90),
  datasets: [
    { name: 'web-1', values: series(90, { start: 42, volatility: 0.07, seasonality: 0.1, seed: 3 }) },
    { name: 'web-2', values: series(90, { start: 55, volatility: 0.07, seasonality: 0.1, seed: 8 }) },
  ],
  valueSuffix: '%',
  // The axis reads 0–100% wherever the window is
  referenceLines: [
    { value: 0, color: 'transparent' },
    { value: 100, color: 'transparent' },
  ],
  withMinimap: true,
  isUtc: true,
});
```

Pin one end alone to start at 0 a range that would otherwise start near its lowest value. A visible reference line, such as a target, stays in view the same way: see [Annotations](annotations.md#pinning-the-y-range).

> [!NOTE]
> On a percentage chart the range stays 0–100% whatever the reference lines, and their `value` is a percentage.

## Formatting values

The chart formats a number in two ways:

| Where | By default | Options |
|---|---|---|
| Y-axis labels | Short: `12.5K`, `3M` | `valuePrefix`, `valueSuffix`, `isCurrencyPrefix` |
| Tooltip values and totals | In full, thousands set apart by a space, with no trailing zeros: `12 500`, `3.25` | `formatTooltipValue`, `valuePrefix`, `valueSuffix`, `isCurrencyPrefix` |

[`onTooltipChange`](api.md#onTooltipChange) hands you the raw numbers, to format as you like on the page: see [Tooltip](tooltip.md#your-own-readout).

### Prefixes and suffixes

[`valuePrefix`](api.md#valuePrefix) and [`valueSuffix`](api.md#valueSuffix) wrap every formatted value: the main Y-axis labels, the tooltip values and its totals. Include any space you want, as `valueSuffix: ' ms'`.

They leave out two kinds of labels: those of a [second Y axis](#a-second-y-axis), which show bare numbers, and those of a [second unit](#a-second-unit-on-the-same-axis), which take a prefix and a suffix of their own.

### Negative amounts of money

A prefix goes before the sign by default, as `$-9.1`. For a currency, set [`isCurrencyPrefix`](api.md#isCurrencyPrefix) to put the minus sign first, as `-$9.1`:

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-negative.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Daily P&L',
  // The values are in thousands of dollars
  valuePrefix: '$',
  valueSuffix: 'K',
  isCurrencyPrefix: true,
  isUtc: true,
});
```

The flag moves the sign in front of the `prefix` of [`secondaryYAxis`](#a-second-unit-on-the-same-axis) too.

### Formatting tooltip numbers

[`formatTooltipValue`](api.md#formatTooltipValue) takes a number of the tooltip and returns its text. `valuePrefix` and `valueSuffix` still wrap the result, and the axis labels keep their short form:

```js
new LovelyChart(element, {
  type: 'line',
  labels,
  datasets: [{ name: 'Average', values: temperatures }],
  valueSuffix: ' °C',
  // 16 reads 16.0, like its neighbours
  formatTooltipValue: (value) => value.toFixed(1),
});
```

`(value) => value.toLocaleString('en-US')` groups thousands with commas, as `12,500`. The function formats the total on the [`secondaryYAxis`](#a-second-unit-on-the-same-axis) scale too.

## A second unit on the same axis

When the values convert into another unit by a factor, such as energy into its cost, [`secondaryYAxis`](api.md#secondaryYAxis) labels the main Y axis in that unit too, at the right of the plot. It takes a `label`, a `multiplier`, and an optional `prefix` and `suffix`:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Energy use',
  type: 'bar',
  isStacked: true,
  labels: days(30),
  datasets: [
    { name: 'Heating', values: series(30, { start: 21, volatility: 0.1, decimals: 1, seed: 2 }) },
    { name: 'Hot water', values: series(30, { start: 8, volatility: 0.1, decimals: 1, seed: 6 }) },
    { name: 'Appliances', values: series(30, { start: 6, volatility: 0.1, decimals: 1, seed: 9 }) },
  ],
  valueSuffix: ' kWh',
  // €0.30 per kWh
  secondaryYAxis: { label: 'Cost', multiplier: 0.3, prefix: '€' },
  isUtc: true,
});
```

The tooltip adds a row of `label` with the total times `multiplier`: under the Total row of a stacked or percentage bar, step or area chart, as here, and under the dataset rows of any other chart. A percentage chart's axis has no scale at the right.

## A second Y axis

When the last dataset has a unit or a magnitude of its own, such as a rate beside counts, set [`hasSecondYAxis`](api.md#hasSecondYAxis) to put it on an axis of its own:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Visitors and conversion',
  type: 'bar',
  labels: days(30),
  datasets: [
    { name: 'Visitors', color: '#3497ED', values: series(30, { start: 12400, seasonality: 0.15, seed: 1 }) },
    {
      name: 'Conversion, %',
      type: 'line',
      color: '#F79E39',
      values: series(30, { start: 2.8, volatility: 0.05, decimals: 1, seed: 12 }),
    },
  ],
  hasSecondYAxis: true,
  isUtc: true,
});
```

- The last dataset is labelled at the right of the plot, in its colour.
- The main axis is labelled in the colour of the first dataset, apart from a stacked or percentage chart's, which keeps the axis text colour.
- The last dataset stays out of the main Y axis, the tooltip's total and, on a stacked chart, the stack.

> [!TIP]
> The labels of the second axis show bare numbers, while every tooltip row takes `valuePrefix` and `valueSuffix`. Name the unit in the dataset's name, as `Conversion, %` above, rather than in a suffix the other datasets would take too.

## Label placement and look

| Option | Does |
|---|---|
| [`isYAxisOutward`](api.md#isYAxisOutward) | Moves the main Y-axis labels into a column left of the plot, right-aligned, so the data never runs under them |
| [`areLabelsContrast`](api.md#areLabelsContrast) | Draws each Y-axis label in a halo of the background colour, 2px in from its side of the chart |
| [`axisFontSize`](api.md#axisFontSize) | Font size of the labels of both axes in px, `10` by default |
| [`axisTextColor`](api.md#axisTextColor) | Colour of the labels of both axes: a CSS colour, or `{ light, dark }` for each skin |

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Page views',
  type: 'line',
  labels: days(60),
  datasets: [
    {
      name: 'Views',
      color: '#2373DB',
      values: series(60, { start: 148000, trend: 0.003, seasonality: 0.12, seed: 5 }),
    },
  ],
  isYAxisOutward: true,
  areLabelsContrast: true,
  axisFontSize: 12,
  axisTextColor: { light: '#2373DB', dark: '#7FB8F0' },
  isUtc: true,
});
```

The column of `isYAxisOutward` fits the widest label the chart can show for its data, at any window and with any datasets hidden, so the plot holds still while the reader pans. The chart measures it when it builds, on `update()` and on a zoom, and again once a web font of the page changes the axis font. A second Y axis keeps its labels inside the plot.

Each Y-axis label stands on the row above its grid line. With `areLabelsContrast`, the labels of both axes stand 2px in from their side of the chart, which keeps the halo of a label inside the plot whole at the plot edge, and the column of `isYAxisOutward` grows by those 2px. The labels of [hatched ranges](annotations.md#labels-and-edges) and [event lines](annotations.md#labels-and-hints) keep clear of the Y-axis labels, that inset included.

The labels take the font family and the regular weight of the chart's text, from the [`--lovely-chart-font-family`](css.md#--lovely-chart-font-family) and [`--lovely-chart-font-weight`](css.md#--lovely-chart-font-weight) CSS variables: see [Theming](theming.md).

> [!NOTE]
> [`backgroundColor`](api.md#backgroundColor) gives the Y-axis labels a halo of that colour too, so they stay legible over the data. Without it, only `areLabelsContrast` labels get one.

## The X axis

The X axis shows your [`labels`](api.md#labels): dates for timestamps, or the text itself for strings. It always shows the newest label, spaces the others evenly back from it, and takes a coarser step when they would crowd, keeping the labels at the edges inside the plot. `axisFontSize` and `axisTextColor` apply to it as to the Y axis, and it runs left to right on a right-to-left page too.

How a timestamp reads, in which time zone and in which language, is the subject of [Dates, time zones and locales](dates.md).
