import type {
  AnalyzedData, AnalyzedDataset, ChartColors, ChartState, Filter, FocusOn, LovelyChartParams, LovelyChartUpdateOptions,
  Pixel, Point, ProjectionParams, Range, Rect, Size, TooltipContent,
} from './types.js';

import { Axes } from './Axes.js';
import { clearCanvas, setupCanvas } from './canvas.js';
import {
  GUTTER,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  PLOT_TOP_PADDING,
  SIMPLIFIER_PLOT_FACTOR,
  SPARKLINE_PADDING,
  SYSTEM_DARK_QUERY,
  TRANSITION_DEFAULT_DURATION,
  X_AXIS_HEIGHT,
} from './constants.js';
import { analyzeData } from './data.js';
import { drawDatasets } from './drawDatasets.js';
import { drawEventLineLabels, drawEventLines } from './drawEventLines.js';
import { drawHatchedRangeLabels } from './drawHatchedRanges.js';
import { drawReferenceLines } from './drawReferenceLines.js';
import { getRangeCaption, getZoomCaption } from './format.js';
import {
  getCircleArea, getIntervalPosition, getPlotStart, getSimplificationDelta, getVisibleLabelRange, isDataRange,
} from './formulas.js';
import { Header } from './Header.js';
import { createElement } from './minifiers.js';
import { Minimap } from './Minimap.js';
import { preparePoints } from './preparePoints.js';
import { Projection } from './Projection.js';
import { createColors, recreateColors } from './skin.js';
import { StateManager } from './StateManager.js';
import { Tools } from './Tools.js';
import { Tooltip } from './Tooltip.js';
import { debounce } from './utils.js';
import { Zoomer } from './Zoomer.js';

export type {
  ChartType, Comparison, DateLocale, EventLine, HatchedRange, LabelType, LovelyChartDatasetParams, LovelyChartParams,
  LovelyChartUpdateOptions, ReferenceLine, SecondaryYAxisConfig, ThemedColor, TooltipContent, TooltipNotes,
} from './types.js';
export { DEFAULT_COLORS, DEFAULT_COMPARISON_COLOR, getDefaultColors } from './data.js';

const REDRAW_DEBOUNCE_MS = 500;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const PLOT_HEIGHT_PROPERTY = '--lovely-chart-plot-height';
const PLOT_HEIGHT_PATTERN = /^(\d*\.?\d+)(px|rem)?$/;
const PLOT_AREA_PROPERTIES: [keyof Rect, string][] = [
  ['left', '--lovely-chart-plot-area-left'],
  ['top', '--lovely-chart-plot-area-top'],
  ['width', '--lovely-chart-plot-area-width'],
  ['height', '--lovely-chart-plot-area-height'],
];
const PLOT_PADDING_TOP_PROPERTY = '--lovely-chart-plot-padding-top';

interface KeptSelection {
  labelIndex: number;
  isByPointer: boolean;
}

// The nodes a rebuilt chart and its legend go before, each to take the place of the one it replaces
interface NextSiblings {
  chart: Node | undefined;
  legend: Node | undefined;
}

export default class LovelyChart {
  readonly #container: HTMLElement;

  #stateManager?: StateManager;

  #element?: HTMLElement;
  #plot?: HTMLCanvasElement;
  #context?: CanvasRenderingContext2D;
  #plotSize?: Size;
  // The data area of the plot in the coordinates of the canvas, as last placed on the element
  #plotArea?: Rect;
  // The data area in px of the padding box of the element, as last written to it
  #placedPlotArea?: Rect;
  #reportedPlotArea?: Rect;

  #header?: Header;
  #axes?: Axes;
  #minimap?: Minimap;
  #tooltip?: Tooltip;
  #tools?: Tools;
  #zoomer?: Zoomer;

  #state?: ChartState;
  #windowWidth = window.innerWidth;
  #originalData: LovelyChartParams;
  // Where each rebuild puts the legend: the `legendContainer` of the params, or the element `setLegendContainer()` gave
  #legendContainer?: HTMLElement;
  #isDestroyed = false;
  // The label the first frame zooms into, as `initialZoom` asks or a zoom `update()` keeps
  #pendingZoomIndex?: number;
  #selectedLabelIndex?: number;
  #tooltipKey?: string;
  // The selection `update()` keeps, which the first frame of the rebuilt chart selects again
  #keptSelection?: KeptSelection;
  // The value of the label `onZoomChange` last reported, while the page knows the chart as zoomed
  #zoomedLabelValue?: number;
  #hiddenDatasetsKey?: string;
  // The charts `update()` with `isAnimated` replaced, with legends of their own outside them, each with the timeout
  // that removes it once it has faded out, and the rebuilt ones fading in
  readonly #fadeOutTimeouts = new Map<HTMLElement, number>();
  #fadingInElements: HTMLElement[] = [];
  #fadeInTimeout?: number;

