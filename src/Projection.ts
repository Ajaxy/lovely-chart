import type { Pixel, ProjectionParams } from './types';

import { mergeProxied } from './utils';

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
      yPadding = 0,
      withColumns = false,
    } = params;

    this.#params = params;
    this.#lastLabelIndex = lastLabelIndex;
    this.#withColumns = withColumns;
    this.#availableWidth = availableWidth;
    this.#availableHeight = availableHeight;

    // In column mode (bars, steps) every label owns a full-width column, so the
    // X scale spans one extra unit and label positions shift to column centers —
    // otherwise the first and last columns are cut in half at the plot edges
    const xUnitsCount = withColumns ? lastLabelIndex + 1 : lastLabelIndex;
    const xRatio = end !== begin ? end - begin : 1;

    // The chart bleeds beyond the container edge while panning, but keeps an
    // edge margin when scrolled all the way to the begin/end. The margin fades
    // in over the last `xPadding` of scroll distance, so the layout stays
    // stable when the minimap hits a boundary.
    const baseXFactor = availableWidth / (xRatio * xUnitsCount);
    const leftPadding = Math.max(0, xPadding - begin * xUnitsCount * baseXFactor);
    const rightPadding = Math.max(0, xPadding - (1 - end) * xUnitsCount * baseXFactor);
    const effectiveWidth = availableWidth - leftPadding - rightPadding;

    this.#xFactor = effectiveWidth / (xRatio * xUnitsCount);
    this.#xOffsetPx = (begin * xUnitsCount) * this.#xFactor - leftPadding;
    if (withColumns) {
      this.#xOffsetPx -= this.#xFactor / 2;
    }

    this.#effectiveHeight = availableHeight - yPadding;
    this.#yFactor = this.#effectiveHeight / (yMax - yMin);
    this.#yOffsetPx = yMin * this.#yFactor;
  }

  toPixels(labelIndex: number, value: number): Pixel {
    return [
      labelIndex * this.#xFactor - this.#xOffsetPx,
      this.#availableHeight - (value * this.#yFactor - this.#yOffsetPx),
    ];
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

  getParams(): ProjectionParams {
    return this.#params;
  }
}
