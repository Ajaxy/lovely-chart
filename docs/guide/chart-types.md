# Chart types

LovelyChart draws six types of chart: line, area, bar, step, pie and donut. You pick one with [`type`](api.md#type), then shape it with stacking, percentages, datasets of other types, a second Y axis or a sparkline.

> [!NOTE]
> The daily data in these examples sits at UTC midnight, so the examples set [`isUtc: true`](api.md#isUtc) to show the same days to readers in every time zone. See [Time zones](dates.md#time-zones).

## Which type when

| Type | Use it to show | Params |
| --- | --- | --- |
| Line | Trends over time, and how a few series compare | `type: 'line'` |
| Stacked area | A total and the parts it's made of, over time | `type: 'area'`, `isStacked: true` |
| Percentage area | How the shares of a whole change over time | `type: 'area'`, `isPercentage: true` |
| Bar | An amount per period, such as orders per day | `type: 'bar'` |
| Stacked bar | An amount per period and its parts, negative ones included | `type: 'bar'`, `isStacked: true` |
| Step | Values that hold until they change: prices, plans, limits | `type: 'step'` |
| Pie | The parts of a whole, a handful of them, at a glance | `type: 'pie'` |
| Donut | The same as a pie, as a ring | `type: 'donut'` |
| Bars and a line | Amounts with an average or a target over them | `datasets[*].type` |
| Two Y axes | Two measures of different scales, such as a count and a rate | `hasSecondYAxis: true` |
| Sparkline | A small trend in a table row or a card | `isSparkline: true` |

## Line

A line chart joins the values of each dataset with a line. It's the default choice for trends over time.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Response time',
  type: 'line',
  labels: days(60),
  datasets: [
    { name: 'Median', values: series(60, { start: 120, volatility: 0.05, seed: 3 }) },
    { name: '95th percentile', values: series(60, { start: 340, volatility: 0.08, seed: 4 }) },
  ],
  valueSuffix: ' ms',
  areLinesSmooth: true,
  isUtc: true,
});
```

- [`areLinesSmooth`](api.md#areLinesSmooth) draws each line as a curve through its values that never overshoots a value. Lines are straight segments by default.
- The Y range starts at 0, unless the values go below 0 or their lowest is more than three quarters of their highest; then it fits the values. See [The Y axis range](axes.md#the-y-axis-range).
- Lines can be dashed or dotted, and break at `null` values: see [Data format](data.md#datasets).

## Area

An area chart fills the space under each line. Areas are at their best stacked, as parts of a total.

### Stacked areas

[`isStacked`](api.md#isStacked) piles each dataset on top of the ones before it, so the top edge traces the total:

```js live
import LovelyChart from 'lovely-chart';

// A year of daily sales of six fruits
const data = await fetch('../data/areas-absolute.json').then((r) => r.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit sales',
  type: 'area',
  isStacked: true,
  withMinimap: true,
  isUtc: true,
});
```

The tooltip of a stacked chart adds a Total row under the datasets. Hide a fruit in the legend, and the stack closes up around the gap.

### Percentage areas

[`isPercentage`](api.md#isPercentage) shows each label's values as shares of their total, stacked to 100%. It stacks the datasets by itself, with no need for `isStacked`.

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/areas.json').then((r) => r.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Share of fruit sales',
  type: 'area',
  isPercentage: true,
  withMinimap: true,
  isUtc: true,
});
```

