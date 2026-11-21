# Layout, sizing and fonts

A chart takes the width your layout gives its element and a height you choose for its plot. Around the plot, a header, a minimap and a legend take their spacing and type from CSS custom properties, so you can fit a chart into a card, a dashboard tile or a table cell without touching its internals.

## Width

A chart fills the full width of the element you pass to the constructor. Size that element with your layout, a grid, a flex row or a `max-width`, and the chart follows:

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: 24px;
}
```

In a grid or a flex row, let the element shrink below the width of its content with `min-width: 0`, or `minmax(0, 1fr)` for its column, so a chart doesn't hold its column open at the width it was built at.

The chart measures its element as it builds. When the width of the window changes, or the device turns, it builds again at its element's new width, shortly after the resize ends. A rebuild keeps the datasets the reader hid and the place of the legend, clears the selection, and returns a zoomed chart to its overview.

> [!TIP]
> A change of the element's width alone, as when a sidebar opens, stretches the chart until the next rebuild. To rebuild at once, watch the element and call [`update()`](api.md#update) with the same params, keeping the reader's view:
>
> ```js
> let lastWidth = element.clientWidth;
> new ResizeObserver(() => {
>   if (element.clientWidth === lastWidth) return;
>   lastWidth = element.clientWidth;
>   chart.update(params, { shouldKeepFilter: true, shouldKeepZoom: true, shouldKeepSelection: true });
> }).observe(element);
> ```

## Height

The height you set is the height of the plot, the canvas that holds the axes and the data. The header, the minimap and the legend add their own height around it.

- [`plotHeight`](api.md#plotHeight) sets it in px. The default is `320`.
- The [`--lovely-chart-plot-height`](css.md#--lovely-chart-plot-height) custom property, on the chart's element or an ancestor, takes precedence over `plotHeight`. It takes a unitless number of px, a `px` length or a `rem` length.

The custom property lets a media query give a chart another height on a small screen:

```css
.sales-chart {
  --lovely-chart-plot-height: 320;
}

@media (max-width: 40rem) {
  .sales-chart {
    --lovely-chart-plot-height: 200;
  }
}
```

The chart reads the property as it builds, so a new value takes effect on the next rebuild, which a resize of the window brings anyway.

## The header

Above the plot, the header holds the [`title`](api.md#title) at its start and a caption at its end: the range of dates on screen, which follows the window as the reader pans. Charts of text labels show no caption.

| You want | Set |
|---|---|
| A title without the dates | [`noCaption: true`](api.md#noCaption) |
| No header band at all, the plot at the top | [`noHeader: true`](api.md#noHeader) |
| Another text in the zoom-out control | [`zoomOutLabel`](api.md#zoomOutLabel), `'Zoom out'` by default |

A header with nothing to show, with no `title` and no caption because of `noCaption` or text labels, folds away, so the plot starts at the top of the chart. With `noHeader`, the band goes whatever it holds, and the axes and the legend stay.

While a chart with no header band is zoomed, its zoom-out control floats over the top inline-start corner of the plot, on a backdrop of the skin's `--background-color`. Set [`noZoomOutControl`](api.md#noZoomOutControl) to leave it out, and offer [a control of your own](interaction.md#a-zoom-out-control-of-your-own).

These custom properties size the band, read from the chart's element or an ancestor:

| Property | Sets | Default |
|---|---|---|
| [`--lovely-chart-header-height`](css.md#--lovely-chart-header-height) | Height of the header band, and line height of its title and caption | `30px` |
| [`--lovely-chart-header-margin-top`](css.md#--lovely-chart-header-margin-top) | Space above the header band | `0` |
| [`--lovely-chart-plot-margin-top`](css.md#--lovely-chart-plot-margin-top) | Space between the header band and the plot | `10px`; none on a sparkline |
| [`--lovely-chart-empty-header-height`](css.md#--lovely-chart-empty-header-height) | Height of a header with nothing to show | `0` |

`--lovely-chart-empty-header-height` keeps a band where there's nothing to show. In a row of charts where only some have a title, it levels the plots:

```css
.chart-row {
  /* As tall as a header that shows something */
  --lovely-chart-empty-header-height: 30px;
}
```

## Spacing

The header, the minimap and the legend share a side inset, and the legend buttons have their own padding, radius and font size. All of them are custom properties, which apply from the chart's element, any ancestor of it or `.lovely-chart--container`, so one rule can space every chart on a page:

| Property | Sets | Default |
|---|---|---|
| [`--lovely-chart-inset`](css.md#--lovely-chart-inset) | Side inset of the header, the minimap and the legend | `10px` |
| [`--lovely-chart-minimap-margin-bottom`](css.md#--lovely-chart-minimap-margin-bottom) | Space under the minimap | `16px` |
| [`--lovely-chart-legend-gap`](css.md#--lovely-chart-legend-gap) | Space between legend entries, as the CSS `gap` | `8px 6px` |
| [`--lovely-chart-legend-padding-bottom`](css.md#--lovely-chart-legend-padding-bottom) | Space under the last row of the legend | `24px` |
| [`--lovely-chart-button-padding`](css.md#--lovely-chart-button-padding) | Padding on every side of a legend button | `7px` |
| [`--lovely-chart-button-radius`](css.md#--lovely-chart-button-radius) | Corner radius of a legend button | `18px` |
| [`--lovely-chart-button-font-size`](css.md#--lovely-chart-button-font-size) | Font size of the legend buttons | The chart's `13px` |

In a card whose own padding insets its content, set the inset to `0`, and end the chart at its legend:

```html live
<div class="card">
  <div id="sessions"></div>
