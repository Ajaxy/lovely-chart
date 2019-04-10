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

// TODO draw overlaying
function drawDatasetArea(context, coords, options) {
  context.beginPath();

  // TODO 1000 -> y0
  // context.moveTo(coords[coords.length - 1].x, 1000);
  // context.lineTo(0, 1000);

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
  context, state, data, range, projection, coords, secondaryCoords, lineWidth, visibilities,
) {
  const { datasets } = data;

  if (data.isStacked) {
    datasets.forEach(({ key, color, type }, i) => {
      const options = {
        color,
        lineWidth,
      };

      let datasetCoords = coords[i];

      if (type === 'area') {
        const [xMax, y0] = projection.toPixels(range.to, 0);
        const [xMin] = projection.toPixels(range.from, 0);
        const bottomLine = [{ x: xMax, y: y0 }, { x: xMin, y: y0 }];
        datasetCoords = datasetCoords.concat(coords[i - 1] ? coords[i - 1].reverse() : bottomLine);
      }

      drawDataset(type, context, datasetCoords, options);
    });
  } else {
    datasets.forEach((dataset, i) => {
      const { color, type, hasOwnYAxis } = dataset;
      let datasetCoords = hasOwnYAxis ? secondaryCoords : coords[i];
      const options = {
        color,
        opacity: visibilities[i],
        lineWidth,
      };

      drawDataset(type, context, datasetCoords, options);
    });
  }
}
