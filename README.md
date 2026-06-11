# LovelyChart

<a href="https://www.npmjs.com/package/lovely-chart" target="_blank"><img alt="npm version" src="https://img.shields.io/npm/v/lovely-chart.svg"/></a>
<a href="https://bundlephobia.com/package/lovely-chart" target="_blank"><img alt="minzipped size" src="https://badgen.net/bundlephobia/minzip/lovely-chart"/></a>
<a href="https://github.com/Ajaxy/lovely-chart/actions/workflows/ci.yml" target="_blank"><img alt="CI status" src="https://github.com/Ajaxy/lovely-chart/actions/workflows/ci.yml/badge.svg"/></a>

## Overview

**LovelyChart** is a tiny, dependency-free library to work with beautiful interactive charts.

It draws line, area, bar, step, pie and donut charts with smooth animated transitions, a draggable minimap for range selection, tooltips, dataset toggling, drill-down zooming and a built-in day/night theme. Everything is touch-friendly and fast enough for low-end mobile devices, at just a few kilobytes over the wire.

🏆 A [Telegram Chart Contest](https://contest.dev/chart-js) award winning library.

## Demo

https://ajaxy.github.io/lovely-chart

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
- `element` — DOM node in which the chart is rendered. The chart layout resizes automatically to occupy the entire available width.
- `data` — Parameters for a chart.

#### Instance methods
The created instance exposes the following methods (the `LovelyChartInstance` type describes this shape structurally, e.g. for test stubs):

Method | Description |
---------|----|
`update(newData)` | Replaces the current data with `newData` (same shape as the initial `data` argument) and re-renders. Resets transient view state (zoom, range, filter). No-op after `destroy()`.
`destroy()` | Tears down the chart: removes the DOM subtree from `element`, detaches all global listeners (window `resize` / `orientationchange`, document `mousemove` / `touchstart`, theme `MutationObserver`), cancels pending animation frames and timeouts. Idempotent. Call this from your framework's cleanup hook (e.g. React `useEffect` cleanup) to avoid resource leaks.

#### Data parameters

Parameter | Description |
---------|----|
`title`| Chart headline
`type`| Chart type. Supported types: `line`, `area`, `bar`, `step`, `pie`, `donut`
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
`isCurrencyPrefix`| When `true`, a negative value is rendered with the minus sign in front of `valuePrefix` (`-$9.1` instead of `$-9.1`). Use with currency-like prefixes. Default `false`.
`withMinimap`| `true` to render the minimap with the draggable range selector below the chart. Default `false`.
`minimapRange`| Initially selected range: a `[begin, end]` tuple of fractions between 0 and 1 (e.g. `[0.8, 1]` for the last 20%), or the `'full'` keyword for the entire range. Defaults to `[0.8, 1]` when the minimap is shown, otherwise to `'full'`.
`onZoom`| Optional function which returns `Promise` with data for the zoomed chart (new `data` object)
`noZoom`| `true` to disable zooming. Default `false`.
`zoomType`| Chart type shown when a percentage chart is zoomed into a single label: `pie` or `donut`. Default `pie`.
