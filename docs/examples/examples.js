// The examples of the gallery in its order. The code of each is in `code/<id>.js`, with `code/<id>.css` and
// `code/<id>.html` for those whose `parts` name them. The gallery shows the preview `npm run thumbnails` renders of
// each in `thumbnails/`, apart from those with `isPreviewLive`, whose charts move by themselves and run live there.

export const CATEGORIES = [
  'Line',
  'Area',
  'Bar',
  'Step',
  'Pie and donut',
  'Combined and axes',
  'Annotations',
  'Interaction',
  'Data and loading',
  'Layout and style',
  'Localisation and accessibility',
];

export const EXAMPLES = [
  {
    id: 'line-basic',
    title: 'Line chart with a minimap',
    category: 'Line',
    description: 'Three series over half a year, with a minimap to pan and resize the visible window.',
  },
  {
    id: 'line-smooth',
    title: 'Smooth lines',
    category: 'Line',
    description: '`areLinesSmooth` draws monotone curves that never overshoot a value; Kiwi starts hidden in the legend.',
  },
  {
    id: 'line-styles',
    title: 'Solid, dashed and dotted',
    category: 'Line',
    description: 'One hue for actuals, the plan and last year, told apart by `isDashed` and `isDotted`.',
  },
  {
    id: 'line-negative',
    title: 'Below zero',
    category: 'Line',
    description: 'Temperatures that cross zero, with a unit suffix and a reference line at freezing.',
  },
  {
    id: 'line-gaps',
    title: 'Gaps in the data',
    category: 'Line',
    description: 'Hourly readings where `null` values leave a gap for a sensor outage.',
  },
  {
    id: 'line-range-selection',
    title: 'Select a range with the mouse',
    category: 'Line',
    description: 'Drag across the plot to open a window on those weeks, double-click to see them all; `onRangeChange` '
      + 'reports the range.',
    parts: ['js', 'html'],
  },
  {
    id: 'area-stacked',
    title: 'Stacked areas',
    category: 'Area',
    description: 'A year of six fruits stacked on each other, with a minimap.',
  },
  {
    id: 'area-percentage',
    title: 'Percentage areas',
    category: 'Area',
    description: 'Shares of a whole that add up to 100%; click a day to zoom into a pie of its shares.',
  },
  {
    id: 'area-outline',
    title: 'Translucent area with an outline',
    category: 'Area',
    description: 'A single area at a low `areaOpacity`, outlined by `areaBorderColor`.',
  },
  {
    id: 'bar-basic',
    title: 'Daily bars',
    category: 'Bar',
    description: 'One series of bars, its Y range pinned to zero by a transparent reference line.',
  },
  {
    id: 'bar-drill-down',
    title: 'Stacked bars with drill-down',
    category: 'Bar',
    description: 'Click a day to load its hours with `onZoom`, and zoom back out to the year.',
  },
  {
    id: 'bar-negative',
    title: 'Positive and negative stacks',
    category: 'Bar',
    description: 'Revenue above zero and refunds below it, in dollars with the minus sign before the `$`.',
  },
  {
    id: 'bar-monthly-shares',
    title: 'Monthly spending with zoom into shares',
    category: 'Bar',
    description: 'Stacked monthly bars of absolute values; `zoomToShares` opens a donut of a month’s categories.',
  },
  {
    id: 'bar-categories',
    title: 'Categories as text labels',
    category: 'Bar',
    description: 'Text labels in place of dates, for days of the week or any other categories.',
  },
  {
    id: 'step-limit',
    title: 'Steps with a limit',
    category: 'Step',
    description: 'Plan quotas as steps under a limit line, the days still to come hatched as planned.',
  },
  {
    id: 'pie-totals',
    title: 'Pie of totals',
    category: 'Pie and donut',
    description: 'One total per dataset in a single `Total` label. Hover a sector for its value and share.',
  },
  {
    id: 'donut-gradient',
    title: 'Donut with a gradient',
    category: 'Pie and donut',
    description: '`withGradient` shades each sector from its inner to its outer edge.',
  },
  {
    id: 'pie-range',
    title: 'Pie over a range of days',
    category: 'Pie and donut',
    description: 'A pie of daily values sums the days the minimap selects; drag the window to sum other days.',
  },
  {
    id: 'combined-budget',
    title: 'Bars under a budget line',
    category: 'Combined and axes',
    description: 'Stacked spending bars with a dashed budget drawn as steps by `datasets[*].type`.',
  },
  {
    id: 'combined-two-axes',
    title: 'Two Y axes',
    category: 'Combined and axes',
    description: 'Stacked bars on the main axis and a share line on an axis of its own with `hasSecondYAxis`.',
  },
  {
    id: 'secondary-scale',
    title: 'A second unit on the axis',
    category: 'Combined and axes',
    description: '`secondaryYAxis` labels the same values in another unit at the right, and adds it to the tooltip.',
  },
  {
    id: 'currency',
    title: 'Currency and number formatting',
    category: 'Combined and axes',
    description: 'Profit and loss in dollars: `valuePrefix`, `isCurrencyPrefix`, `formatTooltipValue` and labels outside '
      + 'the plot.',
  },
  {
    id: 'hourly',
    title: 'Hours across days',
    category: 'Combined and axes',
    description: 'Three days of hourly traffic, labelled by day and hour in UTC.',
  },
  {
    id: 'reference-lines',
    title: 'Targets and thresholds',
    category: 'Annotations',
    description: 'Response times against a target and an alert level, in colours of their own.',
  },
  {
    id: 'forecast',
    title: 'Forecast',
    category: 'Annotations',
    description: 'The days ahead hatched by `hatchedRanges`, labelled on the plot and noted in the tooltip.',
  },
  {
    id: 'event-lines',
    title: 'Launches and incidents',
    category: 'Annotations',
    description: '`eventLines` mark moments with rules and pins, and add a hint to the tooltip of their day.',
  },
  {
    id: 'comparison',
    title: 'Against the previous period',
    category: 'Annotations',
    description: 'A dashed line of the period before, and the change against it in the tooltip.',
  },
  {
    id: 'external-list',
    title: 'Chart linked to a list',
    category: 'Interaction',
    description: 'Hovering a row selects its day with `selectLabel()`, and `onSelectedIndexChange` marks the row of '
      + 'the day the chart shows.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'readout',
    title: 'A readout in place of the tooltip',
    category: 'Interaction',
    description: '`onTooltipChange` feeds a panel of the page, and `--lovely-chart-balloon-display` hides the balloon.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'synced-charts',
    title: 'Synchronised charts',
    category: 'Interaction',
    description: 'Two charts of the same days select together: each passes its selection to the other.',
    parts: ['js', 'html'],
  },
  {
    id: 'custom-legend',
    title: 'Legend outside the chart',
    category: 'Interaction',
    description: '`legendContainer` puts the legend in a panel of the page; `onHiddenSeriesChange` reports what is '
      + 'hidden.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'custom-zoom-out',
    title: 'Zoom-out control of your own',
    category: 'Interaction',
    description: 'Opens zoomed into the last day with `initialZoom`, and zooms out from a button of the page with '
      + '`zoomOut()`.',
    parts: ['js', 'html'],
  },
  {
    id: 'limit-date',
    title: 'Locked history',
    category: 'Interaction',
    description: '`limitDate` locks the months before it behind a mask of the minimap that the reader can click.',
    parts: ['js', 'html'],
  },
  {
    id: 'overlay',
    title: 'Elements over the plot',
    category: 'Interaction',
    description: 'A badge placed by the plot-area variables, and a link that follows its label with `getLabelX()`.',
    parts: ['js', 'css'],
  },
  {
    id: 'update-period',
    title: 'Switch periods with a cross-fade',
    category: 'Data and loading',
    description: '`update()` with `isAnimated` cross-fades into another period, keeping the hidden datasets.',
    parts: ['js', 'html'],
  },
  {
    id: 'live-data',
    title: 'Live data',
    category: 'Data and loading',
    description: 'A new value every second, shifting the window and keeping what the reader hid and selected.',
    isPreviewLive: true,
  },
  {
    id: 'loading',
    title: 'Loading skeleton',
    category: 'Data and loading',
    description: 'A skeleton in the chart’s own shape until the data arrives, and dimmed data while the next loads.',
    isPreviewLive: true,
    parts: ['js', 'html'],
  },
  {
    id: 'sparklines',
    title: 'Sparklines in a table',
    category: 'Layout and style',
    description: '`isSparkline` draws the plot alone, small enough for a row of a table.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'small-multiples',
    title: 'Small multiples',
    category: 'Layout and style',
    description: 'A grid of compact charts without headers, tooltips or legends, under one key of the page.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'custom-theme',
    title: 'A theme of your own',
    category: 'Layout and style',
    description: 'Colours from the page’s custom properties, a font, spacing and a skin of its own, repainted by '
      + '`refreshColors()`.',
    parts: ['js', 'css', 'html'],
  },
  {
    id: 'rtl',
    title: 'Right to left',
    category: 'Localisation and accessibility',
    description: 'Hebrew dates and names on a right-to-left page, the minus signs kept before the digits.',
  },
  {
    id: 'localized-dates',
    title: 'Localised dates',
    category: 'Localisation and accessibility',
    description: 'Spanish month and weekday names through `dateLocale`, on weekly labels.',
  },
  {
    id: 'accessible-readout',
    title: 'Accessible name and live readout',
    category: 'Localisation and accessibility',
    description: 'An `ariaLabel` of your own, and a polite live region that reads the selected day aloud.',
    parts: ['js', 'html'],
  },
];

export const PLAYGROUND_SOURCE = {
  js: `import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const labels = days(120);

new LovelyChart(document.getElementById('chart'), {
  title: 'Playground',
  type: 'line',
  labels,
  datasets: [
    { name: 'Visitors', values: series(120, { start: 1200, trend: 0.004, volatility: 0.04, seed: 3 }) },
    { name: 'Sign-ups', values: series(120, { start: 420, trend: 0.006, volatility: 0.05, seed: 7 }) },
  ],
  withMinimap: true,
});
`,
  css: '',
  html: '<div id="chart"></div>',
};
