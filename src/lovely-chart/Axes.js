import {
  GUTTER,
  AXES_FONT,
  AXES_MAX_COLUMN_WIDTH,
  AXES_MAX_ROW_HEIGHT,
  X_AXIS_HEIGHT,
} from './constants';

export class Axes {
  constructor(context, dataInfo, plotSize) {
    this._context = context;
    this._dataInfo = dataInfo;
    this._plotSize = plotSize;

    // TODO Move out of here
    this._context.font = AXES_FONT;
  }

  draw(state) {
    // TODO perf maybe no need to redraw both
    this._drawXAxis(state);
    this._drawYAxis(state);
  }

  _drawXAxis(state) {
    const context = this._context;
    const { width: plotWidth, height: plotHeight } = this._plotSize;
    const topOffset = plotHeight - X_AXIS_HEIGHT / 2;

    const labelsCount = this._dataInfo.xLabels.length;
    const viewportPercent = state.end - state.begin;

    // TODO `viewport.xBeginIndex`, `viewport.xEndIndex`
    const viewportLabelsCount = labelsCount * viewportPercent;
    const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);
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
      const viewportProgress = (totalProgress - state.begin) / viewportPercent;
      const leftOffset = viewportProgress * plotWidth;
      const alpha = i % (visibleLabelsMultiplicity * 2) === 0 ? 1 : alphaFactor;

      // TODO perf May be faster to draw by `alphaFactor`, to not change canvas state every time
      context.fillStyle = `rgba(150, 150, 150, ${alpha})`;
      context.fillText(label.text, leftOffset, topOffset);
    });
  }

  _drawYAxis(state) {
    const context = this._context;

    const { width: plotWidth, height: plotHeight } = this._plotSize;
    const leftOffset = GUTTER;
    const availableHeight = plotHeight - X_AXIS_HEIGHT;

    const viewportLabelsCount = state.yMax - state.yMin;

    const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);
    const hiddenLabelsFactor = viewportLabelsCount / maxRows;
    const scaleLevel = Math.ceil(Math.sqrt(hiddenLabelsFactor / 2));
    const visibleLabelsMultiplicity = Math.pow(scaleLevel, 2) * 2;

    const rowHeight = availableHeight / viewportLabelsCount;

    const firstVisibleValue = Math.floor(state.yMin / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;
    const lastVisibleValue = Math.ceil(state.yMax / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;

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
      context.lineTo(plotWidth - GUTTER, topOffset);
    }

    context.stroke();
  }
}