  #themeObserver?: MutationObserver;
  #layoutObserver?: ResizeObserver;
  #systemSchemeQuery?: MediaQueryList;
  #fontFaces?: FontFaceSet;
  #onWindowResize?: () => void;
  #onWindowOrientationChange?: () => void;

  // Each rebuild analyzes the data into a new object, out of reach of the components it destroyed
  #data: AnalyzedData;
  // The datasets of the overview the chart was last built with, which a zoom swaps out of `#data` for its own
  #overviewDatasets?: AnalyzedDataset[];
  // A copy of the labels the chart was last built with, as the page can reassign those of the params it passes again
  #overviewLabels?: LovelyChartParams['labels'];
  #colors!: ChartColors;
  readonly #redrawDebounced = debounce(() => this.#redraw(), REDRAW_DEBOUNCE_MS, false, true);

  constructor(container: HTMLElement, originalData: LovelyChartParams) {
    this.#container = container;
    this.#originalData = originalData;
    this.#legendContainer = originalData.legendContainer;

    this.#data = analyzeData(this.#originalData);
    this.#pendingZoomIndex = this.#data.initialZoomIndex;

    // The page can move the plot inside the element with the data area unchanged, as by folding the header while its
    // caption is empty. DOM emulations such as jsdom leave out `ResizeObserver`.
    if (typeof ResizeObserver === 'function') {
      this.#layoutObserver = new ResizeObserver(this.#onLayoutResize);
    }
    this.#setupComponents();
    this.#setupGlobalListeners();
  }

