import type {
  AnalyzedData, ChartColors, ChartState, Filter, FocusOn, LovelyChartParams, Point, ProjectionParams, Range, Size,
} from './types';

import { Axes } from './Axes';
import { clearCanvas, setupCanvas } from './canvas';
import {
  GUTTER,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  PLOT_TOP_PADDING,
  SIMPLIFIER_PLOT_FACTOR,
  X_AXIS_HEIGHT,
} from './constants';
import { analyzeData } from './data';
import { drawDatasets } from './drawDatasets';
import { getFullLabelDate, getLabelDate } from './format';
import { getSimplificationDelta, isDataRange } from './formulas';
import { Header } from './Header';
import { createElement } from './minifiers';
import { Minimap } from './Minimap';
import { preparePoints } from './preparePoints';
import { Projection } from './Projection';
import { createColors } from './skin';
import { StateManager } from './StateManager';
import { Tools } from './Tools';
import { Tooltip } from './Tooltip';
import { debounce } from './utils';
import { Zoomer } from './Zoomer';

import './styles/index.scss';

const REDRAW_DEBOUNCE_MS = 500;

class LovelyChart {
  readonly #container: HTMLElement;

  #stateManager?: StateManager;

  #element?: HTMLElement;
  #plot?: HTMLCanvasElement;
  #context?: CanvasRenderingContext2D;
  #plotSize?: Size;

  #header?: Header;
  #axes?: Axes;
  #minimap?: Minimap;
  #tooltip?: Tooltip;
  #tools?: Tools;
  #zoomer?: Zoomer;

  #state?: ChartState;
  #windowWidth = window.innerWidth;
  #originalData: LovelyChartParams;
  #isDestroyed = false;

  #themeObserver?: MutationObserver;
  #onWindowResize?: () => void;
  #onWindowOrientationChange?: () => void;

  readonly #data: AnalyzedData;
  readonly #colors: ChartColors;
  readonly #redrawDebounced = debounce(() => this.#redraw(), REDRAW_DEBOUNCE_MS, false, true);

  constructor(container: HTMLElement, originalData: LovelyChartParams) {
    this.#container = container;
    this.#originalData = originalData;

    this.#data = analyzeData(this.#originalData);
    this.#colors = createColors(this.#data.colors);

    this.#setupComponents();
    this.#setupGlobalListeners();
  }

