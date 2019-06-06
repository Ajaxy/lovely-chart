# LovelyCharts

🏆 A [Telegram Chart Contest 2019](https://contest.dev/chart-js) award winning library.

`mobile friendly`, `high performance`, `zero dependency`, `production ready`, `open source`

## Demo

https://ajaxy.github.io/LovelyCharts/latest

## Usage

`LovelyChart.render(container, chart)` — Renders a graph inside the container element.

- `container` — DOM Node in which the chart is rendered. The graph layout resizes automatically to occupy the entire available width.

- `chart` — Parameters for a graph.

Param|Description|
---------|----|
`title`| Graph title
`columns`| List of all data columns in the chart. Each column has its label at position 0, followed by values. `x` values are UNIX timestamps in milliseconds
`types`| Chart types for each of the columns. Supported values: `line`, `area`, `bar`, `x`
`colors`| Color for each variable in 6-hex-digit format (e.g. `#FF0000`)
`names`| Name for each variable
`percentage` | `true` for percentage based values
`stacked`| `true` for values stacking on top of each other
`y_scaled`| `true` for charts with 2 Y axes
`x_on_zoom`| Optional function which returns `Promise` with data for the zoomed chart (new `chart` object)