  /**
   * Replaces the data and rebuilds the chart, which keeps a reference to `newData`. The zoom, the minimap window, the
   * datasets the reader hid and the selection reset, unless `options` keeps them, and `isAnimated` cross-fades the
   * chart into the new data.
   */
  update(newData: LovelyChartParams, options: LovelyChartUpdateOptions = {}) {
    if (this.#isDestroyed) return;
    const { shouldKeepFilter, shouldKeepZoom, shouldKeepSelection, isAnimated } = options;
    const data = analyzeData(newData);
    const isViewKept = shouldKeepZoom && areSameLabels(this.#overviewLabels!, newData.labels);
    const zoomedLabelIndex = isViewKept && data.isZoomable ? this.#getZoomedLabelIndex() : undefined;
    const overviewState = this.#zoomer?.getOverviewState();
    const selection = shouldKeepSelection && zoomedLabelIndex === undefined && !overviewState
      ? this.#findKeptSelection(newData.labels)
      : undefined;
    this.#pendingZoomIndex = undefined;
    if (!selection) {
      this.#reportSelectedLabel(undefined);
      this.#reportTooltip(undefined);
    }
    if (zoomedLabelIndex === undefined) {
      this.#reportZoomOut();
    }
    // A callback of the reports can destroy the chart
    if (this.#isDestroyed) return;
    const filter = overviewState?.filter ?? this.#stateManager!.getFilter();
    const { begin, end } = overviewState ?? this.#stateManager!.getRange();
    const hiddenDatasetsKey = this.#hiddenDatasetsKey;
    this.#hiddenDatasetsKey = undefined;
    this.#originalData = newData;
    this.#legendContainer = newData.legendContainer;
    const isPlotFocused = this.#tooltip!.isFocused();
    const shouldCrossFade = isAnimated && !isMotionReduced();
    const nextSiblings = this.#destroyComponents(shouldCrossFade);
    this.#data = data;
    if (shouldKeepFilter) {
      this.#keepFilter(filter);
    }
    if (isViewKept) {
      this.#data.minimapRange = { begin, end };
    }
    this.#pendingZoomIndex = zoomedLabelIndex;
    this.#keptSelection = selection;
    this.#setupComponents(nextSiblings);
    if (shouldCrossFade) {
      this.#fadeIn();
    }
    if (isPlotFocused) {
      this.#tooltip!.focus();
    }

    // The legend's first filter goes unreported, so a kept filter that hides other datasets is reported last
    if (shouldKeepFilter && this.#hiddenDatasetsKey !== hiddenDatasetsKey) {
      this.#hiddenDatasetsKey = hiddenDatasetsKey;
      this.#reportHiddenDatasets(this.#stateManager!.getFilter());
    }
  }

  /**
   * Selects the label at `labelIndex` as hovering it would, showing its tooltip, and `undefined` clears the
   * selection. Pointer moves outside the chart keep it; ignored on pie and donut charts.
   */
  selectLabel(labelIndex: number | undefined) {
    if (this.#isDestroyed) return;
    this.#tooltip?.selectLabel(labelIndex);
  }

  /**
   * Reads the `var()` colours of the params again and repaints the chart in them, keeping its zoom, range, legend
   * filter and selection, for custom properties of the page that change on another trigger than the skin.
   */
  refreshColors() {
    if (this.#isDestroyed || !this.#stateManager) return;
    recreateColors(this.#colors, this.#data.colors, this.#data);
    this.#tools!.updateColors();
    this.#stateManager.update();
  }

  /**
   * Moves the legend into `element`, or back to the end of the chart with `undefined`, without a rebuild: its buttons
   * keep the datasets they hide, and the chart its zoom, range and selection. A zoom, a resize and an orientation
   * change keep the legend there, and `update()` places it by the `legendContainer` of its data.
   */
  setLegendContainer(element: HTMLElement | undefined) {
    if (this.#isDestroyed) return;
    this.#legendContainer = element;
    this.#tools!.setContainer(element ?? this.#element!);
    this.#zoomer?.releaseSize();
  }

  /**
   * The x of the label at `labelIndex` in px from the left of the plot area, in the range and the zoom the chart shows
   * or is moving to: where its value draws, at its point or the centre of its bar or step column. `offset`, from 0 to 1,
   * takes that fraction through the label's interval instead: from its point to the next one on line and area charts,
   * and across its column from its start on charts with bars or steps among their datasets. `undefined` outside the
   * visible range, before the first paint, on pie and donut charts and while zoomed into shares.
   */
  getLabelX(labelIndex: number, offset?: number): number | undefined {
    if (!this.#placedPlotArea || this.#data.isCircle || this.#zoomer?.isZoomedIntoShares()) return undefined;

    // A zoom swaps the data and sets the range it moves to at once, ahead of the frames that draw them
    const state = this.#stateManager!.getState();
    const { from, to } = getVisibleLabelRange(state);
    if (!Number.isInteger(labelIndex) || labelIndex < from || labelIndex > to) return undefined;

    const projection = new Projection(this.#buildProjectionParams(state, this.#axes!.getLabelColumnWidth()));

    return projection.toPixels(getIntervalPosition(this.#data, labelIndex, offset), 0)[0] - projection.getArea().left;
  }

  destroy() {
    if (this.#isDestroyed) return;
    this.#isDestroyed = true;

    this.#themeObserver!.disconnect();
    this.#themeObserver = undefined;
    this.#layoutObserver?.disconnect();
    this.#layoutObserver = undefined;
    this.#systemSchemeQuery?.removeEventListener('change', this.#onSystemSchemeChange);
    this.#systemSchemeQuery = undefined;
    this.#fontFaces?.removeEventListener('loadingdone', this.#onFontsLoaded);
    this.#fontFaces = undefined;
    window.removeEventListener('resize', this.#onWindowResize!);
    this.#onWindowResize = undefined;
    window.removeEventListener('orientationchange', this.#onWindowOrientationChange!);
    this.#onWindowOrientationChange = undefined;
    this.#redrawDebounced.cancel();

    this.#destroyComponents();
    PLOT_AREA_PROPERTIES.forEach(([, property]) => this.#container.style.removeProperty(property));
    this.#container.style.removeProperty(PLOT_PADDING_TOP_PROPERTY);
    if (this.#reportedPlotArea) {
      this.#originalData.onPlotAreaChange?.(undefined);
    }
  }

  #setupComponents(nextSiblings?: NextSiblings) {
    this.#overviewDatasets = this.#data.datasets;
    this.#overviewLabels = [...this.#originalData.labels];
    this.#setupContainer(nextSiblings?.chart);
    this.#colors = createColors(this.#data.colors, this.#data, this.#setupColorProbe());
    this.#header = new Header(this.#element!, this.#data.title!, this.#data.zoomOutLabel, this.#onZoomOut);
    this.#setupPlotCanvas();
    this.#stateManager = new StateManager(this.#data, this.#plotSize!, this.#onStateUpdate);
    this.#axes = new Axes(this.#context!, this.#data, this.#plotSize!, this.#colors);
    if (this.#data.withMinimap) {
      // Triggers the initial render via the range callback
      this.#minimap = new Minimap(this.#element!, this.#data, this.#colors, this.#onRangeChange);
    } else {
      this.#stateManager.update({ range: this.#data.minimapRange });
    }
    this.#tooltip = new Tooltip(
      this.#element!, this.#data, this.#plotSize!, this.#colors, this.#onZoomIn, this.#onFocus, this.#reportTooltip,
    );
    this.#tools = new Tools(
      this.#legendContainer ?? this.#element!, this.#data, this.#colors, this.#onFilterChange, nextSiblings?.legend,
    );
    this.#zoomer = this.#data.isZoomable
      ? new Zoomer(
        this.#data, this.#originalData, this.#colors, this.#stateManager,
        this.#element!, this.#plotSize!, this.#header, this.#minimap, this.#tooltip, this.#tools, this.#onZoomStart,
        this.#onZoomChange,
      )
      : undefined;
  }

  // A rebuilt chart takes the place of the one before it among the children of the element, so elements of the page
  // there keep the stacking they had over or under the chart
  #setupContainer(nextSibling?: Node) {
    this.#element = createElement();
    this.#element.className = 'lovely-chart--container';
    if (this.#data.shouldZoomToShares) {
      this.#element.classList.add('lovely-chart--container-type-circle');
    }
    if (this.#data.isSparkline) {
      this.#element.classList.add('lovely-chart--container-sparkline');
    }
    if (this.#data.colorScheme === 'system') {
      this.#element.classList.add('lovely-chart--container-scheme-system');
    }

    if (nextSibling?.parentNode === this.#container) {
      this.#container.insertBefore(this.#element, nextSibling);
    } else {
      this.#container.appendChild(this.#element);
    }
    this.#layoutObserver?.observe(this.#element);
  }

  // The `var()` colours of the params compute on an element inside the chart, in its cascade. Hidden, the element
  // starts none of the transitions of the page's colours, which a read would catch midway.
  #setupColorProbe() {
    const probe = createElement<HTMLSpanElement>('span');
    probe.style.display = 'none';
    this.#element!.appendChild(probe);
    return probe;
  }

  #setupPlotCanvas() {
    const { canvas, context } = setupCanvas(this.#element!, {
      width: this.#element!.clientWidth,
      height: this.#readPlotHeightProperty() ?? this.#data.plotHeight ?? PLOT_HEIGHT,
    });

    this.#plot = canvas;
    this.#context = context;

    this.#plotSize = {
      width: this.#plot.offsetWidth,
      height: this.#plot.offsetHeight,
    };
  }

  #readPlotHeightProperty() {
    const value = getComputedStyle(this.#element!).getPropertyValue(PLOT_HEIGHT_PROPERTY).trim();
    const match = PLOT_HEIGHT_PATTERN.exec(value);
    if (!match) return undefined;

    const height = parseFloat(match[1]);
    if (!(height > 0)) return undefined;

    return match[2] === 'rem'
      ? height * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : height;
  }

  readonly #onStateUpdate = (state: ChartState) => {
    if (this.#isDestroyed) return;
    this.#state = state;

    // A `FontFace` the page adds to `document.fonts` already loaded fires no `loadingdone`
    if (this.#axes!.detectFontChange()) {
      this.#resetFontMeasures();
    }

    const { datasets } = this.#data;
    const labelColumnWidth = this.#axes!.getLabelColumnWidth();
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const boundsAndParams = this.#buildProjectionParams(state, labelColumnWidth);
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`] as number);
    const circleSums = this.#data.isCircle
      ? datasets.map(({ key }) => state[`circleSum#${key}`] as number)
      : undefined;
    const points = preparePoints(
      this.#data, datasets, range, visibilities, boundsAndParams, undefined, circleSums,
    );
    const projection = new Projection(boundsAndParams);

    let secondaryPoints: Point[] | undefined;
    let secondaryProjection: Projection | undefined;
    if (this.#data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis)!;
      const bounds = {
        yMin: state.yMinViewportSecond!,
        yMax: state.yMaxViewportSecond!,
      };
      secondaryPoints = preparePoints(this.#data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    if (!this.#data.noCaption && this.#data.labelType !== 'text') {
      this.#header!.setCaption(this.#getCaption(state));
    }
    // A page that folds the header while its caption is empty moves the plot as the first caption arrives
    this.#updatePlotArea(this.#data.isCircle ? getCircleArea(projection) : projection.getArea());

    clearCanvas(this.#plot!, this.#context!);

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_PLOT_FACTOR;

    // A panned plot runs past its start, so the column of the Y-axis labels clips it
    if (labelColumnWidth !== undefined) {
      const labelColumnEnd = GUTTER + labelColumnWidth;
      this.#context!.save();
      this.#context!.beginPath();
      this.#context!.rect(labelColumnEnd, 0, this.#plotSize!.width - labelColumnEnd, this.#plotSize!.height);
      this.#context!.clip();
    }
    drawDatasets(
      this.#context!, state, this.#data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, this.#colors, false, simplification,
    );
    if (this.#data.hatchedRanges.length && !this.#data.isSparkline) {
      drawHatchedRangeLabels(
        this.#context!, this.#data, projection, this.#colors, this.#axes!.getInnerLabelWidths(),
      );
    }
    if (this.#data.eventLines.length) {
      drawEventLines(this.#context!, this.#data, projection, this.#colors);
      if (!this.#data.isSparkline) {
        drawEventLineLabels(
          this.#context!, this.#data, projection, this.#colors, this.#axes!.getInnerLabelWidths(true),
        );
      }
    }
    if (labelColumnWidth !== undefined) {
      this.#context!.restore();
    }
    drawReferenceLines(this.#context!, this.#data, projection, this.#plotSize!, this.#colors, labelColumnWidth);
    if (!this.#data.isCircle && !this.#data.isSparkline) {
      this.#axes!.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      this.#axes!.drawXAxis(state, projection);
    }
    this.#minimap?.update(state);
    this.#tooltip!.update(state, points, projection, secondaryPoints, secondaryProjection);
    this.#reportPlotArea();

    // The state callback is rAF-deferred, so this is the earliest point where both
    // `this.#state` and `this.#zoomer` exist — the start-zoom fires here, not in setup
    if (this.#pendingZoomIndex !== undefined && this.#zoomer) {
      const labelIndex = this.#pendingZoomIndex;
      this.#pendingZoomIndex = undefined;
      this.#zoomer.zoomIn(state, labelIndex, true);
    }

    if (this.#keptSelection) {
      const { labelIndex, isByPointer } = this.#keptSelection;
      this.#keptSelection = undefined;
      // A label outside the window the chart opens on ends the selection
      if (!this.#tooltip!.selectLabel(labelIndex, isByPointer)) {
        this.#reportSelectedLabel(undefined);
        this.#reportTooltip(undefined);
      }
    }
  };

  #buildProjectionParams(state: ChartState, labelColumnWidth: number | undefined): ProjectionParams {
    return {
      begin: state.begin,
      end: state.end,
      lastLabelIndex: state.lastLabelIndex,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: this.#plotSize!.width,
      availableHeight: this.#plotSize!.height - (this.#data.isSparkline ? SPARKLINE_PADDING : X_AXIS_HEIGHT),
      xPadding: this.#data.isSparkline ? SPARKLINE_PADDING : GUTTER,
      xInsetStart: labelColumnWidth !== undefined ? getPlotStart(labelColumnWidth) : undefined,
      yPadding: this.#data.isSparkline ? SPARKLINE_PADDING : PLOT_TOP_PADDING,
      withColumns: this.#data.hasBars || this.#data.hasSteps || this.#data.isCircle,
    };
  }

  // The element carries the data area for overlays of the page, measured only when it changes, as on a build or a
  // zoom into data of another label column, or when the layout of the chart resizes
  #updatePlotArea(area: Rect) {
    const previousArea = this.#plotArea;
    if (previousArea && isSameArea(area, previousArea)) return;

    this.#plotArea = area;
    this.#placePlotArea();
  }

  #placePlotArea() {
    const area = this.#plotArea!;
    const [offsetLeft, offsetTop] = this.#measurePlotOffset();
    const placedArea = { ...area, left: offsetLeft + area.left, top: offsetTop + area.top };
    const previousPlacedArea = this.#placedPlotArea;
    if (previousPlacedArea && isSameArea(placedArea, previousPlacedArea)) return;

    this.#placedPlotArea = placedArea;
    PLOT_AREA_PROPERTIES.forEach(([key, property]) => {
      this.#container.style.setProperty(property, `${placedArea[key]}px`);
    });
    this.#container.style.setProperty(
      PLOT_PADDING_TOP_PROPERTY, `${this.#data.isSparkline ? SPARKLINE_PADDING : PLOT_TOP_PADDING}px`,
    );
  }

  // The report goes last, as its callback can update or destroy the chart
  #reportPlotArea() {
    const area = this.#placedPlotArea;
    if (!area || area === this.#reportedPlotArea) return;

    this.#reportedPlotArea = area;
    this.#originalData.onPlotAreaChange?.({ ...area });
  }

  // The canvas origin in the padding box of the element. The layout offset of the canvas leaves out the transform
  // that turns it in a circle transition, and the scale of a transformed element or ancestor turns the distance
  // between the boxes on the screen back into px of the element.
  #measurePlotOffset(): Pixel {
    const container = this.#container;
    const element = this.#element!;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scaleX = containerRect.width && container.offsetWidth ? containerRect.width / container.offsetWidth : 1;
    const scaleY = containerRect.height && container.offsetHeight ? containerRect.height / container.offsetHeight : 1;

    return [
      (elementRect.left - containerRect.left) / scaleX + element.clientLeft + this.#plot!.offsetLeft
      - container.clientLeft + container.scrollLeft,
      (elementRect.top - containerRect.top) / scaleY + element.clientTop + this.#plot!.offsetTop
      - container.clientTop + container.scrollTop,
    ];
  }

  readonly #onRangeChange = (range: Range) => {
    this.#stateManager!.update({ range });
  };

  readonly #onFilterChange = (filter: Filter) => {
    this.#stateManager!.update({ filter });
    this.#reportHiddenDatasets(filter);
  };

  // The legend reports its first filter while it sets up, which is the one the params ask for
  #reportHiddenDatasets(filter: Filter) {
    const hiddenIndexes = this.#data.datasets.flatMap(({ key }, i) => (filter[key] === false ? [i] : []));
    const hiddenNames = hiddenIndexes.map((i) => this.#data.datasets[i].name);
    const key = JSON.stringify([hiddenNames, hiddenIndexes]);
    const isFirstReport = this.#hiddenDatasetsKey === undefined;
    if (key === this.#hiddenDatasetsKey) return;

    this.#hiddenDatasetsKey = key;
    if (isFirstReport) return;

    this.#originalData.onHiddenSeriesChange?.(hiddenNames, hiddenIndexes);
  }

  #reportSelectedLabel(labelIndex: number | undefined) {
    if (labelIndex === this.#selectedLabelIndex) return;

    this.#selectedLabelIndex = labelIndex;
    this.#originalData.onSelectedIndexChange?.(labelIndex);
  }

  // The tooltip reports its content on every frame of a selection, and the callback hears of each change once
  readonly #reportTooltip = (content: TooltipContent | undefined) => {
    const { onTooltipChange } = this.#originalData;
    if (this.#isDestroyed || !onTooltipChange) return;

    const key = content && JSON.stringify(content);
    if (key === this.#tooltipKey) return;

    this.#tooltipKey = key;
    onTooltipChange(content);
  };

  // A rebuild opens the overview, so a zoom the reader saw ends, unless the rebuilt chart opens zoomed again
  #reportZoomOut() {
    if (this.#pendingZoomIndex === undefined) {
      this.#onZoomChange(undefined, undefined);
    }
  }

  // The label of a zoom that shows, is on its way in, or opens on the first frame
  #getZoomedLabelIndex() {
    return this.#pendingZoomIndex ?? this.#zoomer?.getZoomedLabelIndex();
  }

  // The selected label of the overview, at the index of a label of the same value among `labels`
  #findKeptSelection(labels: LovelyChartParams['labels']): KeptSelection | undefined {
    let selection = this.#keptSelection;
    if (!selection && this.#selectedLabelIndex !== undefined) {
      selection = { labelIndex: this.#selectedLabelIndex, isByPointer: this.#tooltip!.isSelectionByPointer() };
    }
    if (!selection) return undefined;

    const value = this.#overviewLabels![selection.labelIndex];
    const labelIndex = labels[selection.labelIndex] === value ? selection.labelIndex : labels.indexOf(value);
    return labelIndex !== -1 ? { labelIndex, isByPointer: selection.isByPointer } : undefined;
  }

  // The rebuilt chart keeps the datasets the reader hid, matched by key, or by name once the count of datasets
  // changes. A dataset with no match keeps its own `isInitiallyHidden`, as does every dataset where the match would
  // hide them all, which the legend never lets the reader do.
  #keepFilter(filter: Filter) {
    const { datasets } = this.#data;
    const previousDatasets = this.#overviewDatasets!;
    const isSameCount = datasets.length === previousDatasets.length;
    const shownStates = datasets.map(({ key, name, isInitiallyHidden }) => {
      const previousKey = isSameCount ? key : previousDatasets.find((dataset) => dataset.name === name)?.key;
      const isShown = previousKey !== undefined ? filter[previousKey] : undefined;
      return isShown ?? !isInitiallyHidden;
    });
    if (!shownStates.includes(true)) return;

    datasets.forEach((dataset, i) => {
      dataset.isInitiallyHidden = !shownStates[i];
    });
  }

  // A zoom `update()` keeps opens again on the rebuilt chart, which the page already knows as zoomed
  readonly #onZoomChange = (labelValue: number | undefined, labelIndex: number | undefined) => {
    if (labelValue === this.#zoomedLabelValue) return;

    this.#zoomedLabelValue = labelValue;
    this.#originalData.onZoomChange?.(labelValue, labelIndex);
  };

  // The report goes last, as its callback can update or destroy the chart
  readonly #onFocus = (focusOn: FocusOn) => {
    if (this.#data.hasBars || this.#data.isCircle || this.#data.hasSteps) {
      // TODO animate
      this.#stateManager!.update({ focusOn });
    }

    this.#reportSelectedLabel(typeof focusOn === 'number' && Number.isInteger(focusOn) ? focusOn : undefined);
  };

  readonly #onZoomIn = (labelIndex: number) => {
    this.#zoomer!.zoomIn(this.#state!, labelIndex);
  };

  readonly #onZoomOut = () => {
    this.#zoomer!.zoomOut(this.#state!);
  };

