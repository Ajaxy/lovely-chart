# Changelog

## Unreleased

### Added

- `hatchedRanges`: runs of labels whose values are estimated, partial, still accruing or forecast, hatched across the plot and the minimap, `[{ from, to, label?, color?, hasEdge?, isAccruing? }]`. Bar and step charts hatch the columns of a range; line and area charts start the hatch at the point before it, or halfway from it with `isAccruing`, and end it halfway to the next label. The hatch goes under lines and over fills, and ranges of one colour that touch hatch as one band. Each range keeps its own `label`, drawn at the bottom left of its hatch where it fits, and `hasEdge`, a dashed rule where its hatch starts.
- `HatchedRange` type.
- `--tooltip-muted-text-color`, `--tooltip-separator-color` and `--tooltip-border`: the colour of the tooltip's `comparison` row, a mix of 70% `--text-color` and 30% `--tooltip-background` by default, the colour of the rule under it, `--grid-lines` by default, and a border of the balloon, `none` by default.
- The README lists the classes of the tooltip that stay stable for the rules of a page: `.lovely-chart--tooltip-balloon`, `-title`, `-title-total`, `-title-note`, `-dataset`, `-dataset-value`, `-dataset-comparison`, `-swatch`, `-change[data-tone]` and `-notes`.
- `--lovely-chart-balloon-z-index`: the `z-index` of the tooltip balloon, read from the chart's element or an ancestor, `auto` by default. Set above the `z-index` of an overlay added after the chart, it places the overlay over the hover line and under the balloon, as the README shows.
- `resolveTooltipNotes`: notes of the tooltip at a label, `(labelValue, datasetIndexes, labelIndex) => { titleNote?, notes? } | undefined`, in `--tooltip-muted-text-color`. A `titleNote` follows the date in `.lovely-chart--tooltip-title-note`, before a title total, and `notes` are lines below the rows in `.lovely-chart--tooltip-notes`, under a rule in `--tooltip-separator-color`, wrapped to the width of the rows. They change with the rows, for a pointer, a touch or `selectLabel()`; ignored on pie and donut charts.
- `hatchedRanges[*].note` and `hatchedRanges[*].titleNote`: notes of the tooltip at each label of a range. Range notes come first, in range order, then those of `resolveTooltipNotes`; each splits into lines at `\n`, and a line shown already is left out. The `titleNote` of `resolveTooltipNotes` wins over a range's, and among ranges the first wins.
- `TooltipNotes` type.

### Changed

- The `comparison` row of the tooltip takes `--tooltip-muted-text-color` in place of an opacity of 0.7. Its text keeps the shade the opacity gave it, on a page's own skin too, while its swatch and the tone of a rise or a fall keep their full colours. In the day and the night skin the text reaches a contrast of 4.5:1 on the tooltip background.
- A `comparison` change that rounds to 0% keeps the weight of its value, normal by default, in place of bold; a rise or a fall stays bold.

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
