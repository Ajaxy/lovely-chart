# CSS variables and classes

The chart reads custom properties for its sizes, its spacing, its fonts and the colours of its skins, and sets a few of its own for the page to place elements by. Set them on the chart's element or any ancestor, as a media query or a theme of the page needs.

```css
.chart {
  --lovely-chart-plot-height: 240;
  --lovely-chart-font-family: inherit;
  --lovely-chart-inset: 0;
}

@media (min-width: 60rem) {
  .chart {
    --lovely-chart-plot-height: 360;
  }
}
```

## Layout

See [Layout, sizing and fonts](layout.md).

Variable | Description |
---------|----|
`--lovely-chart-plot-height`| Plot canvas height, read from the chart element or an ancestor, ahead of `plotHeight`: a unitless number of px, `px` or `rem`.
`--lovely-chart-header-height`| Height of the header band, and line height of its title and caption, read from the chart element or an ancestor. Default `30px`.
`--lovely-chart-header-margin-top`| Space above the header band, read from the chart element or an ancestor. Default `0`.
`--lovely-chart-plot-margin-top`| Space between the header band and the plot canvas, read from the chart element or an ancestor. Default `10px`; a sparkline has none. The hover line and dots of the tooltip follow the plot canvas when these variables or a style of the page move it by resizing the chart's layout or its header, as a folded header.
`--lovely-chart-empty-header-height`| Height of a header with nothing to show, with no `title` and no caption because of `noCaption` or text labels, read from the chart element or an ancestor: 0 by default, so the plot starts at the top of the chart, and while zoomed the zoom-out control floats over the top inline-start corner of the plot. A length such as `1rem` keeps a band, as to level the plots of a row where another chart shows a caption; a header that shows something takes `--lovely-chart-header-height`.

## Typography

Variable | Description |
---------|----|
`--lovely-chart-font-family`| Font family of the chart's text, read from the chart element or an ancestor: the header, the legend, the tooltip and the labels the canvas draws, those of the axes in the regular weight, and those of reference lines, hatched ranges, event lines and pie sectors in weights of their own. Default `'-apple-system', 'HelveticaNeue', Helvetica, Arial, sans-serif`. A custom property set to `inherit` takes the variable of the parent, not its font, so a chart in the font of the page takes the page's family list, or a `var()` that holds it. A legend in `legendContainer` reads it from that element or an ancestor, and keeps the family of that element while it is unset.
`--lovely-chart-font-weight`| Regular weight of the chart's text, read from the chart element or an ancestor: the legend, the names in the tooltip and the axis labels. Default `300`. A legend in `legendContainer` reads it from that element or an ancestor.
`--lovely-chart-font-weight-bold`| Weight of the chart's bold text, read from the chart element or an ancestor: the header and its zoom-out control, the tooltip title and the total beside it, the values, the Total row, a rise or a fall against the `comparison` and the shares of a percentage chart. Default `bold`.

## Spacing the chart

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

Variable | Description |
---------|----|
`--lovely-chart-inset`| Side inset of the header, the minimap and the legend. Default `10px`. The minimap canvas takes the width it leaves. The plot keeps its own 10px gutter, so another inset moves the header, the minimap and the legend off the line of its Y-axis labels and grid.
`--lovely-chart-minimap-margin-bottom`| Space under the minimap, above the legend when the chart holds it. Default `16px`.
`--lovely-chart-legend-gap`| Space between the legend entries, as the CSS `gap`: one length, or a row gap and a column gap. Default `8px 6px`.
`--lovely-chart-legend-padding-bottom`| Space under the last row of the legend. Default `24px`; `0` ends the chart at the legend.
`--lovely-chart-button-padding`| Padding on every side of a legend button, one length, which also places its check mark. The comparison entry takes it above and below its name. Default `7px`.
`--lovely-chart-button-radius`| Corner radius of a legend button. Default `18px`.
`--lovely-chart-button-font-size`| Font size of the legend buttons and the comparison entry. Defaults to the font size around them, the chart's 13px.

## Skin colours

The day and the night skin set these colours on `.lovely-chart--container`. See [Theming and colours](theming.md).

