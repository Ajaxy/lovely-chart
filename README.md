# LovelyChart

<a href="https://www.npmjs.com/package/lovely-chart" target="_blank"><img alt="npm version" src="https://img.shields.io/npm/v/lovely-chart.svg"/></a>
<a href="https://bundlephobia.com/package/lovely-chart" target="_blank"><img alt="minzipped size" src="https://badgen.net/bundlephobia/minzip/lovely-chart"/></a>
<a href="https://github.com/Ajaxy/lovely-chart/actions/workflows/ci.yml" target="_blank"><img alt="CI status" src="https://github.com/Ajaxy/lovely-chart/actions/workflows/ci.yml/badge.svg"/></a>

## Overview

**LovelyChart** is a tiny, dependency-free library to work with beautiful interactive charts.

It draws line, area, bar, step, pie and donut charts with smooth animated transitions, a draggable minimap for range selection, tooltips, dataset toggling, drill-down zooming and a built-in day/night theme. Everything is touch-friendly and fast enough for low-end mobile devices, at just a few kilobytes over the wire.

🏆 A [Telegram Chart Contest](https://contest.dev/chart-js) award winning library.

<img alt="LovelyChart demo" src="https://raw.githubusercontent.com/Ajaxy/lovely-chart/master/docs/preview.png" width="840"/>

## Demo

https://ajaxy.github.io/lovely-chart

Or open the project instantly on [StackBlitz](https://stackblitz.com/github/Ajaxy/lovely-chart).

## Usage

```js
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

const chart = new LovelyChart(element, {
  title: 'Online Users',
  type: 'line',
  labels: [1735689600000, 1735776000000, /* … */],
  datasets: [
    { name: 'Desktop', color: '#3497ED', values: [1274, 1305, /* … */] },
    { name: 'Mobile', color: '#9ED448', values: [2861, 2914, /* … */] },
  ],
  withMinimap: true,
  // See "Data parameters" below for the full list of options
});

// Replace the data and re-render
chart.update(newData);

// Tear down the chart and detach all listeners
chart.destroy();
```

#### Constructor arguments
- `element` — DOM node in which the chart is rendered. The chart layout resizes automatically to occupy the entire available width. The chart sets the `--lovely-chart-plot-area-*` CSS variables on it; of several charts in one element, they describe the one that wrote them last.
- `data` — Parameters for a chart.

#### Instance methods
The created instance exposes the following methods (the `LovelyChartInstance` type describes `update` and `destroy` structurally, e.g. for test stubs):

Method | Description |
---------|----|
`update(newData)` | Replaces the current data with `newData` (same shape as the initial `data` argument) and re-renders. Resets transient view state (zoom, range, filter) and ends a drag, a long press or a hover in progress. No-op after `destroy()`.
`selectLabel(labelIndex)` | Selects the label at `labelIndex` as hovering it would: shows its tooltip, focuses its bar and calls `onSelectedIndexChange`. The selection holds while the pointer moves elsewhere on the page and follows its label through a range change; the pointer over the chart takes it over, and it clears once its label leaves the visible range. `selectLabel(undefined)` clears the selection. Ignored for an index outside the visible range, on pie and donut charts and before the first paint, the frame after the chart is created or updated. No-op after `destroy()`.
`destroy()` | Tears down the chart: removes the DOM subtree from `element` and the `--lovely-chart-plot-area-*` variables from its style, detaches all global listeners (window `resize` / `orientationchange`, document `mousemove` / `touchstart` and those of a drag in progress, theme `MutationObserver`, the `prefers-color-scheme` media query `change`, `document.fonts` `loadingdone`), cancels pending animation frames and timeouts, and calls back nothing after it. Idempotent. Call this from your framework's cleanup hook (e.g. React `useEffect` cleanup) to avoid resource leaks.

#### Data parameters

Parameter | Description |
---------|----|
`title`| Chart headline
`type`| Chart type. Supported types: `line`, `area`, `bar`, `step`, `pie`, `donut`
`labels`| Array of UNIX timestamps in milliseconds, or arbitrary strings for text labels
`labelType`| Optional X-axis label kind: `year`, `month`, `week`, `day`, `hour`, `5min`, `dayHour` or `text`. When omitted, it is inferred from the first two `labels` records: strings → `text`, timestamps → `year`/`month`/`week`/`day`/`hour`/`5min` depending on the step between them. `year` labels render as `2026`, `month` as `January`, `week` as `Week 1`, the ISO 8601 week number of the label's UTC date, so labels on 29 Dec 2025 and 28 Dec 2026 read `Week 1` and `Week 53`. Charts with `text` labels show no header caption.
`dateLocale`| Optional localized date strings for axis, tooltip and caption labels: `{ months, monthsFull, weekDays, weekDaysShort, weekOf }`. Each array field is optional (12 months, or 7 weekdays starting Sunday) and falls back to English when omitted. `weekOf` is the words before the start date in a week title, `Week of` by default.
`tooltipFormatter`| Optional tooltip title format: `statsTooltipFormat('day')` (`18 Nov 2026`), `statsTooltipFormat('week')` (`Week of 16 Nov`), `statsTooltipFormat('hour')` or `statsTooltipFormat('5min')` (`14:00`), `statsFormatDayHourFull` (`18 Nov 14:00`). Defaults to the X-axis label.
`isUtc`| `true` to read every date and time of the labels in UTC. Axis labels of days, hours and minutes and their tooltip titles otherwise follow the reader's time zone, while captions and day titles always read UTC. Default `false`.
`datasets`| Array of params for each dataset
`datasets[*].name`| Dataset name
`datasets[*].color`| Dataset color
`datasets[*].values`| Array of dataset values; `null` leaves a gap
`datasets[*].isInitiallyHidden`| `true` to start the dataset hidden, its legend button unchecked. Default `false`.
`datasets[*].isDashed`| `true` to draw a `line` or `step` dataset in 6px dashes 4px apart. Its legend button gets a dashed outline and a `data-dashed` attribute, and its tooltip swatch a dashed outline. Other types ignore it, legend included. Default `false`.
`datasets[*].isDotted`| `true` to draw a `line` or `step` dataset in 2px dots 3px apart, whether or not it is `isDashed`. Its legend button gets a dotted outline and a `data-dotted` attribute, and its tooltip swatch a dotted outline. Other types ignore it, legend included. Default `false`.
`isPercentage` | `true` for percentage based values
`percentPrecision`| Digits after the point of the share a percentage chart's tooltip prints beside each value. Default `0`.
`isStacked`| `true` for values stacking on top of each other
`hasSecondYAxis`| `true` for charts with 2 Y axes
`secondaryYAxis`| Optional scale of the main Y axis in another unit: `{ label, multiplier, prefix?, suffix? }`. Each main Y-axis label times `multiplier`, between `prefix` and `suffix`, stands at the right of the plot, apart from a percentage chart's. The tooltip adds a row of `label` and its total times `multiplier` to two decimals, between `prefix` and `suffix`: under the Total row of a stacked or percentage `bar`, `step` or `area` chart, and under the dataset rows of any other chart or one with `isTooltipTotalInTitle`.
`valuePrefix`| Optional string prepended to every formatted value (e.g. `$`)
`valueSuffix`| Optional string appended to every formatted value
`isCurrencyPrefix`| When `true`, a negative value is rendered with the minus sign in front of `valuePrefix` (`-$9.1` instead of `$-9.1`). Use with currency-like prefixes. Default `false`.
`withMinimap`| `true` to render the minimap with the draggable range selector below the chart. Default `false`.
`minimapRange`| Initially selected range: a `[begin, end]` tuple of fractions between 0 and 1 (e.g. `[0.8, 1]` for the last 20%), or the `'full'` keyword for the entire range. Defaults to `[0.8, 1]` when the minimap is shown, otherwise to `'full'`.
`onZoom`| Optional function which returns `Promise` with data for the zoomed chart (new `data` object). The zoomed data sets its own options, such as `areLinesSmooth`, `isYAxisOutward` and each dataset's `isDashed`, so it repeats those it shares with the chart; `axisTextColor`, `backgroundColor` and `colorScheme` stay the chart's. Its datasets take their own colours, from `colors` or each dataset's `color`, on the plot, in the legend, the tooltip and the minimap; a dataset with neither keeps the colour of the chart's dataset at its place, and one past the chart's datasets takes a default colour. Data with another number of datasets than the chart shows in full, without the minimap.
`colors`| In data that `onZoom` returns, the colours of its datasets by key, `y0` for the first, `y1` for the second and so on, over each dataset's `color`: `{ y0: '#3497ED', y1: '#9ED448' }`. The chart's own data ignores it.
`noZoom`| `true` to disable zooming. Default `false`.
`zoomType`| Chart type shown when a percentage chart is zoomed into a single label: `pie` or `donut`. Default `pie`.
`zoomToShares`| `true` to opt a non-percentage chart into zoom-to-shares, so clicking a label drills into a `zoomType` chart of that label's shares. Percentage charts do this implicitly; a stacked chart of absolute values needs the flag, since switching it to `isPercentage` would discard the values the overview exists to show. Ignored when `onZoom` is supplied. Default `false`.
`circleLabelsAround`| How many labels either side of the clicked one the zoomed pie/donut covers. Default `3`, which suits daily data; use `0` to drill into a single label.
`onZoomChange`| Optional function called once a zoom settles, with the value of the zoomed-in label, and with `undefined` once zoomed out, also when `update()`, a resize or an orientation change returns a zoomed chart to its overview.
`initialZoom`| Open the chart already zoomed on a point, with no overview shown and no transition morph: a label index, or `'last'` for the last point. Works for both shares (pie/donut) and custom `onZoom` charts. Zoom-out afterwards behaves normally. Ignored when the chart is not zoomable. Out-of-range indexes are clamped.

#### Layout and colour parameters

Parameter | Description |
---------|----|
`plotHeight`| Height of the plot canvas in px. Default `320`. A `--lovely-chart-plot-height` custom property on the chart element or an ancestor takes precedence (a unitless number, `px` or `rem`), so a media query can set it.
`isSparkline`| `true` to draw the datasets alone, inset by 2px: no axes, grid, header or legend. The bottom of the Y range stays unrounded to an axis step and follows the zero baseline of every chart: 0, unless the values go below 0 or their lowest is more than three quarters of their highest. Default `false`.
`isYAxisOutward`| `true` to put the main Y-axis labels in a column left of the plot, right-aligned, so the data never runs under them; the second Y axis keeps its labels inside the plot. The column fits the widest label the chart can show for its data in the axis font, `axisFontSize` included: over the whole value range of every dataset, hidden ones too, the reference lines and the previous period, below 0 as well, and at every step a window can take, down to a window of a single label. That can make it wider than any label a reader brings up at the narrowest window the minimap selects. It is measured once per data set, when the chart is built, on `update()` and on a zoom into or out of a day, so the plot holds still while the reader pans, animates or hides datasets, and again when a web font of the page changes the axis font, so the column fits a font that arrives after the chart: once the font finishes loading, or on the next frame the chart draws after the page adds a `FontFace` already loaded, which fires no event; the data `onZoom` returns sets `isYAxisOutward` of its own. A sparkline has no axes and no column. Default `false`.
`noFloatSteps`| `true` to step the main and the second Y axis in whole numbers, 1 at the finest, for counts: a range of 0 to 2 labels 0, 1 and 2. Default `false`.
`areLabelsContrast`| `true` to center each Y-axis label on its grid line, over the line, inside a halo of the background colour, 2px in from its side of the chart so the grid line still shows at the plot edge. Default `false`.
`axisFontSize`| Font size of the axis labels in px. Default `10`.
`axisTextColor`| Colour of the axis labels: a hex colour (`#RRGGBB`, optionally `#RRGGBB/alpha`) or `{ light, dark }`, one per skin.
`backgroundColor`| Colour of the surface behind the chart, in the same form as `axisTextColor`. The chart paints it inside the hover dots, in the mask over unfocused bars and as a halo around the Y-axis labels. Defaults to the skin's own background; without it, only `areLabelsContrast` labels get a halo.
`colorScheme`| `'htmlClassName'` follows the `theme-dark` class on the `<html>` element; `'system'` follows the system's `prefers-color-scheme`, live. Default `'htmlClassName'`.
`areLinesSmooth`| `true` to draw `line` datasets, and the `comparison` line beside them, as monotone curves through their values, never overshooting a value. Default `false`.
`areaOpacity`| Opacity of an `area` fill, from 0 to 1; the outline and dots keep full opacity. Default `1`.
`areaBorderColor`| Colour of a 1px outline around each area, and around each run of an area split at a gap: any canvas colour or `{ light, dark }`. A stack draws a boundary two areas share once.
`legendContainer`| Element that holds the legend, in place of the chart container.

#### Reference and comparison parameters

Parameter | Description |
---------|----|
`referenceLines`| Dashed rules at fixed values of the main Y axis: `[{ value, label?, color? }]`. The Y range always reaches each value, stacked charts included, so a line with `color: 'transparent'` draws nothing and only pins the range. `label` is drawn above the right end of the line, none when empty. `color` is any canvas colour or `{ light, dark }`, and defaults to the Y-axis text colour. `label` reads in the direction of the page, so on a right-to-left page a sign before a number moves after it; a number wrapped in U+2066 and U+2069, as `'\u2066-1.2K\u2069'`, keeps its sign first. On a percentage chart `value` is a percentage from 0 to 100 and the range stays 0–100%. Ignored on pie and donut charts.
`comparison`| A previous period, drawn as a dashed line: `{ name, color?, values }`. `values` holds the previous values per dataset, in the order of `datasets`, each aligned with `labels`; the line draws their sum over the datasets on screen, and a `null` leaves a gap. `color` is a hex colour, `#6B7280` by default. The legend names it beside a dashed swatch, and the tooltip lists it first with the change of the current total in percent. Ignored on percentage, pie and donut charts.

#### Tooltip parameters

The tooltip lists each dataset on screen with a non-zero value at the label: a swatch of its colour, its name and its value in the text colour, from the largest value down. The swatch of a dashed or dotted line is a dashed or dotted outline. A `comparison` row comes first, set apart from the rest, beside a dashed swatch of its colour, with its change tinted by `--tooltip-change-positive` and `--tooltip-change-negative`. Stacked and percentage `bar`, `step` and `area` charts add a Total row. A pie or donut lists the sector under the pointer alone.

Parameter | Description |
---------|----|
`isTooltipOrderFixed`| `true` to list the tooltip rows in the order of the legend, after the `comparison` row. When more than 12 rows would show, the largest values still decide which ones do. Default `false`.
`isTooltipTotalInTitle`| `true` to put the total of a stacked or percentage `bar`, `step` or `area` chart beside the tooltip title, in place of the Total row. Default `false`.
`formatTooltipValue`| Optional function formatting a number of the tooltip; `valuePrefix` and `valueSuffix` still wrap the result.
`resolveTooltipTotal`| Optional function `(labelValue, datasetIndexes) => number \| null \| undefined` giving the total of a stacked chart's tooltip, for the label's value (its timestamp, or the index of a text label) and the indexes of the datasets on screen. `undefined` keeps the sum of the rows, `null` shows `—`. The comparison change and the total on the `secondaryYAxis` scale read this total too.
`onSelectedIndexChange`| Optional function called when the selected label changes, by pointer, touch or `selectLabel()`, with its index, and with `undefined` once nothing is selected: the pointer leaves the chart, `selectLabel(undefined)`, `update()`, a resize, or the selected label leaving the visible range.
`onHiddenSeriesChange`| Optional function called when the reader shows or hides a dataset in the legend, with the names and the indexes of the hidden datasets.

#### Examples

Solid, dashed and dotted series of one hue, a target line and a range pinned to start at zero:

```js
new LovelyChart(element, {
  type: 'line',
  labels,
  datasets: [
    { name: 'iOS', color: '#3497ED', values: ios },
    { name: 'Android', color: '#3497ED', values: android, isDashed: true },
    { name: 'Web', color: '#3497ED', values: web, isDotted: true },
  ],
  referenceLines: [
    { value: 1200, label: 'Stall · 20 min', color: { light: '#C98A00', dark: '#FFB020' } },
    { value: 0, color: 'transparent' },
  ],
  isUtc: true,
});
```

A stacked chart against the previous period, its tooltip in legend order with the total by the title, and a label column:

```js
new LovelyChart(element, {
  type: 'area',
  isStacked: true,
  labels,
  labelType: 'day',
  tooltipFormatter: "statsTooltipFormat('week')",
  datasets,
  comparison: { name: 'Previous period', values: previousValuesPerDataset },
  isTooltipOrderFixed: true,
  isTooltipTotalInTitle: true,
  formatTooltipValue: (value) => value.toLocaleString('en-US'),
  isYAxisOutward: true,
  areLabelsContrast: true,
  backgroundColor: { light: '#F5F6F7', dark: '#212A33' },
  colorScheme: 'system',
});
```

A sparkline, and a chart driven from outside:

```js
new LovelyChart(cell, { type: 'line', labels, datasets: [series], isSparkline: true, plotHeight: 52 });

const chart = new LovelyChart(element, {
  ...params,
  legendContainer: document.getElementById('legend'),
  onSelectedIndexChange: (index) => highlightRow(index),
  onHiddenSeriesChange: (names) => saveHidden(names),
});
// The chart paints on the next frame, and ignores a selection before it
requestAnimationFrame(() => chart.selectLabel(labels.length - 1));
```

#### CSS variables

Variable | Description |
---------|----|
`--lovely-chart-plot-height`| Plot canvas height, read from the chart element or an ancestor, ahead of `plotHeight`: a unitless number of px, `px` or `rem`.
`--lovely-chart-series-color`| Set by the chart on each legend button and on the comparison legend entry: the colour of its dataset or line.
`--background-color`, `--text-color`, `--grid-lines`, `--tooltip-background` and the other variables on `.lovely-chart--container`| The colours of the day and the night skin. Night colours of your own go under `html.theme-dark .lovely-chart--container:not(.lovely-chart--container-scheme-system)` for the default `colorScheme`, and under `.lovely-chart--container-scheme-system` inside `@media (prefers-color-scheme: dark)` for `'system'`, so neither reaches a chart of the other scheme.
`--tooltip-change-positive`, `--tooltip-change-negative`| Colours of a rise and a fall of the `comparison` change in the tooltip.
`--lovely-chart-plot-area-left`, `--lovely-chart-plot-area-top`, `--lovely-chart-plot-area-width`, `--lovely-chart-plot-area-height`| Set by the chart on `element`, as px lengths from the inside of its border: the data area of the plot, where a window over every label and the Y range draw. It runs from the start of the plot, after an `isYAxisOutward` column, to its end, and from the top of the Y range to the X-axis baseline. A pie or donut sets the square around its circle, and a sparkline its plot inset by 2px. The chart sets them from its first paint, the frame after it is created, and rewrites them when the area changes: on `update()`, a resize or an orientation change, a zoom into data of another label column or into a pie, and when a web font of the page changes the axis font. `destroy()` removes them.

#### Placing elements over the plot

An element positioned by the `--lovely-chart-plot-area-*` variables inside `element`, such as a marker, a band or an empty-state message, covers the data area without repeating the chart's paddings, and follows it through updates, resizes and zooms:

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

The chart keeps its place among the children of `element` through updates and resizes, so an overlay added after it paints over the plot and the tooltip balloon, and one inserted before it paints under them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and [CHANGELOG.md](CHANGELOG.md) for release notes.
