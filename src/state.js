import { mergeArrays, getMaxMin } from './fast';

// TODO extract to constants.js
const X_SCALE_HEIGHT = 30;

function getViewportDimensions(viewport, datasetsByLabelIndex, dataInfo) {
  const totalXWidth = dataInfo.xLabels.length;
  const labelFromIndex = Math.max(0, Math.floor(totalXWidth * viewport.begin));
  const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * viewport.end));

  const viewportDatasets = datasetsByLabelIndex.map((dataset) => dataset.slice(labelFromIndex, labelToIndex));
  const merged = mergeArrays(viewportDatasets);
  // TODO easier to stick with datasetsByLabel?
  const effective = merged.filter((value) => value !== undefined);
  const { max: yMax } = getMaxMin(effective);
  const yMin = 0; // TODO maybe needed real

  return {
    labelFromIndex,
    labelToIndex,
    xShift: viewport.begin * totalXWidth,
    xWidth: (viewport.end - viewport.begin) * totalXWidth,
    yMin,
    yMax,
    yHeight: yMax - yMin,
  };
}


// TODO join w/ getViewportDimensions
export function getState(viewport, datasetsByLabelIndex, dataInfo, canvasSize) {
  const viewportDimensions = getViewportDimensions(viewport, datasetsByLabelIndex, dataInfo);
  const availableCanvasHeight = canvasSize.height - X_SCALE_HEIGHT;

  const xFactor = canvasSize.width / viewportDimensions.xWidth;
  const xShift = viewportDimensions.xShift * xFactor;

  const yFactor = availableCanvasHeight / viewportDimensions.yHeight;
  const yShift = viewportDimensions.yMin * yFactor;

  // TODO remove closure
  function getPixelCoords(labelIndex, y) {

    // TODO test w/o `round`
    return {
      xPx: Math.round(labelIndex * xFactor - xShift),
      yPx: Math.round(availableCanvasHeight - (y * yFactor - yShift)),
    };
  }

  return {
    ...viewportDimensions,
    getPixelCoords,
  };
}
