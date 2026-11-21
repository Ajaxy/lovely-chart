# Introduction

LovelyChart is a small, dependency-free library of Telegram-style interactive charts for the web, minimalist and lovely out of the box. Give it an element and your data, and it draws a line, area, bar, step, pie or donut chart on canvas, with a tooltip, a legend, a draggable minimap and drill-down zooming built in.

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars.json').then((r) => r.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit sales',
  // A click on a day opens its shares as a donut
  zoomToShares: true,
  zoomType: 'donut',
  isUtc: true,
});
```

Try it out:

- Point at a day to read its values in the tooltip.
- Drag the window under the plot to show another period, or pull its edges to show a longer or shorter one.
- Click a fruit in the legend to hide or show it. Press and hold one to show it alone.
- Click a day to drill into its shares, then use **Zoom out** to go back. On a touch screen, tap the tooltip instead.

LovelyChart draws the statistics of [Telegram Web](https://web.telegram.org/a/) and the portfolio charts of [My Wallet](https://mywallet.io). It is an award winner of the [Telegram Chart Contest](https://contest.dev/chart-js).

## Why LovelyChart

- **Small and self-contained.** It has no dependencies: you get one ES module and one stylesheet. Importing it touches neither the DOM nor `window`, so it's safe to import in server-rendered apps.
- **Six chart types.** Line, area, bar, step, pie and donut. Areas and bars stack, and areas can show percentages. You can draw some datasets as lines, bars or steps over another chart type, put one dataset on a second Y axis, or shrink a chart to a sparkline. See [Chart types](chart-types.md).
- **Built for exploring.** A minimap under the plot holds a window that the reader drags and resizes to pick a period. You can also let a mouse select a period by dragging across the plot. Range changes, legend toggles and zooms all animate smoothly.
- **Drill-down zoom.** A click on a label opens its shares as a pie or donut, or loads more detailed data of your own, such as the hours of a day. See [Zoom](zoom.md).
- **Tooltip and legend.** The tooltip lists the values at a label, with a total for stacked charts, the change against a previous period and notes of your own. The legend buttons show and hide datasets.
- **Day and night skins.** The chart follows a `theme-dark` class on `<html>`, or the system's colour scheme. Every colour option takes a CSS colour, a pair of colours with one for each skin, or a `var()` of your page. See [Theming](theming.md).
- **Annotations.** Reference lines at fixed values, hatched ranges for forecasts and estimates, event lines for launches and outages, and a dashed line for a previous period. See [Annotations](annotations.md).
- **Touch-friendly and fast.** Everything works by touch, and it's fast enough for low-end mobile devices.
- **Fits into your page.** CSS variables set the plot height, spacing and fonts. You can move the legend into an element of your own, react to the reader through callbacks, and place your own elements over the plot. See [Layout](layout.md) and [Overlays](overlays.md).
- **Accessible.** The plot is announced as an image with a summary of its data, the legend buttons work from the keyboard, and with `isKeyboardSelectable` the arrow keys step through the labels. See [Accessibility](accessibility.md).
- **Typed.** TypeScript declarations ship in the package.

## What it's for, and what it isn't

LovelyChart is a good fit for:

- Time series on dashboards, admin panels and statistics pages: yearly, monthly, weekly, daily, hourly or five-minute data.
- Comparing a few series, or showing how a total splits into parts, over time.
- Categories with text labels, such as the days of the week.
- Pages that people use on phones, where charts have to work by touch.

Look elsewhere if you need:

- **Other kinds of chart.** It draws the six types above, so there are no scatter, bubble, radar, candlestick or heatmap charts, and no maps.
- **A numeric X axis.** The X axis is a sequence of labels, timestamps or text, each an equal step apart. There's no way to place a value between two labels, or at a distance set by its time.
- **Charts without a browser.** LovelyChart draws into a page's DOM and canvas, so it can't render a chart on a server, and it has no API to export one as an image.

## How it works

You create a chart with `new LovelyChart(element, params)`. It builds itself inside `element`, takes its full width, and stays interactive until you call `destroy()`. `params` is a plain object: the chart `type`, the `labels` along the X axis, the `datasets` with their values, and any options you need.

```js
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

const chart = new LovelyChart(document.getElementById('chart'), {
  title: 'Online users',
  type: 'line',
  labels: [1735689600000, 1735776000000, 1735862400000],
  datasets: [
    { name: 'Desktop', values: [1274, 1305, 1288] },
    { name: 'Mobile', values: [2861, 2914, 2950] },
  ],
});

// Later: new data, then cleanup
chart.update(nextParams);
chart.destroy();
```

The instance has a few more methods for driving the chart from your page, such as `selectLabel()`, `zoomOut()` and `setLoading()`. See the [API reference](api.md).

## Where to go next

- [Installation](installation.md): npm, a CDN, TypeScript and browser support.
- [Your first chart](getting-started.md): a step-by-step walkthrough, from an empty element to a chart with a minimap.
- [Using with frameworks](frameworks.md): React, Vue, Svelte, Angular and Web Components.
- [Data format](data.md): labels, datasets, gaps and colours.
- [Chart types](chart-types.md): every type, and which one to pick.
- [API reference](api.md): every option and method, in full.
