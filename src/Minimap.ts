import type { CaptureEvent } from './captureEvents';
import type { AnalyzedData, ChartColors, ChartState, Point, ProjectionParams, Range, Size } from './types';

import { clearCanvas, setupCanvas } from './canvas';
import { captureEvents } from './captureEvents';
import {
  DEFAULT_RANGE,
  MINIMAP_EAR_WIDTH,
  MINIMAP_HEIGHT,
  MINIMAP_LINE_WIDTH,
  MINIMAP_MARGIN,
  MINIMAP_MAX_ANIMATED_DATASETS,
  NO_FOCUS,
  SIMPLIFIER_MINIMAP_FACTOR,
} from './constants';
import { drawDatasets } from './drawDatasets';
import { getSimplificationDelta } from './formulas';
import { createElement } from './minifiers';
import { preparePoints } from './preparePoints';
import { Projection } from './Projection';
import { proxyMerge, throttleWithRaf } from './utils';

export class Minimap {
  readonly #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #colors: ChartColors;
  readonly #rangeCallback: (range: Range) => void;

  #element!: HTMLElement;
  #canvas!: HTMLCanvasElement;
  #context!: CanvasRenderingContext2D;
  #canvasSize!: Size;
  #ruler!: HTMLElement;
  #slider!: HTMLElement;
  #limitMask?: HTMLElement;

  #capturedOffset?: number;
  #range: Range = {} as Range;
  #state?: ChartState;

  readonly #limitBegin: number | undefined;

  readonly #updateRulerOnRaf = throttleWithRaf(() => this.#updateRuler());

  constructor(container: HTMLElement, data: AnalyzedData, colors: ChartColors, rangeCallback: (range: Range) => void) {
    this.#container = container;
    this.#data = data;
    this.#colors = colors;
    this.#rangeCallback = rangeCallback;

    this.#limitBegin = data.limitBegin;

    this.#setupLayout();
    this.#updateRange(data.minimapRange ?? DEFAULT_RANGE);
  }