- The Y axis runs from 0 to 100%, and the tooltip prints each dataset's share beside its value. [`percentPrecision`](api.md#percentPrecision) sets the digits of the share after the point, `0` by default.
- A percentage chart zooms by itself: click a day to open its shares as a pie, then **Zoom out** to go back. [`zoomType: 'donut'`](api.md#zoomType) makes it a donut, and [`noZoom: true`](api.md#noZoom) turns the zoom off. A stacked chart of absolute values can do the same with [`zoomToShares`](api.md#zoomToShares). See [Zoom](zoom.md).

### Fill opacity and outline

Without `isStacked`, each area fills from its line down to zero, over the areas before it. [`areaOpacity`](api.md#areaOpacity), from 0 to 1, makes the fills translucent while the outline and the dots keep their full opacity. [`areaBorderColor`](api.md#areaBorderColor) draws a 1px outline around each area, in one colour for every area or one per skin.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Active users',
  type: 'area',
  labels: days(90),
  datasets: [{
    name: 'Active users',
    color: '#3497ED',
    values: series(90, { start: 12000, trend: 0.004, seasonality: 0.1, seed: 31 }),
  }],
  areaOpacity: 0.25,
  areaBorderColor: '#3497ED',
  isUtc: true,
});
```

On a stack, `areaBorderColor` draws a boundary that two areas share only once.

## Bar

A bar chart gives every label a column and fills it from zero to the value. It suits amounts that belong to a period, such as orders per day or revenue per month.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders by platform',
  type: 'bar',
  isStacked: true,
  labels: days(30),
  datasets: [
    { name: 'iOS', values: series(30, { start: 420, seasonality: 0.2, seed: 21 }) },
    { name: 'Android', values: series(30, { start: 380, seasonality: 0.2, seed: 22 }) },
    { name: 'Web', values: series(30, { start: 160, seasonality: 0.2, seed: 23 }) },
  ],
  isUtc: true,
});
```

- Hovering a column dims the columns around it, and the tooltip lists its values with a Total row.
- Give a bar chart of several datasets `isStacked: true`. Without it, every dataset fills the same full-width column from zero, so the bars of one label draw over each other.
- A stack takes negative values too: they stack down from zero, under the positive ones, as for revenue, refunds and adjustments.
- `isPercentage: true` makes every column a 100% stack of shares.

## Step

A step chart holds each value flat across its label's column and jumps at the boundary to the next one. Reach for it for values that stay put until they change: prices, plans, rate limits or quotas.

```js live
import LovelyChart from 'lovely-chart';
import { days } from './demo-data.js';

const labels = days(30);
// The price set on the latest day of a change, for each day
const prices = (changes) => labels.map((_, day) => changes.findLast(([from]) => from <= day)[1]);

new LovelyChart(document.getElementById('chart'), {
  title: 'Plan prices',
  type: 'step',
  labels,
  datasets: [
    { name: 'Basic', values: prices([[0, 9], [12, 12]]) },
    { name: 'Pro', values: prices([[0, 29], [8, 24], [20, 32]]) },
  ],
  valuePrefix: '$',
  isUtc: true,
});
```

Like a line, a step dataset can be dashed or dotted, and breaks at `null` values. Steps also make a good limit or budget over a bar chart: see [Mixing types](#mixing-types).

## Pie

A pie shows the parts of a whole as sectors of a circle. It sums each dataset's values over the labels on screen, so with many labels and a minimap, the reader picks the period it sums:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const channels = ['Chat', 'Email', 'Phone', 'Forum'];

new LovelyChart(document.getElementById('chart'), {
  title: 'Support tickets',
  type: 'pie',
  labels: days(90),
  datasets: channels.map((name, i) => ({
    name,
    values: series(90, { start: 400 / (i + 1), seasonality: 0.2, seed: 40 + i }),
  })),
  withMinimap: true,
  isUtc: true,
});
```

- Drag the minimap window to sum another period; the sectors animate to their new sizes.
- Each sector large enough shows its share as a percentage. Point at a sector to pull it out, and the tooltip shows that sector alone.
- For one total per dataset, use a single text label: see [Pie and donut of totals](data.md#pie-and-donut-of-totals).
- Reference lines, hatched ranges, event lines and the `comparison` line don't apply to pies and donuts.

Keep a pie to a handful of datasets: small sectors are hard to compare, and a stacked bar or area shows many parts better.

## Donut

A donut is a pie with a hole in the middle. [`withGradient`](api.md#withGradient) shades each sector from 10% lighter at its inner edge to 10% darker at its outer edge:

```js live
import LovelyChart from 'lovely-chart';

// One day of sales of six fruits
const data = await fetch('../data/donut.json').then((r) => r.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit sales',
  type: 'donut',
  withGradient: true,
});
```

`withGradient` shades a pie the same way, from its centre, and the pie or donut that a [zoom into shares](zoom.md) opens too.

## Mixing types

A dataset's [`type`](api.md#datasets-type), `line`, `bar` or `step`, draws it as another type than the chart's: a line over bars, say, or steps over a stack of areas.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const orders = series(60, { start: 820, seasonality: 0.25, seed: 11 });
// The mean of each day and the six before it, none until a week has passed
const average = orders.map((_, i) => (
  i < 6 ? null : Math.round(orders.slice(i - 6, i + 1).reduce((sum, value) => sum + value, 0) / 7)
));

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders',
  type: 'bar',
  labels: days(60),
  datasets: [
    { name: 'Orders', color: '#9ED448', values: orders },
    { name: '7-day average', type: 'line', color: '#2373DB', values: average },
  ],
  isUtc: true,
});
```

