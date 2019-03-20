const FONT = '10px Arial';
const MAX_COLUMN_WIDTH = 50;
const X_SCALE_HEIGHT = 30;
const GUTTER = 10;

const MAX_ROW_HEIGHT = 50;

class CanvasScales {
  constructor(canvas, context) {
    this._canvas = canvas;
    this._context = context;

    // TODO Move out of here
    this._context.font = FONT;
  }

  setData(data, dataInfo) {
    this._data = data;
    this._dataInfo = dataInfo;
  }

  setViewport(viewport) {
    this._viewport = viewport;
  }

  draw() {
    // TODO No need to redraw both
    this._drawXScale();
    this._drawYScale();
  }

  _drawXScale() {
    const context = this._context;
    const { width: canvasWidth, height: canvasHeight } = this._canvas.getBoundingClientRect();
    const topOffset = canvasHeight - X_SCALE_HEIGHT / 2;

    const labelsCount = this._dataInfo.xLabels.length;
    const viewportPercent = this._viewport.end - this._viewport.begin;

    // TODO `viewport.xBeginIndex`, `viewport.xEndIndex`
    const viewportLabelsCount = labelsCount * viewportPercent;
    const maxColumns = Math.floor(canvasWidth / MAX_COLUMN_WIDTH);
    const hiddenLabelsFactor = viewportLabelsCount / maxColumns;
    const scaleLevel = Math.ceil(Math.log2(hiddenLabelsFactor));
    const visibleLabelsMultiplicity = Math.pow(2, scaleLevel);

    const prevLevelExcess = (hiddenLabelsFactor / (visibleLabelsMultiplicity / 2) - 1);
    const alphaFactor = prevLevelExcess ? 1 - prevLevelExcess : 0;

    context.textAlign = 'center';
    context.textBaseline = 'middle';

    this._dataInfo.xLabels.forEach((label, i) => {
      // TODO Use `viewport.xFrom` and `label.value`
      if (i % visibleLabelsMultiplicity !== 0) {
        return;
      }

      const totalProgress = i / labelsCount;
      const viewportProgress = (totalProgress - this._viewport.begin) / viewportPercent;
      const leftOffset = viewportProgress * canvasWidth;
      const alpha = i % (visibleLabelsMultiplicity * 2) === 0 ? 1 : alphaFactor;

      // TODO May be faster to draw by `alphaFactor`, to not change canvas state every time
      context.fillStyle = `rgba(150, 150, 150, ${alpha})`;
      context.fillText(label.text, leftOffset, topOffset);
    });
  }

  _drawYScale() {
    const context = this._context;
    const viewport = this._viewport;

    const { width: canvasWidth, height: canvasHeight } = this._canvas.getBoundingClientRect();
    const leftOffset = GUTTER;
    const availableHeight = canvasHeight - X_SCALE_HEIGHT;

    const viewportLabelsCount = viewport.yMax - viewport.yMin;

    const maxRows = Math.floor(availableHeight / MAX_ROW_HEIGHT);
    const hiddenLabelsFactor = viewportLabelsCount / maxRows;
    const scaleLevel = Math.ceil(Math.sqrt(hiddenLabelsFactor / 2));
    const visibleLabelsMultiplicity = Math.pow(scaleLevel, 2) * 2;

    const rowHeight = availableHeight / viewportLabelsCount;

    const firstVisibleValue = Math.floor(viewport.yMin / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;
    const lastVisibleValue = Math.ceil(viewport.yMax / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;

    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = `rgba(150, 150, 150, 1)`;
    context.strokeStyle = '#eeeeee';
    context.lineWidth = 1;

    context.beginPath();

    for (let i = firstVisibleValue; i <= lastVisibleValue; i += visibleLabelsMultiplicity) {
      const viewportIndex = i - firstVisibleValue;
      const topOffset = availableHeight - viewportIndex * rowHeight;

      // TODO We do not user label value/text here
      context.fillText(i, leftOffset, topOffset - GUTTER);

      context.moveTo(GUTTER, topOffset);
      context.lineTo(canvasWidth - GUTTER, topOffset);
    }

    context.stroke();
  }
}

export default CanvasScales;
