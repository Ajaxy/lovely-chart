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
- `element` — DOM node in which the chart is rendered. The chart layout resizes automatically to occupy the entire available width. The chart sets the `--lovely-chart-plot-area-*` and `--lovely-chart-plot-padding-top` CSS variables on it; of several charts in one element, they describe the one that wrote them last.
- `data` — Parameters for a chart.

#### Instance methods
The created instance exposes the following methods (the `LovelyChartInstance` type describes `update` and `destroy` structurally, e.g. for test stubs):

Method | Description |
---------|----|
`update(newData, options?)` | Replaces the current data with `newData` (same shape as the initial `data` argument) and re-renders, at once or, with `isAnimated`, through a cross-fade. Resets transient view state (zoom, range, filter, selection) and ends a drag, a long press or a hover in progress, unless `options` keeps part of the view: see [Update options](#update-options). The chart keeps a reference to `newData`, as it does to `data`, and builds from it again on a resize or an orientation change, so a change made to the object afterwards shows from that build on; pass a new object for new data instead. No-op after `destroy()`.
`selectLabel(labelIndex)` | Selects the label at `labelIndex` as hovering it would: shows its tooltip, focuses its bar and calls `onSelectedIndexChange` and `onTooltipChange`. The selection holds while the pointer moves elsewhere on the page and follows its label through a range change; the pointer over the chart takes it over, and it clears once its label leaves the visible range. `selectLabel(undefined)` clears the selection. Ignored for an index outside the visible range, on pie and donut charts and before the first paint, the frame after the chart is created or updated. No-op after `destroy()`.
`refreshColors()` | Reads the `var()` colours of the params again and repaints the chart in them in place, keeping its zoom, range, legend filter and selection: for custom properties that the page changes on another trigger than the skin, such as a `data-theme` attribute. A change of the skin reads them by itself, as [Colours](#colours) describes. No-op after `destroy()`.
`setLegendContainer(element)` | Moves the legend into `element`, or back to the end of the chart with `undefined`, without a rebuild: its buttons keep the datasets they hide, and the chart keeps its zoom, range and selection. The legend takes its [spacing variables](#spacing-the-chart) from its new place, and stays there through a zoom, a resize and an orientation change; `update()` places it by the `legendContainer` of its new data. The element that held it keeps nothing of the chart, and a call with the element that holds it leaves it in place among the elements of the page. No-op after `destroy()`.
`getLabelX(labelIndex, offset?)` | The x of the label at `labelIndex` in px from the left of the plot area the `--lovely-chart-plot-area-*` variables describe, in the current view: where its value draws, at its point on a `line` or `area` chart and at the centre of its column on a `bar` or `step` chart. `offset`, from 0 to 1, takes that fraction through the label's interval instead: from its point to the next one on a `line` or `area` chart, where `0` is the point, and across its column on a `bar` or `step` chart, or one with bars or steps among its datasets, where `0` is its start and `0.5` its centre. It reads the range and the zoom the chart is moving to, so through the transition of a pan or a zoom it gives where the label ends up, and once a zoom into the data `onZoom` returns swaps that data in, as `onZoomChange` reports, it maps that data's labels. A panned window runs past the plot area, so a label at its edge can map below 0 or past the area's width. Returns `undefined` for an index outside the visible range, before the first paint, on pie and donut charts, a zoom into shares from its start included, and after `destroy()`.
`destroy()` | Tears down the chart: removes the DOM subtree from `element` and the `--lovely-chart-plot-area-*` and `--lovely-chart-plot-padding-top` variables from its style, calling `onPlotAreaChange` with `undefined`, detaches all global listeners (window `resize` / `orientationchange`, document `mousemove` / `touchstart` and those of a drag in progress, theme `MutationObserver`, layout `ResizeObserver`, the `prefers-color-scheme` media query `change`, `document.fonts` `loadingdone`), cancels pending animation frames and timeouts, and calls back nothing after it. Idempotent. Call this from your framework's cleanup hook (e.g. React `useEffect` cleanup) to avoid resource leaks.

#### Update options
The second argument of `update()`, of the `LovelyChartUpdateOptions` type, keeps parts of the view the reader has and animates the change. Each option is `false` by default, which resets that part or swaps the data at once.

Option | Description |
---------|----|
`shouldKeepFilter`| `true` to keep the datasets the reader showed or hid in the legend, matched by their place in `datasets`, or by `name` when `newData` has another number of datasets. A dataset with no match starts as its `isInitiallyHidden` says, and so does every dataset where the match would hide them all, which the legend never lets the reader do. `onHiddenSeriesChange` is called once the new data is built when the names or the indexes of the hidden datasets differ from those before.
`shouldKeepZoom`| `true` to keep the minimap window and the zoom while `newData` has the same `labels`. A zoomed chart opens zoomed into the same label, with no overview shown and no transition morph, as `initialZoom` opens it, and calls `onZoom` again for it; a zoom out returns to the kept window. `onZoomChange` goes uncalled for a zoom it already reported, is called with the label's value and index once a zoom still on its way in shows on the rebuilt chart, and with `undefined` for both when the zoom ends: when the labels differ, when `newData` cannot zoom, or when `onZoom` fails.
`shouldKeepSelection`| `true` to keep the selected label, by pointer, touch, keyboard or `selectLabel()`, at the index of the label of the same value in `newData`, while there is one in the window the chart opens on. A selection by pointer or touch still clears as the pointer leaves the chart or a touch lands elsewhere, and one by the keyboard or `selectLabel()` holds. `onSelectedIndexChange` is called on the first frame of the new data only when the index changes, and `onTooltipChange` only when what the tooltip shows changes, and both with `undefined` when the selection ends: its label is gone or outside the window, or a zoom shows or is kept.
`isAnimated`| `true` to cross-fade the chart into `newData` over 400ms. The chart it replaces, with its plot, axes, header, minimap and legend, stays in the new chart's place, under it, as it fades out and the new one fades in. It takes no room in the layout, so the page lays out around the new chart at once, and no pointer, focus or assistive technology reaches it; while it is taller than the new chart, it covers the content that follows. A legend in `legendContainer` cross-fades in its place there, the replaced one over the new one. Positioned elements of the page after the chart in `element` paint over both charts, and those before it under both. Another `update()` with `isAnimated` fades the chart out from the opacity it has reached, while the charts before it go on fading out; one without it, a resize, an orientation change or `destroy()` ends the fades at once. Ignored while the system asks for reduced motion (`prefers-reduced-motion: reduce`).

#### Data parameters

Parameter | Description |
---------|----|
`title`| Chart headline
`type`| Chart type. Supported types: `line`, `area`, `bar`, `step`, `pie`, `donut`
`labels`| Array of UNIX timestamps in milliseconds, or arbitrary strings for text labels
`labelType`| Optional X-axis label kind: `year`, `month`, `week`, `day`, `hour`, `5min`, `dayHour` or `text`. When omitted, it is inferred from the first two `labels` records: strings → `text`, timestamps → `year`/`month`/`week`/`day`/`hour`/`5min` depending on the step between them. `year` labels render as `2026`, `month` as `January`, `week` as `Week 1`, the ISO 8601 week number of the label's UTC date, so labels on 29 Dec 2025 and 28 Dec 2026 read `Week 1` and `Week 53`. Charts with `text` labels show no header caption.
`dateLocale`| Optional localized date strings for axis, tooltip and caption labels: `{ months, monthsFull, weekDays, weekDaysShort, weekOf }`. Each array field is optional (12 months, or 7 weekdays starting Sunday) and falls back to English when omitted. `weekOf` is the words before the start date in a week title, `Week of` by default. The X-axis labels, text ones included, the header caption and the tooltip title read in the direction of their first letter, whatever the direction of the page: English dates left to right and dates in Hebrew or Arabic words right to left. Without a letter, as in the caption `2022 — 2026` of a year chart, they read left to right, the way the X axis runs.
`tooltipFormatter`| Optional tooltip title format: `statsTooltipFormat('day')` (`18 Nov 2026`), `statsTooltipFormat('week')` (`Week of 16 Nov`), `statsTooltipFormat('hour')` or `statsTooltipFormat('5min')` (`14:00`), `statsFormatDayHourFull` (`18 Nov 14:00`). Defaults to the X-axis label.
`isUtc`| `true` to read every date and time of the labels in UTC. Axis labels of days, hours and minutes and their tooltip titles otherwise follow the reader's time zone, while captions and day titles always read UTC. Default `false`.
`datasets`| Array of params for each dataset
`datasets[*].name`| Dataset name
`datasets[*].color`| Dataset colour, in any of the forms under [Colours](#colours). The datasets with none take the [default colours](#default-colours) in order.
`datasets[*].values`| Array of dataset values; `null` leaves a gap
`datasets[*].isInitiallyHidden`| `true` to start the dataset hidden, its legend button unchecked. Default `false`.
`datasets[*].isDashed`| `true` to draw a `line` or `step` dataset in 6px dashes 4px apart. Its legend button gets a dashed outline and a `data-dashed` attribute, and its tooltip swatch a dashed outline. Other types ignore it, legend included. Default `false`.
`datasets[*].isDotted`| `true` to draw a `line` or `step` dataset in 2px dots 3px apart, whether or not it is `isDashed`. Its legend button gets a dotted outline and a `data-dotted` attribute, and its tooltip swatch a dotted outline. Other types ignore it, legend included. Default `false`.
`datasets[*].type`| `line`, `bar` or `step` to draw the dataset as another type than the chart's `type`, as a line over bars; ignored on percentage, pie and donut charts. Lines and steps draw over bars and areas, whatever the order of `datasets`, and the hatch of `hatchedRanges` goes between them. A chart with a `bar` or `step` dataset gives every label a column, its lines running through the middles, and on hover masks the columns around the focused one, with a dot on each line. Bars that share the main Y axis with another type keep 0 on it, whichever side of it their values are. A dataset of another type than the chart's draws its own values: it stays out of a stacked chart's stack, the tooltip's total, the `comparison` and the shares of a zoom into a label. Defaults to the chart's `type`.
`isPercentage` | `true` for percentage based values
`percentPrecision`| Digits after the point of the share a percentage chart's tooltip prints beside each value. Default `0`.
`isStacked`| `true` for values stacking on top of each other
`hasSecondYAxis`| `true` to put the last dataset on a Y axis of its own, labelled at the right of the plot in the dataset's colour. The main Y axis is labelled in the colour of the first dataset, apart from a stacked or percentage chart's, whose labels keep the axis text colour. The last dataset stays out of the main Y axis, the tooltip's total and, on a stacked chart, the stack, beside which it draws its own values; a percentage chart's tooltip prints no share on its row.
`secondaryYAxis`| Optional scale of the main Y axis in another unit: `{ label, multiplier, prefix?, suffix? }`. Each main Y-axis label times `multiplier`, between `prefix` and `suffix`, stands at the right of the plot, apart from a percentage chart's. The tooltip adds a row of `label` and its total times `multiplier`, formatted as the dataset values are, by `formatTooltipValue` when given, between `prefix` and `suffix`: under the Total row of a stacked or percentage `bar`, `step` or `area` chart, and under the dataset rows of any other chart or one with `isTooltipTotalInTitle`.
`valuePrefix`| Optional string prepended to every formatted value (e.g. `$`)
`valueSuffix`| Optional string appended to every formatted value
`isCurrencyPrefix`| When `true`, a negative value is rendered with the minus sign in front of `valuePrefix` (`-$9.1` instead of `$-9.1`), and a negative label or tooltip total of `secondaryYAxis` with it in front of that scale's `prefix`. Use with currency-like prefixes. Default `false`.
`withMinimap`| `true` to render the minimap with the draggable range selector below the chart. Default `false`.
`minimapRange`| Initially selected range: a `[begin, end]` tuple of fractions between 0 and 1 (e.g. `[0.8, 1]` for the last 20%), `{ from, to }`, inclusive label indexes (e.g. `{ from: 0, to: 6 }` for the first week of daily labels), or the `'full'` keyword for the entire range. `from` and `to` are rounded and clamped to the labels, as in `hatchedRanges`: a `bar` or `step` chart, or one with bars or steps among its datasets, selects the columns of the labels from `from` to `to`, a `pie` or `donut` sums those labels, and a `line` or `area` chart selects their points and half an interval past either end, within the axis, so the end points stay off the plot edges. A range of no labels, as one with `from` after `to`, takes the default. In the data `onZoom` returns, the indexes count its own labels. Defaults to `[0.8, 1]` when the minimap is shown, otherwise to `'full'`.
`onZoom`| Optional function which returns `Promise` with data for the zoomed chart (new `data` object). The zoomed data sets its own options, such as `areLinesSmooth`, `isYAxisOutward` and each dataset's `isDashed`, so it repeats those it shares with the chart; `axisTextColor`, `backgroundColor` and `colorScheme` stay the chart's. Its datasets take their own colours, from `colors` or each dataset's `color`, on the plot, in the legend, the tooltip and the minimap; a dataset with neither keeps the colour of the chart's dataset at its place, and one past the chart's datasets takes a default colour. Data with another number of datasets than the chart shows in full, without the minimap.
`colors`| In data that `onZoom` returns, the colours of its datasets by key, `y0` for the first, `y1` for the second and so on, over each dataset's `color`: `{ y0: '#3497ED', y1: '#9ED448' }`. The chart's own data ignores it.
`noZoom`| `true` to disable zooming. Default `false`.
`zoomType`| Chart type shown when a percentage chart is zoomed into a single label: `pie` or `donut`. Default `pie`.
`zoomToShares`| `true` to opt a non-percentage chart into zoom-to-shares, so clicking a label drills into a `zoomType` chart of that label's shares. Percentage charts do this implicitly; a stacked chart of absolute values needs the flag, since switching it to `isPercentage` would discard the values the overview exists to show. Ignored when `onZoom` is supplied. Default `false`.
`circleLabelsAround`| How many labels either side of the clicked one the zoomed pie/donut covers. Default `3`, which suits daily data; use `0` to drill into a single label.
`onZoomChange`| Optional function `(labelValue, labelIndex)` called once a zoom settles, with the value of the zoomed-in label (its timestamp, or the index of a text label) and its index in `labels`, and with `undefined` for both once zoomed out, also when `update()`, unless it keeps the zoom, a resize or an orientation change returns a zoomed chart to its overview.
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
`axisTextColor`| Colour of the axis labels, in any of the forms under [Colours](#colours).
`backgroundColor`| Colour of the surface behind the chart, in any of the forms under [Colours](#colours). The chart paints it inside the hover dots, in the mask over unfocused bars and as a halo around the Y-axis labels and the labels of reference lines, hatched ranges and event lines. Defaults to the skin's own background; without it, of the Y-axis labels only `areLabelsContrast` ones get a halo.
`colorScheme`| `'htmlClassName'` follows the `theme-dark` class on the `<html>` element; `'system'` follows the system's `prefers-color-scheme`, live. Default `'htmlClassName'`.
`areLinesSmooth`| `true` to draw `line` datasets, and the `comparison` line beside them, as monotone curves through their values, never overshooting a value. Default `false`.
`areaOpacity`| Opacity of an `area` fill, from 0 to 1; the outline and dots keep full opacity. Default `1`.
`areaBorderColor`| Colour of a 1px outline around each area, and around each run of an area split at a gap: any CSS colour or `{ light, dark }`. A stack draws a boundary two areas share once.
`legendContainer`| Element that holds the legend, in place of the chart container; `setLegendContainer()` moves the legend later. The legend takes its [spacing variables](#spacing-the-chart) from this element and its ancestors.
`onPlotAreaChange`| Optional function called with the plot area, `{ left, top, width, height }` in px from the inside of the border of `element`, whenever the chart writes the `--lovely-chart-plot-area-*` variables: on its first paint and at each change their row under "CSS variables" lists. It is also called as a zoom in or out starts to move the plot, once the data `onZoom` returns arrives, since a zoom moves the labels `getLabelX()` maps under an area it can leave as it is, and with `undefined` as `destroy()` removes the variables.

#### Colours

Every colour parameter, `datasets[*].color`, `colors`, `comparison.color`, `axisTextColor`, `backgroundColor`, `areaBorderColor`, `referenceLines[*].color`, `hatchedRanges[*].color` and `eventLines[*].color`, takes a CSS colour for both skins, or `{ light, dark }`, one for each. Each also takes `#RRGGBB/alpha`, a hex colour at an opacity.

A colour can be a `var()` of a custom property of the page, alone or inside a colour function such as `color-mix()`. The chart computes it on a hidden element of its own inside `element`, so it reads the custom properties of `element` and its ancestors, and the chart's skin variables such as `--text-color`, and any colour they hold works: hex, `rgb()`, `color-mix()`, `oklch()` and the rest. It reads them when it is built, on `update()` and on a zoom, and again on each change of the `class` of `<html>`, where the `theme-dark` class switches the skin, and, with `colorScheme: 'system'`, of `prefers-color-scheme`. It then repaints in place, keeping its zoom, range, legend filter and selection. `refreshColors()` reads them again for custom properties that the page changes on another trigger, such as a `data-theme` attribute.

The plot, the minimap, the legend buttons, `--lovely-chart-series-color` and the tooltip swatches take the colour of the skin on screen.

```js
const chart = new LovelyChart(element, {
  type: 'line',
  labels,
  datasets: [
    { name: 'Revenue', color: 'var(--color-accent)', values: revenue },
    { name: 'Refunds', color: { light: '#E65850', dark: '#F07068' }, values: refunds },
  ],
  axisTextColor: 'var(--color-text-muted)',
  backgroundColor: 'var(--color-surface)',
});

// The page's tokens follow a `data-theme` attribute, which the chart does not watch
document.documentElement.dataset.theme = 'dark';
chart.refreshColors();
```

#### Default colours

The package exports the colours a chart gives the datasets with no `color`, for elements of the page that show the same series, such as a table beside the chart:

Export | Description |
---------|----|
`DEFAULT_COLORS`| The eight default colours in order, as a frozen array: `#3497ED`, `#2373DB`, `#9ED448`, `#5FB641`, `#F5BD25`, `#F79E39`, `#E65850` and `#5D5CDC`.
`getDefaultColors(datasetCount)`| The default colours of a chart of `datasetCount` datasets, one per dataset, in a new array. The chart gives them in order to the datasets with no `color`, so where none has one, the dataset at index `i` takes the colour at `i`. Fewer than eight datasets take a subset of `DEFAULT_COLORS` whose hues stand apart, as `#3497ED` and `#9ED448` for two; more take `DEFAULT_COLORS` again from the first.
`DEFAULT_COMPARISON_COLOR`| The colour of the `comparison` line when it sets none, `#6B7280`.

```js
import { getDefaultColors } from 'lovely-chart';

// The colours a chart of these providers gives them, for a table beside it
const colors = getDefaultColors(providers.length);
const providerColors = Object.fromEntries(providers.map((name, i) => [name, colors[i]]));
```

#### Reference and comparison parameters

Parameter | Description |
---------|----|
`referenceLines`| Dashed rules at fixed values of the main Y axis: `[{ value, label?, color? }]`. The Y range always reaches each value, stacked charts included, so a line with `color: 'transparent'` draws nothing and only pins the range. `label` is drawn above the right end of the line, none when empty. `color` is any CSS colour or `{ light, dark }`, and defaults to the Y-axis text colour. `label` reads in the direction of the page, so on a right-to-left page a sign before a number moves after it; a number wrapped in U+2066 and U+2069, as `'\u2066-1.2K\u2069'`, keeps its sign first. On a percentage chart `value` is a percentage from 0 to 100 and the range stays 0–100%. Ignored on pie and donut charts.
`hatchedRanges`| Runs of labels whose values are estimated, partial, still accruing or forecast, hatched across the plot and the minimap: `[{ from, to, label?, color?, hasEdge?, isAccruing?, note?, titleNote? }]`, `from` and `to` inclusive label indexes, rounded and clamped to the labels. A `bar` or `step` chart hatches the columns of the range. A `line` or `area` chart starts the hatch at the point before the range, as the segment into an estimated value is estimated too, or halfway from it with `isAccruing`, for a period still filling, and ends it halfway to the label after the range. The hatch goes under the lines of a `line` or `step` chart and over the fills of a `bar` or `area` chart, under the comparison line, the mask over unfocused bars and the reference lines; ranges of one colour that touch hatch as one band. Each range keeps its own label and edge: `label` is drawn at the bottom left of the range's hatch, in the axis font size, clear of the Y-axis labels and of the next label, and dropped where it has no room. `hasEdge` draws a dashed rule where the range's hatch starts, none at the first label. `color` is any CSS colour or `{ light, dark }` for the hatch, the edge and the label, and defaults to the Y-axis text colour. `note` and `titleNote` are notes of the tooltip at each label of the range, under the rows and beside the title, as `resolveTooltipNotes` gives them. The minimap draws the hatch alone, and a sparkline the hatch and the edges. Ignored on pie and donut charts, a zoom into shares included; the data `onZoom` returns sets ranges of its own.
`eventLines`| Dashed vertical rules at moments of the labels, such as a launch or a change in how the data is collected: `[{ labelIndex, offset?, label?, color? }]`, `labelIndex` rounded, and a rule outside the labels dropped. `offset`, clamped to 0–1, places the rule that fraction through the label's interval, as `getLabelX()` maps it: from its point to the next one on a `line` or `area` chart, where `0`, the default, is the point, and across its column on a `bar` or `step` chart, or one with bars or steps among its datasets, where `0` is its start and `0.5`, the default, its centre. The last point of a `line` or `area` chart has no next one and keeps its rule at the point. Each rule runs from the bottom of the Y range through the room above it, over the datasets, the hatches and the comparison line and under the reference lines and the axis labels, and follows the range and the zoom. `label` reads bottom to top from the top of its rule, in the axis font size: before the rule, or after it where it would cover the Y-axis labels, those of an `isYAxisOutward` column included, or leave the plot area. It is dropped where it fits on neither side or runs longer than its rule, and where the label of a later rule crowds it. `color` is any CSS colour or `{ light, dark }` for the rule and the label, and defaults to the Y-axis text colour. A sparkline draws the rules without their labels, and the minimap draws none. Ignored on pie and donut charts, a zoom into shares included; the data `onZoom` returns sets rules of its own.
`comparison`| A previous period, drawn as a dashed line: `{ name, color?, values }`. `values` holds the previous values per dataset, in the order of `datasets`, each aligned with `labels`; the line draws their sum over the datasets on screen, and a `null` leaves a gap. `color` takes any of the forms under [Colours](#colours), `DEFAULT_COMPARISON_COLOR`, `#6B7280`, by default. The legend names it beside a dashed swatch, and the tooltip lists it first with the change of the current total in percent. Ignored on percentage, pie and donut charts.

#### Tooltip parameters

The tooltip lists each dataset on screen with a non-zero value at the label: a swatch of its colour, its name and its value in the text colour, from the largest value down. The swatch of a dashed or dotted line is a dashed or dotted outline. A `comparison` row comes first, beside a dashed swatch of its colour, in `--tooltip-muted-text-color` with its value in the normal weight, and set apart from the rest by a rule in `--tooltip-separator-color`. Its change is bold and tinted by `--tooltip-change-positive` or `--tooltip-change-negative`, unless it rounds to 0%, which keeps the colour and weight of its value. Stacked and percentage `bar`, `step` and `area` charts add a Total row. Notes of `hatchedRanges` and `resolveTooltipNotes` stand beside the title and under the rows, in `--tooltip-muted-text-color`. A pie or donut lists the sector under the pointer alone.

Parameter | Description |
---------|----|
`isTooltipOrderFixed`| `true` to list the tooltip rows in the order of the legend, after the `comparison` row. When more than 12 rows would show, the largest values still decide which ones do. Default `false`.
`isTooltipTotalInTitle`| `true` to put the total of a stacked or percentage `bar`, `step` or `area` chart beside the tooltip title, in place of the Total row. Default `false`.
`formatTooltipValue`| Optional function formatting a number of the tooltip; `valuePrefix` and `valueSuffix` still wrap the result. It formats the total on the `secondaryYAxis` scale too, which the `prefix` and `suffix` of that scale wrap instead.
`resolveTooltipTotal`| Optional function `(labelValue, datasetIndexes, labelIndex) => number \| null \| undefined` giving the total of a stacked chart's tooltip, for the label's value (its timestamp, or the index of a text label), the indexes of the datasets on screen and the label's index in `labels`. `undefined` keeps the sum of the rows, `null` shows `—`. The comparison change and the total on the `secondaryYAxis` scale read this total too.
`resolveTooltipNotes`| Optional function `(labelValue, datasetIndexes, labelIndex) => { titleNote?, notes? } \| undefined` giving the notes of the tooltip at a label, for its value and the indexes of the datasets on screen, as `resolveTooltipTotal` takes them, and its index. `titleNote` stands after the date, before the total of `isTooltipTotalInTitle`. `notes` are lines below the rows, under a rule in `--tooltip-separator-color`, as wide as the rows and wrapped to them. The notes of the `hatchedRanges` that hold the label come first, in their order, then these; each note splits into lines at `\n`, a line shown already is left out, and the text shows as it is, never as HTML. This `titleNote` wins over those of the ranges, of which the first one wins. The notes change with the rows, for a pointer, a touch or `selectLabel()`. Ignored on pie and donut charts.
`onSelectedIndexChange`| Optional function called when the selected label changes, by pointer, touch, keyboard or `selectLabel()`, with its index, not its value, and with `undefined` once nothing is selected: the pointer leaves the chart, `selectLabel(undefined)`, `update()` unless it keeps the selection, a resize, or the selected label leaving the visible range.
`isKeyboardSelectable`| `true` to make the plot focusable, in the tab order of the page. Arrow Left and Arrow Right then step the selection to the previous or the next label, and Home and End to the first or the last label of the visible range, as `selectLabel()` does; with nothing selected, an arrow selects the last label. A key pressed with Alt, Ctrl or Meta stays the browser's. The plot keeps the focus through `update()` and a resize, which rebuild it. Ignored on pie and donut charts, and the pie or donut a zoom opens leaves the tab order while it shows. Default `false`.
`onTooltipChange`| Optional function called when what the tooltip shows changes, as another label is selected or a dataset is shown or hidden, with `{ labelIndex, title, rows, total?, comparison? }`, after `onSelectedIndexChange`, and with `undefined` once it shows nothing, as when nothing is selected. `title` is the title of the tooltip. `rows` holds each dataset on screen, in the order of `datasets`, as `{ datasetIndex, name, value }`, its value at the label, zero included and `null` for a gap. `total` comes with a stacked or percentage `bar`, `step` or `area` chart, as its Total row or title shows it: what `resolveTooltipTotal` gives, or else the sum of the rows. `comparison` comes with a `comparison`, as `{ name, value, change? }`: the previous value at the label and the change of the total against it in percent, unrounded, where the tooltip shows one. A pie or donut reports none. It goes on reporting with the balloon hidden by `--lovely-chart-balloon-display`, for a readout of the page.
`onHiddenSeriesChange`| Optional function called when the reader shows or hides a dataset in the legend, with the names and the indexes of the hidden datasets. The datasets the data starts hidden by `isInitiallyHidden` go unreported, on creation and on `update()`; `update()` with `shouldKeepFilter` reports the hidden datasets when they differ from those before.

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

A forecast after the actuals, hatched from the last actual day, labelled inside the band and noted under the tooltip rows:

```js
new LovelyChart(element, {
  type: 'line',
  labels,
  datasets: [{ name: 'Orders', color: '#3497ED', values: [...actuals, ...forecast] }],
  hatchedRanges: [{
    from: actuals.length,
    to: actuals.length + forecast.length - 1,
    label: 'Forecast',
    hasEdge: true,
    color: { light: '#108BE3', dark: '#48AAF0' },
    note: 'Forecast',
  }],
});
```

Moments marked on daily bars, a launch at the start of its day's column and an outage in the middle of its day:

```js
new LovelyChart(element, {
  type: 'bar',
  labels,
  datasets: [{ name: 'Signups', color: '#5FB641', values: signups }],
  eventLines: [
    { labelIndex: launchIndex, offset: 0, label: 'Launch' },
    { labelIndex: outageIndex, label: 'Outage', color: { light: '#E65850', dark: '#F07068' } },
  ],
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
// New data keeps the datasets the reader hid, the window and the zoom, and the selected label
chart.update(nextParams, { shouldKeepFilter: true, shouldKeepZoom: true, shouldKeepSelection: true });
// Data of another period cross-fades in
chart.update(otherParams, { isAnimated: true });
```

A readout of the page in place of the balloon on a phone, its selection stepped by the arrow keys too:

```js
const element = document.querySelector('.chart');
new LovelyChart(element, {
  type: 'bar',
  isStacked: true,
  labels,
  datasets,
  isKeyboardSelectable: true,
  onTooltipChange: (tooltip) => {
    readout.textContent = tooltip ? `${tooltip.title}: ${tooltip.total}` : '';
  },
});
```

```css
@media (max-width: 40rem) {
  .chart {
    --lovely-chart-balloon-display: none;
  }
}
```

#### CSS variables

Variable | Description |
---------|----|
`--lovely-chart-plot-height`| Plot canvas height, read from the chart element or an ancestor, ahead of `plotHeight`: a unitless number of px, `px` or `rem`.
`--lovely-chart-header-height`| Height of the header band, and line height of its title and caption, read from the chart element or an ancestor. Default `30px`.
`--lovely-chart-header-margin-top`| Space above the header band, read from the chart element or an ancestor. Default `0`.
`--lovely-chart-plot-margin-top`| Space between the header band and the plot canvas, read from the chart element or an ancestor. Default `10px`; a sparkline has none. The hover line and dots of the tooltip follow the plot canvas when these variables or a style of the page move it by resizing the chart's layout or its header, as a folded header.
`--lovely-chart-series-color`| Set by the chart on each legend button, on the comparison legend entry and on each tooltip swatch: the colour of its dataset or line in the skin on screen, as `rgba()`. A legend button takes its outline, its label and its checked fill from it.
`--lovely-chart-inset`| Side inset of the header, the minimap and the legend. Default `10px`. The minimap canvas takes the width it leaves. The plot keeps its own 10px gutter, so another inset moves the header, the minimap and the legend off the line of its Y-axis labels and grid.
`--lovely-chart-minimap-margin-bottom`| Space under the minimap, above the legend when the chart holds it. Default `16px`.
`--lovely-chart-legend-gap`| Space between the legend entries, as the CSS `gap`: one length, or a row gap and a column gap. Default `8px 6px`.
`--lovely-chart-legend-padding-bottom`| Space under the last row of the legend. Default `24px`; `0` ends the chart at the legend.
`--lovely-chart-button-padding`| Padding on every side of a legend button, one length, which also places its check mark. The comparison entry takes it above and below its name. Default `7px`.
`--lovely-chart-button-radius`| Corner radius of a legend button. Default `18px`.
`--lovely-chart-button-font-size`| Font size of the legend buttons and the comparison entry. Defaults to the font size around them, the chart's 13px.
`--background-color`, `--text-color`, `--grid-lines`, `--tooltip-background` and the other variables on `.lovely-chart--container`| The colours of the day and the night skin. Night colours of your own go under `html.theme-dark .lovely-chart--container:not(.lovely-chart--container-scheme-system)` for the default `colorScheme`, and under `.lovely-chart--container-scheme-system` inside `@media (prefers-color-scheme: dark)` for `'system'`, so neither reaches a chart of the other scheme.
`--tooltip-change-positive`, `--tooltip-change-negative`| Colours of a rise and a fall of the `comparison` change in the tooltip.
`--tooltip-muted-text-color`| Colour of the `comparison` row and the notes of the tooltip. Defaults to a mix of 70% `--text-color` and 30% `--tooltip-background`, which follows a skin of your own and reaches a contrast of 4.5:1 on the tooltip background in the day and the night skin. A colour of your own goes per skin, as the colours above.
`--tooltip-separator-color`| Colour of the rule under the `comparison` row of the tooltip and of the rule over its notes. Defaults to `--grid-lines`.
`--tooltip-border`| Border of the tooltip balloon, as `1px solid #D2D5D7`. Default `none`.
`--lovely-chart-balloon-z-index`| The `z-index` of the tooltip balloon, read from the chart element or an ancestor. Default `auto`, so an overlay added after the chart paints over the balloon. A value above the `z-index` of such an overlay places the overlay between the hover line and the balloon: see [Placing elements over the plot](#placing-elements-over-the-plot).
`--lovely-chart-balloon-display`| The `display` of the tooltip balloon, read from the chart element or an ancestor: `block` by default. `none` hides the balloon alone and keeps the rest of a selection, the hover line and dots, the focus of a bar and the calls of `onSelectedIndexChange` and `onTooltipChange`, so a media query can swap the balloon for a readout of the page. A touch screen zooms by a tap on the balloon, so there `none` takes that zoom away too.
`--lovely-chart-plot-area-left`, `--lovely-chart-plot-area-top`, `--lovely-chart-plot-area-width`, `--lovely-chart-plot-area-height`| Set by the chart on `element`, as px lengths from the inside of its border: the data area of the plot, where a window over every label and the Y range draw. It runs from the start of the plot, after an `isYAxisOutward` column, to its end, and from the top of the Y range to the X-axis baseline. A pie or donut sets the square around its circle, and a sparkline its plot inset by 2px. The chart sets them from its first paint, the frame after it is created, and rewrites them when the area changes: on `update()`, a resize or an orientation change, a zoom into data of another label column or into a pie, when a web font of the page changes the axis font, and when a style of the page moves the plot by resizing the chart's layout or its header, as a header folded while its caption is empty. `destroy()` removes them.
`--lovely-chart-plot-padding-top`| Set by the chart on `element` beside the `--lovely-chart-plot-area-*` variables, and removed with them: the room in the plot above the top of the Y range, `15px`, or `2px` on a sparkline, for marks that rise above the data.

#### Styling the tooltip

The tooltip keeps these classes from release to release, for the rules of a page; its other classes are internal. Its text takes `--text-color`, and its background, the `comparison` row and the notes, the rules under that row and over the notes, the tones of the change and the border of the balloon take the `--tooltip-*` variables above.

Class | Element |
---------|----|
`.lovely-chart--tooltip-balloon`| The balloon: its shadow, padding and radius. A night rule of your own under `html.theme-dark .lovely-chart--tooltip-balloon` is as specific as the library's.
`.lovely-chart--tooltip-title`| The title: the date or the label, and at its far end the total of `isTooltipTotalInTitle`.
`.lovely-chart--tooltip-title-total`| The total beside the title, with `isTooltipTotalInTitle`.
`.lovely-chart--tooltip-title-note`| The `titleNote` of `resolveTooltipNotes` or `hatchedRanges`, inside the first `<span>` of the title after the date, in `--tooltip-muted-text-color`.
`.lovely-chart--tooltip-dataset`| A row: a swatch, a name and a value. The `comparison` row is a row too, and the Total row and the `secondaryYAxis` row are rows with a name and a value but no swatch.
`.lovely-chart--tooltip-dataset-value`| The value at the end of a row, in bold tabular figures; that of the `comparison` row is in the normal weight.
`.lovely-chart--tooltip-dataset-comparison`| The `comparison` row, in `--tooltip-muted-text-color` above a rule in `--tooltip-separator-color`.
`.lovely-chart--tooltip-swatch`| The swatch of a row, in `--lovely-chart-series-color`, the colour of its dataset or line. With `data-dashed` or `data-dotted` it is a dashed or dotted outline.
`.lovely-chart--tooltip-change[data-tone]`| The change of the `comparison` row, inside its value. `data-tone` is `positive` or `negative` for a rise or a fall, bold in `--tooltip-change-positive` or `--tooltip-change-negative`, and `neutral` for a change that rounds to 0%, which keeps the colour and weight of its value.
`.lovely-chart--tooltip-notes`| The notes under the rows, the last child of the balloon, with a `<div>` per line, in `--tooltip-muted-text-color` under a rule in `--tooltip-separator-color`. Hidden while empty.

#### Spacing the chart

The spacing variables, `--lovely-chart-inset` to `--lovely-chart-button-font-size`, apply from `element`, any ancestor of it or `.lovely-chart--container`, so one rule can space every chart on a page. A legend in `legendContainer` takes them from that element and its ancestors. The chart sizes the minimap canvas to `--lovely-chart-inset` as it lays out: when it is built, on `update()`, a resize or an orientation change.

```css
/* A card whose own padding insets the chart, which ends at the last row of a legend of small pills */
.card {
  padding: 16px;
  --lovely-chart-inset: 0;
  --lovely-chart-legend-padding-bottom: 0;
  --lovely-chart-button-padding: 4px;
  --lovely-chart-button-radius: 8px;
  --lovely-chart-button-font-size: 12px;
}
```

#### Placing elements over the plot

An element positioned by the `--lovely-chart-plot-area-*` variables inside `element`, such as a marker, a badge or an empty-state message, covers the data area without repeating the chart's paddings, and follows it through updates, resizes and zooms:

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

The chart keeps its place among the children of `element` through updates and resizes, so an overlay added after it paints over the plot and the tooltip balloon, and one inserted before it paints under them. A band over a run of labels needs no element: `hatchedRanges` draws it with the data, as `eventLines` draws a rule at a moment with its label.

An overlay added after the chart can sit over the hover line and under the balloon instead, as a label with a tip the pointer can reach: give it a `z-index`, and the balloon a higher one through `--lovely-chart-balloon-z-index` on `element`. `isolation: isolate` keeps both values inside `element`, away from the z-indexes of the rest of the page.

```css
.chart {
  --lovely-chart-balloon-z-index: 2;
  isolation: isolate;
}

.chart-overlay {
  z-index: 1;
}
```

An element at a label, such as a marker or an annotation, takes its x from `getLabelX()` whenever `onPlotAreaChange` or `onZoomChange` fires, and hides where the label has no x: outside the visible range, and from the start of a zoom into shares. The data `onZoom` returns brings labels of its own once the zoom settles, as `onZoomChange` reports, so a marker at a label of the overview hides from then until the zoom out settles. A pan of the minimap moves the labels with no call, as the area holds still.

```css
.chart-marker {
  position: absolute;
  /* Rises over the data into the room above the Y range */
  top: calc(var(--lovely-chart-plot-area-top) - var(--lovely-chart-plot-padding-top));
  height: calc(var(--lovely-chart-plot-area-height) + var(--lovely-chart-plot-padding-top));
  border-left: 1px dashed currentColor;
  pointer-events: none;
}
```

```js
const marker = document.createElement('div');
marker.className = 'chart-marker';
marker.hidden = true;
element.appendChild(marker);

let plotArea;
let isZoomedIn = false;
const placeMarker = () => {
  const x = plotArea && !isZoomedIn ? chart.getLabelX(markerIndex) : undefined;
  marker.hidden = x === undefined;
  if (x !== undefined) {
    marker.style.left = `${plotArea.left + x}px`;
  }
};

const chart = new LovelyChart(element, {
  ...params,
  onPlotAreaChange: (area) => {
    plotArea = area;
    placeMarker();
  },
  onZoomChange: (labelValue) => {
    isZoomedIn = labelValue !== undefined;
    placeMarker();
  },
});
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and [CHANGELOG.md](CHANGELOG.md) for release notes.