  // A zoom moves the labels under an area it can leave as it is
  readonly #onZoomStart = () => {
    this.#originalData.onPlotAreaChange?.({ ...this.#placedPlotArea! });
  };

  readonly #onSystemSchemeChange = () => {
    if (this.#data.colorScheme !== 'system') return;
    this.refreshColors();
  };

  readonly #onFontsLoaded = () => {
    if (this.#isDestroyed || !this.#stateManager) return;
    this.#resetFontMeasures();
    this.#stateManager.update();
  };

  readonly #onLayoutResize = () => {
    if (this.#isDestroyed || !this.#plotArea) return;
    this.#placePlotArea();
    this.#reportPlotArea();
  };

  // A web font that arrives after the build changes the width of the Y-axis labels the column was measured for, and
  // can move the plot inside the element
  #resetFontMeasures() {
    this.#axes!.resetLabelColumn();
    this.#plotArea = undefined;
  }

  #setupGlobalListeners() {
    this.#themeObserver = new MutationObserver(() => this.refreshColors());
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    if (typeof matchMedia === 'function') {
      this.#systemSchemeQuery = matchMedia(SYSTEM_DARK_QUERY);
      this.#systemSchemeQuery.addEventListener('change', this.#onSystemSchemeChange);
    }

    // DOM emulations such as jsdom leave out `document.fonts`
    if ('fonts' in document) {
      this.#fontFaces = document.fonts;
      this.#fontFaces.addEventListener('loadingdone', this.#onFontsLoaded);
    }

    this.#onWindowResize = () => {
      if (window.innerWidth !== this.#windowWidth) {
        this.#windowWidth = window.innerWidth;
        this.#redrawDebounced();
      }
    };
    window.addEventListener('resize', this.#onWindowResize);

    this.#onWindowOrientationChange = () => {
      this.#redrawDebounced();
    };
    window.addEventListener('orientationchange', this.#onWindowOrientationChange);
  }

  // Takes the chart and its legend out at once or, with `shouldFadeOut`, through a fade, which keeps those of earlier
  // fades fading out, and returns the nodes the rebuilt ones go before
  #destroyComponents(shouldFadeOut = false): NextSiblings {
    if (!shouldFadeOut) {
      this.#endCrossFades();
    }
    this.#zoomer?.destroy();
    this.#minimap?.destroy();
    this.#tools?.destroy();
    this.#tooltip?.destroy();
    this.#header?.destroy();
    this.#stateManager?.destroy();

    const element = this.#element!;
    this.#layoutObserver?.unobserve(element);
    const legend = this.#tools?.getElement();
    const legendNextSibling = legend?.nextSibling ?? undefined;
    let nextSibling: Node | undefined;
    if (shouldFadeOut) {
      nextSibling = element.nextSibling ?? undefined;
      this.#fadeOut();
    } else {
      // The legend leaves before the place of the chart is read, as it follows the chart when `legendContainer` is the
      // chart's own container
      legend?.remove();
      nextSibling = element.nextSibling ?? undefined;
      element.remove();
    }

    this.#element = undefined;
    this.#plot = undefined;
    this.#context = undefined;
    this.#plotArea = undefined;
    this.#placedPlotArea = undefined;
    this.#header = undefined;
    this.#axes = undefined;
    this.#minimap = undefined;
    this.#tooltip = undefined;
    this.#tools = undefined;
    this.#zoomer = undefined;
    this.#stateManager = undefined;
    this.#keptSelection = undefined;

    return { chart: nextSibling, legend: legendNextSibling };
  }

  // The chart a rebuild replaces, with a legend of its own outside it, stays in the place of the new one as it fades
  // out, out of the layout and out of the reader's reach. The new chart paints over it, and the new legend under it.
  #fadeOut() {
    const elements = this.#getFadingElements();
    elements.forEach((element) => {
      const { width, opacity } = getComputedStyle(element);
      // Out of the flow, the element keeps its width and stands where the element after it starts, and one still
      // fading in fades out from the opacity it has reached
      element.style.width = width;
      element.style.opacity = opacity;
      element.inert = true;
    });
    this.#endFadeIn();
    elements.forEach((element) => {
      element.classList.add('lovely-chart--state-fading-out');
      this.#fadeOutTimeouts.set(element, window.setTimeout(() => {
        this.#fadeOutTimeouts.delete(element);
        element.remove();
      }, TRANSITION_DEFAULT_DURATION));
    });
  }

  #fadeIn() {
    this.#fadingInElements = this.#getFadingElements();
    this.#fadingInElements.forEach((element) => element.classList.add('lovely-chart--state-fading-in'));
    this.#fadeInTimeout = window.setTimeout(() => this.#endFadeIn(), TRANSITION_DEFAULT_DURATION);
  }

  // An element hidden and shown again would run its animation again
  #endFadeIn() {
    clearTimeout(this.#fadeInTimeout);
    this.#fadeInTimeout = undefined;
    this.#fadingInElements.forEach((element) => element.classList.remove('lovely-chart--state-fading-in'));
    this.#fadingInElements = [];
  }

  // A rebuild with no fade or `destroy()` ends the cross-fades still on their way
  #endCrossFades() {
    this.#endFadeIn();
    this.#fadeOutTimeouts.forEach((timeout, element) => {
      clearTimeout(timeout);
      element.remove();
    });
    this.#fadeOutTimeouts.clear();
  }

  // The chart's element, and its legend when `legendContainer` holds it
  #getFadingElements() {
    const element = this.#element!;
    const legend = this.#tools!.getElement();
    return legend.parentNode === element ? [element] : [element, legend];
  }

  #redraw() {
    if (this.#isDestroyed) return;
    this.#reportSelectedLabel(undefined);
    this.#reportTooltip(undefined);
    this.#reportZoomOut();
    // A callback of the reports can destroy the chart
    if (this.#isDestroyed) return;
    const filter = this.#zoomer?.getOverviewState()?.filter ?? this.#stateManager?.getFilter() ?? {};
    const isPlotFocused = this.#tooltip!.isFocused();
    const nextSiblings = this.#destroyComponents();
    this.#data = analyzeData(this.#originalData);
    this.#keepFilter(filter);
    this.#setupComponents(nextSiblings);
    if (isPlotFocused) {
      this.#tooltip!.focus();
    }
  }

  #getCaption(renderedState: ChartState): string {
    // The rendered state carries animated in-between values which would make the
    // caption flicker through transient ranges while zooming, so the caption
    // reflects the transition target instead
    const state = renderedState.static ?? renderedState;

    const { from: startIndex, to: endIndex } = getVisibleLabelRange(state);

    const { dateLocale } = this.#data;

    if (isDataRange(this.#data.xLabels[startIndex], this.#data.xLabels[endIndex])) {
      return getRangeCaption(
        this.#data.xLabels[startIndex], this.#data.xLabels[endIndex],
        this.#data.labelType, dateLocale,
      );
    }

    // A window narrower than the label step is named by its middle label —
    // `startIndex` may belong to the previous day when it straddles midnight.
    // The name follows the chart's own granularity, so a month chart zoomed to
    // one label reads "April 2029" rather than naming a single day inside it.
    const middleIndex = Math.round(state.lastLabelIndex * (state.begin + state.end) / 2);
    return getZoomCaption(this.#data.xLabels[middleIndex], this.#data.labelType, dateLocale);
  }
}

// The mapped type strips the `#private` brand of the class, so the handle stays
// structural and consumers can type their own stubs with it
/** The structural shape of a chart instance, satisfiable by consumer stubs. */
export type LovelyChartInstance = Pick<LovelyChart, 'update' | 'destroy'>;

function isSameArea(area: Rect, otherArea: Rect) {
  return PLOT_AREA_PROPERTIES.every(([key]) => area[key] === otherArea[key]);
}

function areSameLabels(labels: LovelyChartParams['labels'], otherLabels: LovelyChartParams['labels']) {
  return labels.length === otherLabels.length && labels.every((label, i) => label === otherLabels[i]);
}

// DOM emulations such as jsdom leave out `matchMedia`
function isMotionReduced() {
  return typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches;
}
