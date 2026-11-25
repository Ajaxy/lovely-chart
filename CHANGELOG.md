# Changelog

## Unreleased

### Changed

- The element that holds a chart takes the `lovely-chart--host` class while it holds one, which makes it a stacking context, `isolation: isolate`, in place of a `:has(> .lovely-chart--container)` rule of the stylesheet, which the browser tested on every element of the page in each full recalculation of its styles, at a cost of several milliseconds on a page of tens of thousands of elements. A rebuild of the chart gives the class back if the page took it away, and the `destroy()` of the last chart in the element takes it away.

## 2.3.5

### Changed

- The share on a pie or donut sector takes the dark label of a checked legend button, `#222222`, on a sector too pale for white, where white reaches less than 2:1 on the sector's colour, as on the light green and the amber of the default colours, and stays white on every other sector, in place of white on every sector.

## 2.3.4

### Changed

- `areLabelsContrast` labels stand on the row above their grid lines, as the other Y-axis labels do, in place of standing centred on them, and keep their halo of the background colour and their 2px inset from their side of the chart. The label of the lowest grid line stands inside the plot, clear of the band of the X-axis labels, and the labels of hatched ranges and event lines keep clear of contrast labels, their inset included.

### Fixed

- `areLabelsContrast` labels fade toward the top of the plot as the other Y-axis labels do, at rest and while the Y scale changes, as on a dataset hidden or shown in the legend, a zoom or a pan that rescales the axis, in place of running unfaded through the room above the Y range, where the top of the canvas cut off the labels of the outgoing or incoming scale.

## 2.3.3

### Changed

- The description and keywords of the package and the opening of the README present LovelyChart as Telegram-style charts that look lovely out of the box: a minimalist design, a refined palette for day and night and polished interactions.

## 2.3.2

### Added

- The documentation site, https://ajaxy.github.io/lovely-chart/: a gallery of 43 live, editable examples with a playground, guides to every feature with live examples that the reader can edit in place, and the reference of the class, its options and its CSS variables, with a search across them. The reference moves from the README to `docs/guide`, and the README keeps an overview. The site opens on the gallery in place of the demo page, which the end-to-end test keeps driving in `test/demo`. Every page is static HTML and Markdown at its own URL, with `llms.txt` and `llms-full.txt` for language models, and the type declarations document every option.

### Changed

- The build is minified: `dist/LovelyChart.js`, the file a page loads from a CDN, weighs 32 KB gzipped in place of 56 KB.

## 2.3.1

### Fixed

- The two ends of the window keep in step through each frame of their transition, as a drag of the minimap window or a zoom moves them: the transitions one change starts share one start, and a frame reads the clock once for all of them, in place of a millisecond turning between two reads and putting one end ahead of the other, which changed the scale of the X axis of a pan by about a ten-thousandth for a frame or two and shifted the dashes and dots of a panned line by up to a seventh of a pixel.
- A swipe down or up the minimap window or one of its ears scrolls the page, a swipe across the window drags it, and one across an ear resizes it. The window and its ears take `touch-action: pan-y` and leave a touch its default. A touch that moves more down or up than across before it moves 6px, or that the browser scrolls the page with, leaves the window where it was, and one across holds the swipe, so the page stays still under it.

## 2.3.0

### Added

- `isRangeSelectable`: lets a mouse select the visible range on the plot. A drag across the plot draws a band over the Y range, and its release opens a window on the labels whose point, or the centre of whose column, the band holds, set on them as `minimapRange` sets one, through the transition of a minimap drag. A line or area chart with no bars or steps among its datasets takes two points at least. The minimap window follows the range, from the first label `limitDate` leaves open and no narrower than its ears leave one, and a chart without a minimap takes the range alike. A double click on the plot shows the whole range again, on a chart that does not zoom in on a click. A press that moves less than 4px across the plot stays a click, Escape ends a drag with no change, the click that ends a drag zooms into nothing, and a touch keeps selecting a label. `onRangeChange` reports each frame of the transition, and `update()` with `shouldKeepZoom` keeps the range. Ignored on pie and donut charts, while zoomed and with `noTooltip`.
- `--range-selection-color`: the colour of the edges of that band, `.lovely-chart--range-selection`, and, at 12%, of its fill, one in each skin.

## 2.2.0

### Added

