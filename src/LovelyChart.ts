import { StateManager } from './StateManager';
import { Header } from './Header';
import { Axes } from './Axes';
import { Minimap } from './Minimap';
import { Tooltip } from './Tooltip';
import { Tools } from './Tools';
import { Zoomer } from './Zoomer';
import { createColors } from './skin';
import { analyzeData } from './data';
import { setupCanvas, clearCanvas } from './canvas';
import { preparePoints } from './preparePoints';
import { Projection } from './Projection';
import { drawDatasets } from './drawDatasets';
import { createElement } from './minifiers';
import { getFullLabelDate, getLabelDate } from './format';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  SIMPLIFIER_PLOT_FACTOR,
} from './constants';
import { getSimplificationDelta, isDataRange } from './formulas';
import { debounce } from './utils';
import type {
  AnalyzedData, ChartColors, ChartState, Filter, FocusOn, LovelyChartParams, Point, ProjectionParams, Range, Size,
} from './types';
import './styles/index.scss';

class LovelyChart {
  #container: HTMLElement;

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

  #themeObserver?: MutationObserver | null;
  #onWindowResize?: (() => void) | null;
  #onWindowOrientationChange?: (() => void) | null;

  #data: AnalyzedData;
  #colors: ChartColors;
  #redrawDebounced = debounce(() => this.#redraw(), 500, false, true);

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
    Object.keys(this.#data).forEach((k) => { delete (this.#data as unknown as Record<string, unknown>)[k]; });
    Object.assign(this.#data, fresh);
    Object.assign(this.#colors, createColors(this.#data.colors));
    this.#setupComponents();
  }

  destroy() {
    if (this.#isDestroyed) return;
    this.#isDestroyed = true;

    if (this.#themeObserver) {
      this.#themeObserver.disconnect();
      this.#themeObserver = null;
    }
    if (this.#onWindowResize) {
      window.removeEventListener('resize', this.#onWindowResize);
      this.#onWindowResize = null;
    }
    if (this.#onWindowOrientationChange) {
      window.removeEventListener('orientationchange', this.#onWindowOrientationChange);
      this.#onWindowOrientationChange = null;
    }

    this.#destroyComponents();
  }

  #setupComponents() {
    this.#setupContainer();
    this.#header = new Header(this.#element!, this.#data.title!, this.#data.zoomOutLabel, this.#onZoomOut);
    this.#setupPlotCanvas();
    this.#stateManager = new StateManager(this.#data, this.#plotSize!, this.#onStateUpdate);
    this.#axes = new Axes(this.#context!, this.#data, this.#plotSize!, this.#colors);
    if (this.#data.withMinimap) {
      // Triggers the initial render via the range callback.
      this.#minimap = new Minimap(this.#element!, this.#data, this.#colors, this.#onRangeChange);
    } else {
      this.#stateManager.update({ range: this.#data.minimapRange });
    }
    this.#tooltip = new Tooltip(this.#element!, this.#data, this.#plotSize!, this.#colors, this.#onZoomIn, this.#onFocus);
    this.#tools = new Tools(this.#element!, this.#data, this.#onFilterChange);
    this.#zoomer = this.#data.isZoomable
      ? new Zoomer(this.#data, this.#originalData, this.#colors, this.#stateManager, this.#element!, this.#header, this.#minimap, this.#tooltip, this.#tools)
      : undefined;
    // hideOnScroll(this.#element);
  }

  #setupContainer() {
    this.#element = createElement();
    this.#element.className = `lovely-chart--container${this.#data.shouldZoomToPie ? ' lovely-chart--container-type-pie' : ''}`;

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

  #onStateUpdate = (state: ChartState) => {
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
      totalXWidth: state.totalXWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: this.#plotSize!.width,
      availableHeight: this.#plotSize!.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
      withColumns: this.#data.isBars || this.#data.isSteps,
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`] as number);
    const points = preparePoints(this.#data, datasets, range, visibilities, boundsAndParams);
    const projection = new Projection(boundsAndParams);

    let secondaryPoints: Point[] | null = null;
    let secondaryProjection: Projection | null = null;
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
    if (!this.#data.isPie) {
      this.#axes!.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      this.#axes!.drawXAxis(state, projection);
    }
    if (this.#minimap) {
      this.#minimap.update(state);
    }
    this.#tooltip!.update(state, points, projection, secondaryPoints, secondaryProjection);
  };

  #onRangeChange = (range: Range) => {
    this.#stateManager!.update({ range });
  };

  #onFilterChange = (filter: Filter) => {
    this.#stateManager!.update({ filter });
  };

  #onFocus = (focusOn: FocusOn) => {
    if (this.#data.isBars || this.#data.isPie || this.#data.isSteps) {
      // TODO animate
      this.#stateManager!.update({ focusOn });
    }
  };

  #onZoomIn = (labelIndex: number | null) => {
    this.#zoomer!.zoomIn(this.#state!, labelIndex!);
  };

  #onZoomOut = () => {
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
    if (this.#zoomer) this.#zoomer.destroy();
    if (this.#tooltip) this.#tooltip.destroy();
    if (this.#header) this.#header.destroy();
    if (this.#stateManager) this.#stateManager.destroy();

    if (this.#element && this.#element.parentNode) {
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

    if (this.#zoomer && this.#zoomer.isZoomed()) {
      // TODO Fix label
      startIndex = state.labelFromIndex === 0 ? 0 : state.labelFromIndex + 1;
      endIndex = state.labelToIndex === state.totalXWidth - 1 ? state.labelToIndex : state.labelToIndex - 1;
    } else {
      startIndex = state.labelFromIndex;
      endIndex = state.labelToIndex;
    }

    return isDataRange(this.#data.xLabels[startIndex], this.#data.xLabels[endIndex])
      ? (
        `${getLabelDate(this.#data.xLabels[startIndex])}` +
        ' — ' +
        `${getLabelDate(this.#data.xLabels[endIndex])}`
      )
      : getFullLabelDate(this.#data.xLabels[startIndex]);
  }
}

function create(container: HTMLElement, data: LovelyChartParams): { update: (newData: LovelyChartParams) => void; destroy: () => void } {
  return new LovelyChart(container, data);
}

export { create };
export default { create };