  update(newData: LovelyChartParams) {
    if (this.#isDestroyed) return;
    this.#originalData = newData;
    this.#destroyComponents();
    const fresh = analyzeData(this.#originalData);
    Object.keys(this.#data).forEach((k) => {
      delete (this.#data as unknown as Record<string, unknown>)[k];
    });
    Object.assign(this.#data, fresh);
    Object.assign(this.#colors, createColors(this.#data.colors));
    this.#setupComponents();
  }

  destroy() {
    if (this.#isDestroyed) return;
    this.#isDestroyed = true;

    this.#themeObserver!.disconnect();
    this.#themeObserver = undefined;
    window.removeEventListener('resize', this.#onWindowResize!);
    this.#onWindowResize = undefined;
    window.removeEventListener('orientationchange', this.#onWindowOrientationChange!);
    this.#onWindowOrientationChange = undefined;

    this.#destroyComponents();
  }

  #setupComponents() {
    this.#setupContainer();
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
      this.#element!, this.#data, this.#plotSize!, this.#colors, this.#onZoomIn, this.#onFocus,
    );
    this.#tools = new Tools(this.#element!, this.#data, this.#onFilterChange);
    this.#zoomer = this.#data.isZoomable
      ? new Zoomer(
        this.#data, this.#originalData, this.#colors, this.#stateManager,
        this.#element!, this.#header, this.#minimap, this.#tooltip, this.#tools,
      )
      : undefined;
  }

  #setupContainer() {
    this.#element = createElement();
    this.#element.className
      = `lovely-chart--container${this.#data.shouldZoomToShares ? ' lovely-chart--container-type-circle' : ''}`;

    this.#container.appendChild(this.#element);
  }

  #setupPlotCanvas() {
    const { canvas, context } = setupCanvas(this.#element!, {
      width: this.#element!.clientWidth,
      height: PLOT_HEIGHT,
    });

    this.#plot = canvas;
    this.#context = context;

    this.#plotSize = {
      width: this.#plot.offsetWidth,
      height: this.#plot.offsetHeight,
    };
  }

  readonly #onStateUpdate = (state: ChartState) => {
    if (this.#isDestroyed) return;
    this.#state = state;

    const { datasets } = this.#data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const boundsAndParams: ProjectionParams = {
      begin: state.begin,
      end: state.end,
      lastLabelIndex: state.lastLabelIndex,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: this.#plotSize!.width,
      availableHeight: this.#plotSize!.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
      withColumns: this.#data.isBars || this.#data.isSteps || this.#data.isCircle,
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`] as number);
    const points = preparePoints(this.#data, datasets, range, visibilities, boundsAndParams);
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

    clearCanvas(this.#plot!, this.#context!);

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_PLOT_FACTOR;

    drawDatasets(
      this.#context!, state, this.#data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, this.#colors, false, simplification,
    );
    if (!this.#data.isCircle) {
      this.#axes!.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      this.#axes!.drawXAxis(state, projection);
    }
    this.#minimap?.update(state);
    this.#tooltip!.update(state, points, projection, secondaryPoints, secondaryProjection);
  };

  readonly #onRangeChange = (range: Range) => {
    this.#stateManager!.update({ range });
  };

  readonly #onFilterChange = (filter: Filter) => {
    this.#stateManager!.update({ filter });
  };

  readonly #onFocus = (focusOn: FocusOn) => {
    if (this.#data.isBars || this.#data.isCircle || this.#data.isSteps) {
      // TODO animate
      this.#stateManager!.update({ focusOn });
    }
  };

  readonly #onZoomIn = (labelIndex: number) => {
    this.#zoomer!.zoomIn(this.#state!, labelIndex);
  };

  readonly #onZoomOut = () => {
    this.#zoomer!.zoomOut(this.#state!);
  };

  #setupGlobalListeners() {
    this.#themeObserver = new MutationObserver(() => {
      if (this.#isDestroyed || !this.#stateManager) return;
      this.#stateManager.update();
    });
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

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

  #destroyComponents() {
    this.#zoomer?.destroy();
    this.#tooltip?.destroy();
    this.#header?.destroy();
    this.#stateManager?.destroy();

    if (this.#element?.parentNode) {
      this.#element.remove();
    }

    this.#element = undefined;
    this.#plot = undefined;
    this.#context = undefined;
    this.#header = undefined;
    this.#axes = undefined;
    this.#minimap = undefined;
    this.#tooltip = undefined;
    this.#tools = undefined;
    this.#zoomer = undefined;
    this.#stateManager = undefined;
  }

  #redraw() {
    if (this.#isDestroyed) return;
    this.#destroyComponents();
    Object.assign(this.#data, analyzeData(this.#originalData));
    this.#setupComponents();
  }

  #getCaption(state: ChartState): string {
    let startIndex;
    let endIndex;

    if (this.#zoomer?.isZoomed()) {
      // Un-extend the ±1 label padding of the state indexes; at the edges the
      // extension was clamped, so the values are kept as is
      startIndex = state.labelFromIndex === 0 ? 0 : state.labelFromIndex + 1;
      endIndex = state.labelToIndex === state.lastLabelIndex ? state.labelToIndex : state.labelToIndex - 1;
    } else {
      startIndex = state.labelFromIndex;
      endIndex = state.labelToIndex;
    }

    return isDataRange(this.#data.xLabels[startIndex], this.#data.xLabels[endIndex])
      ? `${getLabelDate(this.#data.xLabels[startIndex])} — ${getLabelDate(this.#data.xLabels[endIndex])}`
      : getFullLabelDate(this.#data.xLabels[startIndex]);
  }
}

export function create(
  container: HTMLElement,
  data: LovelyChartParams,
): { update: (newData: LovelyChartParams) => void; destroy: () => void } {
  return new LovelyChart(container, data);
}
