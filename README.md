# LovelyChart

🏆 A [Telegram Chart Contest 2019](https://contest.dev/chart-js) award winning library.

`mobile friendly`, `high performance`, `extra lightweight`, `zero dependency`, `production ready`, `open source`

<a href="https://www.npmjs.com/package/lovely-chart" target="_blank"><img src="https://img.shields.io/npm/v/lovely-chart.svg"/></a> <img alt="lightweight chart js library" src="https://badgen.net/bundlephobia/minzip/lovely-chart">

## Demo

https://ajaxy.github.io/lovely-chart/

<img height="400" src="http://chatik.ajaxy.ru/uploads/lovely-chart.png" /> <img height="400" src="http://chatik.ajaxy.ru/uploads/lovely-chart-3.png" />

## Usage

```js
import * as LovelyChart from 'lovely-chart';
import '~/lovely-chart/dist/LovelyChart.css';

const chart = LovelyChart.create(container, data);

// Replace the chart data and re-render.
chart.update(newData);

// Tear down the chart: removes the DOM, detaches all global listeners
// (window resize/orientation, document mousemove/touchstart, theme
// MutationObserver), cancels pending animation frames and timeouts.
chart.destroy();
```

#### Arguments for `LovelyChart.create`
- `container` — DOM Node in which the chart is rendered. The chart layout resizes automatically to occupy the entire available width.
- `data` — Parameters for a chart.

#### Returned instance
`create` returns an object with the following methods:

Method | Description |
---------|----|
`update(newData)` | Replaces the current data with `newData` (same shape as the initial `data` argument) and re-renders. Resets transient view state (zoom, range, filter). No-op after `destroy()`.
`destroy()` | Tears down the chart: removes the DOM subtree from `container`, detaches all global listeners (window `resize` / `orientationchange`, document `mousemove` / `touchstart`, theme `MutationObserver`), cancels pending animation frames and timeouts. Idempotent. Call this from your framework's cleanup hook (e.g. React `useEffect` cleanup) to avoid resource leaks.

#### Data parameters

Parameter | Description |
---------|----|
`title`| Chart headline
`type`| Chart type. Supported types: `line`, `area`, `bar`, `pie`
`labels`| Array of UNIX timestamps in milliseconds, or arbitrary strings for text labels
`labelType`| Optional X-axis label kind: `year`, `month`, `week`, `day`, `hour`, `5min`, `dayHour` or `text`. When omitted, it is inferred from the first two `labels` records: strings → `text`, timestamps → `year`/`month`/`week`/`day`/`hour`/`5min` depending on the step between them. `year` labels render as `2026`, `month` as `January`, `week` as `Week 1` (week of the year). Charts with `text` labels show no header caption.
`datasets`| Array of params for each dataset
`datasets[*].name`| Dataset name
`datasets[*].color`| Dataset color
`datasets[*].values`| Array of dataset values
`isPercentage` | `true` for percentage based values
`isStacked`| `true` for values stacking on top of each other
`hasSecondYAxis`| `true` for charts with 2 Y axes
`valuePrefix`| Optional string prepended to every formatted value (e.g. `$`)
`valueSuffix`| Optional string appended to every formatted value
`prefixIsCurrency`| When `true`, a negative value is rendered with the minus sign in front of `valuePrefix` (`-$9.1` instead of `$-9.1`). Use with currency-like prefixes. Default `false`.
`withMinimap`| `true` to render the minimap with the draggable range selector below the chart. Default `false`.
`minimapRange`| Initially selected range: a `[begin, end]` tuple of fractions between 0 and 1 (e.g. `[0.8, 1]` for the last 20%), or the `'full'` keyword for the entire range. Defaults to `[0.8, 1]` when the minimap is shown, otherwise to `'full'`.
`onZoom`| Optional function which returns `Promise` with data for the zoomed chart (new `data` object)
