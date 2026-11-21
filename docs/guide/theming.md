# Theming and colours

Every chart comes with a day and a night skin, and switches between them with your page. Your own colours, for datasets and annotations, take any CSS colour, a colour per skin, or a `var()` of your page's design tokens, so a chart can follow your theme without a line of code.

## Day and night

By default, a chart follows the `theme-dark` class on the `<html>` element: without it, the chart shows its day skin, and with it, its night skin. The chart watches the class and repaints in place as it changes, keeping its zoom, range, legend filter and selection:

```js
// Your page's theme switcher
document.documentElement.classList.toggle('theme-dark');
```

To follow the reader's system setting instead, set [`colorScheme`](api.md#colorScheme) to `'system'`. The chart then follows `prefers-color-scheme`, live, and ignores the `theme-dark` class:

```js
new LovelyChart(element, {
  ...params,
  colorScheme: 'system',
});
```

| `colorScheme` | Night skin when |
|---|---|
| `'htmlClassName'` (default) | `<html>` has the `theme-dark` class |
| `'system'` | The system prefers a dark scheme |

The chart has no background of its own: it paints over the background of your page. The skins are made for a white page by day and a dark blue-grey one, `#242F3E`, by night. On other surfaces, set [`backgroundColor`](#backgroundcolor-and-axistextcolor) as well.

## Colour forms

Every colour parameter, `datasets[*].color`, `axisTextColor`, `backgroundColor`, `areaBorderColor`, `comparison.color`, the `color` of `referenceLines`, `hatchedRanges` and `eventLines`, and `colors` in data that `onZoom` returns, takes any of these forms:

| Form | Example | Gives |
|---|---|---|
| A CSS colour | `'#3497ED'`, `'rgb(52 151 237)'`, `'oklch(0.65 0.15 250)'` | The same colour in both skins |
| A colour per skin | `{ light: '#E65850', dark: '#F07068' }` | `light` by day, `dark` by night |
| A hex colour at an opacity | `'#3497ED/0.5'` | `#3497ED` at 50% |
| A custom property | `'var(--color-accent)'` | Whatever the property holds, read inside the chart |
| A colour function of custom properties | `'color-mix(in srgb, var(--color-accent) 60%, var(--color-surface))'` | The mix, read inside the chart |

The colour of a dataset shows wherever the dataset does: on the plot, in the minimap, on its legend button and on its tooltip swatch, all in the colour of the skin on screen.

### Colours from your design tokens

A `var()` colour is computed on a hidden element inside the chart, so it reads the custom properties of `element` and its ancestors, and the chart's own skin properties such as `--text-color`. Whatever the property holds works: hex, `rgb()`, `color-mix()`, `oklch()` and the rest.

The chart reads these colours when it's built, on `update()` and on a zoom, and again on each change of the skin. So tokens that change with your page's theme carry the chart along:

```html live
<style>
  html { --brand: #108BE3; --surface: #FFFFFF; }
  html.theme-dark { --brand: #48AAF0; --surface: #242F3E; }
</style>
<div id="storage"></div>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  new LovelyChart(document.getElementById('storage'), {
    title: 'Storage by tier, TB',
    type: 'bar',
    isStacked: true,
    labels: days(21),
    datasets: [
      // A token of the page, which follows its theme
      { name: 'Hot', color: 'var(--brand)', values: series(21, { start: 42, seed: 81 }) },
      // Mixes of two tokens, as tints of the brand colour
      { name: 'Warm', color: 'color-mix(in srgb, var(--brand) 55%, var(--surface))', values: series(21, { start: 58, seed: 82 }) },
      { name: 'Cold', color: 'color-mix(in srgb, var(--brand) 25%, var(--surface))', values: series(21, { start: 75, seed: 83 }) },
    ],
    // A colour per skin
    referenceLines: [{ value: 220, label: 'Quota', color: { light: '#E65850', dark: '#F07068' } }],
    isUtc: true,
  });
</script>
```

Switch the theme of this site, and the bars follow the tokens.

### Tokens that change on another trigger

The chart watches the class of `<html>`, and with `colorScheme: 'system'` the system setting, but nothing else. When your tokens change on another trigger, as a `data-theme` attribute or a brand picker, call [`refreshColors()`](api.md#refreshColors) after the change. It reads the `var()` colours again and repaints in place, keeping the zoom, range, legend filter and selection:

```html live
<div class="brand-demo" data-brand="ocean">
  <div id="visits"></div>
  <div class="brand-picker">
    <button type="button" value="ocean">Ocean</button>
    <button type="button" value="forest">Forest</button>
    <button type="button" value="sunset">Sunset</button>
  </div>
</div>
<style>
  .brand-demo[data-brand='ocean'] { --brand: #3497ED; --brand-soft: #9CCBF5; }
  .brand-demo[data-brand='forest'] { --brand: #5FB641; --brand-soft: #B5DDA5; }
  .brand-demo[data-brand='sunset'] { --brand: #F79E39; --brand-soft: #FBCF9C; }
  .brand-picker { display: flex; gap: 6px; margin: 0 10px; }
  .brand-picker button { font: inherit; padding: 4px 12px; border-radius: 16px; }
</style>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const brandDemo = document.querySelector('.brand-demo');
  const chart = new LovelyChart(document.getElementById('visits'), {
    title: 'Visits',
    type: 'bar',
    isStacked: true,
    labels: days(14),
    datasets: [
      { name: 'New', color: 'var(--brand)', values: series(14, { start: 820, seed: 91 }) },
      { name: 'Returning', color: 'var(--brand-soft)', values: series(14, { start: 1300, seed: 92 }) },
    ],
    isUtc: true,
  });

  document.querySelectorAll('.brand-picker button').forEach((button) => {
    button.addEventListener('click', () => {
      brandDemo.dataset.brand = button.value;
      // The chart doesn't watch this attribute, so it's told to read its colours again
      chart.refreshColors();
    });
  });
</script>
```

## Default colours

Datasets with no `color` take the default colours in order. The package exports them, so an element of your page that shows the same series, such as a table beside the chart, can match:

| Export | Is |
|---|---|
| [`DEFAULT_COLORS`](api.md#DEFAULT_COLORS) | The eight default colours, in order, as a frozen array |
| [`getDefaultColors(datasetCount)`](api.md#getDefaultColors) | The colours a chart of `datasetCount` datasets gives them, one per dataset |
| [`DEFAULT_COMPARISON_COLOR`](api.md#DEFAULT_COMPARISON_COLOR) | The colour of a `comparison` line with no `color`, `#6B7280` |

A chart of fewer than eight datasets doesn't take the first colours of `DEFAULT_COLORS`, but a subset whose hues stand apart, as `#3497ED` and `#9ED448` for two. So call `getDefaultColors()` with the number of datasets rather than slicing the array:

```html live
<div id="payments"></div>
<table class="payment-totals">
  <thead><tr><th>Method</th><th>Last 30 days</th></tr></thead>
  <tbody></tbody>
</table>
<style>
  .payment-totals { margin: 0 10px; border-collapse: collapse; }
  .payment-totals th, .payment-totals td { padding: 4px 16px 4px 0; text-align: start; }
  .payment-totals td:last-child { text-align: end; font-variant-numeric: tabular-nums; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-inline-end: 8px; border-radius: 3px; }
</style>
<script type="module">
  import LovelyChart, { getDefaultColors } from 'lovely-chart';
  import { days, series } from './demo-data.js';

  const datasets = [
    { name: 'Card', values: series(30, { start: 5400, seed: 101 }) },
    { name: 'Bank transfer', values: series(30, { start: 2100, seed: 102 }) },
    { name: 'Wallet', values: series(30, { start: 1300, seed: 103 }) },
  ];
  new LovelyChart(document.getElementById('payments'), {
    title: 'Payments by method', type: 'line', labels: days(30), datasets, isUtc: true,
  });

  // The colours the chart gives these datasets, for the table beside it
  const colors = getDefaultColors(datasets.length);
  document.querySelector('.payment-totals tbody').append(...datasets.map(({ name, values }, i) => {
    const row = document.createElement('tr');
    const swatch = Object.assign(document.createElement('span'), { className: 'swatch' });
    swatch.style.background = colors[i];
    row.insertCell().append(swatch, name);
    row.insertCell().textContent = values.reduce((sum, value) => sum + value, 0).toLocaleString('en-US');
    return row;
  }));
</script>
```

Where only some datasets have a `color`, those without take the colours of `getDefaultColors(datasets.length)` from the first, in their order: with a colour on the first of three datasets, the second takes the first default colour and the third the second.

## The skin's custom properties

The parts of the chart built from HTML take their colours from custom properties set on `.lovely-chart--container`, one value for each skin:

| Property | Colours | Day | Night |
|---|---|---|---|
| `--text-color` | The title and caption of the header, the text of the tooltip, the comparison entry of the legend | `#222222` | `#FFFFFF` |
| `--background-color` | The backdrop of a zoom-out control that floats over the plot | `#FFFFFF` | `#242F3E` |
| `--tooltip-background` | The tooltip balloon | `#FFFFFF` | `#1C2533` |
| `--tooltip-muted-text-color` | The comparison row and the notes of the tooltip | 70% `--text-color`, 30% `--tooltip-background` | The same mix |
| `--tooltip-separator-color` | The rules in the tooltip | `--grid-lines` | `--grid-lines` |
| `--tooltip-border` | The border of the balloon | `none` | `none` |
| `--tooltip-change-positive`, `--tooltip-change-negative` | A rise and a fall against the `comparison` | `#108BE3`, `#E65850` | `#48AAF0`, `#F07068` |
| `--grid-lines` | The ring of a tooltip swatch, and the default of `--tooltip-separator-color` | `#182D3B` at 10% | `#FFFFFF` at 10% |
| `--zoom-out-text` | The zoom-out control | `#108BE3` | `#48AAF0` |
| `--minimap-mask` | The minimap outside its window | `#E2EEF9` at 60% | `#304259` at 60% |
| `--minimap-slider` | The frame and ears of the minimap window | `#C0D1E1` | `#56626D` |
| `--minimap-limit-color` | The edge and the lock of a [`limitDate`](api.md#limitDate) mask | `#616770` | `#BFC0C2` |
| `--skeleton-color` | The skeleton of a [loading](updating.md#loading-states) chart | `#182D3B` at 10% | `#FFFFFF` at 10% |
| `--range-selection-color` | The band of [`isRangeSelectable`](api.md#isRangeSelectable) | `#108BE3` | `#48AAF0` |

The canvas, which draws the data, the grid, the axis labels and the halos around labels, doesn't read these properties: it takes the skin's built-in colours, and your [`axisTextColor`](#backgroundcolor-and-axistextcolor) and [`backgroundColor`](#backgroundcolor-and-axistextcolor) over them. See [`--background-color`](css.md#--background-color) in the CSS reference for the complete list.

## Writing a skin of your own

A skin of your own sets these properties for the day and the night skin, under selectors that reach each chart in the right skin only. Scope them to a class of your page, `.sales` here, so they don't reach other charts:

```css
/* Day */
.sales .lovely-chart--container {
  --text-color: #2D2A26;
  --tooltip-background: #FFFDF8;
}

/* Night, for the default colorScheme: 'htmlClassName' */
html.theme-dark .sales .lovely-chart--container:not(.lovely-chart--container-scheme-system) {
  --text-color: #F3E9DC;
  --tooltip-background: #352D27;
}

/* Night, for colorScheme: 'system' */
@media (prefers-color-scheme: dark) {
  .sales .lovely-chart--container.lovely-chart--container-scheme-system {
    --text-color: #F3E9DC;
    --tooltip-background: #352D27;
  }
}
```

The `:not()` and the `.lovely-chart--container-scheme-system` class keep each night rule to the charts of its `colorScheme`, so a chart that follows the system isn't turned dark by the class on `<html>`, nor the other way round. Leave out the rule of a scheme your page doesn't use.

> [!TIP]
> When your page already has tokens that switch with its theme, let the skin read them, and one rule with both selectors serves the day and the night skin alike, as the example below does.

The skin covers the HTML parts. For the canvas, set two params to match:

- [`backgroundColor`](api.md#backgroundColor), the colour of your surface, which the chart paints inside the hover dots, in the mask over unfocused bars, as a ring around pin heads and as a halo around labels on the plot. Without it, those take the skin's own white or blue-grey, which shows as a fringe on a surface of another colour.
- [`axisTextColor`](api.md#axisTextColor), the colour of the axis labels, which reference lines, hatched ranges and event lines also take when they have no `color`.

Here is a warm "paper" skin, all of it from the page's tokens:

```html live
<style>
  html {
    --paper: #FBF6EE; --paper-raised: #FFFDF8; --ink: #3D3027; --ink-muted: #8A7868; --accent: #C2410C;
  }
  html.theme-dark {
    --paper: #2B241F; --paper-raised: #352D27; --ink: #F3E9DC; --ink-muted: #A8998A; --accent: #FB923C;
  }
  .paper { padding-top: 12px; border-radius: 12px; background: var(--paper); }
  /* The skin reads the page's tokens, so one rule serves the day and the night skin */
  .paper .lovely-chart--container,
  html.theme-dark .paper .lovely-chart--container:not(.lovely-chart--container-scheme-system) {
    --text-color: var(--ink);
    --tooltip-background: var(--paper-raised);
    --tooltip-border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    --minimap-mask: color-mix(in srgb, var(--ink) 8%, transparent);
    --minimap-slider: color-mix(in srgb, var(--ink) 30%, transparent);
    --zoom-out-text: var(--accent);
  }
</style>
<div class="paper"><div id="readers"></div></div>
<script type="module">
  import LovelyChart from 'lovely-chart';
  import { days, series } from './demo-data.js';

  new LovelyChart(document.getElementById('readers'), {
    title: 'Daily readers',
    type: 'line',
    labels: days(120),
    datasets: [
      { name: 'Articles', color: 'var(--accent)', values: series(120, { start: 2400, volatility: 0.04, seasonality: 0.2, seed: 21 }) },
      { name: 'Newsletter', color: 'var(--ink-muted)', values: series(120, { start: 900, volatility: 0.04, seasonality: 0.1, seed: 22 }) },
    ],
    withMinimap: true,
    backgroundColor: 'var(--paper)',
    axisTextColor: 'var(--ink-muted)',
    isUtc: true,
  });
</script>
```

To restyle the balloon itself, its shadow, padding or radius, see [Tooltip](tooltip.md) and the [`.lovely-chart--tooltip-balloon`](css.md#lovely-chart--tooltip-balloon) class.

## `backgroundColor` and `axisTextColor`

These two params take the colour forms above, and reach the parts of the chart the custom properties don't:

| Param | Colours | Default |
|---|---|---|
| [`backgroundColor`](api.md#backgroundColor) | Inside the hover dots, the mask over unfocused bars, the ring around pin heads, the halo around the Y-axis labels and the labels of reference lines, hatched ranges and event lines | The skin's background |
| [`axisTextColor`](api.md#axisTextColor) | The axis labels, and reference lines, hatched ranges and event lines with no `color` | The skin's axis text |

Without `backgroundColor`, only the Y-axis labels of [`areLabelsContrast`](api.md#areLabelsContrast) get a halo; with it, all of them do.

## Pie and donut gradients

[`withGradient`](api.md#withGradient) shades each sector of a pie or donut from 10% lighter at its inner edge, the centre of a pie, to 10% darker at its outer edge, in whatever colours the datasets have. It applies to the pie or donut a zoom into shares opens too:

```js live
import LovelyChart from 'lovely-chart';

const data = await fetch('../data/donut.json').then((response) => response.json());

new LovelyChart(document.getElementById('chart'), {
  ...data,
  title: 'Fruit sold',
  withGradient: true,
});
```

For colours that hold up for every reader, see [Accessibility](accessibility.md#colour-and-contrast).
