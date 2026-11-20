import type { Pixel, ProjectionParams, Rect } from './types.js';

import { isConstantRange } from './formulas.js';
import { mergeProxied } from './utils.js';

export class Projection {
  readonly #params: ProjectionParams;

  readonly #lastLabelIndex: number;
  readonly #withColumns: boolean;
  readonly #availableWidth: number;
  readonly #availableHeight: number;
  readonly #effectiveHeight: number;

  readonly #xFactor: number;
  readonly #xOffsetPx: number;
  readonly #yFactor: number;
  readonly #yOffsetPx: number;

  constructor(params: ProjectionParams) {
    const {
      begin,
      end,
      lastLabelIndex,
      yMin,
      yMax,
      availableWidth,
      availableHeight,
      xPadding = 0,
      xInsetStart,
      yPadding = 0,
      withColumns = false,
    } = params;

    this.#params = params;
    this.#lastLabelIndex = lastLabelIndex;
    // A single label has no span to stretch over, so it takes a column centered in the plot
    this.#withColumns = withColumns || lastLabelIndex === 0;
    this.#availableWidth = availableWidth;
    this.#availableHeight = availableHeight;

    // In column mode (bars, steps) every label owns a full-width column, so the
    // X scale spans one extra unit and label positions shift to column centers —
    // otherwise the first and last columns are cut in half at the plot edges
    const xUnitsCount = this.#withColumns ? lastLabelIndex + 1 : lastLabelIndex;
    const xRatio = end !== begin ? end - begin : 1;

    // The chart bleeds beyond the container edge while panning, but keeps an
    // edge margin when scrolled all the way to the begin/end. The margin fades
    // in over the last `xPadding` of scroll distance, so the layout stays
    // stable when the minimap hits a boundary. A label column would hide what
    // bleeds under it, so beside one the window begins at its fixed inset.
    const baseXFactor = availableWidth / (xRatio * xUnitsCount);
    const leftPadding = xInsetStart ?? Math.max(0, xPadding - begin * xUnitsCount * baseXFactor);
    const rightPadding = Math.max(0, xPadding - (1 - end) * xUnitsCount * baseXFactor);
    const effectiveWidth = availableWidth - leftPadding - rightPadding;

    this.#xFactor = effectiveWidth / (xRatio * xUnitsCount);
    this.#xOffsetPx = (begin * xUnitsCount) * this.#xFactor - leftPadding;
    if (this.#withColumns) {
      this.#xOffsetPx -= this.#xFactor / 2;
    }

    this.#effectiveHeight = availableHeight - yPadding;
    // A constant range sits at the middle height
    const isConstant = isConstantRange(yMin, yMax);
    this.#yFactor = isConstant ? 0 : this.#effectiveHeight / (yMax - yMin);
    this.#yOffsetPx = isConstant ? -this.#effectiveHeight / 2 : yMin * this.#yFactor;
  }

  toPixels(labelIndex: number, value: number): Pixel {
    return [
      labelIndex * this.#xFactor - this.#xOffsetPx,
      this.#availableHeight - (value * this.#yFactor - this.#yOffsetPx),
    ];
  }

  // The label position at `xPx`, between label indexes: the point of a label, or the centre of its column
  toLabelPosition(xPx: number): number {
    return (xPx + this.#xOffsetPx) / this.#xFactor;
  }

  findClosestLabelIndex(xPx: number): number {
    const labelIndex = Math.round((xPx + this.#xOffsetPx) / this.#xFactor);
    // In column mode the gutters and the very edge pixels round outside the
    // lateral columns — keep them within the outermost ones
    return this.#withColumns ? Math.max(0, Math.min(labelIndex, this.#lastLabelIndex)) : labelIndex;
  }

  copy(overrides: Partial<ProjectionParams>): Projection {
    return new Projection(mergeProxied(this.#params, overrides));
  }

  getCenter(): Pixel {
    return [
      this.#availableWidth / 2,
      this.#availableHeight - this.#effectiveHeight / 2,
    ];
  }

  getSize(): Pixel {
    return [this.#availableWidth, this.#effectiveHeight];
  }

  // The rectangle that a window over every label and the Y range fill; a panned window bleeds past its X padding
  getArea(): Rect {
    const { xPadding = 0, xInsetStart, yPadding = 0 } = this.#params;
    const left = xInsetStart ?? xPadding;

    return { left, top: yPadding, width: this.#availableWidth - xPadding - left, height: this.#effectiveHeight };
  }

  // Bars and steps, and a single label, give every label a column of its own
  hasColumns(): boolean {
    return this.#withColumns;
  }

  getParams(): ProjectionParams {
    return this.#params;
  }
}