- Lines and steps draw over bars and areas, whatever the order of `datasets`.
- A chart with bars or steps among its datasets gives every label a column, and its lines run through the middles of the columns.
- A dataset of another type than the chart's draws its own values. It stays out of a stacked chart's stack, the tooltip's total, the `comparison` and the shares of a zoom into a label, so a target or a budget never adds to the total.
- `type` is ignored on percentage, pie and donut charts, whose datasets are all shares of one whole.

## A second Y axis

[`hasSecondYAxis`](api.md#hasSecondYAxis) puts the last dataset on a Y axis of its own, labelled at the right of the plot in the dataset's colour. Use it for two measures of different scales, such as a count and a rate:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Sessions and bounce rate',
  type: 'line',
  labels: days(60),
  datasets: [
    { name: 'Sessions', values: series(60, { start: 5400, seasonality: 0.15, seed: 5 }) },
    { name: 'Bounce rate, %', values: series(60, { start: 42, volatility: 0.03, decimals: 1, seed: 6 }) },
  ],
  hasSecondYAxis: true,
  isUtc: true,
});
```

- The main Y axis takes the colour of the first dataset, so each axis reads as its dataset's. On a stacked or percentage chart, the main axis keeps the axis text colour.
- The last dataset stays out of the main Y axis and the tooltip's total, and on a stacked chart it draws beside the stack rather than in it.
- `valuePrefix` and `valueSuffix` go on the main axis labels and on every dataset's value in the tooltip, while the second axis shows bare numbers. So name the unit of the second axis in its dataset's `name`, as `Bounce rate, %` here.

To label the main axis in a second unit instead, such as a currency, see [`secondaryYAxis`](api.md#secondaryYAxis) in [A second unit on the same axis](axes.md#a-second-unit-on-the-same-axis). [Axes](axes.md#a-second-y-axis) has more on the second Y axis.

## Sparklines

[`isSparkline`](api.md#isSparkline) draws the datasets alone, inset by 2px: no axes, grid, header or legend. With a small [`plotHeight`](api.md#plotHeight), it fits a table row or a card.

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  type: 'area',
  labels: days(30),
  datasets: [{
    name: 'Revenue',
    color: '#5FB641',
    values: series(30, { start: 4200, trend: 0.01, seed: 7 }),
  }],
  isSparkline: true,
  plotHeight: 48,
  areaOpacity: 0.25,
  areaBorderColor: '#5FB641',
  isUtc: true,
});
```

- Any type can be a sparkline. A line or a translucent area, as here, reads best at this size.
- The bottom of the Y range isn't rounded to an axis step: it's 0, unless the values go below 0 or their lowest is more than three quarters of their highest.
- When the row around a sparkline already names it, set [`ariaLabel: ''`](api.md#ariaLabel) to leave the plot out of the accessibility tree. See [Accessibility](accessibility.md).
