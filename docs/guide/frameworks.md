# Using with frameworks

LovelyChart works with any framework, or none: all it needs is an element. A wrapper component creates the chart when it mounts, hands it new data with `update()`, and destroys it when it unmounts.

## The lifecycle

Every wrapper on this page follows the same three steps:

| When | Call | Why |
| --- | --- | --- |
| The component mounts | `new LovelyChart(element, params)` | Builds the chart inside the component's element |
| New data arrives | `chart.update(params)` | Rebuilds the chart from the new params, in the same element |
| The component unmounts | `chart.destroy()` | Removes the chart's DOM, detaches its window and document listeners, and cancels its animation frames and timers |

A few rules keep the wrappers simple and leak-free:

- **Give the chart an element of its own.** Render an empty element and let the chart fill it; don't have the framework render children into it. The chart adds its own DOM to the element and sets the `--lovely-chart-plot-area-*` CSS variables on its style.
- **Create the chart once its element is in the document.** The chart measures the width of its element as it builds. An element that is hidden at that moment, as in an inactive tab, has no width to measure, so create the chart when it's shown.
- **Pass a new object for new data.** The chart keeps a reference to the params you give it and builds from them again on a window resize. Frameworks that favour immutable data fit this naturally: see [Data format](data.md#passing-new-data).
- **Keep the instance out of reactive state.** The chart keeps its state in native `#private` class fields, which a JavaScript `Proxy` can't reach: calling a method of the chart through a reactive proxy, such as Vue's `ref()`, throws a `TypeError`. Hold the instance in a plain variable, or in your framework's raw or shallow container.
- **Always destroy.** `destroy()` is idempotent, so a cleanup that runs twice does no harm.

`update()` resets the zoom, the window, the datasets hidden in the legend and the selected label. For live data, keep the reader's view with the update options:

```js
chart.update(params, { shouldKeepFilter: true, shouldKeepZoom: true, shouldKeepSelection: true });
```

See [Updating](updating.md) for what each option keeps.

## React

Create the chart in an effect, and return `destroy()` as its cleanup. A second effect hands the chart new data:

```jsx
import { useEffect, useRef } from 'react';
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

export function Chart({ params }) {
  const elementRef = useRef(null);
  const chartRef = useRef(null);
  // The params the chart on screen was built from
  const builtParamsRef = useRef(params);

  // Create on mount, destroy on unmount
  useEffect(() => {
    const chart = new LovelyChart(elementRef.current, builtParamsRef.current);
    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  // Rebuild from new params
  useEffect(() => {
    if (chartRef.current && params !== builtParamsRef.current) {
      builtParamsRef.current = params;
      chartRef.current.update(params);
    }
  }, [params]);

  return <div ref={elementRef} />;
}
```

The check against `builtParamsRef` skips an `update()` right after the chart is created from the same params, which would rebuild it for nothing.

### Strict Mode

In development, Strict Mode mounts each component twice: it runs the effects, their cleanups, then the effects again. With the component above, that creates a chart, destroys it and creates a fresh one in the same element. `destroy()` removes everything the first chart added, so nothing is left over. If you see two charts in one element, an effect is missing its cleanup.

### Stable params

`update()` rebuilds the chart and resets the reader's view, so call it only when the data really changes. Build the params with `useMemo`, keyed by the data they come from, rather than as a new object literal on every render:

```jsx
import { useMemo } from 'react';

function OrdersChart({ rows }) {
  const params = useMemo(() => ({
    title: 'Orders',
    type: 'bar',
    labels: rows.map((row) => row.date),
    datasets: [{ name: 'Orders', values: rows.map((row) => row.orders) }],
  }), [rows]);

  return <Chart params={params} />;
}
```

This matters most with callbacks in the params. `update()` reports the end of a selection to `onSelectedIndexChange`, so a callback that sets state, with params rebuilt on every render, would update the chart on every report and lose the selection each time.

In TypeScript, type the props with `LovelyChartParams`, and the refs as `useRef<HTMLDivElement>(null)` and `useRef<LovelyChart | null>(null)`.

> [!NOTE]
> In the Next.js App Router, a component that uses effects is a Client Component: start its file with `'use client'`. See [Server-side rendering](#server-side-rendering).

## Vue 3

Create the chart in `onMounted`, update it from a `watch` on the params, and destroy it in `onBeforeUnmount`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import LovelyChart, { type LovelyChartParams } from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

const props = defineProps<{ params: LovelyChartParams }>();

const element = ref<HTMLDivElement | null>(null);
// A plain variable: a ref() would wrap the chart in a reactive proxy, which its methods can't run through
let chart: LovelyChart | undefined;

onMounted(() => {
  chart = new LovelyChart(element.value!, toRaw(props.params));
});

watch(() => props.params, (params) => {
  chart?.update(toRaw(params));
});

onBeforeUnmount(() => {
  chart?.destroy();
  chart = undefined;
});
</script>

<template>
  <div ref="element"></div>
</template>
```

- `toRaw()` hands the chart the plain object behind a reactive one, so it doesn't read every value through Vue's proxies.
- The `watch` fires when the parent passes a new params object, not when it changes the one it passed. Replace the params rather than mutating them; `shallowRef()` in the parent suits data that is replaced as a whole.
- If you'd rather keep the chart in a ref, use `shallowRef()` or wrap the instance in `markRaw()`.

## Svelte

An action is the most compact wrapper: Svelte calls it with the element once it's in the document, calls its `update` when the parameter changes, and its `destroy` when the element goes.

```svelte
<script>
  import LovelyChart from 'lovely-chart';
  import 'lovely-chart/LovelyChart.css';

  let { params } = $props();

  function lovelyChart(element, params) {
    const chart = new LovelyChart(element, params);

    return {
      update(newParams) {
        chart.update(newParams);
      },
      destroy() {
        chart.destroy();
      },
    };
  }
</script>

<div use:lovelyChart={params}></div>
```

The action is the same in Svelte 4, where the component takes `export let params;` in place of `$props()`.

In Svelte 5, keep the params in `$state.raw()` and replace them as a whole for new data: the chart gets a plain object, and a reassignment updates it.

### With onMount

If you'd rather have the instance in the component, for instance to call `chart.selectLabel()` from a button, create it in `onMount` and update it from an effect:

```svelte
<script>
  import { onMount } from 'svelte';
  import LovelyChart from 'lovely-chart';

  let { params } = $props();
  let element;
  // Plain variables, which the effect doesn't track
  let chart;
  let builtParams;

  onMount(() => {
    builtParams = params;
    chart = new LovelyChart(element, params);

    return () => chart.destroy();
  });

  $effect(() => {
    // Read first, so the effect tracks the params from its first run
    const nextParams = params;
    if (chart && nextParams !== builtParams) {
      builtParams = nextParams;
      chart.update(nextParams);
    }
  });
</script>

<div bind:this={element}></div>
```

## Angular

Create the chart in `ngAfterViewInit`, once the view holds its element, update it in `ngOnChanges`, and destroy it in `ngOnDestroy`:

```ts
import {
  AfterViewInit, Component, ElementRef, inject, Input, NgZone, OnChanges, OnDestroy, ViewChild,
} from '@angular/core';
import LovelyChart, { type LovelyChartParams } from 'lovely-chart';

@Component({
  selector: 'app-lovely-chart',
  standalone: true,
  template: '<div #chart></div>',
})
export class LovelyChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) params!: LovelyChartParams;
  @ViewChild('chart') private element!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private chart?: LovelyChart;

  ngAfterViewInit() {
    // The chart's animation frames and listeners need no change detection
    this.zone.runOutsideAngular(() => {
      this.chart = new LovelyChart(this.element.nativeElement, this.params);
    });
  }

  ngOnChanges() {
    // No chart yet on the first change: ngAfterViewInit creates it
    this.zone.runOutsideAngular(() => this.chart?.update(this.params));
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
```

- **Run the chart outside the zone.** The chart draws on animation frames and listens to pointer moves over the document. Created inside Angular's zone, each of those would trigger change detection. Callbacks in the params then run outside the zone too: wrap the state changes they make in `this.zone.run(() => …)`. A zoneless app needs neither.
- **Add the stylesheet globally.** Component styles are scoped to the component's own template, and the chart builds its DOM itself, so they don't reach it. Add `node_modules/lovely-chart/dist/LovelyChart.css` to the `styles` array of your project's build options in `angular.json`, beside your own global stylesheet.

- **Pass new objects.** `ngOnChanges` runs when the parent binds a new params object, not when it changes the one it bound.

## Web Component

A custom element can wrap the chart for any page or framework: it creates the chart when it's added to the document, updates it when its `params` property is set, and destroys it when it's removed.

```js
import LovelyChart from 'lovely-chart';
import 'lovely-chart/LovelyChart.css';

class LovelyChartView extends HTMLElement {
  #chart;
  #params;

  get params() {
    return this.#params;
  }

  set params(params) {
    this.#params = params;
    if (this.#chart) {
      this.#chart.update(params);
    } else if (this.isConnected) {
      this.#chart = new LovelyChart(this, params);
    }
  }

  connectedCallback() {
    if (this.#params && !this.#chart) {
      this.#chart = new LovelyChart(this, this.#params);
    }
  }

  disconnectedCallback() {
    this.#chart?.destroy();
    this.#chart = undefined;
  }
}

customElements.define('lovely-chart-view', LovelyChartView);
```

A custom element is inline by default, so make it a block:

```css
lovely-chart-view {
  display: block;
}
```

Then set its `params` from a script:

```html
<lovely-chart-view id="orders"></lovely-chart-view>

<script type="module">
  document.getElementById('orders').params = {
    title: 'Orders',
    type: 'bar',
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ name: 'Orders', values: [412, 438, 451, 469, 520, 610, 574] }],
  };