- `hatchedRanges`: runs of labels whose values are estimated, partial, still accruing or forecast, hatched across the plot and the minimap, `[{ from, to, label?, color?, hasEdge?, isAccruing? }]`. Bar and step charts hatch the columns of a range; line and area charts start the hatch at the point before it, or halfway from it with `isAccruing`, and end it halfway to the next label. The hatch goes under lines and over fills, and ranges of one colour that touch hatch as one band. Each range keeps its own `label`, drawn at the bottom left of its hatch where it fits, and `hasEdge`, a dashed rule where its hatch starts.
- `HatchedRange` type.
- `--tooltip-muted-text-color`, `--tooltip-separator-color` and `--tooltip-border`: the colour of the tooltip's `comparison` row, a mix of 70% `--text-color` and 30% `--tooltip-background` by default, the colour of the rule under it, `--grid-lines` by default, and a border of the balloon, `none` by default.
- The README lists the classes of the tooltip that stay stable for the rules of a page: `.lovely-chart--tooltip-balloon`, `-title`, `-title-total`, `-title-note`, `-dataset`, `-dataset-value`, `-dataset-comparison`, `-swatch`, `-change[data-tone]` and `-notes`.
- `resolveTooltipNotes`: notes of the tooltip at a label, `(labelValue, datasetIndexes, labelIndex) => { titleNote?, notes? } | undefined`, in `--tooltip-muted-text-color`. A `titleNote` follows the date in `.lovely-chart--tooltip-title-note`, before a title total, and `notes` are lines below the rows in `.lovely-chart--tooltip-notes`, under a rule in `--tooltip-separator-color`, wrapped to the width of the rows. They change with the rows, for a pointer, a touch or `selectLabel()`; ignored on pie and donut charts.
- `hatchedRanges[*].note` and `hatchedRanges[*].titleNote`: notes of the tooltip at each label of a range. Range notes come first, in range order, then the `hint` of each of the `eventLines` at the label, then those of `resolveTooltipNotes`; each splits into lines at `\n`, and a line shown already is left out. The `titleNote` of `resolveTooltipNotes` wins over a range's, and among ranges the first wins.
- `TooltipNotes` type.
- `onZoomChange(labelValue, labelIndex)` and `resolveTooltipTotal(labelValue, datasetIndexes, labelIndex)`: the label's index in `labels` as the last argument, beside its value, the timestamp of a date label or the index of a text label. `onZoomChange` passes `undefined` for both once zoomed out.
- `isKeyboardSelectable`: makes the plot focusable. Arrow Left and Arrow Right step the selection label by label, and Home and End select the first and the last label of the visible range; with nothing selected, an arrow selects the last label. The plot keeps the focus through `update()` and a resize, and the pie or donut a zoom opens leaves the tab order.
- `onTooltipChange`: what the tooltip shows, `{ labelIndex, title, rows, total?, comparison? }`, reported on each change and as `undefined` once it shows nothing, for a readout of the page. `rows` lists each dataset on screen in the order of `datasets`, and `total` is the one the Total row shows, `resolveTooltipTotal`'s included.
- `TooltipContent` type.
- `--lovely-chart-balloon-display`: `none` hides the tooltip balloon alone, keeping the hover line, the dots, the focus of a bar and the reports of the selection, so a media query can swap the balloon for a readout.
- `datasets[*].type`: draws a dataset as a `line`, `bar` or `step` whatever the chart's `type`, as a line over bars, apart from a percentage, pie or donut chart's. Lines and steps draw over bars and areas, with the hatch of `hatchedRanges` between them, and bars that share the main Y axis with another type keep 0 on it. A chart with bars or steps among its datasets gives every label a column and masks the columns around the focused one. A dataset of another type than the chart's draws its own values: it stays out of a stacked chart's stack, the tooltip's total, the `comparison` and the shares of a zoom into a label.
- `datasets[*].color`, `comparison.color` and the `colors` of data that `onZoom` returns take `{ light, dark }`, a colour per skin. The legend buttons, `--lovely-chart-series-color` and the tooltip swatches follow the skin, as the plot and the minimap do.
- Every colour parameter takes a `var()` of the page's custom properties, alone or inside a colour function such as `color-mix()`. The chart computes it on a hidden element inside it, so any colour the property holds works, and computes it again on each change of the `class` of `<html>` and, with `colorScheme: 'system'`, of `prefers-color-scheme`, repainting in place.
- `refreshColors()`: reads the `var()` colours again, for custom properties that the page changes on another trigger than the skin, keeping the zoom, the range, the legend filter and the selection.
- `DEFAULT_COLORS`, `getDefaultColors(datasetCount)` and `DEFAULT_COMPARISON_COLOR`, exported for elements of the page that show the same series as a chart. `getDefaultColors` returns a colour per dataset, those the chart gives in order to the datasets with no `color`: a subset of the eight `DEFAULT_COLORS` for fewer datasets, and the eight again from the first for more.
- `--lovely-chart-inset`, `--lovely-chart-minimap-margin-bottom`, `--lovely-chart-legend-gap`, `--lovely-chart-legend-padding-bottom`, `--lovely-chart-button-padding`, `--lovely-chart-button-radius` and `--lovely-chart-button-font-size`: the side inset of the header, the minimap and the legend, the space under the minimap, between the legend entries and under the legend, and the padding, corner radius and font size of the legend buttons. They apply from the chart's element or any ancestor, and from the `legendContainer` of a legend there; the minimap canvas fits the inset.
- `setLegendContainer(element)`: moves the legend into an element of the page, or back into the chart with `undefined`, without a rebuild, so its buttons keep the datasets they hide and the chart its zoom, range and selection. A zoom, a resize and an orientation change keep the legend there, and `update()` places it by the `legendContainer` of its data.
- `getLabelX(labelIndex, offset?)`: the x of a label in px from the left of the plot area, where the last frame the chart drew put it, through the transition of a pan or a zoom too: at its point, or the centre of its bar or step column, or with `offset` that fraction through its interval. From the first frame of the data `onZoom` returns, it maps that data's labels. `undefined` outside the visible range, before the first frame of the chart's data, the data a zoom swaps in and that of a chart that opens zoomed included, on pie and donut charts and while zoomed into shares.
- `onPlotAreaChange`: called with the plot area whenever the chart writes the `--lovely-chart-plot-area-*` variables, and with `undefined` as `destroy()` removes them.
- `onRangeChange`: called after each frame that draws the labels at a new x, at most once a frame, with the labels of the visible range, `{ from, to }`, inclusive indexes that `getLabelX()` maps where that frame drew them, so an element of the page placed in it moves with the canvas: on the first paint, through a drag of the minimap window and the range transition of a zoom, from the first frame of the data `onZoom` returns, indexing its labels, and after `update()` or a resize, from the zoomed view of a chart that opens zoomed. Frames that move no label, of a hover, a selection, a legend toggle or a change of the skin, go unreported. Passed back as `minimapRange`, the range opens a window on the same labels, or, from the first label `limitDate` leaves open on a line or area chart, one label wider short of the last label. Called with `undefined` once no labels are on screen: on a pie or donut, from the start of a zoom into shares, and on `destroy()`.
- `--lovely-chart-plot-padding-top`, set by the chart on its element beside the plot-area variables: the room above the Y range, 15px, or 2px on a sparkline, for marks that rise above the data.
- `eventLines`: vertical rules at moments of the labels, and pins, `[{ labelIndex, offset?, label?, color?, isDashed?, isDotted?, withHead?, hint? }]`, from the bottom of the Y range through the room above it, over the datasets, following the range and the zoom. `offset` places a rule through its label's interval as `getLabelX()` maps it, and the last point of a `line` or `area` chart, with no interval after it, keeps its rule at the point. A rule is solid, dashed with `isDashed`, or dotted with `isDotted`, `isDashed` or not, in the dashes and dots of a dataset. `withHead` makes a rule a pin, topped over the data and the axis labels by a disc of its colour in a ring of the background colour. A sparkline draws the heads with the rules, and the minimap neither. Each rule's `label` reads bottom to top from its top, or from under its head, before the rule, or after it where it would cover the Y-axis labels or leave the plot area, and gives way to the label of a later rule that crowds it. `hint` is a note of the tooltip at the rule's label, as a `note` of `hatchedRanges` is, after the notes of the ranges and before those of `resolveTooltipNotes`.
- `EventLine` type.
- `minimapRange` takes `{ from, to }`, inclusive label indexes, rounded and clamped to the labels as in `hatchedRanges`: a bar or step chart opens on the columns of those labels, a pie or donut sums them, and a line or area chart opens on their points and half an interval past either end, within the axis. A range of no labels takes the default.
- `update(newData, options)`: `shouldKeepFilter` keeps the datasets the reader hid, matched by their place or, once the number of datasets changes, by name; `shouldKeepZoom` keeps the minimap window and the zoom while the labels are unchanged, reopening a zoomed chart zoomed into its label; `shouldKeepSelection` keeps the selected label while a label of its value shows. Callbacks follow what changes: `onHiddenSeriesChange` when the hidden datasets differ, `onZoomChange` when a zoom still on its way in shows or the zoom ends, and `onSelectedIndexChange` when the index moves or the selection ends.
- `LovelyChartUpdateOptions` type.
- `update(newData, { isAnimated })`: cross-fades the chart into the new data over 400ms within the one instance: the plot, the axes, the header, the minimap and the legend, one in `legendContainer` included. The replaced chart stays in the new one's place, under it, out of the layout and of the reader's reach, until it has faded out, and another animated update fades the chart out from the opacity it has reached. With reduced motion the data swaps at once.
- `--lovely-chart-header-height`, `--lovely-chart-header-margin-top` and `--lovely-chart-plot-margin-top`, read from the chart element or an ancestor: the height of the header band and the line height of its title and caption, the space above the band, and the space between the band and the plot canvas, `30px`, `0` and `10px` by default.
- `noHeader`: leaves out the band of the title and the caption, so the plot starts at the top of the chart. While zoomed, the zoom-out control floats over the top inline-start corner of the plot, on a backdrop of `--background-color`.
- `noTooltip`: leaves out the hover layer and the pointer handling of the plot, so no pointer selects a label, focuses a bar or zooms in, and `selectLabel()` and `isKeyboardSelectable` are ignored.
- `zoomOut()`: zooms a zoomed chart out as its zoom-out control does, for a page that draws a header of its own.
- `noZoomOutControl`: leaves out the zoom-out control, for a page that zooms out with `zoomOut()` from a control of its own.
- `--lovely-chart-empty-header-height`: the height of a header with nothing to show, 0 by default; a page keeps a band with it, as to level the plots of a row.
- `--lovely-chart-font-family`: the font family of the chart's text, the labels the canvas draws included, read from the chart element or an ancestor.
- `--lovely-chart-font-weight`: the regular weight of the chart's text, 300 by default: the legend, the names in the tooltip and the axis labels.
- `--lovely-chart-font-weight-bold`: the weight of the chart's bold text, `bold` by default: the header, the tooltip title and its total, the values, the Total row, a rise or a fall against the `comparison` and the shares of a percentage chart.
- `ariaLabel`: the accessible name of the plot, which takes `role="img"` while the chart element takes no role, so the legend buttons stay exposed. An empty string leaves the plot out of the accessibility tree.
- `isLoading`: shows the chart as loading, its element and its legend `inert`. Data with labels dims on the plot, the minimap and the legend, and data with none draws a skeleton of them in the chart's own geometry, so the chart its data builds takes the same place: a block over the data area of the plot, or the circle of a pie and the ring of a donut, the box of the minimap and a pill for each legend entry, sized by its name. The skeleton pulses unless the reader prefers reduced motion.
- `setLoading(isLoading)`: shows the chart as loading, as `isLoading` does, or as loaded, in place, so the data on screen keeps its zoom, range, hidden datasets and selected label.
- `--skeleton-color`: the colour of the skeleton of a loading chart, one in each skin.
- The README documents options the chart took with no word there: `noCaption`, `zoomOutLabel`, `labelFormatter`, `withGradient`, `limitDate` and `onLimitedRangeClick`. It also gives a pie or donut of one total per dataset a single text label, `labels: ['Total']`, which shows no caption of dates.

