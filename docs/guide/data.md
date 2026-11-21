# Data format

Every chart takes one plain object: a `type`, the `labels` along the X axis, and the `datasets` to draw, each with a value per label. This page covers those three, and how the chart treats the object you hand it.

## The shape of the data

```js
const params = {
  title: 'Orders', // optional headline
  type: 'line', // 'line', 'area', 'bar', 'step', 'pie' or 'donut'
  labels: [1793491200000, 1793577600000, 1793664000000], // 1–3 Nov 2026, one per point or column
  datasets: [
    { name: 'iOS', values: [412, 438, 451] }, // one value per label
    { name: 'Android', values: [389, 402, 417] },
  ],
  // ...any other options
};

new LovelyChart(element, params);
```

`labels` and each dataset's `values` line up by index: `values[i]` is the value at `labels[i]`. Every other option has a sensible default; see the [options reference](api.md#chart-options) for all of them.

## Labels

[`labels`](api.md#labels) are either UNIX timestamps in milliseconds or text strings.

The chart places each label an equal step along the X axis, whatever the time between two timestamps. So give every period its own label, and mark a period with no data with a `null` value rather than leaving its label out: see [Gaps](#gaps).

### Timestamps

Timestamps give you date labels on the X axis, dates in the tooltip title, and a caption of the dates on screen in the header.

```js
// Midnight UTC of 16 November 2026
const label = Date.UTC(2026, 10, 16);
// The same instant from an ISO date
const sameLabel = new Date('2026-11-16').getTime();
```

> [!TIP]
> A day label shows the date in the reader's time zone, so a reader west of UTC sees a timestamp at UTC midnight as the day before. For daily data at UTC midnight, set [`isUtc: true`](api.md#isUtc) to read every date in UTC. See [Time zones](dates.md#time-zones).

### Label type

The chart works out how to name the labels from the step between the first two timestamps. You can set it yourself with [`labelType`](api.md#labelType).

| Step between the first two labels | Inferred `labelType` | X-axis label |
| --- | --- | --- |
| 365 days or more | `year` | `2026` |
| 28 days or more | `month` | `January` |
| 7 days or more | `week` | `Week 47` |
| A day or more | `day` | `16 Nov` |
| An hour or more | `hour` | `14:00` |
| Less than an hour | `5min` | `14:05` |

Text labels always take `text`, and a single timestamp takes `day`. `dayHour`, which labels each point with its date and hour, is never inferred: set it when you need it.

Here, labels a month apart read as month names:

```js live
import LovelyChart from 'lovely-chart';
import { months, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Monthly revenue',
  type: 'bar',
  labels: months(12),
  datasets: [
    { name: 'Revenue', values: series(12, { start: 48000, trend: 0.02, seed: 5 }) },
  ],
  valuePrefix: '$',
});
```

To format the labels of timestamps differently, as dates for weekly data, see [Axis label formats](dates.md#axis-label-formats).

### Text labels

Strings make a category axis, with each string as its label and the tooltip title:

```js live
import LovelyChart from 'lovely-chart';

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders by weekday',
  type: 'bar',
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    { name: 'Orders', values: [412, 438, 451, 469, 520, 610, 574] },
  ],
});
```

A chart of text labels has no dates to show, so its header holds the `title` alone. Without a `title`, the header folds away and the plot starts at the top of the chart.

## Datasets

Each entry of [`datasets`](api.md#datasets) is one series:

| Field | What it does |
| --- | --- |
| [`name`](api.md#datasets-name) | Names the dataset in the legend and the tooltip. Required. |
| [`values`](api.md#datasets-values) | One number per label, or `null` for a gap. Required. |
| [`color`](api.md#datasets-color) | Any CSS colour, `{ light, dark }` for one per skin, or a `var()` of your page. Defaults to the [default colours](#default-colours). |
| [`isInitiallyHidden`](api.md#datasets-isInitiallyHidden) | Starts the dataset hidden, its legend button unchecked. |
| [`isDashed`](api.md#datasets-isDashed) | Draws a line or step dataset in dashes. |
| [`isDotted`](api.md#datasets-isDotted) | Draws a line or step dataset in dots. |
| [`type`](api.md#datasets-type) | Draws the dataset as a `line`, `bar` or `step` over a chart of another type. |

Colours have a page of their own: see [Theming](theming.md).

### Gaps

A `null` value leaves a gap, for a period with no data. A line breaks at the gap, and the tooltip leaves out a dataset with no value at the label.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const web = series(30, { start: 240, seasonality: 0.2, seed: 8 });
// Tracking was down for three days
web.fill(null, 12, 15);

new LovelyChart(document.getElementById('chart'), {
  title: 'Sign-ups',
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'Web', values: web },
    { name: 'App', values: series(30, { start: 180, seasonality: 0.2, seed: 9 }) },
  ],
  isUtc: true,
});
```

Other types treat gaps in kind: a bar chart draws no bar at a gap, and an area splits at a gap and fills each run on its own. A line run of one or two values between gaps draws as dots, and so does a lone value of an area.

> [!NOTE]
> The tooltip leaves out a dataset whose value at the label is `0` too. [`onTooltipChange`](api.md#onTooltipChange) still reports it, with `0`, and a gap as `null`.

### Hidden, dashed and dotted datasets

`isInitiallyHidden` starts a dataset hidden, for a series the reader can bring in from the legend. `isDashed` and `isDotted` tell lines of one colour apart, as an actual value from a target. Both apply to `line` and `step` datasets only; other types ignore them.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(60);

new LovelyChart(document.getElementById('chart'), {
  title: 'Revenue',
  type: 'line',
  labels,
  datasets: [
    { name: 'Actual', color: '#3497ED', values: series(60, { start: 8200, trend: 0.004, volatility: 0.04, seed: 18 }) },
    { name: 'Target', color: '#3497ED', isDashed: true, values: labels.map((_, i) => 8000 + i * 40) },
    {
      name: 'Last year',
      color: '#3497ED',
      isDotted: true,
      isInitiallyHidden: true,
      values: series(60, { start: 7100, trend: 0.003, volatility: 0.04, seed: 44 }),
    },
  ],
  valuePrefix: '$',
  isUtc: true,
});
```

The legend buttons and the tooltip swatches of dashed and dotted datasets take a dashed or dotted outline too. A single dataset normally has no legend, but one that starts hidden keeps it, as the legend is the only way to show it.

### Default colours

A dataset without a `color` takes one of eight default colours:

`#3497ED`, `#2373DB`, `#9ED448`, `#5FB641`, `#F5BD25`, `#F79E39`, `#E65850` and `#5D5CDC`.

A chart of fewer than eight datasets takes a subset of them whose hues stand apart: `#3497ED` and `#9ED448` for two, then `#F79E39` for a third, and so on. A chart of more than eight starts over from the first. The colours go in order to the datasets without a `color`, so when none has one, the dataset at index `i` takes the colour at index `i`.

To show the same colours elsewhere on your page, as in a table beside the chart, ask [`getDefaultColors()`](api.md#getDefaultColors) for them:

```js
import { getDefaultColors } from 'lovely-chart';

const regions = ['Europe', 'Americas', 'Asia'];
const colors = getDefaultColors(regions.length);
const regionColors = Object.fromEntries(regions.map((name, i) => [name, colors[i]]));
// { Europe: '#3497ED', Americas: '#9ED448', Asia: '#F79E39' }
```

[`DEFAULT_COLORS`](api.md#DEFAULT_COLORS) holds all eight, in order, as a frozen array.

### Datasets of another type

A dataset's `type` draws it as a `line`, `bar` or `step` over a chart of another type, such as an average line over daily bars. Such a dataset draws its own values, outside the stack and the tooltip's total. See [Mixing types](chart-types.md#mixing-types).

## Pie and donut of totals

A pie or donut of a total per dataset takes a single text label, as `labels: ['Total']`, and each dataset's `values` holds its total:

```js live
import LovelyChart from 'lovely-chart';

new LovelyChart(document.getElementById('chart'), {
  title: 'Traffic sources',
  type: 'pie',
  labels: ['Total'],
  datasets: [
    { name: 'Search', values: [48210] },
    { name: 'Direct', values: [21840] },
    { name: 'Social', values: [12370] },
    { name: 'Email', values: [6950] },
    { name: 'Referral', values: [4120] },
  ],
});
```

As with any text label, the header shows no dates. A pie or donut can also take many labels, and then sums the values of the period on screen: see [Chart types](chart-types.md#pie).

## Passing new data

The chart keeps a reference to the params object you pass to the constructor or to [`update()`](api.md#update). It builds from that object again whenever it rebuilds itself, as on a window resize or an orientation change. So a change you make to the object later doesn't show when you make it, but at the next rebuild.

Treat the object as the chart's from then on, and build a new one for new data:

```js
const chart = new LovelyChart(element, params);

// Don't: the chart holds this object, so the new title shows only at its next rebuild
params.title = 'Orders, net';

// Do: pass a new object
chart.update({ ...params, title: 'Orders, net' });

// The same for new values: new arrays in a new object
chart.update({
  ...params,
  labels: [...params.labels, nextDay],
  datasets: params.datasets.map((dataset, i) => ({
    ...dataset,
    values: [...dataset.values, nextValues[i]],
  })),
});
```

`update()` resets the zoom, the window, the datasets hidden in the legend and the selection, unless its options keep them. See [Updating](updating.md).
