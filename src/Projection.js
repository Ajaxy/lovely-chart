import { proxyMerge } from './utils.js';

export function createProjection(params) {
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

  const xFactor = effectiveWidth / (xRatio * xUnitsCount);
  let xOffsetPx = (begin * xUnitsCount) * xFactor - leftPadding;
  if (withColumns) {
    xOffsetPx -= xFactor / 2;
  }

  const effectiveHeight = availableHeight - yPadding;
  const yFactor = effectiveHeight / (yMax - yMin);
  const yOffsetPx = yMin * yFactor;

  function getState() {
    return { xFactor, xOffsetPx, availableHeight, yFactor, yOffsetPx };
  }

  function findClosestLabelIndex(xPx) {
    const labelIndex = Math.round((xPx + xOffsetPx) / xFactor);
    // In column mode the gutters and the very edge pixels round outside the
    // lateral columns — keep them within the outermost ones.
    return withColumns ? Math.max(0, Math.min(labelIndex, totalXWidth)) : labelIndex;
  }

  function copy(overrides, cons) {
    return createProjection(proxyMerge(params, overrides), cons);
  }

  function getCenter() {
    return [
      availableWidth / 2,
      availableHeight - effectiveHeight / 2,
    ];
  }

  function getSize() {
    return [availableWidth, effectiveHeight];
  }

  function getParams() {
    return params;
  }

  return {
    findClosestLabelIndex,
    copy,
    getCenter,
    getSize,
    getParams,
    getState,
  };
}

export function toPixels(projection, labelIndex, value) {
  const { xFactor, xOffsetPx, availableHeight, yFactor, yOffsetPx } = projection.getState();

  return [
    labelIndex * xFactor - xOffsetPx,
    availableHeight - (value * yFactor - yOffsetPx),
  ];
}
