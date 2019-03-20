// TODO extract to constants.js
const X_SCALE_HEIGHT = 30;

// TODO move to viewport
export function getState(viewportData, canvasSize) {
  const availableCanvasHeight = canvasSize.height - X_SCALE_HEIGHT;

  const xFactor = canvasSize.width / viewportData.xWidth;
  const xShift = viewportData.xShift * xFactor;

  const yFactor = availableCanvasHeight / viewportData.yMax;
  const yShift = viewportData.yMin * yFactor;

  // TODO remove closure
  function getPixelCoords(labelIndex, y) {

    // TODO test w/o `round`
    return {
      xPx: Math.round(labelIndex * xFactor - xShift),
      yPx: Math.round(availableCanvasHeight - (y * yFactor - yShift)),
    };
  }

  return {
    ...viewportData,
    getPixelCoords,
  };
}
