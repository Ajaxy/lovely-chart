function drawDatasetLine(context, coords, options) {
  context.beginPath();

  coords.forEach(({ x, y }, i) => {
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

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
    context.lineTo(x, yTo);
  });

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = coords[1].x - coords[0].x;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();
  context.restore();
}

function drawDataset(type, ...args) {
  switch (type) {
    case 'line':
      return drawDatasetLine(...args);
    case 'bar':
    case 'area':
      return drawDatasetBars(...args);
  }
}

// TODO refactor for percent-based
export function drawDatasets(
  context, state, data, range, projection, coords, secondaryCoords, lineWidth, visibilities,
) {
  const { datasets } = data;

  if (data.isStacked) {
    datasets.forEach(({ key, color, type }, i) => {
      const options = {
        color,
        lineWidth,
      };

      drawDataset(type, context, coords[i], options);
    });
  } else {
    datasets.forEach((dataset, i) => {
      const { color, type, hasOwnYAxis } = dataset;
      const datasetCoords = hasOwnYAxis ? secondaryCoords : coords[i];
      const options = {
        color,
        opacity: visibilities[i],
        lineWidth,
      };

      drawDataset(type, context, datasetCoords, options);
    });
  }
}
