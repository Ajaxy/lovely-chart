export function createProjectionFn(state, availableSize) {
  const xFactor = availableSize.width / state.xWidth;
  const xShift = state.xShift * xFactor;

  const yFactor = availableSize.height / state.yMax;
  const yShift = state.yMin * yFactor;

  return function (labelIndex, y) {
    // TODO perf test with `round`
    return {
      xPx: labelIndex * xFactor - xShift,
      yPx: availableSize.height - (y * yFactor - yShift),
    };
  };
}