Variable | Description |
---------|----|
`--background-color`, `--text-color`, `--grid-lines`, `--tooltip-background` and the other variables on `.lovely-chart--container`| The colours of the day and the night skin. Night colours of your own go under `html.theme-dark .lovely-chart--container:not(.lovely-chart--container-scheme-system)` for the default `colorScheme`, and under `.lovely-chart--container.lovely-chart--container-scheme-system` inside `@media (prefers-color-scheme: dark)`, in a stylesheet after the library's, for `'system'`, so neither reaches a chart of the other scheme.
`--tooltip-change-positive`, `--tooltip-change-negative`| Colours of a rise and a fall of the `comparison` change in the tooltip.
`--tooltip-muted-text-color`| Colour of the `comparison` row and the notes of the tooltip. Defaults to a mix of 70% `--text-color` and 30% `--tooltip-background`, which follows a skin of your own and reaches a contrast of 4.5:1 on the tooltip background in the day and the night skin. A colour of your own goes per skin, as the colours above.
`--tooltip-separator-color`| Colour of the rule under the `comparison` row of the tooltip and of the rule over its notes. Defaults to `--grid-lines`.
`--tooltip-border`| Border of the tooltip balloon, as `1px solid #D2D5D7`. Default `none`.
`--skeleton-color`| Colour of the skeleton a loading chart draws in place of data with no labels, `isLoading`, one in each skin as the colours above. A legend in `legendContainer` reads it from that element or an ancestor, and takes a translucent grey while it is unset.
`--range-selection-color`| Colour of the edges of the band `isRangeSelectable` draws while a mouse drags across the plot, and, at 12% over the plot, of its fill, one in each skin as the colours above: `#108BE3` by day and `#48AAF0` by night. The band is `.lovely-chart--range-selection`.

The skins declare these values, in the DOM parts of the chart: its header, legend, tooltip and minimap. The canvas draws the grid, the axis labels and the hover dots in colours of its own skin, which [`axisTextColor`](api.md#axisTextColor) and [`backgroundColor`](api.md#backgroundColor) set.

Skin variable | Day | Night | Colours |
---------|-----|-------|----|
`--background-color` | `#ffffff` | `#242F3E` | The backdrop of the zoom-out control that floats over the plot
`--text-color` | `#222222` | `#ffffff` | The text of the header, the legend and the tooltip
`--tooltip-background` | `#ffffff` | `#1c2533` | The tooltip balloon
`--grid-lines` | `rgba(24, 45, 59, 0.1)` | `rgba(255, 255, 255, 0.1)` | The ring of a tooltip swatch, and the default of `--tooltip-separator-color`
`--zoom-out-text` | `#108BE3` | `#48AAF0` | The zoom-out control
`--minimap-mask` | `rgba(226, 238, 249, 0.6)` | `rgba(48, 66, 89, 0.6)` | The minimap outside its window
`--minimap-slider` | `#C0D1E1` | `#56626D` | The frame and the ears of the minimap window
`--minimap-limit-color` | `#616770` | `#BFC0C2` | The dashed edge and the lock of the `limitDate` mask
`--tooltip-change-positive` | `#108BE3` | `#48AAF0` | A rise against the `comparison`
`--tooltip-change-negative` | `#E65850` | `#F07068` | A fall against the `comparison`
`--skeleton-color` | `rgba(24, 45, 59, 0.1)` | `rgba(255, 255, 255, 0.1)` | The skeleton of a loading chart
`--range-selection-color` | `#108BE3` | `#48AAF0` | The band of a range selection

## Tooltip

Variable | Description |
---------|----|
`--lovely-chart-balloon-display`| The `display` of the tooltip balloon, read from the chart element or an ancestor: `block` by default. `none` hides the balloon alone and keeps the rest of a selection, the hover line and dots, the focus of a bar and the calls of `onSelectedIndexChange` and `onTooltipChange`, so a media query can swap the balloon for a readout of the page. A touch screen zooms by a tap on the balloon, so there `none` takes that zoom away too.

### Styling the tooltip

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

## Set by the chart

The chart writes these on elements of its own and on `element`, for the page to read. See [Overlays and custom marks](overlays.md).

Variable | Description |
---------|----|
`--lovely-chart-series-color`| Set by the chart on each legend button, on the comparison legend entry and on each tooltip swatch: the colour of its dataset or line in the skin on screen, as `rgba()`. A legend button takes its outline, its label and its checked fill from it.
`--lovely-chart-plot-area-left`, `--lovely-chart-plot-area-top`, `--lovely-chart-plot-area-width`, `--lovely-chart-plot-area-height`| Set by the chart on `element`, as px lengths from the inside of its border: the data area of the plot, where a window over every label and the Y range draw. It runs from the start of the plot, after an `isYAxisOutward` column, to its end, and from the top of the Y range to the X-axis baseline. A pie or donut sets the square around its circle, and a sparkline its plot inset by 2px. The chart sets them from its first paint, the frame after it is created, and rewrites them when the area changes: on `update()`, a resize or an orientation change, a zoom into data of another label column or into a pie, when a web font of the page changes the axis font, and when a style of the page moves the plot by resizing the chart's layout or its header, as a header folded while its caption is empty. `destroy()` removes them.
`--lovely-chart-plot-padding-top`| Set by the chart on `element` beside the `--lovely-chart-plot-area-*` variables, and removed with them: the room in the plot above the top of the Y range, `15px`, or `2px` on a sparkline, for marks that rise above the data.