</div>
<style>
  .card {
    padding: 16px;
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 16px;
    --lovely-chart-inset: 0;
    --lovely-chart-legend-padding-bottom: 0;
    --lovely-chart-button-padding: 4px;
    --lovely-chart-button-radius: 8px;
    --lovely-chart-button-font-size: 12px;
  }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  new LovelyChart(document.getElementById('sessions'), {
    title: 'Sessions',
    type: 'line',
    labels: days(90),
    datasets: [
      { name: 'Organic', values: series(90, { start: 2400, volatility: 0.05, seasonality: 0.15, seed: 111 }) },
      { name: 'Paid', values: series(90, { start: 1300, volatility: 0.05, seasonality: 0.1, seed: 112 }) },
      { name: 'Referral', values: series(90, { start: 600, volatility: 0.05, seasonality: 0.1, seed: 113 }) },
    ],
    withMinimap: true,
    isUtc: true,
  });
</script>
```

> [!NOTE]
> The plot keeps a gutter of its own, 10px, whatever the inset. With another inset, the header, the minimap and the legend move off the line of the Y-axis labels and the grid, as the 0 inset above shows.

The chart sizes the minimap to the inset as it lays out: when it's built, on `update()`, and on a resize or an orientation change. A legend moved to a [`legendContainer`](api.md#legendContainer) takes these properties from that element and its ancestors instead.

## Typography

The chart's text, in the header, the legend, the tooltip and the labels the canvas draws, takes its family and weights from three custom properties, read from the chart's element or an ancestor:

| Property | Sets | Default |
|---|---|---|
| [`--lovely-chart-font-family`](css.md#--lovely-chart-font-family) | The family of all the chart's text | `'-apple-system', 'HelveticaNeue', Helvetica, Arial, sans-serif` |
| [`--lovely-chart-font-weight`](css.md#--lovely-chart-font-weight) | The regular weight: the legend, the names in the tooltip, the axis labels | `300` |
| [`--lovely-chart-font-weight-bold`](css.md#--lovely-chart-font-weight-bold) | The bold weight: the header, the tooltip title, the values and totals | `bold` |

The size of the axis labels is the [`axisFontSize`](api.md#axisFontSize) param, `10` px by default. The labels of hatched ranges and event lines take the same size.

```html live
<div class="serif-chart">
  <div id="temperatures"></div>
</div>
<style>
  .serif-chart {
    --lovely-chart-font-family: Georgia, 'Times New Roman', serif;
    --lovely-chart-font-weight: 400;
    --lovely-chart-font-weight-bold: 700;
  }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/lines-negative.json').then((response) => response.json());

  new LovelyChart(document.getElementById('temperatures'), {
    ...data,
    title: 'Weekly low, °C',
    valueSuffix: '°',
    axisFontSize: 12,
  });
</script>
```

> [!WARNING]
> `--lovely-chart-font-family: inherit` doesn't give the chart the font of your page: a custom property set to `inherit` takes the *custom property* of the parent, not its font. To use your page's font, set the property to its family list, or to a `var()` that holds it, as `--lovely-chart-font-family: var(--font-body)`.

A web font that finishes loading after the chart is built reaches the canvas too: the chart draws its labels again in it, and measures again a column of [`isYAxisOutward`](api.md#isYAxisOutward) labels.

## Sparklines and small multiples

### Sparklines

[`isSparkline`](api.md#isSparkline) draws the datasets alone, inset by 2px: no axes, grid, header or legend. With a small `plotHeight`, it fits a table cell beside the figure it shows:

```html live
<table class="metrics">
  <thead><tr><th>Metric</th><th>Last 30 days</th><th>Today</th></tr></thead>
  <tbody></tbody>
