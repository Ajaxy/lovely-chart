# Changelog

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
