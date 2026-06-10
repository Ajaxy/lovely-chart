import { proxyMerge } from './utils';
import type { Pixel, ProjectionParams } from './types';

export class Projection {
  #params: ProjectionParams;

  #totalXWidth: number;
  #withColumns: boolean;
  #availableWidth: number;
  #availableHeight: number;
  #effectiveHeight: number;

  #xFactor: number;
  #xOffsetPx: number;
  #yFactor: number;
  #yOffsetPx: number;

  constructor(params: ProjectionParams) {
    const {
      begin,
      end,
      totalXWidth,
      yMin,
      yMax,
      availableWidth,
      availableHeight,
      xPadding = 0,
      yPadding = 0,
      withColumns = false,
    } = params;

    this.#params = params;
    this.#totalXWidth = totalXWidth;
    this.#withColumns = withColumns;
    this.#availableWidth = availableWidth;
    this.#availableHeight = availableHeight;

    // In column mode (bars, steps) every label owns a full-width column, so the
    // X scale spans one extra unit and label positions shift to column centers —
    // otherwise the first and last columns are cut in half at the plot edges.
    const xUnitsCount = withColumns ? totalXWidth + 1 : totalXWidth;
    const xRatio = end !== begin ? end - begin : 1;

    // The chart bleeds beyond the container edge while panning, but keeps an
    // edge margin when scrolled all the way to the begin/end. The margin fades
    // in over the last `xPadding` of scroll distance — applying it only at
    // exactly 0/1 made the layout jump when the minimap hit a boundary.
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
    // lateral columns — keep them within the outermost ones.
    return this.#withColumns ? Math.max(0, Math.min(labelIndex, this.#totalXWidth)) : labelIndex;
  }

  copy(overrides: Partial<ProjectionParams>): Projection {
    return new Projection(proxyMerge(this.#params, overrides) as ProjectionParams);
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
