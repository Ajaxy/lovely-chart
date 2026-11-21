# Installation

LovelyChart ships as one ES module and one stylesheet. Install it from npm for an app with a bundler, or load both files from a CDN for a plain HTML page.

## Install from npm

Add the package with your package manager:

```bash
npm install lovely-chart
```

```bash
yarn add lovely-chart
```

```bash
pnpm add lovely-chart
```

## Import the module and the stylesheet

Import the `LovelyChart` class, the default export, and the stylesheet:

```js
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

const chart = new LovelyChart(document.getElementById('chart'), params);
```

The stylesheet lays out the header, the minimap, the legend and the tooltip, and holds the colours of the day and night skins as CSS variables. A chart needs it, so import it once for your whole app, for example in your entry file.

Besides the class, the module has three named exports for elements of your page that show the same series as a chart, such as a table beside it:

| Export | What it is |
| --- | --- |
| [`getDefaultColors(datasetCount)`](api.md#getDefaultColors) | The colours a chart of that many datasets gives the datasets with no `color` |
| [`DEFAULT_COLORS`](api.md#DEFAULT_COLORS) | The eight default colours, in order |
| [`DEFAULT_COMPARISON_COLOR`](api.md#DEFAULT_COMPARISON_COLOR) | The colour of the `comparison` line when it sets none |

```js
import LovelyChart, { getDefaultColors } from 'lovely-chart';
```

### Import paths

The package's `exports` field makes three paths public:

| Path | File |
| --- | --- |
| `lovely-chart` | `dist/LovelyChart.js`, with its types in `dist/LovelyChart.d.ts` |
| `lovely-chart/LovelyChart.css` | `dist/LovelyChart.css` |
| `lovely-chart/package.json` | `package.json` |

> [!WARNING]
> Bundlers and Node refuse paths into `dist/` that `exports` doesn't list, such as `lovely-chart/dist/LovelyChart.css`. Import the stylesheet as `lovely-chart/LovelyChart.css`.

If your build doesn't handle CSS imports, copy `node_modules/lovely-chart/dist/LovelyChart.css` to where your site serves static files, and link it from your HTML with a `<link rel="stylesheet">`.

### Modules and tree shaking

- **ES module only.** There's no CommonJS or UMD build. Load the package with `import`, or with a dynamic `import()` from CommonJS code.
- **Free of side effects.** `package.json` marks only the stylesheets as side effects, so `import 'lovely-chart/LovelyChart.css'` stays in your bundle, and the JavaScript you don't use can be dropped.
- **Minified.** The build is minified, 33 KB gzipped, so a page that loads it from a CDN downloads no more than a bundle would hold.

## Use it from a CDN

Without a bundler, load both files from [jsDelivr](https://www.jsdelivr.com/). The neatest way is an import map, which lets your scripts import `lovely-chart` by name, as they would with a bundler:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lovely-chart@2/dist/LovelyChart.css">

<script type="importmap">
  {
    "imports": {
      "lovely-chart": "https://cdn.jsdelivr.net/npm/lovely-chart@2/dist/LovelyChart.js"
    }
  }
</script>

<div id="chart"></div>

<script type="module">
  import LovelyChart from 'lovely-chart';

  new LovelyChart(document.getElementById('chart'), {
    title: 'Orders',
    type: 'bar',
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ name: 'Orders', values: [412, 438, 451, 469, 520, 610, 574] }],
  });
</script>
```

For a single script, you can import the module from its URL instead:

```html
<script type="module">
  import LovelyChart from 'https://cdn.jsdelivr.net/npm/lovely-chart@2/dist/LovelyChart.js';
</script>
```

A module script runs once the document has been parsed, so the chart's element already exists when it runs.

> [!TIP]
> `lovely-chart@2` follows the latest 2.x release. In production, pin the exact version you've tested, such as `lovely-chart@2.3.0`, in both URLs.

## TypeScript

The package ships its TypeScript declarations, so there's nothing else to install. They resolve through the package's `exports`, with `moduleResolution` set to `node16` or `nodenext` too.

```ts
import LovelyChart, { type LovelyChartParams } from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

const params: LovelyChartParams = {
  title: 'Orders',
  type: 'line',
  labels: [Date.UTC(2026, 10, 16), Date.UTC(2026, 10, 17), Date.UTC(2026, 10, 18)],
  datasets: [{ name: 'Orders', values: [412, 438, null] }],
  isUtc: true,
};

const chart: LovelyChart = new LovelyChart(document.getElementById('chart')!, params);
```

The module exports these types:

| Type | Describes |
| --- | --- |
| `LovelyChartParams` | The params of the constructor and of `update()`, and the data that `onZoom` resolves to |
| `LovelyChartDatasetParams` | One entry of `datasets` |
| `LovelyChartUpdateOptions` | The second argument of `update()` |
| `LovelyChartInstance` | The `update()` and `destroy()` methods of a chart, as a structural type for test stubs |
| `ChartType` | The chart types: `'line'`, `'bar'`, `'step'`, `'area'`, `'pie'` and `'donut'` |
| `LabelType` | The values of `labelType` |
| `ThemedColor` | A colour option: a CSS colour, or `{ light, dark }` |
| `DateLocale` | The localised date strings of `dateLocale` |
| `SecondaryYAxisConfig` | The `secondaryYAxis` scale |
| `ReferenceLine` | One entry of `referenceLines` |
| `HatchedRange` | One entry of `hatchedRanges` |
| `EventLine` | One entry of `eventLines` |
| `Comparison` | The previous period of `comparison` |
| `TooltipContent` | What `onTooltipChange` reports |
| `TooltipNotes` | What `resolveTooltipNotes` returns |

`LovelyChartInstance` lets a test hand your code a stand-in for a chart:

```ts
import type { LovelyChartInstance } from 'lovely-chart';

const chart: LovelyChartInstance = {
  update() {},
  destroy() {},
};
```

See [Types](api.md#types) in the API reference for their full shapes.

## Browser support

LovelyChart runs in current browsers on desktop and mobile, by mouse, touch and keyboard.

- **Modern JavaScript.** The bundle targets `esnext`: it keeps the syntax of its source as it is, including native `#private` class members. A browser that lacks them can't load the module; Safari 14 is one. To support such a browser, have your bundler transpile `lovely-chart` along with your own code.
- **The project's target.** The repository's `.browserslistrc` reads `> 0.5%, not ie 11, not edge 17`. Internet Explorer isn't supported.
- **Server-side rendering.** Importing the package touches neither the DOM nor `window`, so a server can import it. Create charts only in the browser: see [Using with frameworks](frameworks.md#server-side-rendering).

## Upgrading from 1.x

Version 2.0 changed how you create a chart. The main changes:

- `LovelyChart.create(element, data)` is gone. The class is the default export, and you create a chart with `new`:

  ```js
  // 1.x
  import * as LovelyChart from 'lovely-chart';
  const chart = LovelyChart.create(element, data);

  // 2.x
  import LovelyChart from 'lovely-chart';
  const chart = new LovelyChart(element, data);
  ```

- The `isDonut` parameter is gone: a donut is a type of its own, `type: 'donut'`.
- Pie and donut charts no longer need `isStacked` or `isPercentage`, and `isPercentage` no longer makes them zoomable.
- The internal class `lovely-chart--container-type-pie` is now `lovely-chart--container-type-circle`, so update any styles that target it.

The package's `CHANGELOG.md` lists every change since.
