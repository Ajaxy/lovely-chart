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

  let effectiveWidth = availableWidth;

  // TODO bug get rid of padding jumps
  if (begin === 0) {
    effectiveWidth -= xPadding;
  }
  if (end === 1) {
    effectiveWidth -= xPadding;
  }
  // In column mode (bars, steps) every label owns a full-width column, so the
  // X scale spans one extra unit and label positions shift to column centers —
  // otherwise the first and last columns are cut in half at the plot edges.
  const xUnitsCount = withColumns ? totalXWidth + 1 : totalXWidth;
  const xFactor = effectiveWidth / ((end !== begin ? end - begin : 1) * xUnitsCount);
  let xOffsetPx = (begin * xUnitsCount) * xFactor;
  if (withColumns) {
    xOffsetPx -= xFactor / 2;
  }
  if (begin === 0) {
    xOffsetPx -= xPadding;
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
