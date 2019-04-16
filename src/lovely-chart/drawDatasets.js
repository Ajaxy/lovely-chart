import { getCssColor } from './skin';
import { mergeArrays } from './utils';
import { getPieTextShift, getPieTextSize } from './formulas';
import { PLOT_PIE_RADIUS_FACTOR, PLOT_PIE_SHIFT } from './constants';

export function drawDatasets(
  context, state, data,
  range, points, projection, secondaryPoints, secondaryProjection,
  lineWidth, visibilities, colors, pieToArea,
) {
  data.datasets.forEach(({ colorName, type, hasOwnYAxis }, i) => {
    if (!visibilities[i]) {
      return;
    }

    const options = {
      color: getCssColor(colors, `${colorName}-line`),
      lineWidth,
      opacity: data.isStacked ? 1 : visibilities[i],
    };

    const datasetType = type === 'pie' && pieToArea ? 'area' : type;
    let datasetPoints = hasOwnYAxis ? secondaryPoints : points[i];
    let datasetProjection = hasOwnYAxis ? secondaryProjection : projection;

    if (datasetType === 'area') {
      const { yMin, yMax } = projection.getParams();
      const yHeight = yMax - yMin;
      const bottomLine = [
        { labelIndex: range.from, stackValue: 0 },
        { labelIndex: range.to, stackValue: 0 },
      ];
      const topLine = [
        { labelIndex: range.to, stackValue: yHeight },
        { labelIndex: range.from, stackValue: yHeight },
      ];

      datasetPoints = mergeArrays([points[i - 1] || bottomLine, topLine]);
    }

    if (datasetType === 'pie') {
      options.center = projection.getCenter();
      options.radius = Math.min(...projection.getSize()) * PLOT_PIE_RADIUS_FACTOR;
      options.pointerVector = state.focusOn;
    }

    if (datasetType === 'bar') {
      const [x0] = projection.toPixels(0, 0);
      const [x1] = projection.toPixels(1, 0);

      options.lineWidth = x1 - x0;
      options.focusOn = state.focusOn;
    }

    drawDataset(datasetType, context, datasetPoints, datasetProjection, options);
  });

  if (state.focusOn && data.isBars) {
    const [x0] = projection.toPixels(0, 0);
    const [x1] = projection.toPixels(1, 0);

    drawBarsMask(context, projection, {
      focusOn: state.focusOn,
      color: getCssColor(colors, 'mask'),
      lineWidth: x1 - x0
    });
  }
}

function drawDataset(type, ...args) {
  switch (type) {
    case 'line':
      return drawDatasetLine(...args);
    case 'bar':
      return drawDatasetBars(...args);
    case 'area':
      return drawDatasetArea(...args);
    case 'pie':
      return drawDatasetPie(...args);
  }
}

function drawDatasetLine(context, points, projection, options) {
  context.beginPath();

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue } = points[j];
    const [x, y] = projection.toPixels(labelIndex, stackValue);
    context.lineTo(x, y);
  }

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();
  context.restore();
}

// TODO try areas
function drawDatasetBars(context, points, projection, options) {
  const { yMin } = projection.getParams();

  context.save();
  context.globalAlpha = options.opacity;
  context.fillStyle = options.color;

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue, stackOffset = 0 } = points[j];

    const [, yFrom] = projection.toPixels(labelIndex, Math.max(stackOffset, yMin));
    const [x, yTo] = projection.toPixels(labelIndex, stackValue);
    const rectX = x - options.lineWidth / 2;
    const rectY = yTo;
    const rectW = options.lineWidth + 0.5;
    const rectH = yFrom - yTo;

    context.fillRect(rectX, rectY, rectW, rectH);
  }

  context.restore();
}

function drawBarsMask(context, projection, options) {
  const [xCenter, yCenter] = projection.getCenter();
  const [width, height] = projection.getSize();

  const [x] = projection.toPixels(options.focusOn, 0);

  context.fillStyle = options.color;
  context.fillRect(xCenter - width / 2, yCenter - height / 2, x - options.lineWidth / 2, height);
  context.fillRect(x + options.lineWidth / 2, yCenter - height / 2, width - (x + options.lineWidth / 2), height);
}

function drawDatasetArea(context, points, projection, options) {
  context.beginPath();

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue } = points[j];
    const [x, y] = projection.toPixels(labelIndex, stackValue);
    context.lineTo(x, y);
  }

  context.save();
  context.fillStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.fill();
  context.restore();
}

function drawDatasetPie(context, points, projection, options) {
  const { visibleValue, stackValue, stackOffset = 0 } = points[0];

  if (!visibleValue) {
    return;
  }

  const { yMin, yMax } = projection.getParams();
  const percentFactor = 1 / (yMax - yMin);
  const percent = visibleValue * percentFactor;

  const beginAngle = stackOffset * percentFactor * Math.PI * 2 - Math.PI / 2;
  const endAngle = stackValue * percentFactor * Math.PI * 2 - Math.PI / 2;

  const { radius = 120, center: [x, y], pointerVector } = options;

  const shift = (
    pointerVector &&
    beginAngle <= pointerVector.angle &&
    pointerVector.angle < endAngle &&
    pointerVector.distance <= radius
  ) ? PLOT_PIE_SHIFT : 0;

  const shiftAngle = (beginAngle + endAngle) / 2;
  const directionX = Math.cos(shiftAngle);
  const directionY = Math.sin(shiftAngle);
  const shiftX = directionX * shift;
  const shiftY = directionY * shift;

  context.save();

  context.beginPath();
  context.fillStyle = options.color;
  context.moveTo(x + shiftX, y + shiftY);
  context.arc(x + shiftX, y + shiftY, radius, beginAngle, endAngle);
  context.lineTo(x + shiftX, y + shiftY);
  context.fill();

  context.font = `700 ${getPieTextSize(percent, radius)}px Helvetica, Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'white';
  const textShift = getPieTextShift(percent, radius);
  context.fillText(
    `${Math.round(percent * 100)}%`, x + directionX * textShift + shiftX, y + directionY * textShift + shiftY
  );

  context.restore();
}
