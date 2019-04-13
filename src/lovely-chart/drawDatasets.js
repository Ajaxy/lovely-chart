import { mergeArrays } from './fast';
import { buildCssColorFromState } from './skin';

function drawDatasetLine(context, coords, options) {
  context.beginPath();

  // TODO perf use projection?
  // const { xFactor, xOffsetPx, availableHeight, yFactor, yOffsetPx } = projection.vars;
  //  const x = j * xFactor - xOffsetPx;
  //  const y = availableHeight - (values[j] * yFactor - yOffsetPx);

  for (let j = 0, l = coords.length; j <l; j++) {
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

// TODO draw overlaying
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

function drawDataset(type, ...args) {
  switch (type) {
    case 'line':
      return drawDatasetLine(...args);
    case 'bar':
      return drawDatasetBars(...args);
    case 'area':
      return drawDatasetArea(...args);
  }
}

// TODO remove projection
export function drawDatasets(
  context, state, data, range, projection, coords, secondaryCoords, lineWidth, visibilities, palette
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

    let datasetCoords = hasOwnYAxis ? secondaryCoords : coords[i];

    if (type === 'area') {
      const [xMax, y0] = projection.toPixels(range.to, 0);
      const [xMin] = projection.toPixels(range.from, 0);
      const bottomLine = [{ x: xMin, y: y0 }, { x: xMax, y: y0 }];
      const topLine = [{ x: xMax, y: 0 }, { x: xMin, y: 0 }];

      datasetCoords = mergeArrays([coords[i - 1] || bottomLine, topLine]);
    }

    drawDataset(type, context, datasetCoords, options);
  });
}
