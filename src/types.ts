import type { COLOR_PROBE, COLOR_SCHEME, NO_FOCUS } from './constants.js';

export type ChartType = 'line' | 'bar' | 'step' | 'area' | 'pie' | 'donut';

export type LabelType = 'year' | 'month' | 'week' | 'day' | 'hour' | '5min' | 'dayHour' | 'text';

export interface Range {
  begin: number;
  end: number;
}

export interface LabelRange {
  from: number;
  to: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

export interface XLabel {
  value: number;
  text: string;
  direction: 'ltr' | 'rtl';
}

export type Filter = Record<string, boolean>;

export interface PointerVector {
  angle: number;
  distance: number;
}

// A label index for bars/steps, a pointer vector for pies, or the NO_FOCUS
// sentinel to clear focus. `undefined` in a state update keeps the
// previous value.
export type FocusOn = number | PointerVector | typeof NO_FOCUS;

export interface SecondaryYAxisConfig {
  label: string;
  multiplier: number;
  prefix?: string;
  suffix?: string;
}

export interface LovelyChartDatasetParams {
  name: string;
  /**
   * Colour of the dataset. In the chart's own data, the datasets with none take the colours of
   * `getDefaultColors(datasets.length)` in order, so where no dataset has one, each takes the colour at its index. In
   * data that `onZoom` returns, one with none and no entry in `colors` keeps the colour of the chart's dataset at its
   * place, and one past the chart's datasets takes a default colour.
   */
  color?: ThemedColor;
  values: (number | null)[];
  /** Starts the dataset hidden, its legend button unchecked, so a reader can show it from the legend. */
  isInitiallyHidden?: boolean;
  /** Draws a line or step dataset in 6px dashes 4px apart, its legend button with a dashed outline. */
  isDashed?: boolean;
  /** Draws a line or step dataset in 2px dots 3px apart, `isDashed` or not, its legend button with a dotted outline. */
  isDotted?: boolean;
  /**
   * Draws the dataset as a line, bars or steps whatever the chart's `type`, as a line over bars; ignored on percentage,
   * pie and donut charts. Lines and steps draw over bars and areas, and bars that share the main Y axis with another
   * type keep 0 on it. A dataset of another type than the chart's draws its own values, out of a stacked chart's
   * stack, and stays out of the tooltip's total, the comparison and the shares of a zoom into a label.
   */
  type?: 'line' | 'bar' | 'step';
}

/**
 * A CSS colour for both the day and the night skin, or one for each. A `var()` of the page's custom properties, alone or
 * inside a colour function such as `color-mix()`, takes the colour it computes to inside the chart, read again on each
 * change of the skin and on `refreshColors()`. `#RRGGBB/alpha` gives a hex colour at an opacity.
 */
export type ThemedColor = string | { light: string; dark: string };

/**
 * A dashed rule across the plot at a value of the main Y axis, labelled at its right end. The chart's Y range
 * always reaches the value, so a line with `color: 'transparent'` draws nothing and only pins the range.
 */
export interface ReferenceLine {
  /** The value on the main Y axis; on a percentage chart, a percentage from 0 to 100. */
  value: number;
  /** Text drawn above the right end of the line; none when empty or absent. */
  label?: string;
  /** Any CSS colour, or one per skin; defaults to the Y-axis text colour. */
  color?: ThemedColor;
}

/**
 * A run of labels whose values are not plain actuals, such as estimated, partial, still accruing or forecast, hatched
 * across the plot and the minimap. A bar or step chart hatches the columns of the range. A line or area chart starts
 * the hatch at the point before the range, as the segment into an estimated value is estimated too, and ends it halfway
 * to the label after the range.
 */
export interface HatchedRange {
  /** Index of the first label of the range. */
  from: number;
  /** Index of the last label of the range, inclusive. */
  to: number;
  /** Text at the bottom left of the range's hatch, in its colour; dropped where it has no room. */
  label?: string;
  /** Any CSS colour of the hatch, the edge and the label, or one per skin; defaults to the axis text colour. */
  color?: ThemedColor;
  /** Draws a dashed rule where the range's hatch starts, as where actuals end and a forecast begins. */
  hasEdge?: boolean;
  /** Marks a range whose values are still filling: a line or area chart starts its hatch halfway from the point before. */
  isAccruing?: boolean;
  /**
   * A note under the tooltip rows at each label of the range, split into lines at `\n`, before the notes of
   * `resolveTooltipNotes`.
   */
  note?: string;
  /**
   * A note beside the tooltip title at each label of the range, unless `resolveTooltipNotes` or an earlier range
   * gives one.
   */
  titleNote?: string;
}

/** Muted notes of a tooltip, which `resolveTooltipNotes` gives a label. */
export interface TooltipNotes {
  /** Text beside the title, after the date and before a title total. */
  titleNote?: string;
  /** Lines under the rows, wrapped to their width; a `\n` splits a line in two. */
  notes?: string[];
}

/**
 * A dashed vertical rule at a moment of the labels, such as a launch or a change in how the data is collected, from the
 * bottom of the Y range through the room above it, labelled beside its top.
 */
export interface EventLine {
  /** Index of the label the rule stands at. */
  labelIndex: number;
  /**
   * How far through the label's interval the rule stands, from 0 to 1: from its point to the next one on a line or area
   * chart, and across its column from its start on a bar or step chart, or one with bars or steps among its datasets.
   * Defaults to the point, or the column centre. The last point of a line or area chart has no interval after it and
   * keeps its rule at the point.
   */
  offset?: number;
  /** Text reading bottom to top beside the top of the rule, in its colour; dropped where it has no room. */
  label?: string;
  /** Any CSS colour of the rule and the label, or one per skin; defaults to the axis text colour. */
  color?: ThemedColor;
}

/** The values of a previous period, drawn as one dashed line under the name of its legend entry. */
export interface Comparison {
  /** Name in the legend and in the tooltip, as `'Previous period'`. */
  name: string;
  /**
   * Colour of the line and of its swatches in the legend and the tooltip; defaults to `DEFAULT_COMPARISON_COLOR`,
   * `#6B7280`.
   */
  color?: ThemedColor;
  /**
   * Previous values per dataset, in the order of `datasets`, each aligned with `labels`. The line draws their
   * sum over the datasets on screen, and `null` leaves a gap.
   */
  values: (number | null)[][];
}

/** What the tooltip shows for the selected label, as `onTooltipChange` reports it. */
export interface TooltipContent {
  /** Index of the selected label in `labels`. */
  labelIndex: number;
  /** The title of the tooltip, as `18 Nov 2026`. */
  title: string;
  /**
   * Each dataset on screen, in the order of `datasets`, with its index there, its name and its value at the label:
   * zero included, and `null` for a gap.
   */
  rows: { datasetIndex: number; name: string; value: number | null }[];
  /**
   * The total of a stacked or percentage bar, step or area chart, as its Total row or title shows it: what
   * `resolveTooltipTotal` gives, or else the sum of the rows.
   */
  total?: number | null;
  /**
   * The previous period at the label: its name, its value, `null` for a gap, and `change`, the change of the current
   * total against it in percent, unrounded, where the tooltip shows one.
   */
  comparison?: { name: string; value: number | null; change?: number };
}

/**
 * Localized date strings for axis, tooltip and caption labels. Each is optional and falls back to English. A date
 * reads in the direction of its first letter, so one in Hebrew or Arabic words reads right to left on any page.
 */
export interface DateLocale {
  months?: readonly string[]; // Short month names, 12 entries (Jan..Dec)
  monthsFull?: readonly string[]; // Full month names, 12 entries (January..December)
  weekDays?: readonly string[]; // Full weekday names, 7 entries starting Sunday
  weekDaysShort?: readonly string[]; // Short weekday names, 7 entries starting Sunday
  weekOf?: string; // Words before the start date of a week in a tooltip title, as in "Week of 21 Oct"
}

/** Raw data accepted by the `LovelyChart` constructor and `onZoom` callbacks. */
export interface LovelyChartParams {
  type: ChartType;
  labels: (number | string)[];
  datasets: LovelyChartDatasetParams[];
  title?: string;
  /** In data that `onZoom` returns, dataset colours by key (`y0` for the first) over each dataset's `color`. */
  colors?: Record<string, ThemedColor>;
  labelType?: LabelType;
  labelFormatter?: string;
  tooltipFormatter?: string;
  dateLocale?: DateLocale;
  isStacked?: boolean;
  isPercentage?: boolean;
  /**
   * Digits after the point on the share a percentage tooltip prints beside each
   * value. Defaults to 0, which suits a stack of a few large slices; raise it
   * where slices sit close together and whole percents collapse them onto the
   * same number.
   */
  percentPrecision?: number;
  withGradient?: boolean;
  /**
   * Plot canvas height in px; defaults to 320. A `--lovely-chart-plot-height` custom property on the chart
   * element or an ancestor takes precedence, so a media query can set it.
   */
  plotHeight?: number;
  /** Draws the datasets alone, with no axes, grid, header or legend, inset by 2px. */
  isSparkline?: boolean;
  /**
   * Centers each Y-axis label on its grid line, over the line, instead of above it, inside a halo of the background
   * colour, and moves the labels of either axis 2px in from their side of the chart.
   */
  areLabelsContrast?: boolean;
  /**
   * Puts the main Y-axis labels in a column left of the plot, right-aligned, clear of the data. The column fits the
   * widest label the chart can show for its data, measured once per data set, so the plot holds still while the
   * reader pans, animates or hides datasets, and again when a web font of the page changes the axis font: once it
   * finishes loading, or on the next frame the chart draws after the page adds a `FontFace` already loaded. The second
   * Y axis keeps its labels inside the plot.
   */
  isYAxisOutward?: boolean;
  /**
   * Steps both Y axes in whole numbers, 1 at the finest, for counts that have no fractions: a range of 0 to 2
   * labels 0, 1 and 2.
   */
  noFloatSteps?: boolean;
  /** Font size in px of the axis labels; defaults to 10. */
  axisFontSize?: number;
  /** Colour of the axis labels. */
  axisTextColor?: ThemedColor;
  /**
   * Colour of the surface behind the chart. The chart paints it inside the hover dots, in the mask over
   * unfocused bars and as a halo around the Y-axis labels and the labels of reference lines, hatched ranges and event
   * lines; defaults to the skin's own background.
   */
  backgroundColor?: ThemedColor;
  /**
   * A previous period, drawn as a dashed line on the main Y axis with its change in the tooltip; ignored on
   * percentage, pie and donut charts.
   */
  comparison?: Comparison;
  /**
   * Reads every date and time of the labels in UTC. Axis labels of days, hours and minutes and their tooltip
   * titles otherwise follow the reader's time zone, while captions and day titles always read UTC.
   */
  isUtc?: boolean;
  /**
   * `'htmlClassName'`, the default, follows the `theme-dark` class on the `<html>` element; `'system'`
   * follows the `prefers-color-scheme` of the reader's system, live.
   */
  colorScheme?: 'htmlClassName' | 'system';
  /** Dashed rules at fixed values, drawn over the datasets; ignored on pie and donut charts. */
  referenceLines?: ReferenceLine[];
  /** Runs of labels to hatch, such as estimated or forecast ones; ignored on pie and donut charts. */
  hatchedRanges?: HatchedRange[];
  /** Dashed vertical rules at moments of the labels, drawn over the datasets; ignored on pie and donut charts. */
  eventLines?: EventLine[];
  /**
   * Lists the tooltip rows in the order of the legend, after the comparison row, rather than from the largest
   * value down. When more rows would show than the tooltip holds, the largest values still decide which do.
   */
  isTooltipOrderFixed?: boolean;
  /**
   * Puts the total of a stacked or percentage bar, step or area chart beside the tooltip title, in place of a
   * Total row.
   */
  isTooltipTotalInTitle?: boolean;
  /**
   * Formats a number of the tooltip, the total on the `secondaryYAxis` scale included; `valuePrefix` and
   * `valueSuffix` still wrap the result, or the `prefix` and `suffix` of `secondaryYAxis` around that total.
   */
  formatTooltipValue?: (value: number) => string;
  /**
   * The total of a tooltip, for the label's value (its timestamp, or the index of a text label), the indexes of the
   * datasets on screen and the label's index. `undefined` keeps the sum of the rows and `null` shows "—". The
   * comparison change reads this total too.
   */
  resolveTooltipTotal?: (labelValue: number, datasetIndexes: number[], labelIndex: number) => number | null | undefined;
  /**
   * The notes of a tooltip, for the label's value (its timestamp, or the index of a text label), the indexes of the
   * datasets on screen and the label's index. Its notes follow those of the `hatchedRanges` that hold the label, and
   * its `titleNote` wins over theirs; ignored on pie and donut charts.
   */
  resolveTooltipNotes?: (labelValue: number, datasetIndexes: number[], labelIndex: number) => TooltipNotes | undefined;
  /** Draws line datasets as monotone curves through their values, never overshooting a value. */
  areLinesSmooth?: boolean;
  /** Opacity of an area fill, 0 to 1; the area's outline and dots keep full opacity. */
  areaOpacity?: number;
  /**
   * CSS colour of a 1px outline around each area, and around each run of an area split at a gap, or one per skin.
   */
  areaBorderColor?: ThemedColor;
  /**
   * Puts the last dataset on a Y axis of its own, labelled at the right of the plot in the dataset's colour. The main
   * Y axis is labelled in the colour of the first dataset, apart from a stacked or percentage chart's, whose labels
   * keep the axis text colour. The last dataset stays out of the main Y axis, the tooltip's total and, on a stacked
   * chart, the stack, beside which it draws its own values; a percentage chart's tooltip prints no share on its row.
   */
  hasSecondYAxis?: boolean;
  /**
   * A scale of the main Y axis in another unit, labelled at the right of the plot, apart from a percentage chart's.
   * The tooltip adds a row of `label` and the total times `multiplier`, formatted as the dataset values are, between
   * `prefix` and `suffix`.
   */
  secondaryYAxis?: SecondaryYAxisConfig;
  onZoom?: (value: number) => Promise<LovelyChartParams | undefined>;
  /**
   * Called once a zoom settles, with the value of the zoomed-in label (its timestamp, or the index of a text label)
   * and its index in `labels`, and with `undefined` for both once zoomed out, also when `update()`, a resize or an
   * orientation change returns a zoomed chart to its overview.
   */
  onZoomChange?: (labelValue: number | undefined, labelIndex: number | undefined) => void;
  /** Called when the reader shows or hides a dataset in the legend, with the names and indexes of the hidden ones. */
  onHiddenSeriesChange?: (names: string[], datasetIndexes: number[]) => void;
  /**
   * Called when the selected label changes, by pointer, touch, keyboard or `selectLabel()`, with its index, not its
   * value, and with `undefined` once nothing is selected; a pie or donut selects no label.
   */
  onSelectedIndexChange?: (labelIndex: number | undefined) => void;
  /**
   * Makes the plot focusable, in the tab order. Arrow Left and Arrow Right then step the selection to the previous or
   * next label, and Home and End to the first or last label of the visible range; with nothing selected, an arrow
   * selects the last label. The plot keeps the focus through `update()` and a resize. Ignored on pie and donut charts,
   * and the pie or donut a zoom opens leaves the tab order.
   */
  isKeyboardSelectable?: boolean;
  /**
   * Called when what the tooltip shows changes, as another label is selected or a dataset is shown or hidden, with its
   * content, after `onSelectedIndexChange`, and with `undefined` once it shows nothing; a pie or donut reports none. It
   * reports with the balloon hidden by `--lovely-chart-balloon-display: none` too, for a readout of the page.
   */
  onTooltipChange?: (tooltip: TooltipContent | undefined) => void;
  /**
   * Called with the data area of the plot, in px from the inside of the element's border, whenever the chart writes
   * the `--lovely-chart-plot-area-*` variables, and as a zoom starts to move the labels under the area, once the data
   * `onZoom` returns arrives; called with `undefined` as `destroy()` removes the variables.
   */
  onPlotAreaChange?: (area: { left: number; top: number; width: number; height: number } | undefined) => void;
  /**
   * Element that holds the legend, in place of the chart container; `setLegendContainer()` moves the legend later. The
   * legend takes its spacing variables, such as `--lovely-chart-legend-gap`, from this element and its ancestors.
   */
  legendContainer?: HTMLElement;
  noZoom?: boolean;
  zoomType?: 'pie' | 'donut';
  /**
   * Opt a non-percentage chart into zoom-to-shares, so clicking a label drills
   * into a pie/donut of that label's shares. Percentage charts get this
   * implicitly; a stacked chart of absolute values needs the flag, since making
   * it `isPercentage` would discard the values the overview exists to show.
   * Ignored when `onZoom` is supplied.
   */
  zoomToShares?: boolean;
  /**
   * How many labels either side of the clicked one the zoomed pie/donut covers.
   * Defaults to 3, which suits daily data; use 0 to drill into a single label.
   */
  circleLabelsAround?: number;
  initialZoom?: number | 'last';
  withMinimap?: boolean;
  /**
   * The window the chart opens on: a `[begin, end]` tuple of fractions of the axis from 0 to 1, `'full'`, or
   * `{ from, to }`, inclusive label indexes, rounded and clamped to the labels. A bar or step chart, or one with bars or
   * steps among its datasets, takes the columns of those labels, a pie or donut sums them, and a line or area chart
   * takes their points and half an interval past either end, within the axis. A range of no labels takes the default:
   * `[0.8, 1]` with the minimap, otherwise `'full'`.
   */
  minimapRange?: [number, number] | 'full' | { from: number; to: number };
  noCaption?: boolean;
  zoomOutLabel?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  /**
   * Puts the minus sign of a negative value in front of `valuePrefix`, `-$9.1` rather than `$-9.1`, and in front of
   * the `prefix` of `secondaryYAxis` on its labels and its tooltip total.
   */
  isCurrencyPrefix?: boolean;
  limitDate?: number;
  onLimitedRangeClick?: () => void;
}

/** What `update()` keeps of the view the reader has, each part reset by default, and whether it animates the change. */
export interface LovelyChartUpdateOptions {
  /**
   * Keeps the datasets the reader showed or hid, matched by their place in `datasets`, or by `name` once the count of
   * datasets changes. A dataset with no match starts as its `isInitiallyHidden` says, as does every dataset where the
   * match would hide them all. `onHiddenSeriesChange` is called when the hidden datasets differ from those before.
   */
  shouldKeepFilter?: boolean;
  /**
   * Keeps the minimap window and a zoom while the labels are unchanged: a zoomed chart opens zoomed into the same label
   * with no transition, as `initialZoom` opens it, `onZoom` called again for it. `onZoomChange` goes uncalled for a
   * zoom it already reported, is called with the label's value and index once a zoom on its way in shows, and with
   * `undefined` when the zoom ends: on other labels, on data that cannot zoom, or when the zoom fails.
   */
  shouldKeepZoom?: boolean;
  /**
   * Keeps a selected label of the overview, at the index of a label of the same value, while one exists and shows in
   * the window the chart opens on. A selection of the pointer or a touch still ends as the pointer leaves the chart or
   * a touch lands elsewhere, and one of `selectLabel()` holds. `onSelectedIndexChange` is called only when the index
   * changes or the selection ends.
   */
  shouldKeepSelection?: boolean;
  /**
   * Cross-fades the chart into the new data over 400ms: the replaced chart, with its plot, axes, header, minimap and
   * legend, stays in the new one's place, under it, out of the layout and of the reader's reach, as it fades out and
   * the new one fades in, and a legend in `legendContainer` fades out over the new one there. Another animated
   * `update()` fades the chart out from the opacity it has reached, while one without `isAnimated`, a resize or
   * `destroy()` ends the fades at once. Ignored while the system asks for reduced motion.
   */
  isAnimated?: boolean;
}

export type LinePattern = 'dashed' | 'dotted';

export interface AnalyzedDataset {
  type: ChartType;
  key: string;
  name: string;
  color: ThemedColor;
  values: (number | null)[];
  isInitiallyHidden?: boolean;
  isDashed?: boolean;
  isDotted?: boolean;
  hasOwnYAxis: boolean | undefined;
  // Draws as another type than the chart's
  hasOwnType: boolean;
  yMin: number | undefined;
  yMax: number | undefined;
}

export interface AnalyzedData {
  title?: string;
  labelType?: LabelType;
  labelFormatter?: string;
  tooltipFormatter?: string;
  dateLocale?: DateLocale;
  xLabels: XLabel[];
  datasets: AnalyzedDataset[];
  isStacked?: boolean;
  isPercentage?: boolean;
  percentPrecision?: number;
  isShares: boolean;
  plotHeight?: number;
  isSparkline?: boolean;
  areLabelsContrast?: boolean;
  isYAxisOutward?: boolean;
  noFloatSteps?: boolean;
  axisFontSize: number;
  axisTextColor?: ThemedColor;
  backgroundColor?: ThemedColor;
  referenceLines: ReferenceLine[];
  hatchedRanges: HatchedRange[];
  eventLines: EventLine[];
  isUtc?: boolean;
  colorScheme?: LovelyChartParams['colorScheme'];
  comparison?: Comparison & { color: ThemedColor };
  isTooltipOrderFixed?: boolean;
  isTooltipTotalInTitle?: boolean;
  formatTooltipValue?: LovelyChartParams['formatTooltipValue'];
  resolveTooltipTotal?: LovelyChartParams['resolveTooltipTotal'];
  resolveTooltipNotes?: LovelyChartParams['resolveTooltipNotes'];
  isKeyboardSelectable?: boolean;
  areLinesSmooth?: boolean;
  areaOpacity?: number;
  areaBorderColor?: LovelyChartParams['areaBorderColor'];
  secondaryYAxis?: SecondaryYAxisConfig;
  hasSecondYAxis?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  isCurrencyPrefix?: boolean;
  onZoom?: LovelyChartParams['onZoom'];
  isLines: boolean;
  isBars: boolean;
  isSteps: boolean;
  isAreas: boolean;
  // Some dataset draws as bars or as steps, whatever the chart's type
  hasBars: boolean;
  hasSteps: boolean;
  isPie: boolean;
  isDonut: boolean;
  isCircle: boolean;
  withGradient: boolean;
  yMin: number;
  yMax: number;
  colors: Record<string, ThemedColor>;
  withMinimap: boolean;
  minimapRange?: Range;
  noCaption?: boolean;
  zoomOutLabel?: string;
  limitBegin: number | undefined;
  onLimitedRangeClick?: () => void;
  shouldZoomToShares: boolean;
  circleLabelsAround?: number;
  zoomType: 'pie' | 'donut';
  isZoomable: boolean;
  initialZoomIndex?: number;
}

export interface ChartState {
  begin: number;
  end: number;
  lastLabelIndex: number;
  labelFromIndex: number;
  labelToIndex: number;
  xAxisScale: number;
  yAxisScale: number;
  yAxisScaleSecond?: number | false;
  yMinViewport: number;
  yMaxViewport: number;
  yMinMinimap: number;
  yMaxMinimap: number;
  yMinViewportSecond?: number;
  yMaxViewportSecond?: number;
  yMinMinimapSecond?: number;
  yMaxMinimapSecond?: number;
  filter: Filter;
  focusOn?: FocusOn;
  minimapDelta?: number;
  static?: ChartState;
  // The transition manager interpolates over arbitrary numeric props and adds
  // `*From`/`*To`/`*Progress` companions, plus per-dataset `opacity#*` and
  // `circleShift#*` values — all keyed dynamically
  [prop: string]: any;
}

export interface Point {
  labelIndex: number;
  value: number | null;
  visibleValue: number;
  stackOffset: number;
  stackValue: number;
  isGap: boolean;
  percent?: number;
}

/** The subset of `Point` the canvas renderers actually consume. */
export interface DrawPoint {
  labelIndex: number;
  stackValue: number;
  stackOffset?: number;
  visibleValue?: number;
  isGap?: boolean;
}

export interface ProjectionParams {
  begin: number;
  end: number;
  lastLabelIndex: number;
  yMin: number;
  yMax: number;
  availableWidth: number;
  availableHeight: number;
  xPadding?: number;
  // A left padding that panning keeps, in place of `xPadding`, as beside a Y-axis label column
  xInsetStart?: number;
  yPadding?: number;
  withColumns?: boolean;
}

export type Pixel = [number, number];

export type ColorChannels = [number, number, number, number?];
type SkinColors = Record<string, ColorChannels>;
export type ChartColors = Record<string, SkinColors> & {
  [COLOR_SCHEME]?: 'htmlClassName' | 'system';
  [COLOR_PROBE]: HTMLElement;
};

export interface StatisticsItem {
  key: string;
  name: string;
  value: number | null;
  hasOwnYAxis: boolean | undefined;
  // Counts toward the total, unlike the comparison and a dataset on its own Y axis or of another type than the chart's
  isInTotal: boolean;
  originalIndex: number;
  isComparison?: boolean;
  // Change of the current total against the comparison value, in percent
  comparisonChange?: number;
}