### Changed

- The `comparison` row of the tooltip takes `--tooltip-muted-text-color` in place of an opacity of 0.7. Its text keeps the shade the opacity gave it, on a page's own skin too, while its swatch and the tone of a rise or a fall keep their full colours. In the day and the night skin the text reaches a contrast of 4.5:1 on the tooltip background.
- A `comparison` change that rounds to 0% keeps the weight of its value, normal by default, in place of bold; a rise or a fall stays bold.
- The total on the `secondaryYAxis` scale in the tooltip is formatted as the dataset values are, by `formatTooltipValue` when given, and otherwise with its digits grouped and no trailing zeros: `$1 250` rather than `$1250.00`.
- Dataset, comparison, axis text and background colours take any CSS colour, not only `#RRGGBB`. Reference line, hatched range and area border colours take any CSS colour, such as `light-dark()`, and `#RRGGBB/alpha`, not only those the canvas takes.
- Legend buttons take their outline, label and checked fill from `--lovely-chart-series-color`, in place of a `lovely-chart--color-*` class and the rules the chart added to the page for each colour.
- The legend sets its entries `--lovely-chart-legend-gap` apart in a wrapping flex row, in place of a margin after and under each entry. A row fits entries up to its end, so a legend can take a row fewer, and the 24px under its last row are its own padding. A `text-align` of the page no longer places the entries, and margins of the page on them add to the gap. A negative bottom margin on `.lovely-chart--tools` that offset the 8px under the entries now clips their last row; `--lovely-chart-legend-padding-bottom: 0` in its place ends the chart at that row.
- The axis labels take the regular weight of the chart's text, `--lovely-chart-font-weight`, as they take its family, in place of a fixed 300, so a page style that sets the weight of the chart's text reaches them too.
- A header with nothing to show, with no `title` and no caption because of `noCaption` or text labels, folds to `--lovely-chart-empty-header-height`, 0 by default, in place of its 30px band, and the hover layer follows the plot up. While zoomed, its zoom-out control floats over the top inline-start corner of the plot, on a backdrop of `--background-color` and without a caption.
- The plot takes `role="img"` and an English summary of the data it shows as its accessible name unless `ariaLabel` gives one: its type, the span of its labels and the names of its datasets, as `Line chart, 1 Nov 2025 — 5 Nov 2025: Desktop, Mobile`. A zoom in or out renews the summary from the data it brings.
- An element a page places over the plot paints under the tooltip balloon in place of over it, and still over the hover line, when it comes after the chart with no `z-index` or `0`, or before it with `1`: the balloon takes `z-index: 1` in the element that holds the chart, which is a stacking context, `isolation: isolate`, while it holds one. That element paints as one layer among the positioned elements of the page around it, and no `z-index` inside it, as of a menu of the page there, reaches over the page.

