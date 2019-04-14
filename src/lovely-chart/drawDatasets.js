import { mergeArrays } from './fast';
import { buildCssColorFromState } from './skin';
import { PLOT_PIE_RADIUS_FACTOR } from './constants';
import { getPieTextShift, getPieTextSize } from './formulas';

function drawDatasetLine(context, coords, options) {
  context.beginPath();

  // TODO perf use projection?
  // const { xFactor, xOffsetPx, availableHeight, yFactor, yOffsetPx } = projection.vars;
  //  const x = j * xFactor - xOffsetPx;
  //  const y = availableHeight - (values[j] * yFactor - yOffsetPx);

  for (let j = 0, l = coords.length; j < l; j++) {
    const { x, y } = coords[j];
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

// TODO try polyons and filled lines
function drawDatasetBars(context, coords, options) {
  context.beginPath();

  coords.forEach(({ x, yFrom, yTo }) => {
    context.moveTo(x, yFrom);
    context.lineTo(x, yFrom - yTo >= 1 ? yTo : yTo - 1);
  });

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = coords.length > 1 ? coords[1].x - coords[0].x : coords[0].x * 2;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();
  context.restore();
}

// TODO try draw overlaying
function drawDatasetArea(context, coords, options) {
  context.beginPath();

  coords.forEach(({ x, y }, i) => {
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.save();
  context.fillStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.fill();
  context.restore();
}

function drawDatasetPie(context, coords, options) {
  const { percent, percentFrom, percentTo } = coords[0];

  if (!percent) {
    return;
  }

  const beginAngle = percentFrom * Math.PI * 2 - Math.PI / 2;
  const endAngle = percentTo * Math.PI * 2 - Math.PI / 2;
  const { radius = 120, shift = 0, center } = options;
  const [x, y] = center;

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
  context.fillText(`${Math.round(percent * 100)}%`, x + directionX * textShift, y + directionY * textShift);

  context.restore();
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

export function drawDatasets(
  context, state, data, range, projection, coords, secondaryCoords, lineWidth, visibilities, palette, pieToArea
) {
  data.datasets.forEach(({ colorName, type, hasOwnYAxis }, i) => {
    if (!visibilities[i]) {
      return;
    }

    const options = {
      color: buildCssColorFromState(state, `palette-${palette}-${colorName}-line`),
      lineWidth,
      opacity: data.isStacked ? 1 : visibilities[i],
    };

    const datasetType = type === 'pie' && pieToArea ? 'area' : type;
    let datasetCoords = hasOwnYAxis ? secondaryCoords : coords[i];

    if (datasetType === 'area') {
      const [xMax, y0] = projection.toPixels(range.to, 0);
      const [xMin] = projection.toPixels(range.from, 0);
      const bottomLine = [{ x: xMin, y: y0 }, { x: xMax, y: y0 }];
      const topLine = [{ x: xMax, y: 0 }, { x: xMin, y: 0 }];

      datasetCoords = mergeArrays([coords[i - 1] || bottomLine, topLine]);
    }

    if (datasetType === 'pie') {
      options.center = projection.getCenter();
      options.radius = Math.min(...projection.getSize()) * PLOT_PIE_RADIUS_FACTOR;
    }

    drawDataset(datasetType, context, datasetCoords, options);
  });
}
