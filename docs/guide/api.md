# API reference

Everything the package exports: the `LovelyChart` class with every option of a chart and every method, the default colours and the TypeScript types. The stylesheet has a reference of its own, [CSS variables and classes](css.md).

```ts
import LovelyChart, {
  DEFAULT_COLORS,
  DEFAULT_COMPARISON_COLOR,
  getDefaultColors,
  type LovelyChartParams,
} from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';
```

## Constructor

```ts
new LovelyChart(element: HTMLElement, data: LovelyChartParams)
```

Builds a chart in `element` and paints it on the next frame. The chart takes the whole width of `element`, and builds again at its new width when the width of the window changes: see [Width](layout.md#width).

Argument | Type | Description |
---------|----|----|
`element`| `HTMLElement` | DOM node in which the chart is rendered, taking its whole width. The chart sets the `--lovely-chart-plot-area-*` and `--lovely-chart-plot-padding-top` CSS variables on it; of several charts in one element, they describe the one that wrote them last. While it holds a chart, the chart's stylesheet makes it a stacking context: see [Placing elements over the plot](overlays.md).
`data`| [`LovelyChartParams`](#chart-options) | Parameters for a chart.

## Chart options

Every parameter of the `data` object that `new LovelyChart(element, data)` and `update(newData)` take: the `LovelyChartParams` type. Only `type`, `labels` and `datasets` are required; every other parameter is optional, and a boolean one is `false` unless it says otherwise.

```ts
import LovelyChart, { type LovelyChartParams } from 'lovely-chart';

const params: LovelyChartParams = {
  type: 'line',
  labels: [1735689600000, 1735776000000, 1735862400000],
  datasets: [{ name: 'Visitors', values: [1274, 1305, 1342] }],
};

new LovelyChart(element, params);
```

The types the tables name, such as `ThemedColor` and `HatchedRange`, are exported by the package and listed under [Types](#types).

### Chart data

The kind of chart, its labels and its datasets. See [Data format](data.md) and [Chart types](chart-types.md) for a walk-through.

Parameter |  Type | Description |
---------|----|----|
`type`| `ChartType` | Chart type. Supported types: `line`, `area`, `bar`, `step`, `pie`, `donut`
`labels`| `(number \| string)[]` | Array of UNIX timestamps in milliseconds, or arbitrary strings for text labels. A `pie` or `donut` of one total per dataset takes a single text label, as `labels: ['Total']`, each dataset's `values` holding its total: a text label shows no caption of dates, so the header holds the `title` alone, or folds with none.
`datasets`| `LovelyChartDatasetParams[]` | Array of params for each dataset
`datasets[*].name`| `string` | Dataset name
`datasets[*].values`| `(number \| null)[]` | Array of dataset values; `null` leaves a gap
`datasets[*].color`| `ThemedColor` | Dataset colour, in any of the forms under [Colours](#colours). The datasets with none take the [default colours](#default-colours) in order.
`datasets[*].type`| `'line' \| 'bar' \| 'step'` | `line`, `bar` or `step` to draw the dataset as another type than the chart's `type`, as a line over bars; ignored on percentage, pie and donut charts. Lines and steps draw over bars and areas, whatever the order of `datasets`, and the hatch of `hatchedRanges` goes between them. A chart with a `bar` or `step` dataset gives every label a column, its lines running through the middles, and on hover masks the columns around the focused one, with a dot on each line. Bars that share the main Y axis with another type keep 0 on it, whichever side of it their values are. A dataset of another type than the chart's draws its own values: it stays out of a stacked chart's stack, the tooltip's total, the `comparison` and the shares of a zoom into a label. Defaults to the chart's `type`.
`datasets[*].isInitiallyHidden`| `boolean` | `true` to start the dataset hidden, its legend button unchecked. Default `false`.
`datasets[*].isDashed`| `boolean` | `true` to draw a `line` or `step` dataset in 6px dashes 4px apart. Its legend button gets a dashed outline and a `data-dashed` attribute, and its tooltip swatch a dashed outline. Other types ignore it, legend included. Default `false`.
`datasets[*].isDotted`| `boolean` | `true` to draw a `line` or `step` dataset in 2px dots 3px apart, whether or not it is `isDashed`. Its legend button gets a dotted outline and a `data-dotted` attribute, and its tooltip swatch a dotted outline. Other types ignore it, legend included. Default `false`.
`isStacked`| `boolean` | `true` for values stacking on top of each other
`isPercentage`| `boolean` | `true` for percentage based values
`percentPrecision`| `number` | Digits after the point of the share a percentage chart's tooltip prints beside each value. Default `0`.

### Labels and dates

How the X axis, the header caption and the tooltip title read the labels. See [Dates, time zones and locales](dates.md).

Parameter |  Type | Description |
---------|----|----|
`labelType`| `LabelType` | Optional X-axis label kind: `year`, `month`, `week`, `day`, `hour`, `5min`, `dayHour` or `text`. When omitted, it is inferred from the first two `labels` records: strings → `text`, timestamps → `year`/`month`/`week`/`day`/`hour`/`5min` depending on the step between them. `year` labels render as `2026`, `month` as `January`, `week` as `Week 1`, the ISO 8601 week number of the label's UTC date, so labels on 29 Dec 2025 and 28 Dec 2026 read `Week 1` and `Week 53`. Charts with `text` labels show no header caption.
`labelFormatter`| `string` | Optional format of the X-axis labels of timestamps, over the one `labelType` gives: `statsFormatYear` (`2026`), `statsFormatMonth` (`January`), `statsFormatWeek` (`Week 1`), `statsFormat('day')` (`18 Nov`), `statsFormat('hour')` or `statsFormat('5min')` (`14:00`), or `statsFormatDayHour` (`18 Nov 14:00`). The tooltip title takes it too unless `tooltipFormatter` sets one, while the header caption keeps the granularity of `labelType`. The day, hour and day-hour formats follow the reader's time zone unless `isUtc` is set, while the year, month and week formats read UTC: with `isUtc: true` for labels at UTC midnight, `statsFormat('day')` labels weekly data by the date each week starts on, as `14 Sep` in place of `Week 38`, which a reader west of UTC would otherwise see as the day before. Defaults to the format of `labelType`.
`tooltipFormatter`| `string` | Optional tooltip title format: `statsTooltipFormat('day')` (`18 Nov 2026`), `statsTooltipFormat('week')` (`Week of 16 Nov`), `statsTooltipFormat('hour')` or `statsTooltipFormat('5min')` (`14:00`), `statsFormatDayHourFull` (`18 Nov 14:00`). Defaults to the X-axis label.
`isUtc`| `boolean` | `true` to read every date and time of the labels in UTC. Axis labels of days, hours and minutes and their tooltip titles otherwise follow the reader's time zone, while captions and day titles always read UTC. Default `false`.
`dateLocale`| `DateLocale` | Optional localized date strings for axis, tooltip and caption labels: `{ months, monthsFull, weekDays, weekDaysShort, weekOf }`. Each array field is optional (12 months, or 7 weekdays starting Sunday) and falls back to English when omitted. `weekOf` is the words before the start date in a week title, `Week of` by default. The X-axis labels, text ones included, the header caption and the tooltip title read in the direction of their first letter, whatever the direction of the page: English dates left to right and dates in Hebrew or Arabic words right to left. Without a letter, as in the caption `2022 — 2026` of a year chart, they read left to right, the way the X axis runs.

### Values and axes

How the values read and where the Y axes stand. See [Axes and values](axes.md).

Parameter |  Type | Description |
---------|----|----|
`valuePrefix`| `string` | Optional string prepended to every formatted value (e.g. `$`)
`valueSuffix`| `string` | Optional string appended to every formatted value
`isCurrencyPrefix`| `boolean` | When `true`, a negative value is rendered with the minus sign in front of `valuePrefix` (`-$9.1` instead of `$-9.1`), and a negative label or tooltip total of `secondaryYAxis` with it in front of that scale's `prefix`. Use with currency-like prefixes. Default `false`.
`hasSecondYAxis`| `boolean` | `true` to put the last dataset on a Y axis of its own, labelled at the right of the plot in the dataset's colour. The main Y axis is labelled in the colour of the first dataset, apart from a stacked or percentage chart's, whose labels keep the axis text colour. The last dataset stays out of the main Y axis, the tooltip's total and, on a stacked chart, the stack, beside which it draws its own values; a percentage chart's tooltip prints no share on its row.
`secondaryYAxis`| `SecondaryYAxisConfig` | Optional scale of the main Y axis in another unit: `{ label, multiplier, prefix?, suffix? }`. Each main Y-axis label times `multiplier`, between `prefix` and `suffix`, stands at the right of the plot, apart from a percentage chart's. The tooltip adds a row of `label` and its total times `multiplier`, formatted as the dataset values are, by `formatTooltipValue` when given, between `prefix` and `suffix`: under the Total row of a stacked or percentage `bar`, `step` or `area` chart, and under the dataset rows of any other chart or one with `isTooltipTotalInTitle`.
`noFloatSteps`| `boolean` | `true` to step the main and the second Y axis in whole numbers, 1 at the finest, for counts: a range of 0 to 2 labels 0, 1 and 2. Default `false`.
`isYAxisOutward`| `boolean` | `true` to put the main Y-axis labels in a column left of the plot, right-aligned, so the data never runs under them; the second Y axis keeps its labels inside the plot. The column fits the widest label the chart can show for its data in the axis font, `axisFontSize` included: over the whole value range of every dataset, hidden ones too, the reference lines and the previous period, below 0 as well, and at every step a window can take, down to a window of a single label. That can make it wider than any label a reader brings up at the narrowest window the minimap selects. It is measured once per data set, when the chart is built, on `update()` and on a zoom into or out of a day, so the plot holds still while the reader pans, animates or hides datasets, and again when a web font of the page changes the axis font, so the column fits a font that arrives after the chart: once the font finishes loading, or on the next frame the chart draws after the page adds a `FontFace` already loaded, which fires no event; the data `onZoom` returns sets `isYAxisOutward` of its own. A sparkline has no axes and no column. Default `false`.
`areLabelsContrast`| `boolean` | `true` to center each Y-axis label on its grid line, over the line, inside a halo of the background colour, 2px in from its side of the chart so the grid line still shows at the plot edge. Default `false`.
`axisFontSize`| `number` | Font size of the axis labels in px, which take the family and the regular weight of the chart's text: see `--lovely-chart-font-family` and `--lovely-chart-font-weight`. Default `10`.
`axisTextColor`| `ThemedColor` | Colour of the axis labels, in any of the forms under [Colours](#colours).

### Header and layout

The parts of the chart around the plot and its size. See [Layout, sizing and fonts](layout.md).

Parameter |  Type | Description |
---------|----|----|
`title`| `string` | Chart headline
`ariaLabel`| `string` | Accessible name of the plot, which takes `role="img"`. The chart element takes no role, so the legend buttons stay exposed to assistive technology. Defaults to an English summary of the data the plot shows: its type, the span of its labels and the names of its datasets, as `Line chart, 1 Nov 2025 — 5 Nov 2025: Desktop, Mobile`. Date labels span as the header caption names a range, in `dateLocale`, and text labels from the first to the last, as `Bar chart, Mon — Sun: Orders`. A zoom in or out and `update()` name the plot from the data they bring, as `Pie chart, …` for a zoom into the shares of a label, while a given `ariaLabel` stays across a zoom. An empty string leaves the plot out of the accessibility tree with `aria-hidden`, as for a sparkline whose row names it already.
`plotHeight`| `number` | Height of the plot canvas in px. Default `320`. A `--lovely-chart-plot-height` custom property on the chart element or an ancestor takes precedence (a unitless number, `px` or `rem`), so a media query can set it.
`noHeader`| `boolean` | `true` to leave out the band of the title and the caption, so the plot starts at the top of the chart, axes and legend kept. While zoomed, the zoom-out control floats over the top inline-start corner of the plot, as it does from a header with nothing to show (see `--lovely-chart-empty-header-height`), on a backdrop of `--background-color` that covers the top label of the main Y axis; `noZoomOutControl` leaves it out. Default `false`.
`noCaption`| `boolean` | `true` to leave out the caption of the header, the dates on screen, also while zoomed: the data `onZoom` returns needs no `noCaption` of its own. With no `title`, the header has nothing to show and folds to `--lovely-chart-empty-header-height`. Default `false`.
`isSparkline`| `boolean` | `true` to draw the datasets alone, inset by 2px: no axes, grid, header or legend. The bottom of the Y range stays unrounded to an axis step and follows the zero baseline of every chart: 0, unless the values go below 0 or their lowest is more than three quarters of their highest. Default `false`.
`isLoading`| `boolean` | `true` to show the chart as loading, for a page that fetches its data. The chart element and its legend are `inert`: they take no pointer, focus or keyboard input and leave the accessibility tree. Data with labels dims on the plot, the minimap and the legend, as the data on screen does while the next data loads. Data with none, as `labels: []`, draws a skeleton of them in the chart's own geometry, so the chart its data builds takes the same place: a block over the data area of the plot, or the circle of a pie and the ring of a donut, the box of the minimap without its ruler, and a pill for each legend entry, sized by its name, so datasets with their names and empty `values` hold the place of the legend to come. The header keeps its title and the band of a caption of dates; for text labels and no `title`, `labelType: 'text'` folds it as the labels will. The skeleton takes `--skeleton-color`, and pulses unless the reader prefers reduced motion. `setLoading()` sets and clears it in place, keeping the zoom, the range, the hidden datasets and the selected label of the data on screen, and `update()` takes it from its params. Default `false`.
`onPlotAreaChange`| `(area: { left, top, width, height } \| undefined) => void` | Optional function called with the plot area, `{ left, top, width, height }` in px from the inside of the border of `element`, whenever the chart writes the `--lovely-chart-plot-area-*` variables: on its first paint and at each change their row under "CSS variables" lists, and with `undefined` as `destroy()` removes the variables. A pan or a zoom moves the labels under an area it leaves as it is, as `onRangeChange` reports.

### Legend

See [Legend](legend.md).

Parameter |  Type | Description |
---------|----|----|
`legendContainer`| `HTMLElement` | Element that holds the legend, in place of the chart container; `setLegendContainer()` moves the legend later. The legend takes its [spacing variables](css.md#spacing-the-chart) from this element and its ancestors. The legend takes its spacing along, so an element the page never shows, such as one with the `hidden` attribute or one left out of the document, drops the legend from the chart.
`onHiddenSeriesChange`| `(names: string[], datasetIndexes: number[]) => void` | Optional function called when the reader shows or hides a dataset in the legend, with the names and the indexes of the hidden datasets. The datasets the data starts hidden by `isInitiallyHidden` go unreported, on creation and on `update()`; `update()` with `shouldKeepFilter` reports the hidden datasets when they differ from those before.

### Style

See [Theming and colours](theming.md).

Parameter |  Type | Description |
---------|----|----|
`colorScheme`| `'htmlClassName' \| 'system'` | `'htmlClassName'` follows the `theme-dark` class on the `<html>` element; `'system'` follows the system's `prefers-color-scheme`, live. Default `'htmlClassName'`.
`backgroundColor`| `ThemedColor` | Colour of the surface behind the chart, in any of the forms under [Colours](#colours). The chart paints it inside the hover dots, in the mask over unfocused bars, as a ring around the heads of event lines and as a halo around the Y-axis labels and the labels of reference lines, hatched ranges and event lines. Defaults to the skin's own background; without it, of the Y-axis labels only `areLabelsContrast` ones get a halo.
`areLinesSmooth`| `boolean` | `true` to draw `line` datasets, and the `comparison` line beside them, as monotone curves through their values, never overshooting a value. Default `false`.
`areaOpacity`| `number` | Opacity of an `area` fill, from 0 to 1; the outline and dots keep full opacity. Default `1`.
`areaBorderColor`| `ThemedColor` | Colour of a 1px outline around each area, and around each run of an area split at a gap: any CSS colour or `{ light, dark }`. A stack draws a boundary two areas share once.
`withGradient`| `boolean` | `true` to shade each sector of a `pie` or `donut` chart, and of the pie or donut a zoom into shares opens, from 10% lighter at its inner edge, the centre of a pie, to 10% darker at its outer edge. Default `false`.

### Minimap and range

See [Minimap and ranges](minimap.md).

Parameter |  Type | Description |
---------|----|----|
`withMinimap`| `boolean` | `true` to render the minimap with the draggable range selector below the chart. A swipe down or up its window or one of the window's ears scrolls the page, a swipe across the window drags it, and one across an ear resizes it. Default `false`.
`minimapRange`| `[number, number] \| { from, to } \| 'full'` | Initially selected range: a `[begin, end]` tuple of fractions between 0 and 1 (e.g. `[0.8, 1]` for the last 20%), `{ from, to }`, inclusive label indexes (e.g. `{ from: 0, to: 6 }` for the first week of daily labels), or the `'full'` keyword for the entire range. `from` and `to` are rounded and clamped to the labels, as in `hatchedRanges`: a `bar` or `step` chart, or one with bars or steps among its datasets, selects the columns of the labels from `from` to `to`, a `pie` or `donut` sums those labels, and a `line` or `area` chart selects their points and half an interval past either end, within the axis, so the end points stay off the plot edges. A range of no labels, as one with `from` after `to`, takes the default. In the data `onZoom` returns, the indexes count its own labels. Defaults to `[0.8, 1]` when the minimap is shown, otherwise to `'full'`.
`limitDate`| `number` | Optional timestamp that locks the labels before it, as data the reader has no access to: the minimap covers them with a blurred mask, a dashed edge and a lock icon in `--minimap-limit-color`, and its window starts no earlier than the first label at or after `limitDate`, at its point or at the start of its column, wherever the reader drags it. A `minimapRange` that starts before that label starts there and keeps its width within the axis, so one that ends before it moves past the locked labels whole. Ignored without `withMinimap`, when `limitDate` falls at or before the first label, which locks none, and when it falls after the label before the last, which leaves the window only the last label.
`onLimitedRangeClick`| `() => void` | Optional function called when the reader clicks the mask of `limitDate`, as to offer the data it locks. Without it, the mask lets the pointer through.
`isRangeSelectable`| `boolean` | `true` to let a mouse select the visible range on the plot. A press on the plot and a drag across it draw a band in `--range-selection-color` over the Y range, from the press to the pointer, and the release opens a window on the labels under the band: those whose point, or the centre of whose column, it holds, set on them as `minimapRange` sets one, through the transition a drag of the minimap takes, which `onRangeChange` reports frame by frame. A `line` or `area` chart with no bars or steps among its datasets takes two points at least, so a band over one point or none leaves the range as it is, as does a band over no column centre. The minimap window follows the range, from the first label `limitDate` leaves open and no narrower than a drag of its ears leaves it, widened around its middle; a chart without the minimap takes the range alike. A double click on the plot shows the whole range again, on a chart that does not zoom in on a click, as the first click of the two zooms one that does. A press that moves less than 4px across the plot is a click, Escape ends a drag with no change, a release the page never hears, as a context menu takes it, ends the drag with no change, and the click that ends a drag zooms into nothing. A touch keeps selecting a label, and a double tap shows no range. `update()` with `shouldKeepZoom` keeps the range. Ignored on `pie` and `donut` charts, while zoomed and with `noTooltip`. Default `false`.
`onRangeChange`| `(range: { from, to } \| undefined) => void` | Optional function called after each frame that draws the labels at a new x, at most once a frame, with the labels of the visible range, `{ from, to }`, inclusive indexes in `labels`: those `getLabelX()` maps, which in the callback gives where that frame drew each, so an element a page places there moves with the canvas. It is called on the first paint, through each frame of a drag or a resize of the minimap window, of the transition to a range selected on the plot or shown whole by `isRangeSelectable`, and of the range transition of a zoom in or out, from the first frame of the data `onZoom` returns, whose labels it indexes then, and on the first paint after `update()`, a resize or an orientation change, even at the same labels; a chart that opens zoomed, by `initialZoom` or an `update()` that keeps the zoom, reports nothing of the overview it hides until the zoomed view shows. A frame that moves no label, as that of a hover, a selection, a legend toggle or a change of the skin, goes unreported. `from` and `to` mean what they mean in `minimapRange`, so passing the range back as `minimapRange` opens a window on the same labels, set on them as `minimapRange` sets one: on their columns, or on their points and half an interval past either end; with `limitDate`, such a window on a `line` or `area` chart from the first label it leaves open starts on that label, keeping its width, and so shows one label more at its end, unless it ends on the last label. Called with `undefined` once no labels are on screen: on the first paint of a `pie` or `donut` chart or of data with no labels, from the first frame of a zoom into shares until the zoom out draws the labels again, and as `destroy()` tears the chart down. A call to `update()` or `destroy()` from within it is safe, and as the first frame of `update()` reports its labels again, a callback that calls `update()` on every report rebuilds the chart on every frame.

### Zoom

See [Zoom and drill-down](zoom.md).

Parameter |  Type | Description |
---------|----|----|
`onZoom`| `(value: number) => Promise<LovelyChartParams \| undefined>` | Optional function which returns `Promise` with data for the zoomed chart (new `data` object). The zoomed data sets its own options, such as `areLinesSmooth`, `isYAxisOutward` and each dataset's `isDashed`, so it repeats those it shares with the chart; `axisTextColor`, `backgroundColor`, `colorScheme` and `ariaLabel` stay the chart's, and a chart that shows no caption, by `noCaption` or text labels, shows none while zoomed. Its datasets take their own colours, from `colors` or each dataset's `color`, on the plot, in the legend, the tooltip and the minimap; a dataset with neither keeps the colour of the chart's dataset at its place, and one past the chart's datasets takes a default colour. Data with another number of datasets than the chart shows in full, without the minimap.
`colors`| `Record<string, ThemedColor>` | In data that `onZoom` returns, the colours of its datasets by key, `y0` for the first, `y1` for the second and so on, over each dataset's `color`: `{ y0: '#3497ED', y1: '#9ED448' }`. The chart's own data ignores it.
`noZoom`| `boolean` | `true` to disable zooming. Default `false`.
`zoomType`| `'pie' \| 'donut'` | Chart type shown when a percentage chart is zoomed into a single label: `pie` or `donut`. Default `pie`.
`zoomToShares`| `boolean` | `true` to opt a non-percentage chart into zoom-to-shares, so clicking a label drills into a `zoomType` chart of that label's shares. Percentage charts do this implicitly; a stacked chart of absolute values needs the flag, since switching it to `isPercentage` would discard the values the overview exists to show. Ignored when `onZoom` is supplied. Default `false`.
`circleLabelsAround`| `number` | How many labels either side of the clicked one the zoomed pie/donut covers. Default `3`, which suits daily data; use `0` to drill into a single label.
`initialZoom`| `number \| 'last'` | Open the chart already zoomed on a point, with no overview shown and no transition morph: a label index, or `'last'` for the last point. Works for both shares (pie/donut) and custom `onZoom` charts. Zoom-out afterwards behaves normally. Ignored when the chart is not zoomable. Out-of-range indexes are clamped.
`onZoomChange`| `(labelValue: number \| undefined, labelIndex: number \| undefined) => void` | Optional function `(labelValue, labelIndex)` called once a zoom settles, with the value of the zoomed-in label (its timestamp, or the index of a text label) and its index in `labels`, and with `undefined` for both once zoomed out, also when `update()`, unless it keeps the zoom, a resize or an orientation change returns a zoomed chart to its overview.
`zoomOutLabel`| `string` | Text of the zoom-out control, in `--zoom-out-text` after a magnifier icon, which takes the place of the title while zoomed, or floats over the plot with `noHeader` or from a header with nothing to show. Default `Zoom out`.
`noZoomOutControl`| `boolean` | `true` to leave out the zoom-out control, for a page that zooms out with `zoomOut()` from a control of its own; while zoomed, the header keeps its title. Default `false`.

### Annotations

Lines, bands and a previous period drawn with the data. See [Annotations](annotations.md).

Parameter |  Type | Description |
---------|----|----|
`referenceLines`| `ReferenceLine[]` | Dashed rules at fixed values of the main Y axis: `[{ value, label?, color? }]`. The Y range always reaches each value, stacked charts included, so a line with `color: 'transparent'` draws nothing and only pins the range. `label` is drawn above the right end of the line, none when empty. `color` is any CSS colour or `{ light, dark }`, and defaults to the Y-axis text colour. `label` reads in the direction of the page, so on a right-to-left page a sign before a number moves after it; a number wrapped in U+2066 and U+2069, as `'\u2066-1.2K\u2069'`, keeps its sign first. On a percentage chart `value` is a percentage from 0 to 100 and the range stays 0–100%. Ignored on pie and donut charts.
`hatchedRanges`| `HatchedRange[]` | Runs of labels whose values are estimated, partial, still accruing or forecast, hatched across the plot and the minimap: `[{ from, to, label?, color?, hasEdge?, isAccruing?, note?, titleNote? }]`, `from` and `to` inclusive label indexes, rounded and clamped to the labels. A `bar` or `step` chart hatches the columns of the range. A `line` or `area` chart starts the hatch at the point before the range, as the segment into an estimated value is estimated too, or halfway from it with `isAccruing`, for a period still filling, and ends it halfway to the label after the range. The hatch goes under the lines of a `line` or `step` chart and over the fills of a `bar` or `area` chart, under the comparison line, the mask over unfocused bars and the reference lines; ranges of one colour that touch hatch as one band. Each range keeps its own label and edge: `label` is drawn at the bottom left of the range's hatch, in the axis font size, clear of the Y-axis labels and of the next label, and dropped where it has no room. `hasEdge` draws a dashed rule where the range's hatch starts, none at the first label. `color` is any CSS colour or `{ light, dark }` for the hatch, the edge and the label, and defaults to the Y-axis text colour. `note` and `titleNote` are notes of the tooltip at each label of the range, under the rows and beside the title, as `resolveTooltipNotes` gives them. The minimap draws the hatch alone, and a sparkline the hatch and the edges. Ignored on pie and donut charts, a zoom into shares included; the data `onZoom` returns sets ranges of its own.
`eventLines`| `EventLine[]` | Vertical rules at moments of the labels, such as a launch or a change in how the data is collected, and pins that carry a note: `[{ labelIndex, offset?, label?, color?, isDashed?, isDotted?, withHead?, hint? }]`, `labelIndex` rounded, and a rule outside the labels dropped. `offset`, clamped to 0–1, places the rule that fraction through the label's interval, as `getLabelX()` maps it: from its point to the next one on a `line` or `area` chart, where `0`, the default, is the point, and across its column on a `bar` or `step` chart, or one with bars or steps among its datasets, where `0` is its start and `0.5`, the default, its centre. The last point of a `line` or `area` chart has no next one and keeps its rule at the point. Each rule runs from the bottom of the Y range through the room above it, over the datasets, the hatches and the comparison line and under the reference lines and the axis labels, and follows the range and the zoom. A rule is a solid 1px line, which `isDashed` draws in 6px dashes 4px apart and `isDotted` in 2px dots 3px apart, `isDashed` or not, as those of a dataset. `withHead` makes the rule a pin, topped by a head at the top of the canvas: a disc of its colour 8px across, ringed in the background colour, over the data and the axis labels. `label` reads bottom to top from the top of its rule, or from under its head, in the axis font size: before the rule, or after it where it would cover the Y-axis labels, those of an `isYAxisOutward` column included, or leave the plot area. It is dropped where it fits on neither side or runs longer than its rule, and where the label of a later rule crowds it. `color` is any CSS colour or `{ light, dark }` for the rule, its head and the label, and defaults to the Y-axis text colour. `hint` is a note of the tooltip at the label of `labelIndex`, under the rows, as a `note` of `hatchedRanges` is: after the notes of the ranges and before those of `resolveTooltipNotes`, split into lines at `\n`, a line shown already left out. A sparkline draws the rules and their heads without their labels, and the minimap draws none. Ignored on pie and donut charts, a zoom into shares included; the data `onZoom` returns sets rules and hints of its own.
`comparison`| `Comparison` | A previous period, drawn as a dashed line: `{ name, color?, values }`. `values` holds the previous values per dataset, in the order of `datasets`, each aligned with `labels`; the line draws their sum over the datasets on screen, and a `null` leaves a gap. `color` takes any of the forms under [Colours](#colours), `DEFAULT_COMPARISON_COLOR`, `#6B7280`, by default. The legend names it beside a dashed swatch, and the tooltip lists it first with the change of the current total in percent. Ignored on percentage, pie and donut charts.

### Tooltip and selection

The tooltip lists each dataset on screen with a non-zero value at the label: a swatch of its colour, its name and its value in the text colour, from the largest value down. The swatch of a dashed or dotted line is a dashed or dotted outline. A `comparison` row comes first, beside a dashed swatch of its colour, in `--tooltip-muted-text-color` with its value in the normal weight, and set apart from the rest by a rule in `--tooltip-separator-color`. Its change is bold and tinted by `--tooltip-change-positive` or `--tooltip-change-negative`, unless it rounds to 0%, which keeps the colour and weight of its value. Stacked and percentage `bar`, `step` and `area` charts add a Total row. Notes of `hatchedRanges` and `resolveTooltipNotes` stand beside the title and under the rows, and the hints of `eventLines` under the rows, in `--tooltip-muted-text-color`. A pie or donut lists the sector under the pointer alone.

See [Tooltip](tooltip.md) and [Events and external control](interaction.md).

Parameter |  Type | Description |
---------|----|----|
`noTooltip`| `boolean` | `true` to leave out the hover layer, its line, dots and balloon, and the pointer handling of the plot: no pointer selects a label or a range, focuses a bar or zooms in, and `selectLabel()`, `isKeyboardSelectable` and `isRangeSelectable` are ignored. `initialZoom` still opens a zoom. Default `false`.
`isTooltipOrderFixed`| `boolean` | `true` to list the tooltip rows in the order of the legend, after the `comparison` row. When more than 12 rows would show, the largest values still decide which ones do. Default `false`.
`isTooltipTotalInTitle`| `boolean` | `true` to put the total of a stacked or percentage `bar`, `step` or `area` chart beside the tooltip title, in place of the Total row. Default `false`.
`formatTooltipValue`| `(value: number) => string` | Optional function formatting a number of the tooltip; `valuePrefix` and `valueSuffix` still wrap the result. It formats the total on the `secondaryYAxis` scale too, which the `prefix` and `suffix` of that scale wrap instead.
`resolveTooltipTotal`| `(labelValue: number, datasetIndexes: number[], labelIndex: number) => number \| null \| undefined` | Optional function `(labelValue, datasetIndexes, labelIndex) => number \| null \| undefined` giving the total of a stacked chart's tooltip, for the label's value (its timestamp, or the index of a text label), the indexes of the datasets on screen and the label's index in `labels`. `undefined` keeps the sum of the rows, `null` shows `—`. The comparison change and the total on the `secondaryYAxis` scale read this total too.
`resolveTooltipNotes`| `(labelValue: number, datasetIndexes: number[], labelIndex: number) => TooltipNotes \| undefined` | Optional function `(labelValue, datasetIndexes, labelIndex) => { titleNote?, notes? } \| undefined` giving the notes of the tooltip at a label, for its value and the indexes of the datasets on screen, as `resolveTooltipTotal` takes them, and its index. `titleNote` stands after the date, before the total of `isTooltipTotalInTitle`. `notes` are lines below the rows, under a rule in `--tooltip-separator-color`, as wide as the rows and wrapped to them. The notes of the `hatchedRanges` that hold the label come first, in their order, then the hints of the `eventLines` at the label, in theirs, then these; each note splits into lines at `\n`, a line shown already is left out, and the text shows as it is, never as HTML. This `titleNote` wins over those of the ranges, of which the first one wins. The notes change with the rows, for a pointer, a touch or `selectLabel()`. Ignored on pie and donut charts.
`onSelectedIndexChange`| `(labelIndex: number \| undefined) => void` | Optional function called when the selected label changes, by pointer, touch, keyboard or `selectLabel()`, with its index, not its value, and with `undefined` once nothing is selected: the pointer leaves the chart, `selectLabel(undefined)`, `update()` unless it keeps the selection, a resize, or the selected label leaving the visible range.
`onTooltipChange`| `(tooltip: TooltipContent \| undefined) => void` | Optional function called when what the tooltip shows changes, as another label is selected or a dataset is shown or hidden, with `{ labelIndex, title, rows, total?, comparison? }`, after `onSelectedIndexChange`, and with `undefined` once it shows nothing, as when nothing is selected. `title` is the title of the tooltip. `rows` holds each dataset on screen, in the order of `datasets`, as `{ datasetIndex, name, value }`, its value at the label, zero included and `null` for a gap. `total` comes with a stacked or percentage `bar`, `step` or `area` chart, as its Total row or title shows it: what `resolveTooltipTotal` gives, or else the sum of the rows. `comparison` comes with a `comparison`, as `{ name, value, change? }`: the previous value at the label and the change of the total against it in percent, unrounded, where the tooltip shows one. A pie or donut reports none. It goes on reporting with the balloon hidden by `--lovely-chart-balloon-display`, for a readout of the page.
`isKeyboardSelectable`| `boolean` | `true` to make the plot focusable, in the tab order of the page. Arrow Left and Arrow Right then step the selection to the previous or the next label, and Home and End to the first or the last label of the visible range, as `selectLabel()` does; with nothing selected, an arrow selects the last label. A key pressed with Alt, Ctrl or Meta stays the browser's. The plot keeps the focus through `update()` and a resize, which rebuild it. Ignored on pie and donut charts, and the pie or donut a zoom opens leaves the tab order while it shows. Default `false`.

## Instance methods

The created instance exposes the following methods (the `LovelyChartInstance` type describes `update` and `destroy` structurally, e.g. for test stubs):

Method | Description |
---------|----|
`update(newData, options?)`| Replaces the current data with `newData` (same shape as the initial `data` argument) and re-renders, at once or, with `isAnimated`, through a cross-fade. Resets transient view state (zoom, range, filter, selection) and ends a drag, a long press or a hover in progress, unless `options` keeps part of the view: see [Update options](#update-options). The chart keeps a reference to `newData`, as it does to `data`, and builds from it again on a resize or an orientation change, so a change made to the object afterwards shows from that build on; pass a new object for new data instead. No-op after `destroy()`.
`selectLabel(labelIndex)`| Selects the label at `labelIndex` as hovering it would: shows its tooltip, focuses its bar and calls `onSelectedIndexChange` and `onTooltipChange`. The selection holds while the pointer moves elsewhere on the page and follows its label through a range change; the pointer over the chart takes it over, and it clears once its label leaves the visible range: the labels whose point, or the centre of whose column, lies in the window the plot shows, or in a window too narrow to hold one, the labels of the points either side of it or of the columns it shows. `selectLabel(undefined)` clears the selection. Ignored for an index outside the visible range, on pie and donut charts, with `noTooltip` and before the first paint, the frame after the chart is created or updated. No-op after `destroy()`.
`refreshColors()`| Reads the `var()` colours of the params again and repaints the chart in them in place, keeping its zoom, range, legend filter and selection: for custom properties that the page changes on another trigger than the skin, such as a `data-theme` attribute. A change of the skin reads them by itself, as [Colours](#colours) describes. No-op after `destroy()`.
`setLegendContainer(element)`| Moves the legend into `element`, or back to the end of the chart with `undefined`, without a rebuild: its buttons keep the datasets they hide, and the chart keeps its zoom, range and selection. The legend takes its [spacing variables](css.md#spacing-the-chart) from its new place, and stays there through a zoom, a resize and an orientation change; `update()` places it by the `legendContainer` of its new data. The element that held it keeps nothing of the chart, and a call with the element that holds it leaves it in place among the elements of the page. No-op after `destroy()`.
`getLabelX(labelIndex, offset?)`| The x of the label at `labelIndex` in px from the left of the plot area the `--lovely-chart-plot-area-*` variables describe, where the last frame the chart drew put it: where its value draws, at its point on a `line` or `area` chart and at the centre of its column on a `bar` or `step` chart. `offset`, from 0 to 1, takes that fraction through the label's interval instead: from its point to the next one on a `line` or `area` chart, where `0` is the point, and across its column on a `bar` or `step` chart, or one with bars or steps among its datasets, where `0` is its start and `0.5` its centre. It follows the canvas frame by frame, so through the transition of a pan or a zoom it gives where the label stands on screen, and `onRangeChange` reports each frame that moves the labels; from the first frame of the data `onZoom` returns, it maps that data's labels. A panned window runs past the plot area, so a label at its edge can map below 0 or past the area's width. Returns `undefined` for an index outside the labels `onRangeChange` reports, before the first frame of the chart, of `update()`, of a resize and of the data a zoom swaps in, while a chart that opens zoomed waits for the data of the zoom, on pie and donut charts, a zoom into shares from its start included, and after `destroy()`.
`zoomOut()`| Zooms a zoomed chart out to its overview as its zoom-out control does, for a page that draws a header or a zoom-out control of its own and leaves out the chart's control with `noZoomOutControl`. Starts on the next frame, and only if the chart is zoomed in then: from the moment `onZoomChange` reports a zoom, even from within that callback, until a zoom out starts. No-op after `destroy()`.
`setLoading(isLoading)`| Shows the chart as loading, as the `isLoading` parameter does, and `setLoading(false)` as loaded, without a rebuild: the data on screen dims or shows in full, or data with no labels shows or leaves its skeleton, and the zoom, the range, the datasets hidden in the legend and the selected label stay as they are, with no callback. A resize keeps the state, and `update()` takes the one of its `isLoading`. No-op after `destroy()`.
`destroy()`| Tears down the chart: removes the DOM subtree from `element` and the `--lovely-chart-plot-area-*` and `--lovely-chart-plot-padding-top` variables from its style, calling `onPlotAreaChange` with `undefined`, and `onRangeChange` with `undefined` when it last reported labels, detaches all global listeners (window `resize` / `orientationchange`, document `mousemove` / `touchstart` and those of a drag in progress, theme `MutationObserver`, layout `ResizeObserver`, the `prefers-color-scheme` media query `change`, `document.fonts` `loadingdone`), cancels pending animation frames and timeouts, and calls back nothing after it. Idempotent. Call this from your framework's cleanup hook (e.g. React `useEffect` cleanup) to avoid resource leaks.

## Update options

The second argument of `update()`, of the `LovelyChartUpdateOptions` type, keeps parts of the view the reader has and animates the change. Each option is `false` by default, which resets that part or swaps the data at once.

Option | Description |
---------|----|
`shouldKeepFilter`| `true` to keep the datasets the reader showed or hid in the legend, matched by their place in `datasets`, or by `name` when `newData` has another number of datasets. A dataset with no match starts as its `isInitiallyHidden` says, and so does every dataset where the match would hide them all, which the legend never lets the reader do. `onHiddenSeriesChange` is called once the new data is built when the names or the indexes of the hidden datasets differ from those before.
`shouldKeepZoom`| `true` to keep the window, of the minimap or of a range selected on the plot, and the zoom while `newData` has the same `labels`. A zoomed chart opens zoomed into the same label, with no overview shown and no transition morph, as `initialZoom` opens it, and calls `onZoom` again for it; a zoom out returns to the kept window. `onZoomChange` goes uncalled for a zoom it already reported, is called with the label's value and index once a zoom still on its way in shows on the rebuilt chart, and with `undefined` for both when the zoom ends: when the labels differ, when `newData` cannot zoom, or when `onZoom` fails.
`shouldKeepSelection`| `true` to keep the selected label, by pointer, touch, keyboard or `selectLabel()`, at the index of the label of the same value in `newData`, while there is one in the window the chart opens on. A selection by pointer or touch still clears as the pointer leaves the chart or a touch lands elsewhere, and one by the keyboard or `selectLabel()` holds. `onSelectedIndexChange` is called on the first frame of the new data only when the index changes, and `onTooltipChange` only when what the tooltip shows changes, and both with `undefined` when the selection ends: its label is gone or outside the window, or a zoom shows or is kept.
`isAnimated`| `true` to cross-fade the chart into `newData` over 400ms. The chart it replaces, with its plot, axes, header, minimap and legend, stays in the new chart's place, under it, as it fades out and the new one fades in. It takes no room in the layout, so the page lays out around the new chart at once, and no pointer, focus or assistive technology reaches it; while it is taller than the new chart, it covers the content that follows. A legend in `legendContainer` cross-fades in its place there, the replaced one over the new one. Positioned elements of the page after the chart in `element` paint over both charts, and those before it under both. Another `update()` with `isAnimated` fades the chart out from the opacity it has reached, while the charts before it go on fading out; one without it, a resize, an orientation change or `destroy()` ends the fades at once. Ignored while the system asks for reduced motion (`prefers-reduced-motion: reduce`).

## Colours

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

### Default colours

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

## Types

The package ships its declarations, `dist/LovelyChart.d.ts`, and exports the types of its parameters:

Type | Description |
---------|----|
`LovelyChartParams`| The parameters of a chart, the `data` of the constructor and of `update()`: see [Chart options](#chart-options).
`LovelyChartDatasetParams`| A dataset: `{ name, values, color?, isInitiallyHidden?, isDashed?, isDotted?, type? }`, the `datasets[*]` entries of [Chart options](#datasets).
`LovelyChartUpdateOptions`| The second argument of `update()`: `{ shouldKeepFilter?, shouldKeepZoom?, shouldKeepSelection?, isAnimated? }`, see [Update options](#update-options).
`LovelyChartInstance`| `Pick<LovelyChart, 'update' \| 'destroy'>`, the methods a test stub or a wrapper of a framework needs.
`ChartType`| `'line' \| 'bar' \| 'step' \| 'area' \| 'pie' \| 'donut'`, the [`type`](#type) of a chart.
`LabelType`| `'year' \| 'month' \| 'week' \| 'day' \| 'hour' \| '5min' \| 'dayHour' \| 'text'`, the kind of the X-axis labels, [`labelType`](#labelType).
`ThemedColor`| `string \| { light: string; dark: string }`: a CSS colour for both skins, or one for each. See [Colours](#colours).
`DateLocale`| `{ months?, monthsFull?, weekDays?, weekDaysShort?, weekOf? }`, the localized names of [`dateLocale`](#dateLocale): arrays of 12 months or 7 weekdays from Sunday, and the words before the start date of a week.
`SecondaryYAxisConfig`| `{ label: string; multiplier: number; prefix?: string; suffix?: string }`, the scale of [`secondaryYAxis`](#secondaryYAxis).
`ReferenceLine`| `{ value: number; label?: string; color?: ThemedColor }`, an entry of [`referenceLines`](#referenceLines).
`HatchedRange`| `{ from: number; to: number; label?: string; color?: ThemedColor; hasEdge?: boolean; isAccruing?: boolean; note?: string; titleNote?: string }`, an entry of [`hatchedRanges`](#hatchedRanges).
`EventLine`| `{ labelIndex: number; offset?: number; label?: string; color?: ThemedColor; isDashed?: boolean; isDotted?: boolean; withHead?: boolean; hint?: string }`, an entry of [`eventLines`](#eventLines).
`Comparison`| `{ name: string; color?: ThemedColor; values: (number \| null)[][] }`, the previous period of [`comparison`](#comparison).
`TooltipNotes`| `{ titleNote?: string; notes?: string[] }`, what [`resolveTooltipNotes`](#resolveTooltipNotes) returns.
`TooltipContent`| `{ labelIndex: number; title: string; rows: { datasetIndex: number; name: string; value: number \| null }[]; total?: number \| null; comparison?: { name: string; value: number \| null; change?: number } }`, what [`onTooltipChange`](#onTooltipChange) reports.