### Fixed

- English dates read left to right on a right-to-left page, on the X axis, in the header caption and in the tooltip title: each of these, a text label included, reads in the direction of its first letter, so dates in Hebrew or Arabic words read right to left on a left-to-right page. One with no letter, such as the caption `2022 — 2026` of a year chart, reads left to right, the way the X axis runs.
- `isCurrencyPrefix` puts the minus sign in front of the `prefix` of `secondaryYAxis` too, on its axis labels and its tooltip total: `-$1.3K` rather than `$-1.3K`.
- A stacked chart with `hasSecondYAxis` keeps the last dataset out of the stack, on a Y axis of its own: the dataset draws its own values on that axis, which labels them, and fades when hidden, while the stack, the main Y axis, its `isYAxisOutward` column and the tooltip's total leave it out. The main Y-axis labels of the stack keep the axis text colour rather than the first dataset's, and a percentage chart's tooltip prints no share on the row of the dataset on its own axis.
- `update()`, a resize and an orientation change keep a legend in `legendContainer` in its place among the page's elements there, and the chart in its place among them when `legendContainer` is the chart's own `element`.
- A resize or an orientation change of a chart zoomed into its own datasets, as into a pie or a donut, keeps in the overview it opens the datasets the reader hid or showed in the zoomed legend.
- The hover line and dots of the tooltip stay on the plot when a style of the page moves the plot canvas by resizing the chart's layout or its header, as by folding or restyling the header or changing the plot canvas's margin. The chart places the hover layer, `.lovely-chart--tooltip`, from the plot canvas whenever the plot area, the chart's layout or its header changes, ahead of a `top` the page sets on the layer and a margin it sets on the hover canvas: a page that set a margin on both canvases to move the plot needs it on `.lovely-chart--container > canvas` alone.
- The `--lovely-chart-plot-area-*` variables follow the plot when a style of the page folds or resizes the header in a chart element that keeps its size, as one of fixed height.
- A chart with no labels, as `labels: []`, draws its empty plot, in place of throwing an error on each frame it draws.
- A header caption of a range of days whose ends fall in different years gives each end its year, as `1 Jan 2026 — 18 Feb 2027`, in place of leaving out the year of the end in the current year, which read as a span of the other end's year, `1 Jan — 18 Feb 2027`.
- A `minimapRange` that starts before the first label `limitDate` leaves open starts at that label and keeps its width within the axis, so one that ends before it selects the open labels in place of a window that ends before it starts, with an empty plot and a caption of reversed dates. A `limitDate` after the label before the last locks no label, in place of leaving the window no span of labels to select, past the right end of the minimap.
- `noCaption` leaves out the caption of the header while zoomed too, into shares or into the data `onZoom` returns, as by a click, `initialZoom` or an `update()` that keeps the zoom, and once zoomed out, in place of naming the zoomed day, as `Friday, 6 Nov`, and keeping that name in the overview. A chart of text labels, which shows no caption, shows none while zoomed into data of dates either.
- A tooltip balloon tall enough to reach the legend or the minimap paints over the legend buttons, in place of under them, and takes a touch where it covers the widened touch area of a minimap handle, in place of passing it to the handle under it.
- A window whose edge stands on a label, as one at the first label `limitDate` leaves open, holds that label in its header caption, its Y range, the labels Home and End select and those `selectLabel()` takes, in place of leaving it out where float error put the edge a hair past it.
- A window of a `bar` or `step` chart, or of one with bars or steps among its datasets, holds a label while it holds the centre of the label's column, as it opens and as the reader drags it: its header caption, its Y range, the labels Home and End select and those `selectLabel()` takes and keeps selected follow the centres of the columns, as do the labels a `pie` or `donut` sums from the window of its minimap, in place of the points a line chart of as many labels would put in the window, which took a column in or left it out up to half a column early, as the default window of 6 bars, the last 20% of the minimap, took in the label of the column before the last, of which it shows a fifth. A window too narrow to hold a point takes the labels of the points either side of it, and one too narrow to hold the centre of a column the labels of the columns it shows, in place of none, which kept the Y range of the window before it, left the keys, `selectLabel()` and a pie or donut no label, and named the labels either side in reverse in the caption of a chart of weeks, months or years. `limitDate` on a chart whose labels take columns, a `bar`, `step`, `pie` or `donut` chart or one with bars or steps among its datasets, masks the minimap, and stops the window, at the start of the column of the first open label, in place of partway into that column.

