import { proxyMerge } from './fast';

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
  } = params;

  let effectiveWidth = availableWidth;

  // TODO bug get rid of padding jumps
  if (begin === 0) {
    effectiveWidth -= xPadding;
  }
  if (end === 1) {
    effectiveWidth -= xPadding;
  }
  const xFactor = effectiveWidth / ((end - begin) * totalXWidth);
  let xOffsetPx = (begin * totalXWidth) * xFactor;
  if (begin === 0) {
    xOffsetPx -= xPadding;
  }

  const effectiveHeight = availableHeight - yPadding;
  const yFactor = effectiveHeight / (yMax - yMin);
  const yOffsetPx = yMin * yFactor;

  function toPixels(labelIndex, value) {
    return [
      labelIndex * xFactor - xOffsetPx,
      availableHeight - (value * yFactor - yOffsetPx),
    ];
  }

  function findClosesLabelIndex(xPx) {
    return Math.round((xPx + xOffsetPx) / xFactor);
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
    toPixels,
    findClosesLabelIndex,
    copy,
    getCenter,
    getSize,
    getParams,
  };
}