</table>
<style>
  .metrics { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .metrics th, .metrics td { padding: 6px 8px; text-align: start; border-bottom: 1px solid rgba(128, 128, 128, 0.25); }
  .metrics th:nth-child(2) { width: 50%; }
  .metrics :is(th, td):last-child { text-align: end; font-variant-numeric: tabular-nums; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const labels = days(30);
  const metrics = [
    { name: 'Sign-ups', color: '#3497ED', values: series(30, { start: 420, trend: 0.01, seed: 61 }) },
    { name: 'Cancellations', color: '#E65850', values: series(30, { start: 60, seed: 62 }) },
    { name: 'Revenue, $', color: '#5FB641', values: series(30, { start: 8200, trend: 0.005, seed: 67 }) },
  ];

  const body = document.querySelector('.metrics tbody');
  metrics.forEach(({ name, color, values }) => {
    const row = body.insertRow();
    row.insertCell().textContent = name;
    const cell = row.insertCell();
    row.insertCell().textContent = values[values.length - 1].toLocaleString('en-US');
    new LovelyChart(cell, {
      type: 'line',
      labels,
      datasets: [{ name, color, values }],
      isSparkline: true,
      plotHeight: 32,
      noTooltip: true,
      // The row names the sparkline already
      ariaLabel: '',
    });
  });
</script>
```

The bottom of a sparkline's Y range isn't rounded to an axis step. It sits at 0, unless the values go below 0 or their lowest is more than three quarters of their highest, so a sparkline of a figure that moves within a narrow band shows its movement rather than a flat line near the top.

A sparkline still shows a tooltip on hover unless you set [`noTooltip`](api.md#noTooltip). Of the [annotations](annotations.md), it draws the hatches and edges of hatched ranges, and the rules and heads of event lines without their labels.

### Small multiples

Small multiples, a grid of small charts of one kind, read best with one title and one key for all of them. Leave out what each chart would repeat:

- [`noHeader`](api.md#noHeader) leaves out the header band, while the axes stay.
- [`noTooltip`](api.md#noTooltip) leaves out the hover layer.
- A [`legendContainer`](api.md#legendContainer) that isn't in the document drops the legend: `legendContainer: document.createElement('div')`.
- An [`ariaLabel`](api.md#ariaLabel) names each chart, since the page's heading isn't part of it.

```html live
<div class="multiples">
  <p class="multiples-key"><span>Last 4 weeks</span> <span class="dashed">The 4 weeks before</span></p>
  <div class="multiples-grid"></div>
</div>
<style>
  .multiples { margin: 0 10px; }
  .multiples-key { display: flex; gap: 16px; margin: 0 0 12px; font-size: 12px; }
  .multiples-key span::before {
    content: ''; display: inline-block; width: 16px; margin-inline-end: 6px; vertical-align: middle;
    border-top: 2px solid #3497ED;
  }
  .multiples-key .dashed::before { border-top-style: dashed; }
  .multiples-grid {
    --lovely-chart-plot-margin-top: 4px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
  }
  .multiple-header { display: flex; justify-content: space-between; font-size: 13px; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';

  const data = await fetch('../data/areas-absolute.json').then((response) => response.json());
  const labels = data.labels.slice(-28);

  data.datasets.slice(0, 4).forEach(({ name, values }) => {
    const recent = values.slice(-28);
    const cell = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'multiple-header';
    header.append(name, Object.assign(document.createElement('b'), { textContent: recent[27].toLocaleString('en-US') }));
    cell.append(header);
    document.querySelector('.multiples-grid').append(cell);

    new LovelyChart(cell, {
      type: 'line',
      labels,
      datasets: [
        { name: 'Last 4 weeks', color: '#3497ED', values: recent },
        { name: 'The 4 weeks before', color: '#3497ED', values: values.slice(-56, -28), isDashed: true },
      ],
      ariaLabel: `${name}, the last 4 weeks against the 4 before`,
      plotHeight: 120,
      noHeader: true,
      noTooltip: true,
      legendContainer: document.createElement('div'),
      areLabelsContrast: true,
      isUtc: true,
    });
  });
</script>
```

Each cell gives the chart room with `minmax(0, 1fr)`, and `--lovely-chart-plot-margin-top` on the grid brings the plots closer to the headings of the page.