## 2.1.0

### Added

- `referenceLines`: dashed rules at fixed values, `[{ value, label?, color? }]`, labelled at their right end. The Y range reaches every value on line, bar, step and area charts, stacked ones included, so a `color: 'transparent'` line draws nothing and pins the range. On a percentage chart the value is a percentage on the 0–100% grid.
- `comparison`: a previous period, `{ name, color?, values }`, drawn as a dashed line of the previous total of the datasets on screen, on the main Y axis. The legend names it beside a dashed swatch, and the tooltip lists it first, set apart, with the change of the current total tinted by `--tooltip-change-positive` and `--tooltip-change-negative`.
- `datasets[*].isDashed`: draws a `line` or `step` dataset in 6px dashes 4px apart. The dataset's legend button shows the dash on its outline and carries `data-dashed`, and its tooltip swatch is a dashed outline.
- `datasets[*].isDotted`: draws a `line` or `step` dataset in 2px dots 3px apart, `isDashed` or not. The dataset's legend button shows the dots on its outline and carries `data-dotted`, and its tooltip swatch is a dotted outline.
- `datasets[*].isInitiallyHidden`: starts a dataset hidden, its legend button unchecked. A lone dataset that starts hidden keeps its legend.
- `plotHeight`, and the `--lovely-chart-plot-height` custom property (a unitless number, `px` or `rem`) that takes precedence over it.
- `--lovely-chart-plot-area-left`, `--lovely-chart-plot-area-top`, `--lovely-chart-plot-area-width` and `--lovely-chart-plot-area-height`, set by the chart on its element: the data area of the plot in px of the element's padding box, for elements of the page to cover it with. A pie or donut sets the square around its circle, and a sparkline its plot inset by 2px. The chart rewrites them whenever the area moves, as on a resize, a zoom, a web font that loads late or a header that a style of the page folds while its caption is empty.
- `isSparkline`: the plot alone, inset by 2px, with no axes, grid, header or legend. The bottom of its Y range stays unrounded to an axis step and follows the zero baseline of every chart: 0, unless the values go below 0 or their lowest is more than three quarters of their highest.
- `isYAxisOutward`: the main Y-axis labels in a column left of the plot, right-aligned, as wide as the widest label the data can show, so the plot holds still while the reader pans or hides datasets. The column is measured again when a web font changes the axis font after the chart is built: once the font finishes loading, or on the next frame the chart draws after the page adds a `FontFace` already loaded, which fires no event.
- `noFloatSteps`: whole-number steps of at least 1 on both Y axes, for counts.
- `areLabelsContrast`: Y-axis labels centered on their grid lines inside a halo of the background colour, 2px in from their side of the chart.
- `axisFontSize` and `axisTextColor`.
- `backgroundColor`: the surface colour for hover dots, the bar focus mask and label halos.
- `axisTextColor` and `backgroundColor` take a hex colour or `{ light, dark }`; reference line colours take any canvas colour or `{ light, dark }`.
- `colorScheme`: `'htmlClassName'`, the default, follows the `theme-dark` class on the `<html>` element, and `'system'` follows `prefers-color-scheme`, live.
- `isUtc`: reads every date and time of the labels in UTC.
- `areLinesSmooth`: monotone curves for `line` datasets, and for the `comparison` line beside them, that never overshoot a value.
- `areaOpacity` and `areaBorderColor` for `area` datasets: a fill opacity, and a 1px outline around each area and each run of an area split at a gap, in one canvas colour or one per skin.
- `isTooltipOrderFixed`: tooltip rows in the order of the legend; the largest values still decide which rows fit.
- `isTooltipTotalInTitle`: the total of a stacked or percentage bar, step or area chart beside the tooltip title, in place of the Total row.
- `formatTooltipValue`: formats a tooltip number, wrapped by `valuePrefix` and `valueSuffix`.
- `resolveTooltipTotal`: supplies the tooltip total for a label and the datasets on screen; `null` shows `—`.
- `tooltipFormatter: "statsTooltipFormat('week')"` titles a tooltip `Week of 16 Nov`, and `dateLocale.weekOf` translates it.
- `selectLabel(labelIndex)`: selects a label as hovering it would, and holds it while the pointer moves elsewhere on the page; `selectLabel(undefined)` clears it.
- `legendContainer`: an element of your own for the legend.
- `onZoomChange`, `onHiddenSeriesChange` and `onSelectedIndexChange` callbacks.
- `ReferenceLine`, `Comparison`, `ThemedColor` and `DateLocale` types.
- Legend buttons carry `role="button"` and `aria-pressed`, toggle on Space, and expose their dataset colour as `--lovely-chart-series-color`.

