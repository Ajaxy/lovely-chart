# Changelog

## 2.0.0 (unreleased)

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
