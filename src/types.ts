import type { NO_FOCUS } from './constants';

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

export interface XLabel {
  value: number;
  text: string;
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
  color?: string;
  values: (number | null)[];
}

/** Raw data accepted by the `LovelyChart` constructor and `onZoom` callbacks. */
export interface LovelyChartParams {
  type: ChartType;
  labels: (number | string)[];
  datasets: LovelyChartDatasetParams[];
  title?: string;
  colors?: Record<string, string>;
  labelType?: LabelType;
  labelFormatter?: string;
  tooltipFormatter?: string;
  isStacked?: boolean;
  isPercentage?: boolean;
  withGradient?: boolean;
  hasSecondYAxis?: boolean;
  secondaryYAxis?: SecondaryYAxisConfig;
  onZoom?: (value: number) => Promise<LovelyChartParams | undefined>;
  noZoom?: boolean;
  zoomType?: 'pie' | 'donut';
  withMinimap?: boolean;
  minimapRange?: [number, number] | 'full';
  noCaption?: boolean;
  zoomOutLabel?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  isCurrencyPrefix?: boolean;
  limitDate?: number;
  onLimitedRangeClick?: () => void;
}

export interface AnalyzedDataset {
  type: ChartType;
  key: string;
  name: string;
  color: string;
  values: (number | null)[];
  hasOwnYAxis: boolean | undefined;
  yMin: number | undefined;
  yMax: number | undefined;
}

export interface AnalyzedData {
  title?: string;
  labelType?: LabelType;
  labelFormatter?: string;
  tooltipFormatter?: string;
  xLabels: XLabel[];
  datasets: AnalyzedDataset[];
  isStacked?: boolean;
  isPercentage?: boolean;
  isShares: boolean;
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
  isPie: boolean;
  isDonut: boolean;
  isCircle: boolean;
  withGradient: boolean;
  yMin: number;
  yMax: number;
  colors: Record<string, string>;
  withMinimap: boolean;
  minimapRange?: Range;
  noCaption?: boolean;
  zoomOutLabel?: string;
  limitBegin: number | undefined;
  onLimitedRangeClick?: () => void;
  shouldZoomToShares: boolean;
  zoomType: 'pie' | 'donut';
  isZoomable: boolean;
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
  yPadding?: number;
  withColumns?: boolean;
}

export type Pixel = [number, number];

export type ColorChannels = [number, number, number, number?];
type SkinColors = Record<string, ColorChannels>;
export type ChartColors = Record<string, SkinColors>;

export interface StatisticsItem {
  key: string;
  name: string;
  value: number | null;
  hasOwnYAxis: boolean | undefined;
  originalIndex: number;
}