### Changed

- Numbers abbreviate billions as `B` and trillions as `T`.
- The Y axis steps in 1, 2 and 5 times a power of ten below 100, and past 100M in 1, 2.5 and 5 times a power of ten without end. A short plot takes a finer step so at least two labels stay legible.
- The X-axis label grid counts from the newest label, which it always shows, and takes a coarser step when labels would crowd; edge labels stay within the plot.
- A resize or an orientation change keeps the datasets the reader hid, and a zoom into or out of a lines view keeps the legend buttons in step with the datasets shown.
- Tooltip rows follow their dataset key, so datasets sharing a name keep separate rows.
- Tooltip rows show a swatch of the dataset colour before the name and the value in the text colour, in place of a value in the dataset colour. The comparison row and dashed lines take a dashed swatch.
- A checked legend button keeps its white label while that reaches 2:1 contrast on its fill; below that, a `#222222` label takes over when it reads clearer. Pale fills take dark labels, among the eight default colours the light green `#9ED448` and the amber `#F5BD25` alone, while mid-tones such as the green `#5FB641` and the orange `#F79E39` keep white.

### Fixed

- A constant series draws at the middle height, its value the one Y-axis label on it, on the main and the second axis; a single-label chart draws in a centered column. Neither draws `NaN` paths. A bar or an unstacked area of a constant range, such as a single label or equal values, spans from zero at the plot edge to the middle height: up from the bottom for a positive value and down from the top for a negative one, on both Y axes and in the minimap.
- A constant range takes the Y-axis step of the range from 0 to its value, so panning a narrow window across single labels keeps the page responsive, a few Y-axis labels a frame. A Y-axis pass of far more ticks than the axis has rows, as a step can be mid-transition, draws nothing.
- A Y-axis tick at 0 reads `0`, never float noise such as `-0.000000000000000056`, and a constant range in the trillions, such as a single label, labels its value instead of freezing the page.
- A Y range that starts on a multiple of its axis step, such as 0.3 in steps of 0.1, starts on that label.
- A Y-axis label shows every digit after the point that its step has in the label's unit, so the labels of a narrow window differ and read exactly, on both Y axes: `6.02K` in steps of 20, `6.25K` in steps of 250 and `6.2K` in steps of 100, never `6.1K` four times or `6.3K` for 6,250. The one label of a constant window, such as equal values or a single label, reads its value in full, as `6.25K` for 6,250. A step of whole units keeps the short form, such as `6K`, and the `isYAxisOutward` column fits the longer labels.
- An area splits at a missing value and fills each run down to its own stack base; a lone value draws as a dot.
- A line run of one or two points between gaps draws its points as dots.
- The type declarations resolve under `moduleResolution` `node16` and `nodenext`, so the parameters type-check there.
- Tooltip values, totals and shares read left to right on a right-to-left page, each sign before its digits.
- A zoom draws the zoomed datasets in the colours the zoomed data gives them, by `colors` or each dataset's `color`: on the plot, in the legend and in the tooltip, and in the minimap when the zoomed data has as many datasets as the chart. That holds when the zoomed data has more datasets than the chart, past whose datasets one with no colour takes a default colour; within them, one with no colour keeps the chart's colour at its place. A zoom out, and a resize or an orientation change while zoomed, redraw the plot, the legend and the minimap in the chart's colours.
- A zoom out of a pie or donut started right after the zoom in keeps the turn and the clip of its transition to its end, and a second zoom click before the first zoom settles does not throw.
- `update()` and `destroy()` end the frames, timers, drags and long presses of the chart they replace or tear down, the minimap's included, so a pointer move, a drag, a held legend button or an animation in flight neither throws nor reads labels the new data lacks, and calls back nothing afterwards. A click before the first frame of new data does nothing.
- A minimap drag holds its grabbing or resize cursor over the whole page until the release, wherever the pointer goes, through the `lovely-chart--cursor-grabbing` and `lovely-chart--cursor-ew-resize` classes on `<html>`, which leave a page's own `cursor-grabbing` and `cursor-ew-resize` classes alone. A context menu the press opens ends the drag, as does a release over an element of the page that stops its propagation, or, after a release over a frame, the next move over the page with no button pressed.
- The transition of a zoom into or out of a pie or donut closes its clip on the circle, with room for the shift of a focused sector, at any chart width and plot height and on a sparkline: a narrow chart on a wide page shows the whole circle, and a wide or short one clips the overview tight around it.
- The tooltip balloon takes its place from the width of the content it shows, so one opened by a tap or a single pointer move near the right edge stays inside a chart wider than it, beside its label.
- The tooltip of a stacked bar, step or area chart with `secondaryYAxis` keeps its Total row, with the total on the secondary scale on a row of its own under it.
- Y-axis labels read left to right on a right-to-left page, each sign before its digits.
- A long tooltip title stops short of the zoom chevron and the loading spinner instead of running under them.