</script>
```

- **Keep it in the light DOM.** The element holds the chart itself, with no shadow root, so the library's stylesheet reaches it from the document. With the default `colorScheme`, the night skin hangs off a `theme-dark` class on `<html>`, which a stylesheet inside a shadow root can't see.
- **Moving the element rebuilds the chart.** Moving it in the document disconnects and reconnects it, which destroys the chart and creates a new one, with a fresh view.

## Server-side rendering

Importing `lovely-chart` touches neither the DOM nor `window`, so server-rendered code can import it. Creating a chart needs a browser. React's `useEffect`, Vue's `onMounted`, Svelte's actions and `onMount`, and a custom element's `connectedCallback` only run there, so the wrappers above need no change: on the server, the component renders its empty element, and the chart builds itself in it once the page runs in the browser.

Angular is the exception: with server-side rendering, it runs `ngAfterViewInit` on the server too. Create the chart only in the browser there, for example behind a check of `isPlatformBrowser()`:

```ts
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

// In the component
private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

ngAfterViewInit() {
  if (!this.isBrowser) return;
  this.zone.runOutsideAngular(() => {
    this.chart = new LovelyChart(this.element.nativeElement, this.params);
  });
}
```

The stylesheet import is plain CSS, so it works in server builds as long as your framework accepts CSS from packages. Import it once, where your framework takes global styles.