  update(newState: ChartState) {
    const { begin, end } = newState;
    if (!this.#capturedOffset) {
      this.#updateRange({ begin, end }, true);
    }

    if (this.#data.datasets.length >= MINIMAP_MAX_ANIMATED_DATASETS) {
      newState = newState.static!;
    }

    if (!this.#isStateChanged(newState)) {
      return;
    }

    this.#state = proxyMerge(newState, { focusOn: NO_FOCUS });
    clearCanvas(this.#canvas, this.#context);

    this.#drawDatasets(this.#state);
  }

  toggle(shouldShow: boolean) {
    this.#element.classList.toggle('lovely-chart--state-hidden', !shouldShow);

    requestAnimationFrame(() => {
      this.#element.classList.toggle('lovely-chart--state-transparent', !shouldShow);
    });
  }

  #setupLayout() {
    this.#element = createElement();

    this.#element.className = 'lovely-chart--minimap';
    this.#element.style.height = `${MINIMAP_HEIGHT}px`;

    this.#setupCanvas();
    this.#setupRuler();
    this.#setupLimitMask();

    this.#container.appendChild(this.#element);

    this.#canvasSize = {
      width: this.#canvas.offsetWidth,
      height: this.#canvas.offsetHeight,
    };
  }

  #getSize(): Size {
    return {
      width: this.#container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT,
    };
  }

  #setupCanvas() {
    const { canvas, context } = setupCanvas(this.#element, this.#getSize());

    this.#canvas = canvas;
    this.#context = context;
  }

  #setupRuler() {
    this.#ruler = createElement();
    this.#ruler.className = 'lovely-chart--minimap-ruler';
    // Concatenated on purpose: the masks and slider are inline-block, so a
    // multi-line template literal would inject layout-breaking whitespace.
    this.#ruler.innerHTML
      = '<div class="lovely-chart--minimap-mask"></div>'
        + '<div class="lovely-chart--minimap-slider">'
        + '<div class="lovely-chart--minimap-slider-handle">'
        + '<span class="lovely-chart--minimap-slider-handle-pin"></span></div>'
        + '<div class="lovely-chart--minimap-slider-inner"></div>'
        + '<div class="lovely-chart--minimap-slider-handle">'
        + '<span class="lovely-chart--minimap-slider-handle-pin"></span></div>'
        + '</div>'
        + '<div class="lovely-chart--minimap-mask"></div>';

    this.#slider = this.#ruler.children[1] as HTMLElement;

    captureEvents(
      this.#slider.children[1] as HTMLElement,
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onSliderDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: 'grabbing',
      },
    );

    captureEvents(
      this.#slider.children[0] as HTMLElement,
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onLeftEarDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    captureEvents(
      this.#slider.children[2] as HTMLElement,
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onRightEarDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    this.#element.appendChild(this.#ruler);
  }

  #setupLimitMask() {
    if (this.#limitBegin === undefined) return;

    this.#limitMask = createElement();
    this.#limitMask.className = 'lovely-chart--minimap-limit-mask';
    this.#limitMask.style.width = `${this.#limitBegin * 100}%`;
    this.#limitMask.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16.5265 10.2173V7.54299C16.5265 5.08532 14.4958 3.08585 11.9997 3.08585C9.50365 3.08585 7.47293 5.08532 7.47293 7.54299V10.2173C6.2992 10.2173 5.36524 11.2011 5.42629 12.3733L5.60706 15.844C5.6879 17.3962 5.72833 18.1723 6.00269 18.7852C6.39058 19.6518 7.10506 20.33 7.9906 20.6723C8.61698 20.9144 9.39412 20.9144 10.9484 20.9144H13.051C14.6053 20.9144 15.3825 20.9144 16.0088 20.6723C16.8944 20.33 17.6089 19.6518 17.9967 18.7852C18.2711 18.1723 18.3115 17.3962 18.3924 15.844L18.5731 12.3733C18.6342 11.2011 17.7002 10.2173 16.5265 10.2173ZM11.9997 4.8687C10.5023 4.8687 9.28364 6.06857 9.28364 7.54299V10.2173H14.7158V7.54299C14.7158 6.06857 13.4972 4.8687 11.9997 4.8687Z" fill="currentColor"/>
      </svg>`;
    if (this.#data.onLimitedRangeClick) {
      this.#limitMask.classList.add('lovely-chart--state-interactive');
      this.#limitMask.addEventListener('click', this.#data.onLimitedRangeClick);
    }
    this.#element.appendChild(this.#limitMask);
  }

  #isStateChanged(newState: ChartState): boolean {
    if (!this.#state) {
      return true;
    }

    const { datasets } = this.#data;

    if (datasets.some(({ key }) => this.#state![`opacity#${key}`] !== newState[`opacity#${key}`])) {
      return true;
    }

    if (this.#state.yMaxMinimap !== newState.yMaxMinimap) {
      return true;
    }

    return false;
  }

  #drawDatasets(state: ChartState = {} as ChartState) {
    const { datasets } = this.#data;
    const range = {
      from: 0,
      to: state.totalXWidth,
    };
    const boundsAndParams: ProjectionParams = {
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: this.#canvasSize.width,
      availableHeight: this.#canvasSize.height,
      yPadding: 1,
      withColumns: this.#data.isBars || this.#data.isSteps || this.#data.isPie,
    };
    const visibilities = datasets.map(({ key }) => this.#state![`opacity#${key}`] as number);
    const points = preparePoints(this.#data, datasets, range, visibilities, boundsAndParams, true);
    const projection = new Projection(boundsAndParams);

    let secondaryPoints: Point[] | undefined;
    let secondaryProjection: Projection | undefined;
    if (this.#data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis)!;
      const bounds = { yMin: state.yMinMinimapSecond!, yMax: state.yMaxMinimapSecond! };
      secondaryPoints = preparePoints(this.#data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_MINIMAP_FACTOR;

    drawDatasets(
      this.#context, state, this.#data,
      range, points, projection, secondaryPoints, secondaryProjection,
      MINIMAP_LINE_WIDTH, visibilities, this.#colors, true, simplification,
    );
  }

  readonly #onDragCapture = (e: CaptureEvent) => {
    e.preventDefault();
    this.#capturedOffset = (e.target as HTMLElement).offsetLeft;
  };

  readonly #onDragRelease = () => {
    this.#capturedOffset = undefined;
  };

  readonly #onSliderDrag = (
    moveEvent: CaptureEvent, captureEvent: CaptureEvent, { dragOffsetX }: { dragOffsetX: number },
  ) => {
    const limitX = this.#limitBegin !== undefined ? this.#limitBegin * this.#canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = this.#canvasSize.width - this.#slider.offsetWidth;

    const newX1 = Math.max(minX1, Math.min(this.#capturedOffset! + dragOffsetX - MINIMAP_EAR_WIDTH, maxX1));
    const newX2 = newX1 + this.#slider.offsetWidth;
    const begin = newX1 / this.#canvasSize.width;
    const end = newX2 / this.#canvasSize.width;

    this.#updateRange({ begin, end });
  };

  readonly #onLeftEarDrag = (
    moveEvent: CaptureEvent, captureEvent: CaptureEvent, { dragOffsetX }: { dragOffsetX: number },
  ) => {
    const limitX = this.#limitBegin !== undefined ? this.#limitBegin * this.#canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = this.#slider.offsetLeft + this.#slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const newX1 = Math.min(maxX1, Math.max(minX1, this.#capturedOffset! + dragOffsetX));
    const begin = newX1 / this.#canvasSize.width;

    this.#updateRange({ begin });
  };

  readonly #onRightEarDrag = (
    moveEvent: CaptureEvent, captureEvent: CaptureEvent, { dragOffsetX }: { dragOffsetX: number },
  ) => {
    const minX2 = this.#slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = this.#canvasSize.width;

    const newX2 = Math.max(minX2, Math.min(this.#capturedOffset! + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / this.#canvasSize.width;

    this.#updateRange({ end });
  };

  #updateRange(range: Partial<Range>, isExternal?: boolean) {
    let nextRange = { ...this.#range, ...range };

    if (this.#state?.minimapDelta && !isExternal) {
      nextRange = this.#adjustDiscreteRange(nextRange);
    }

    if (this.#limitBegin !== undefined && nextRange.begin < this.#limitBegin) {
      nextRange.begin = this.#limitBegin;
    }

    if (nextRange.begin === this.#range.begin && nextRange.end === this.#range.end) {
      return;
    }

    this.#range = nextRange;
    this.#updateRulerOnRaf();

    if (!isExternal) {
      this.#rangeCallback(this.#range);
    }
  }

  #adjustDiscreteRange(nextRange: Range): Range {
    // TODO sometimes beginChange and endChange are different for slider drag because of pixels division
    const begin = Math.round(nextRange.begin / this.#state!.minimapDelta!) * this.#state!.minimapDelta!;
    const end = Math.round(nextRange.end / this.#state!.minimapDelta!) * this.#state!.minimapDelta!;

    return { begin, end };
  }

  #updateRuler() {
    const { begin, end } = this.#range;

    (this.#ruler.children[0] as HTMLElement).style.width = `${begin * 100}%`;
    (this.#ruler.children[1] as HTMLElement).style.width = `${(end - begin) * 100}%`;
    (this.#ruler.children[2] as HTMLElement).style.width = `${(1 - end) * 100}%`;
  }
}