## 2.0.6

### Changed

- The unused `cssnano` development dependency is removed, and with it the audit advisories of its PostCSS chain.

## 2.0.5

### Added

- `zoomToShares` parameter — opts a non-percentage chart into zoom-to-shares, so a stacked chart of absolute values can drill into a label's shares without being converted to percentages.
- `circleLabelsAround` parameter — how many labels either side of the clicked one the zoomed pie/donut covers (default `3`).
- `percentPrecision` parameter — the digits after the point of the share a percentage tooltip prints beside each value (default `0`).

### Changed

- The caption of a zoomed or multi-label window follows `labelType`: a year chart reads `2029`, a month chart `April 2029` and `February — March 2029`.
- A discrete minimap drag steps by the label under the pointer, so the range changes as the pointer crosses a label boundary.

### Fixed

- A zoomed pie or donut sums and selects the labels of its own window, with no neighbour labels from the edge margin.

## 2.0.4

### Added

- Right-to-left layouts under `dir="rtl"`.

### Fixed

- Header captions, the zoomed caption included, follow `dateLocale`.

## 2.0.3

### Added

- `dateLocale` parameter — localized month and weekday names for axis, tooltip and caption labels.
- `initialZoom` parameter — opens the chart already zoomed on a label index or `'last'`.

### Fixed

