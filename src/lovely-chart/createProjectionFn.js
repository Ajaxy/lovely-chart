export function createProjectionFn(bounds, availableSize) {
  const xFactor = availableSize.width / bounds.xWidth;
  const xShift = bounds.xShift * xFactor;

  const yFactor = availableSize.height / bounds.yMax;
  const yShift = bounds.yMin * yFactor;

  return function (labelIndex, y) {
    // TODO perf test with `round`
    return {
      xPx: labelIndex * xFactor - xShift,
      yPx: availableSize.height - (y * yFactor - yShift),
    };
  };
}
