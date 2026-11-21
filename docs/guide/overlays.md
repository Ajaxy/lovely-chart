# Overlays and custom marks

Sometimes a mark belongs in the HTML of your page rather than on the canvas: a badge with a figure, an empty-state message, a link at the label of a release. The chart tells your page exactly where its plot is, through CSS custom properties and two callbacks, so such elements line up with the data and follow it through every update, resize and zoom.

## The plot-area variables

From its first paint, the frame after it's created, the chart sets these custom properties on the `element` you passed to the constructor:

| Variable | Holds |
|---|---|
| [`--lovely-chart-plot-area-left`](css.md#--lovely-chart-plot-area-left) | Left edge of the data area, in px |
| `--lovely-chart-plot-area-top` | Top edge of the data area, in px |
| `--lovely-chart-plot-area-width` | Width of the data area, in px |
| `--lovely-chart-plot-area-height` | Height of the data area, in px |
| [`--lovely-chart-plot-padding-top`](css.md#--lovely-chart-plot-padding-top) | The room above the data area, `15px`, or `2px` on a sparkline |

The data area is where the data draws: from the start of the plot, after an [`isYAxisOutward`](api.md#isYAxisOutward) column of labels, to its end, and from the top of the Y range down to the X-axis baseline. A pie or donut sets the square around its circle, and a sparkline its plot inset by 2px. The `--lovely-chart-plot-padding-top` room above it is where pin heads and the labels of [event lines](annotations.md#event-lines) rise.

The values are lengths from the inside of the element's border, so an absolutely positioned child of the element covers the data area with no arithmetic of its own:

```css
.chart {
  position: relative;
}

.chart-overlay {
  position: absolute;
  left: var(--lovely-chart-plot-area-left);
  top: var(--lovely-chart-plot-area-top);
  width: var(--lovely-chart-plot-area-width);
  height: var(--lovely-chart-plot-area-height);
  /* Lets the pointer through to the tooltip */
  pointer-events: none;
}
```

```js
const element = document.querySelector('.chart');
new LovelyChart(element, params);

const overlay = document.createElement('div');
overlay.className = 'chart-overlay';
element.appendChild(overlay);
```

The chart rewrites the variables whenever the area changes: on `update()`, a resize or an orientation change, a zoom into data of another label column or into a pie, a web font that changes the axis font, and a style of your page that moves the plot, as by folding the header. [`destroy()`](api.md#destroy) removes them.

> [!NOTE]
> The variables describe one chart. Of several charts in one element, they describe the one that wrote them last, so give each chart with an overlay an element of its own.

### A badge in the corner of the plot

Here a badge sums up the forecast week at the bottom left of the plot. It's positioned by the variables alone, so it stays in its corner at any width:

```html live
<div class="forecast-chart">
  <div class="forecast-badge" hidden></div>
</div>
<style>
  .forecast-chart { position: relative; }
  .forecast-badge {
    position: absolute;
    top: calc(var(--lovely-chart-plot-area-top) + var(--lovely-chart-plot-area-height) - 6px);
    left: calc(var(--lovely-chart-plot-area-left) + 6px);
    max-width: calc(var(--lovely-chart-plot-area-width) - 12px);
    transform: translateY(-100%);
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(16, 139, 227, 0.1);
    color: #108BE3;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  html.theme-dark .forecast-badge { background: rgba(72, 170, 240, 0.16); color: #48AAF0; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const values = series(28, { start: 1200, trend: 0.004, seasonality: 0.12, seed: 3 });
  const forecastTotal = values.slice(-7).reduce((sum, value) => sum + value, 0);
  const element = document.querySelector('.forecast-chart');
  const badge = element.querySelector('.forecast-badge');
  badge.textContent = `Next 7 days: ${forecastTotal.toLocaleString('en-US')}`;

  new LovelyChart(element, {
    title: 'Orders forecast',
    type: 'line',
    labels: days(28),
    datasets: [{ name: 'Orders', color: '#3497ED', values }],
    hatchedRanges: [{ from: 21, to: 27, label: 'Forecast', hasEdge: true, color: { light: '#108BE3', dark: '#48AAF0' } }],
    isUtc: true,
    // The variables exist from the first paint on, so the badge waits for it
    onPlotAreaChange: (area) => { badge.hidden = !area; },
  });
</script>
```

The badge comes before the chart in the element, so the line and the tooltip paint over it; see [Stacking](#stacking) below.

## Following the plot area from script

When you position something from JavaScript rather than CSS, as when you size a canvas or an SVG of your own to the plot, use [`onPlotAreaChange`](api.md#onPlotAreaChange). The chart calls it with `{ left, top, width, height }` in px, the same numbers as the variables, whenever it writes them, and with `undefined` as `destroy()` removes them:

```js
new LovelyChart(element, {
  ...params,
  onPlotAreaChange: (area) => {
    svg.style.display = area ? '' : 'none';
    if (!area) return;

    Object.assign(svg.style, { left: `${area.left}px`, top: `${area.top}px` });
    svg.setAttribute('width', area.width);
    svg.setAttribute('height', area.height);
  },
});
```

A pan, or a zoom that leaves the area as it is, moves the labels across it without a call of `onPlotAreaChange`. For an element tied to a label, follow the labels instead, as the next section does.

## Placing an element at a label

[`getLabelX(labelIndex, offset?)`](api.md#getLabelX) returns the x of a label in px from the left of the plot area, where the last frame drew it: at its point on a `line` or `area` chart, and at the centre of its column on a `bar` or `step` chart. Add the area's `left` to place an element at it.

Call it whenever the labels move, which [`onRangeChange`](api.md#onRangeChange) reports frame by frame through a drag of the minimap and the transition of a zoom, and whenever the area changes. Here a link to the release notes stands above the day of a release, over a dashed [event line](annotations.md#event-lines). Drag the minimap, and the link moves with the canvas and hides once its day leaves the window:

```html live
<div id="usage" class="usage-chart"></div>
<style>
  .usage-chart { position: relative; }
  .release-link {
    position: absolute;
    /* Stands in the room above the Y range, centred on its label */
    top: calc(var(--lovely-chart-plot-area-top) - var(--lovely-chart-plot-padding-top));
    transform: translateX(-50%);
    padding: 0 6px;
    border-radius: 8px;
    background: #3497ED;
    color: #FFFFFF;
    font-size: 11px;
    line-height: 15px;
    text-decoration: none;
  }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const element = document.getElementById('usage');
  const releaseIndex = 110;

  const link = document.createElement('a');
  link.className = 'release-link';
  link.href = '#release-2-0';
  link.textContent = 'v2.0';
  link.hidden = true;

  let plotArea;
  const placeLink = () => {
    const x = plotArea ? chart.getLabelX(releaseIndex) : undefined;
    link.hidden = x === undefined;
    if (x !== undefined) {
      link.style.left = `${plotArea.left + x}px`;
    }
  };

  const chart = new LovelyChart(element, {
    title: 'Daily active users',
    type: 'line',
    labels: days(120),
    datasets: [
      { name: 'Desktop', values: series(120, { start: 3400, volatility: 0.04, seasonality: 0.15, seed: 71 }) },
      { name: 'Mobile', values: series(120, { start: 5200, volatility: 0.04, seasonality: 0.1, seed: 72 }) },
    ],
    withMinimap: true,
    isUtc: true,
    eventLines: [{ labelIndex: releaseIndex, isDashed: true }],
    onPlotAreaChange: (area) => {
      plotArea = area;
      placeLink();
    },
    onRangeChange: placeLink,
  });
  // After the chart, so the link paints over the plot and takes clicks
  element.append(link);
</script>
```

`getLabelX()` returns `undefined` where the label has no x, which is the cue to hide the element:

- for an index outside the visible range, the labels `onRangeChange` reports;
- before the first frame of the chart, of `update()`, of a resize and of the data a zoom swaps in;
- on pie and donut charts, and from the start of a zoom into shares;
- after `destroy()`.

A label at the edge of a panned window can map below 0 or past the area's width, since the window runs past the plot area; clip or hide the element there if it matters.

`offset`, from 0 to 1, takes a point through the label's interval instead, as [`eventLines`](annotations.md#event-lines) does: from the label's point to the next one on a `line` or `area` chart, and across its column on a `bar` or `step` chart, where `0` is its start and `0.5` its centre.

### While zoomed

From the first frame of the data [`onZoom`](api.md#onZoom) returns, `getLabelX()` maps that data's labels, not the overview's. If your element belongs to a label of the overview, hide it while zoomed, using [`onZoomChange`](api.md#onZoomChange), which reports a zoom ahead of its first frame:

```js
let isZoomedIn = false;

const placeLink = () => {
  const x = plotArea && !isZoomedIn ? chart.getLabelX(releaseIndex) : undefined;
  link.hidden = x === undefined;
  if (x !== undefined) {
    link.style.left = `${plotArea.left + x}px`;
  }
};

const chart = new LovelyChart(element, {
  ...params,
  onPlotAreaChange: (area) => {
    plotArea = area;
    placeLink();
  },
  onRangeChange: placeLink,
  onZoomChange: (labelValue) => {
    isZoomedIn = labelValue !== undefined;
  },
});
```

## Stacking

The chart keeps its place among the children of `element` through updates and resizes, so the order you give your elements decides what paints over what:

| Your element | Paints |
|---|---|
| Inserted before the chart | Under the plot and the hover line |
| Added after the chart | Over the plot and the hover line, under the tooltip balloon |
| Either, with a `z-index` above `1` | Over the tooltip balloon too |

The tooltip balloon, and the zoom-out control where it floats over the plot, take `z-index: 1`. An element after the chart takes the pointer over its own box, so give a decorative one `pointer-events: none`, or the reader can't hover the data under it; one before the chart lies under the chart and gets no clicks where the chart covers it.

While it holds a chart, `element` is a stacking context, with `isolation: isolate`. No `z-index` inside it reaches over the page around it, so a menu of your page placed inside `element` can't cover the content after the chart. Put such menus outside the element.

> [!NOTE]
> During the cross-fade of [`update()` with `isAnimated`](updating.md#cross-fading), positioned elements after the chart in `element` paint over both the old and the new chart, and those before it under both.

## When to draw with the chart instead

An overlay is the right tool for something interactive, as a link or a button, for rich HTML text, or for anything not tied to the data. For marks on the data itself, the chart's own [annotations](annotations.md) are simpler and do more:

| You want | Use |
|---|---|
| A band over a run of labels, as a forecast | [`hatchedRanges`](api.md#hatchedRanges) |
| A rule or a pin at a moment, with a label and a note in the tooltip | [`eventLines`](api.md#eventLines) |
| A line at a value, as a target | [`referenceLines`](api.md#referenceLines) |

They draw with the data, in the colours of the skin, show on the minimap and sparklines where it makes sense, and need no code to follow a pan or a zoom.
