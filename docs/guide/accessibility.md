# Accessibility

A chart is a picture of data, and a picture needs help to reach every reader. This page covers what the chart does on its own for assistive technology, keyboards and reduced motion, and the few things your page adds to make a chart work for everyone.

## What the chart exposes

Out of the box, a chart gives assistive technology:

- **A named image for the plot.** The plot takes `role="img"` and an accessible name that sums up the data it shows, as "Line chart, 1 Nov 2025 — 5 Nov 2025: Desktop, Mobile": its type, the span of its labels and the names of its datasets.
- **Legend buttons.** Each dataset's legend entry has `role="button"` and `aria-pressed`, `true` while the dataset shows. The buttons are in the tab order and toggle with <kbd>Enter</kbd> and <kbd>Space</kbd>. The legend always keeps at least one dataset shown.
- **No role on the chart element.** Only the plot is an image, so the legend buttons beside it stay reachable rather than becoming part of the picture.

The name of the plot follows the data: a zoom in or out and `update()` name it from the data they bring, as "Pie chart, …" for a zoom into the shares of a label. Dates span the way the header's caption names a range, in your [`dateLocale`](api.md#dateLocale), and text labels from the first to the last, as "Bar chart, Mon — Sun: Orders".

## Naming the plot

The summary tells a reader what the chart is, but not what it shows. When the point of the chart is a finding, say it with [`ariaLabel`](api.md#ariaLabel):

```js
new LovelyChart(element, {
  ...params,
  ariaLabel: 'Orders by channel, last 30 days: web orders up 12% on the 30 days before',
});
```

A name you give stays across a zoom, so write one that holds for the zoomed views too, or update it with the data. The summary is in English, so on a page in another language, give every chart an `ariaLabel` in that language.

An empty string, `ariaLabel: ''`, leaves the plot out of the accessibility tree with `aria-hidden`. Use it where the page already says what the plot shows: a sparkline beside the figure and the name of its row, or a chart followed by a table of the same numbers.

## Keyboard

Two parts of a chart take the keyboard:

- The **legend buttons**, reachable with <kbd>Tab</kbd>, which show and hide datasets with <kbd>Enter</kbd> or <kbd>Space</kbd>.
- The **plot**, with [`isKeyboardSelectable`](api.md#isKeyboardSelectable). It joins the tab order, and <kbd>←</kbd> and <kbd>→</kbd> step the selection label by label, while <kbd>Home</kbd> and <kbd>End</kbd> select the first and the last label on screen. The tooltip shows as on hover, and the plot keeps the focus through `update()` and a resize, which rebuild it. See [Keyboard selection](interaction.md#keyboard-selection) for the details.

The rest takes a pointer. Zooming into a label takes a click or a tap, the minimap and [`isRangeSelectable`](api.md#isRangeSelectable) take a drag, and the zoom-out control in the header is a plain element that takes clicks, not a focusable button. Where these matter to your readers, give them controls of the page:

- A zoom-out button of your own: set [`noZoomOutControl`](api.md#noZoomOutControl) and call [`zoomOut()`](api.md#zoomOut) from a `<button>`, as in [A zoom-out control of your own](interaction.md#a-zoom-out-control-of-your-own).
- Buttons for the periods a reader needs, in place of a minimap drag, as the [period switcher](updating.md#a-period-switcher) does.
- A list of labels that selects them with [`selectLabel()`](api.md#selectLabel), as in [Linking a chart with a list](interaction.md#linking-a-chart-with-a-list).

## A readout for screen readers

The tooltip balloon is HTML, but it isn't a live region, so a screen reader doesn't announce it as the selection moves. To make the selected values heard, write them into a live region of your page from [`onTooltipChange`](api.md#onTooltipChange), which reports what the tooltip shows on every change, by pointer, touch, keyboard or `selectLabel()`.

The `<p aria-live="polite">` below is the page's own markup: the chart knows nothing about it. Focus the chart and step through the days with the arrow keys:

```html live
<div id="orders"></div>
<!-- The page's own live region, filled from onTooltipChange -->
<p id="orders-readout" class="readout" aria-live="polite">Focus the chart and press ← or → to read a day.</p>
<style>
  .readout { margin: 0 10px; min-height: 2.8em; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const readout = document.getElementById('orders-readout');
  const format = (value) => (value === null ? 'no data' : value.toLocaleString('en-US'));

  new LovelyChart(document.getElementById('orders'), {
    title: 'Orders by channel',
    type: 'bar',
    isStacked: true,
    labels: days(14),
    datasets: [
      { name: 'Web', values: series(14, { start: 640, seasonality: 0.15, seed: 41 }) },
      { name: 'App', values: series(14, { start: 420, seasonality: 0.1, seed: 42 }) },
    ],
    isUtc: true,
    isKeyboardSelectable: true,
    ariaLabel: 'Orders by channel, daily, for the last 14 days',
    onTooltipChange: (tooltip) => {
      // Keeps the last reading once nothing is selected
      if (!tooltip) return;
      const rows = tooltip.rows.map(({ name, value }) => `${name} ${format(value)}`).join(', ');
      readout.textContent = `${tooltip.title}: ${format(tooltip.total)} orders. ${rows}.`;
    },
  });
</script>
```

`polite` lets the reader finish hearing one day before the next. The readout is visible here, which helps sighted keyboard users too; to keep it for screen readers alone, hide it visually with your usual "visually hidden" class rather than `display: none`, which a screen reader skips.

To show the readout *in place of* the balloon on small screens, set [`--lovely-chart-balloon-display: none`](css.md#--lovely-chart-balloon-display) in a media query: the balloon hides while the selection and `onTooltipChange` go on. See [Your own readout](tooltip.md#your-own-readout).

## Motion

When the reader's system asks for reduced motion, `prefers-reduced-motion: reduce`, the chart:

- swaps the data of [`update()` with `isAnimated`](updating.md#cross-fading) at once, in place of the cross-fade;
- shows the skeleton of a [loading chart](updating.md#loading-states) without its pulse.

The chart's other animations, as the transitions of a zoom and of a dataset shown or hidden, don't consult the setting.

## Loading charts

While a chart is loading, by [`isLoading`](api.md#isLoading) or [`setLoading(true)`](api.md#setLoading), the chart and its legend are `inert`: they take no pointer, focus or keyboard input, and leave the accessibility tree. The chart a cross-fade replaces is out of reach in the same way while it fades out.

So a loading chart says nothing to a screen reader. If the wait is long enough to matter, tell the reader in your page's own words, as a status message that you set before the fetch and clear after it:

```html
<!-- The page's own markup -->
<p class="visually-hidden" role="status" id="orders-status"></p>
```

```js
const status = document.getElementById('orders-status');

status.textContent = 'Loading orders…';
chart.setLoading(true);
chart.update({ ...params, ...(await fetchOrders(period)) });
status.textContent = '';
```

## Colour and contrast

### Don't rely on colour alone

Lines that differ in colour alone are hard to tell apart for many readers. [`isDashed`](api.md#datasets-isDashed) and [`isDotted`](api.md#datasets-isDotted) draw a `line` or `step` dataset in dashes or dots, and the legend button and the tooltip swatch of the dataset take a matching dashed or dotted outline, so the key reads without colour too:

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'Active users by platform',
  type: 'line',
  labels: days(30),
  datasets: [
    { name: 'iOS', color: '#3497ED', values: series(30, { start: 1800, seed: 51 }) },
    { name: 'Android', color: '#3497ED', values: series(30, { start: 1200, seed: 52 }), isDashed: true },
    { name: 'Web', color: '#3497ED', values: series(30, { start: 600, seed: 53 }), isDotted: true },
  ],
  isUtc: true,
});
```

The other marks follow the same idea: the `comparison` line is always dashed, [event lines](annotations.md#event-lines) can be dashed or dotted, and [hatched ranges](annotations.md#hatched-ranges) mark a run of labels with a pattern and a label rather than a tint.

### Text contrast

- The comparison row and the notes of the tooltip take `--tooltip-muted-text-color`, a mix of 70% `--text-color` and 30% `--tooltip-background`. In the built-in day and night skins it reaches a contrast of 4.5:1 on the tooltip background. The mix follows a [skin of your own](theming.md#writing-a-skin-of-your-own), so check the contrast of your colours, and set [`--tooltip-muted-text-color`](css.md#--tooltip-muted-text-color) per skin if it falls short.
- A checked legend button keeps its white label while that reaches a contrast of 2:1 on the dataset's colour; on paler colours, where a dark label reads clearer, it takes `#222222`. Among the default colours, the light green `#9ED448` and the amber `#F5BD25` take the dark label.
- On a surface of your own, set [`axisTextColor`](api.md#axisTextColor) to a colour that reads on it, and [`backgroundColor`](api.md#backgroundColor) to the surface, so the halos around labels match it.

## A checklist

- Give each chart an [`ariaLabel`](api.md#ariaLabel) that says what it shows, in the language of the page, or `''` where the page says it already.
- Set [`isKeyboardSelectable`](api.md#isKeyboardSelectable), and read the selection out through [`onTooltipChange`](api.md#onTooltipChange) into a live region.
- Offer page controls for the zoom and the periods your readers need.
- Tell datasets apart by more than colour, with `isDashed` and `isDotted`.
- Where the numbers matter, offer them as a table too.