- A percentage chart whose datasets all hold 0 at a label draws with no `NaN` paths.

## 2.0.2

### Changed

- The Y range of a chart that does not stack starts at 0 unless the values go below 0 or their lowest is more than three quarters of their highest.

## 2.0.1

### Changed

- Week labels use ISO 8601 week numbers.
- Captions omit the year when it is the current one.

### Fixed

- X-axis labels at a range pinned to a data boundary keep full opacity and stay inside the plot edge.

## 2.0.0

### Breaking changes

- `LovelyChart.create(element, data)` is removed. The `LovelyChart` class is now the default export — use `new LovelyChart(element, data)`:
  ```js
  // Before
  import * as LovelyChart from 'lovely-chart';
  const chart = LovelyChart.create(element, data);

  // After
  import LovelyChart from 'lovely-chart';
  const chart = new LovelyChart(element, data);
  ```
- The `isDonut` parameter is removed — donut is a chart type of its own: `type: 'donut'`.
- Pie and donut charts no longer require `isStacked` / `isPercentage` to render correctly, and no longer become zoomable when `isPercentage` is set.
- The library-internal CSS class names of the zoom transition changed (`lovely-chart--container-type-pie` → `lovely-chart--container-type-circle`); stylesheets targeting them must be updated.

### Added

- TypeScript declarations are shipped with the package.
- `LovelyChartInstance` — a structural type of the chart handle, satisfiable by test stubs.
- `noZoom` parameter to disable zooming.
- `zoomType` parameter (`'pie' | 'donut'`) — the chart type a percentage chart zooms into.
- The `step` chart type is documented and demonstrated on the demo page.
- A single modern ESM build replaces the previous bundle formats.

### Changed

- Importing the library no longer touches the DOM or `window`: theme detection, style injection and the theme observer attach on the first chart creation. The import is side-effect free (tree-shaking friendly) and safe in window-less environments such as SSR.

### Fixed

- Crashes and `NaN` rendering states on single-label charts.
- A crash when clicking the plot gutter of a zoomable chart.
- The wrong day being selected when zooming near the data edges, in both hourly and pie/donut zoom modes.
- Header caption flicker during zoom transitions and on the first render.

## 1.4.1 and earlier

Earlier releases were not tracked in this file.
