;(function() {
const LABELS_KEY = 'x';

const DEFAULT_RANGE = { begin: 0.333, end: 0.667 };
const GUTTER = 10;

const PLOT_HEIGHT = 320;
const PLOT_TOP_PADDING = 10;
const PLOT_LINE_WIDTH = 2;
const PLOT_PIE_RADIUS_FACTOR = 0.9 / 2;
const PLOT_PIE_SHIFT = 10;

const PIE_BALLOON_MIN_DISTANCE = 150;

const AXES_FONT = '300 10px Helvetica, Arial, sans-serif';
const AXES_MAX_COLUMN_WIDTH = 45;
const AXES_MAX_ROW_HEIGHT = 50;
const X_AXIS_HEIGHT = 30;
const X_AXIS_SHIFT_START = 1;
const Y_AXIS_ZERO_BASED_THRESHOLD = 0.1;

const MINIMAP_HEIGHT = 40;
const MINIMAP_MARGIN = 10;
const MINIMAP_LINE_WIDTH = 1;
const MINIMAP_EAR_WIDTH = 8;

const DPR = window.devicePixelRatio || 1;

const DAY_MS = 1000 * 60 * 60 * 24;
const HOUR_MS = 1000 * 60 * 60;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BALLOON_OFFSET = 20;

const TRANSITION_DEFAULT_DURATION = 300;

const ZOOM_TIMEOUT = TRANSITION_DEFAULT_DURATION;
const ZOOM_RANGE_DELTA = 0.1;
const ZOOM_RANGE_MIDDLE = .5;

const DEFAULT_PALETTE = 'type-1';

const ANIMATE_PROPS = [
  // Viewport X-axis
  'begin 200 fast', 'end 200 fast', 'labelFromIndex 200 fast floor', 'labelToIndex 200 fast ceil',

  // X-axis labels
  'xAxisScale 400',

  // Viewport Y-axis
  'yMinViewport', 'yMaxViewport', 'yMinViewportSecond', 'yMaxViewportSecond',

  // Minimap Y-axis
  'yMinMinimap', 'yMaxMinimap', 'yMinMinimapSecond', 'yMaxMinimapSecond',

  // Y-axis labels
  'yAxisScale', 'yAxisScaleSecond',
];


function createLovelyChart(params) {
  let _data;

  let _container;
  let _plot;
  let _context;
  let _plotSize;

  let _header;
  let _axes;
  let _stateManager;
  let _minimap;
  let _tooltip;

  let _state;
  let _isZoomed = false;
  let _stateBeforeZoom;

  _setupContainer();

  _fetchData().then((data) => {
    _data = analyzeData(data, params.datasetColors);
    _setupComponents();
  });

  function redraw() {
    _stateManager.update();
  }

  function _setupContainer() {
    _container = createElement();
    _container.className = `lovely-chart palette-${params.palette || DEFAULT_PALETTE}`;

    hideOnScroll(_container);

    const parentContainer = document.getElementById(params.containerId);
    parentContainer.appendChild(_container);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_container, {
      width: _container.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;
    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _fetchData() {
    const { data, dataSource } = params;

    if (data) {
      return Promise.resolve(data);
    } else if (dataSource) {
      return fetch(`${dataSource}/overview.json`)
        .then((response) => response.json());
    }
  }

  function _fetchDayData(date) {
    const { dataSource } = params;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

    return fetch(`${dataSource}/${path}.json`)
      .then((response) => response.json());
  }

  function _setupComponents() {
    _header = createHeader(_container, params.title, _onZoomOut);
    _setupPlotCanvas();
    _axes = createAxes(_context, _data, _plotSize, params.palette);
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _minimap = createMinimap(_container, _data, params.palette, _onRangeChange);
    _tooltip = createTooltip(_container, _data, _plotSize, params.palette, _zoomToDay, _onFocus);
    createTools(_container, _data, _onFilterChange);
  }

  function _onStateUpdate(state) {
    _state = state;

    const { datasets } = _data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const boundsAndParams = {
      begin: state.begin,
      end: state.end,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: _plotSize.width,
      availableHeight: _plotSize.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`]);
    const points = preparePoints(_data, datasets, range, visibilities, boundsAndParams);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (_data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = {
        yMin: state.yMinViewportSecond,
        yMax: state.yMaxViewportSecond,
      };
      secondaryPoints = preparePoints(_data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    _header.setCaption(`${_data.xLabels[state.labelFromIndex + 1].text} — ${_data.xLabels[state.labelToIndex - 1].text}`);
    clearCanvas(_plot, _context);
    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, params.palette,
    );
    if (!_data.isPie) {
      _axes.drawYAxis(state, projection, secondaryProjection);
      _axes.drawXAxis(state, projection);
    }
    _minimap.update(state);
    _tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  function _zoomToDay(labelIndex) {
    if (!params.dataSource || _isZoomed) {
      return;
    }

    _stateBeforeZoom = _state;
    const { value: date, text: dateText } = _data.xLabels[labelIndex];
    _header.zoom(dateText);
    const dataPromise = params.zoomToPie ? Promise.resolve(_generatePieData()) : _fetchDayData(new Date(date));
    dataPromise.then((data) => _replaceData(data, labelIndex));
  }

  function _onZoomOut() {
    if (!params.dataSource) {
      return;
    }

    const labelIndex = Math.round((_state.labelFromIndex + _state.labelToIndex) / 2);

    _fetchData().then((data) => _replaceData(data, labelIndex));
  }

  function _replaceData(data, labelIndex) {
    const labelWidth = 1 / _data.xLabels.length;
    const labelMiddle = labelIndex / (_data.xLabels.length - 1);

    _stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
    });

    setTimeout(() => {
      Object.assign(_data, analyzeData(data, params.datasetColors, _isZoomed || params.zoomToPie ? 'days' : 'hours'));

      _stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
      }, true);

      const daysCount = _isZoomed || params.zoomToPie ? _data.xLabels.length : _data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;

      _stateManager.update({
        range: _isZoomed ? {
          begin: _stateBeforeZoom.begin,
          end: _stateBeforeZoom.end,
        } : {
          begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
          end: ZOOM_RANGE_MIDDLE + halfDayWidth,
        },
      });

      _isZoomed = !_isZoomed;
    }, ZOOM_TIMEOUT);
  }

  function _generatePieData() {
    return _fetchData().then((sourceData) => {
      const pieData = Object.assign({}, sourceData);

      pieData.columns = sourceData.columns.map((c) => {
        const column = c.slice(_state.labelFromIndex + 1, _state.labelToIndex + 1);
        column.unshift(c[0]);
        return column;
      });

      Object.keys(pieData.types).forEach((key) => {
        if (key !== 'x') {
          pieData.types[key] = 'pie';
        }
      });

      pieData.pie = true;

      return pieData;
    });
  }

  function _onFocus(labelIndex) {
    if (_data.isBars || _data.isPie) {
      _stateManager.update({ focusOn: labelIndex });
    }
  }

  return { redraw };
}

window.LovelyChart = {
  create: createLovelyChart,
  setupColors,
};


function createStateManager(data, viewportSize, callback) {
  const _range = { begin: 0, end: 1 };
  const _filter = _buildDefaultFilter();
  const _transitionConfig = _buildTransitionConfig();
  const _transitions = createTransitionManager(_runCallback);
  const _runCallbackOnRaf = throttleWithRaf(_runCallback);

  let _state = {};

  function update({ range = {}, filter = {}, focusOn } = {}, noTransition) {
    Object.assign(_range, range);
    Object.assign(_filter, filter);

    const prevState = _state;
    _state = calculateState(data, viewportSize, _range, _filter, focusOn, prevState);

    if (!noTransition) {
      _transitionConfig.forEach(({ prop, duration, options }) => {
        const transition = _transitions.get(prop);
        const currentTarget = transition ? transition.to : prevState[prop];

        if (currentTarget !== undefined && currentTarget !== _state[prop]) {
          const current = transition
            ? (options.includes('fast') ? prevState[prop] : transition.current)
            : prevState[prop];

          if (transition) {
            _transitions.remove(prop);
          }

          _transitions.add(prop, current, _state[prop], duration, options);
        }
      });
    }

    if (!_transitions.isRunning()) {
      _runCallbackOnRaf();
    }
  }

  function _buildTransitionConfig() {
    const transitionConfig = [];
    const datasetVisibilities = data.datasets.map(({ key }) => `opacity#${key} 300`);
    const skinColors = buildSkinStateKeys().map((key) => `${key} 300`);

    mergeArrays([
      ANIMATE_PROPS,
      datasetVisibilities,
      skinColors,
    ]).forEach((transition) => {
      const [prop, duration, ...options] = transition.split(' ');
      transitionConfig.push({ prop, duration, options });
    });

    return transitionConfig;
  }

  function _buildDefaultFilter() {
    const filter = {};

    data.datasets.forEach(({ key }) => {
      filter[key] = true;
    });

    return filter;
  }

  function _runCallback() {
    callback(proxyMerge(_state, _transitions.getState()));
  }

  return { update };
}

function calculateState(data, viewportSize, range, filter, focusOn, prevState) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length - 1;

  const labelFromIndex = Math.max(0, Math.ceil(totalXWidth * begin));
  const labelToIndex = Math.min(Math.floor(totalXWidth * end), totalXWidth);

  const xAxisScale = calculateXAxisScale(viewportSize.width, labelFromIndex, labelToIndex);

  const yRanges = data.isStacked
    ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState)
    : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);

  const yAxisScale = calculateYAxisScale(viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport);
  const yAxisScaleSecond = data.hasSecondYAxis &&
    calculateYAxisScale(viewportSize.height, yRanges.yMinViewportSecond, yRanges.yMaxViewportSecond);

  const yStep = yScaleLevelToStep(yAxisScale);
  yRanges.yMinViewport -= yRanges.yMinViewport % yStep;

  if (yAxisScaleSecond) {
    const yStepSecond = yScaleLevelToStep(yAxisScaleSecond);
    yRanges.yMinViewportSecond -= yRanges.yMinViewportSecond % yStepSecond;
  }

  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });
  return Object.assign(
    {
      totalXWidth,
      xAxisScale,
      yAxisScale,
      yAxisScaleSecond,
      labelFromIndex: Math.max(0, labelFromIndex - 1),
      labelToIndex: Math.min(labelToIndex + 1, totalXWidth),
      filter,
      focusOn: focusOn !== undefined ? focusOn : prevState.focusOn,
    },
    yRanges,
    datasetsOpacity,
    buildSkinState(),
    range,
  );
}

function calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState) {
  const secondaryYAxisDataset = data.hasSecondYAxis && data.datasets.slice(-1)[0];
  const filteredDatasets = data.datasets.filter((d) => filter[d.key] && d !== secondaryYAxisDataset);

  const yRanges = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, filteredDatasets);

  if (secondaryYAxisDataset) {
    const group = filter[secondaryYAxisDataset.key] ? [secondaryYAxisDataset] : [];
    const {
      yMinViewport: yMinViewportSecond,
      yMaxViewport: yMaxViewportSecond,
      yMinMinimap: yMinMinimapSecond,
      yMaxMinimap: yMaxMinimapSecond,
    } = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, [secondaryYAxisDataset]);

    Object.assign(yRanges, {
      yMinViewportSecond,
      yMaxViewportSecond,
      yMinMinimapSecond,
      yMaxMinimapSecond,
    });
  }

  return yRanges;
}

function calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, datasets) {
  const { min: yMinMinimapReal = prevState.yMinMinimap, max: yMaxMinimap = prevState.yMaxMinimap }
    = getMaxMin(mergeArrays(datasets.map(({ yMax, yMin }) => [yMax, yMin])));
  const yMinMinimap = yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapReal : 0;

  let yMinViewport;
  let yMaxViewport;

  if (labelFromIndex === 0 && labelToIndex === data.xLabels.length - 1) {
    yMinViewport = yMinMinimap;
    yMaxViewport = yMaxMinimap;
  } else {
    const filteredValues = datasets.map(({ values }) => values);
    const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));
    const viewportMaxMin = getMaxMin(mergeArrays(viewportValues));
    const yMinViewportReal = viewportMaxMin.min || prevState.yMinViewport;
    yMaxViewport = viewportMaxMin.max || prevState.yMaxViewport;
    yMinViewport = yMinViewportReal / yMaxViewport > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportReal : 0;
  }

  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap,
  };
}

function calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState) {
  const filteredDatasets = data.datasets.filter((d) => filter[d.key]);
  const filteredValues = filteredDatasets.map(({ values }) => values);

  const sums = filteredValues.length ? sumArrays(filteredValues) : [];
  const { max: yMaxMinimap = prevState.yMaxMinimap } = getMaxMin(sums);
  const { max: yMaxViewport = prevState.yMaxViewport } = getMaxMin(sums.slice(labelFromIndex, labelToIndex + 1));

  return {
    yMinViewport: 0,
    yMaxViewport,
    yMinMinimap: 0,
    yMaxMinimap,
  };
}

function calculateXAxisScale(plotWidth, labelFromIndex, labelToIndex) {
  const viewportLabelsCount = labelToIndex - labelFromIndex;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);

  return xStepToScaleLevel(viewportLabelsCount / maxColumns);
}

function calculateYAxisScale(plotHeight, yMin, yMax) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);

  return yStepToScaleLevel(viewportLabelsCount / maxRows);
}


function transition(t) {
  // faster
  // return -t * (t - 2);
  // easeOut
  return 1 - Math.pow(1 - t, 1.675);
}

function createTransitionManager(onTick) {
  const _transitions = {};

  let _nextFrame = null;

  function add(prop, from, to, duration, options) {
    _transitions[prop] = {
      from,
      to,
      duration,
      options,
      current: from,
      startedAt: Date.now(),
      progress: 0,
    };

    if (!_nextFrame) {
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  function remove(prop) {
    delete _transitions[prop];

    if (!isRunning()) {
      cancelAnimationFrame(_nextFrame);
      _nextFrame = null;
    }
  }

  function get(prop) {
    return _transitions[prop];
  }
  function getState() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { current, from, to, progress } = _transitions[prop];
      state[prop] = current;
      state[`${prop}From`] = from;
      state[`${prop}To`] = to;
      state[`${prop}Progress`] = progress;
    });

    return state;
  }

  function isRunning() {
    return Boolean(Object.keys(_transitions).length);
  }

  function _tick() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = _transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * transition(progress);

      if (options.includes('ceil')) {
        current = Math.ceil(current);
      } else if (options.includes('floor')) {
        current = Math.floor(current);
      }

      _transitions[prop].current = current;
      _transitions[prop].progress = progress;
      state[prop] = current;

      if (progress === 1) {
        remove(prop);
      }
    });

    onTick(state);

    if (isRunning()) {
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  return { add, remove, get, getState, isRunning };
}


function createHeader(container, title, zoomOutCallback) {
  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;

  const setCaptionThrottled = throttle(setCaption, 800, false, true);

  _setupLayout();

  function setCaption(caption) {
    if (!_captionElement.innerHTML) {
      _captionElement.innerHTML = caption;
    } else if (_captionElement.innerHTML !== caption) {
      _captionElement = toggleText(_captionElement, caption, 'caption right');
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    _zoomOutElement = toggleText(_titleElement, 'Zoom Out', 'title zoom-out');
    addEventListener(_zoomOutElement, 'click', _onZoomOut);

    setCaption(caption);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header';

    _titleElement = createElement();
    _titleElement.className = 'title';
    _titleElement.innerHTML = title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'caption right';
    _element.appendChild(_captionElement);

    container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement = toggleText(_zoomOutElement, title, 'title', true);

    zoomOutCallback();
  }

  return {
    setCaption: setCaptionThrottled,
    zoom,
  };
}


function createAxes(context, data, plotSize, palette) {
  function drawXAxis(state, projection) {
    context.clearRect(0, plotSize.height - X_AXIS_HEIGHT + 1, plotSize.width, X_AXIS_HEIGHT + 1);

    const topOffset = plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    context.font = AXES_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      const shiftedI = i - X_AXIS_SHIFT_START;

      if (shiftedI % step !== 0) {
        continue;
      }

      const label = data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotSize.width);

      context.fillStyle = buildCssColorFromState(state, `palette-${palette}-x-axis-text`, opacity);
      context.fillText(label.text, xPx, topOffset);
    }
  }

  function drawYAxis(state, projection, secondaryProjection) {
    const {
      yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0,
      yMinViewport, yMinViewportFrom, yMinViewportTo,
      yMaxViewport, yMaxViewportFrom, yMaxViewportTo,
      yMinViewportSecond, yMinViewportSecondFrom, yMinViewportSecondTo,
      yMaxViewportSecond, yMaxViewportSecondFrom, yMaxViewportSecondTo,
    } = state;
    const color = secondaryProjection && data.datasets[0].colorName;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

    _drawYAxisScaled(
      state,
      projection,
      Math.round(yAxisScaleTo || yAxisScale),
      yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
      yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
      yAxisScaleFrom ? yAxisScaleProgress : 1,
      color,
    );

    if (yAxisScaleProgress > 0 && isYChanging) {
      _drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== undefined ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== undefined ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        color,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColor = data.datasets[data.datasets.length - 1].colorName;
      const isYChanging = yMinViewportSecondFrom !== undefined || yMaxViewportSecondFrom !== undefined;

      _drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== undefined ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== undefined ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColor,
        true,
      );

      if (yAxisScaleSecondProgress > 0 && isYChanging) {
        _drawYAxisScaled(
          state,
          secondaryProjection,
          Math.round(yAxisScaleSecondFrom),
          yMinViewportSecondFrom !== undefined ? yMinViewportSecondFrom : yMinViewportSecond,
          yMaxViewportSecondFrom !== undefined ? yMaxViewportSecondFrom : yMaxViewportSecond,
          1 - yAxisScaleSecondProgress,
          secondaryColor,
          true,
        );
      }
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, colorName = null, isSecondary = false) {
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

    context.font = AXES_FONT;
    context.textAlign = isSecondary ? 'right' : 'left';
    context.textBaseline = 'bottom';

    context.lineWidth = 1;

    context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);
      context.fillStyle = colorName
        ? buildCssColorFromState(state, `palette-${palette}-${colorName}-text`, textOpacity)
        : buildCssColorFromState(state, `palette-${palette}-y-axis-text`, textOpacity);

      if (!isSecondary) {
        context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      } else {
        context.fillText(humanize(value), plotSize.width - GUTTER, yPx - GUTTER / 2);
      }

      if (isSecondary) {
        context.strokeStyle = buildCssColorFromState(state, `palette-${palette}-${colorName}-text`, opacity);

        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(GUTTER, yPx);
        context.strokeStyle = buildCssColorFromState(state, 'grid-lines', opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    }

    context.stroke();
  }

  return { drawXAxis, drawYAxis };
}


function createMinimap(container, data, palette, rangeCallback) {
  let _element;
  let _canvas;
  let _context;
  let _canvasSize;
  let _ruler;
  let _slider;

  let _capturedOffset;
  let _range = {};
  let _state;

  const _updateRulerOnRaf = throttleWithRaf(_updateRuler);

  _setupLayout();
  _updateRange(DEFAULT_RANGE);

  function update(newState) {
    const { begin, end } = newState;
    if (!_capturedOffset) {
      _updateRange({ begin, end }, true);
    }

    if (!_isStateChanged(newState)) {
      return;
    }

    _state = newState;
    clearCanvas(_canvas, _context);
    _drawDatasets(newState);
  }

  function _setupLayout() {
    _element = createElement();

    _element.className = 'minimap';
    _element.style.height = `${MINIMAP_HEIGHT}px`;

    _setupCanvas();
    _setupRuler();

    container.appendChild(_element);

    _canvasSize = {
      width: _canvas.offsetWidth,
      height: _canvas.offsetHeight,
    };
  }

  function _getSize() {
    return {
      width: container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT,
    };
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, _getSize());

    _canvas = canvas;
    _context = context;
  }

  function _setupRuler() {
    _ruler = createElement();
    _ruler.className = 'ruler';
    _ruler.innerHTML =
      '<div class="mask"></div>' +
      '<div class="slider"><div class="handle"><span></span></div><div class="inner"></div><div class="handle"><span></span></div></div>' +
      '<div class="mask"></div>';

    _slider = _ruler.children[1];

    setupDrag(
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onSliderDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'grabbing',
      },
    );

    setupDrag(
      _slider.children[0],
      {
        onCapture: _onDragCapture,
        onDrag: _onLeftEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    setupDrag(
      _slider.children[2],
      {
        onCapture: _onDragCapture,
        onDrag: _onRightEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    _element.appendChild(_ruler);
  }

  function _isStateChanged(newState) {
    if (!_state) {
      return true;
    }

    const keys = data.datasets.map(({ key }) => `opacity#${key}`);
    keys.push('yMaxMinimap');

    return keys.some((key) => _state[key] !== newState[key]);
  }

  function _drawDatasets(state = {}) {
    const { datasets } = data;
    const range = {
      from: 0,
      to: state.totalXWidth,
    };
    const boundsAndParams = {
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: _canvasSize.width,
      availableHeight: _canvasSize.height,
      yPadding: 1,
    };
    const visibilities = datasets.map(({ key }) => getDatasetMinimapVisibility(state, key));
    const points = preparePoints(data, datasets, range, visibilities, boundsAndParams, true);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = { yMin: state.yMinMinimapSecond, yMax: state.yMaxMinimapSecond };
      secondaryPoints = preparePoints(data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    drawDatasets(
      _context, state, data,
      range, points, projection, secondaryPoints, secondaryProjection,
      MINIMAP_LINE_WIDTH, visibilities, palette, true,
    );
  }

  function _onDragCapture(e) {
    _capturedOffset = e.target.offsetLeft;
  }

  function _onDragRelease() {
    _capturedOffset = null;
  }

  function _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX1 = 0;
    const maxX1 = _canvasSize.width - _slider.offsetWidth;

    const newX1 = Math.max(minX1, Math.min(_capturedOffset + dragOffsetX - MINIMAP_EAR_WIDTH, maxX1));
    const newX2 = newX1 + _slider.offsetWidth;
    const begin = newX1 / _canvasSize.width;
    const end = newX2 / _canvasSize.width;

    _updateRange({ begin, end });
  }

  function _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX1 = 0;
    const maxX1 = _slider.offsetLeft + _slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const newX1 = Math.min(maxX1, Math.max(minX1, _capturedOffset + dragOffsetX));
    const begin = newX1 / _canvasSize.width;

    _updateRange({ begin });
  }

  function _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX2 = _slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = _canvasSize.width;

    const newX2 = Math.max(minX2, Math.min(_capturedOffset + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / _canvasSize.width;

    _updateRange({ end });
  }

  function _updateRange(range, isExternal) {
    const nextRange = Object.assign({}, _range, range);
    if (nextRange.begin === _range.begin && nextRange.end === _range.end) {
      return;
    }

    _range = nextRange;
    _updateRulerOnRaf();

    if (!isExternal) {
      rangeCallback(_range);
    }
  }

  function _updateRuler() {
    const { begin, end } = _range;

    _ruler.children[0].style.width = `${begin * 100}%`;
    _ruler.children[1].style.width = `${(end - begin) * 100}%`;
    _ruler.children[2].style.width = `${(1 - end) * 100}%`;
  }

  return { update };
}


function createTooltip(container, data, plotSize, palette, onZoom, onFocus) {
  let _state;
  let _points;
  let _projection;
  let _secondaryPoints;
  let _secondaryProjection;

  let _element;
  let _canvas;
  let _context;
  let _balloon;

  let _offsetX;
  let _offsetY;
  let _clickedOnLabel = null;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _selectLabel(true);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'tooltip';

    _setupCanvas();
    _setupBalloon();

    if ('ontouchstart' in window) {
      addEventListener(_element, 'touchmove', _onMouseMove);
      addEventListener(_element, 'touchstart', _onMouseMove);
      addEventListener(document, 'touchstart', _onDocumentMove);
    } else {
      addEventListener(_element, 'mousemove', _onMouseMove);
      addEventListener(_element, 'click', _onClick);
      addEventListener(document, 'mousemove', _onDocumentMove);
    }

    container.appendChild(_element);
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, plotSize);

    _canvas = canvas;
    _context = context;
  }

  function _setupBalloon() {
    _balloon = createElement();
    _balloon.className = 'balloon';
    _balloon.innerHTML = '<div class="title"></div><div class="legend"></div>';

    addEventListener(_balloon, 'click', _onBalloonClick);

    _element.appendChild(_balloon);
  }

  function _onMouseMove(e) {
    if (e.target === _balloon || _balloon.contains(e.target) || _clickedOnLabel) {
      return;
    }

    const pageOffset = _getPageOffset(_element);
    _offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - pageOffset.left;
    _offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - pageOffset.top;

    _selectLabelOnRaf();
  }

  function _onDocumentMove(e) {
    if (_offsetX !== null && e.target !== _element && !_element.contains(e.target)) {
      _clear();
    }
  }

  function _onClick(e) {
    const oldLabelIndex = _clickedOnLabel;

    _clickedOnLabel = null;
    _onMouseMove(e, true);

    const newLabelIndex = _getLabelIndex();
    if (newLabelIndex !== oldLabelIndex) {
      _clickedOnLabel = newLabelIndex;
    }
  }

  function _onBalloonClick() {
    _balloon.classList.add('loading');
    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    onZoom(labelIndex);
  }

  function _clear(isExternal) {
    _offsetX = null;
    _clickedOnLabel = null;
    clearCanvas(_canvas, _context);
    _hideBalloon();

    if (!isExternal && onFocus) {
      onFocus(null);
    }
  }

  function _getLabelIndex() {
    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    return labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex ? null : labelIndex;
  }

  function _selectLabel(isExternal) {
    if (!_offsetX || !_state) {
      return;
    }

    const labelIndex = _getLabelIndex();
    if (!labelIndex) {
      _clear(isExternal);
      return;
    }

    const pointerVector = getPointerVector();
    const shouldShowBalloon = data.isPie ? pointerVector.distance >= PIE_BALLOON_MIN_DISTANCE : true;

    if (!isExternal && onFocus) {
      if (data.isPie) {
        onFocus(pointerVector);
      } else {
        onFocus(labelIndex);
      }
    }

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const statistics = data.datasets
      .map(({ key, name, colorName, values, hasOwnYAxis }, i) => ({
        key,
        name,
        colorName,
        value: values[labelIndex],
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => _state.filter[key]);

    if (shouldShowBalloon) {
      _updateBalloon(statistics, xPx, labelIndex);
    } else {
      _hideBalloon();
    }

    if (data.isLines || data.isAreas) {
      clearCanvas(_canvas, _context);

      if (data.isLines) {
        _drawCircles(statistics, labelIndex);
      }

      _drawTail(xPx, plotSize.height - X_AXIS_HEIGHT, buildCssColorFromState(_state, 'grid-lines'));
    }
  }

  function _drawCircles(statistics, labelIndex) {
    statistics.forEach(({ value, colorName, hasOwnYAxis, originalIndex }) => {
      const pointIndex = labelIndex - _state.labelFromIndex;
      const point = hasOwnYAxis ? _secondaryPoints[pointIndex] : _points[originalIndex][pointIndex];

      if (!point) {
        return;
      }

      const [x, y] = hasOwnYAxis
        ? _secondaryProjection.toPixels(labelIndex, point.stackValue)
        : _projection.toPixels(labelIndex, point.stackValue);
      _drawCircle(
        [x, y],
        buildCssColorFromState(_state, `palette-${palette}-${colorName}-line`),
        buildCssColorFromState(_state, 'background'),
      );
    });
  }

  function _drawCircle([xPx, yPx], strokeColor, fillColor) {
    _context.strokeStyle = strokeColor;
    _context.fillStyle = fillColor;
    _context.lineWidth = 2;

    _context.beginPath();
    _context.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    _context.fill();
    _context.stroke();
  }

  function _drawTail(xPx, height, color) {
    _context.strokeStyle = color;
    _context.lineWidth = 1;

    _context.beginPath();
    _context.moveTo(xPx, 0);
    _context.lineTo(xPx, height);
    _context.stroke();
  }

  function _updateBalloon(statistics, xPx, labelIndex) {
    const label = data.xLabels[labelIndex];
    const date = new Date(label.value);
    _balloon.children[0].innerHTML = `${WEEK_DAYS[date.getDay()]}, ${label.text}`;
    _balloon.children[1].innerHTML = statistics.map(({ name, colorName, value }) => (
      '<div class="dataset transition-container">' +
      `  <span>${name}</span>` +
      `  <span class="value transition top right ${colorName}">${formatInteger(value)}</span>` +
      '</div>'
    )).join('');

    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const left = labelIndex < meanLabel
      ? _offsetX + BALLOON_OFFSET
      : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);

    _balloon.style.transform = `translateX(${left}px) translateZ(0)`;
    _balloon.classList.add('shown');
  }

  function _hideBalloon() {
    _balloon.classList.remove('shown');
  }

  function getPointerVector() {
    const { width, height } = _element.getBoundingClientRect();

    const center = [width / 2, height / 2];
    const angle = Math.atan2(_offsetY - center[1], _offsetX - center[0]);
    const distance = Math.sqrt((_offsetX - center[0]) ** 2 + (_offsetY - center[1]) ** 2);

    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance,
    };
  }

  function _getPageOffset(el) {
    return el.getBoundingClientRect();
  }

  return { update };
}



function createTools(container, data, filterCallback) {
  if (data.datasets.length < 2) {
    return;
  }

  let _element;

  _setupLayout();
  _updateFilter();

  function _setupLayout() {
    _element = createElement();
    _element.className = 'tools';

    data.datasets.forEach(({ key, name, colorName }) => {
      const control = createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = `checkbox ${colorName} checked`;
      control.innerHTML = `<span class="circle"></span><span class="label">${name}</span>`;
      control.addEventListener('click', _updateFilter);
      _element.appendChild(control);
    });

    container.appendChild(_element);
  }

  function _updateFilter(e) {
    if (e) {
      e.preventDefault();
      e.currentTarget.classList.toggle('checked');
    }

    const filter = {};

    Array.from(_element.getElementsByTagName('a')).forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('checked');
    });

    filterCallback(filter);
  }
}


function prepareDatasets(chartData, datasetColors = {}) {
  const { columns, names, types, y_scaled: hasSecondYAxis } = chartData;

  let labels = [];
  const datasets = [];

  columns.forEach((values, i) => {
    const key = values.shift();

    if (key === LABELS_KEY) {
      labels = values;
      ensureSorted(labels);
      return;
    }

    datasets.push({
      key,
      colorName: datasetColors[key],
      name: names[key],
      type: types[key],
      values,
      hasOwnYAxis: hasSecondYAxis && i === columns.length - 1,
    });
  });

  datasets.forEach((dataset) => {
    dataset.labels = labels;
  });

  return { datasets };
}

function analyzeData(data, datasetColors, type) {
  const { datasets } = prepareDatasets(data, datasetColors);

  let totalYMin = Infinity;
  let totalYMax = -Infinity;

  datasets.forEach((dataset) => {
    const { min: yMin, max: yMax } = getMaxMin(dataset.values);

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }

    dataset.yMin = yMin;
    dataset.yMax = yMax;
  });

  const firstlLabels = datasets.map((dataset) => dataset.labels[0]);
  const lastLabels = datasets.map((dataset) => dataset.labels[dataset.labels.length - 1]);
  const firstDate = Math.min.apply(null, firstlLabels);
  const lastDate = Math.max.apply(null, lastLabels);
  const xLabels = type === 'hours' ? buildTimeLabels(firstDate, lastDate) : buildDayLabels(firstDate, lastDate);

  return {
    datasets,
    yMin: totalYMin,
    yMax: totalYMax,
    xLabels,
    hasSecondYAxis: data.y_scaled,
    isStacked: data.stacked,
    isPercentage: data.percentage,
    isPie: data.pie,
    isLines: datasets.some(({ type }) => type === 'line'),
    isBars: datasets.some(({ type }) => type === 'bar'),
    isAreas: datasets.some(({ type }) => type === 'area'),
  };
}


// const dataCache = {};

function preparePoints(data, datasets, range, visibilities, bounds, pieToArea) {
  let values = datasets.map(({ values }) => (
    values.slice(range.from, range.to + 1)
  ));

  if (data.isPie && !pieToArea) {
    values = prepareSumsByY(values);
  }

  const points = values.map((datasetValues, i) => (
    datasetValues.map((value, j) => {
      let visibleValue = value;

      if (data.isStacked) {
        visibleValue *= visibilities[i];
      }

      return {
        labelIndex: range.from + j,
        value,
        visibleValue,
        stackOffset: 0,
        stackValue: visibleValue,
      };
    })
  ));

  if (data.isPercentage) {
    preparePercentage(points, bounds);
  }
  if (data.isStacked) {
    prepareStacked(points);
  }

  return points;
}

function getSumsByX(points) {
  return sumArrays(points.map((datasetPoints) => (
    datasetPoints.map(({ visibleValue }) => visibleValue)
  )));
}
function preparePercentage(points, bounds) {
  const sumsByX = getSumsByX(points);

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      point.percent = point.visibleValue / sumsByX[j];
      point.visibleValue = point.percent * bounds.yMax;
    });
  });
}

function prepareStacked(points) {
  const accum = [];

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      if (accum[j] === undefined) {
        accum[j] = 0;
      }

      point.stackOffset = accum[j];
      accum[j] += point.visibleValue;
      point.stackValue = accum[j];
    });
  });
}

function prepareSumsByY(values) {
  return values.map((datasetValues) => (
    [datasetValues.reduce((sum, value) => sum + value, 0)]
  ));
}


function createProjection(params) {
  const {
    begin,
    end,
    totalXWidth,
    yMin,
    yMax,
    availableWidth,
    availableHeight,
    xPadding = 0,
    yPadding = 0,
  } = params;

  let effectiveWidth = availableWidth;
  if (begin === 0) {
    effectiveWidth -= xPadding;
  }
  if (end === 1) {
    effectiveWidth -= xPadding;
  }
  const xFactor = effectiveWidth / ((end - begin) * totalXWidth);
  let xOffsetPx = (begin * totalXWidth) * xFactor;
  if (begin === 0) {
    xOffsetPx -= xPadding;
  }

  const effectiveHeight = availableHeight - yPadding;
  const yFactor = effectiveHeight / (yMax - yMin);
  const yOffsetPx = yMin * yFactor;

  function toPixels(labelIndex, value) {
    return [
      labelIndex * xFactor - xOffsetPx,
      availableHeight - (value * yFactor - yOffsetPx),
    ];
  }

  function findClosesLabelIndex(xPx) {
    return Math.round((xPx + xOffsetPx) / xFactor);
  }

  function copy(overrides, cons) {
    return createProjection(proxyMerge(params, overrides), cons);
  }

  function getCenter() {
    return [
      availableWidth / 2,
      availableHeight - effectiveHeight / 2,
    ];
  }

  function getSize() {
    return [availableWidth, effectiveHeight];
  }

  function getParams() {
    return params;
  }

  return {
    toPixels,
    findClosesLabelIndex,
    copy,
    getCenter,
    getSize,
    getParams,
  };
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
function drawDatasetBars(context, points, projection, options) {
  const { yMin } = projection.getParams();
  let activePoint;

  context.save();

  context.fillStyle = options.color;

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue, stackOffset = 0 } = points[j];

    // if (labelIndex === options.focusOn) {
    //   activePoint = points[j];
    //   continue;
    // }

    const [, yFrom] = projection.toPixels(labelIndex, Math.max(stackOffset, yMin));
    const [x, yTo] = projection.toPixels(labelIndex, stackValue);
    const rectX = x - options.lineWidth / 2;
    const rectY = yTo;
    const rectW = options.lineWidth + 0.5;
    const rectH = yFrom - yTo;

    context.fillRect(rectX, rectY, rectW, rectH);
  }

  // if (activePoint) {
  //   drawBarsActivePoint(activePoint, context, projection, options);
  // }

  context.restore();
}

function drawDatasetBarsWithLines(context, points, projection, options) {
  const { yMin } = projection.getParams();

  context.beginPath();

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue, stackOffset = 0 } = points[j];
    const [, yFrom] = projection.toPixels(labelIndex, Math.max(stackOffset, yMin));
    const [x, yTo] = projection.toPixels(labelIndex, stackValue);

    context.moveTo(x, yFrom);
    context.lineTo(x, yFrom - yTo >= 1 ? yTo : yTo - 1);
  }

  const [x0] = projection.toPixels(0, 0);
  const [x1] = projection.toPixels(1, 0);
  const lineWidth = x1 - x0;

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();
  context.restore();
}

function drawBarsActivePoint(activePoint, context, projection, options) {
  const { yMin } = projection.getParams();
  const { labelIndex, stackValue, stackOffset = 0 } = activePoint;
  const [, yFrom] = projection.toPixels(labelIndex, Math.max(stackOffset, yMin));
  const [x, yTo] = projection.toPixels(labelIndex, stackValue);

  const rectX = x - options.lineWidth / 2;
  const rectY = yTo;
  const rectW = options.lineWidth;
  const rectH = yFrom - yTo;

  context.globalAlpha = options.opacity;
  context.fillRect(rectX, rectY, rectW, rectH);
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

function drawDatasets(
  context, state, data,
  range, points, projection, secondaryPoints, secondaryProjection,
  lineWidth, visibilities, palette, pieToArea,
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
      color: buildCssColorFromState(state, 'mask'),
      lineWidth: x1 - x0
    });
  }
}


let colors;
let colorKeys;

const CHANNEL_KEYS = ['R', 'G', 'B', 'A'];

function setupColors(_colors) {
  colors = _colors;
  colorKeys = Object.keys(colors['skin-day']);
}

function getSkin() {
  return document.body.classList.contains('skin-night') ? 'skin-night' : 'skin-day';
}

function buildSkinState() {
  const state = {};
  const skin = colors[getSkin()];
  colorKeys.forEach((key) => {
    CHANNEL_KEYS.forEach((channel, i) => {
      const channels = hexToChannels(skin[key]);
      state[`colorChannels#${key}#${channel}`] = channels[i];
    });
  });

  return state;
}

function buildSkinStateKeys() {
  return mergeArrays(colorKeys.map((key) => (
    CHANNEL_KEYS.map((channel) => `colorChannels#${key}#${channel}`)
  )));
}

function buildCssColorFromState(state, key, opacity = 1) {
  const rgba = CHANNEL_KEYS.map((channel) => {
    const value = state[`colorChannels#${key}#${channel}`];

    return channel === 'A' ? value : Math.round(value);
  });

  return buildCssColor(rgba, opacity);
}

function hexToChannels(hexWithAlpha) {
  const [hex, alpha] = hexWithAlpha.replace('#', '').split('/');

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    alpha ? parseFloat(alpha) : 1,
  ];
}

function buildCssColor([r, g, b, a = 1], opacity = 1) {
  return `rgba(${r}, ${g}, ${b}, ${a * opacity})`;
}


function setupCanvas(container, { width, height }) {
  const canvas = createElement('canvas');

  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;

  const context = canvas.getContext('2d');
  context.scale(DPR, DPR);

  container.appendChild(canvas);

  return { canvas, context };
}

function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

// https://jsperf.com/finding-maximum-element-in-an-array
function getMaxMin(array) {
  const length = array.length;
  let max = array[0];
  let min = array[0];

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (value > max) {
      max = value;
    } else if (value < min) {
      min = value;
    }
  }

  return { max, min };
}

function ensureSorted(array) {
  for (let i = 0, l = array.length; i < l; i++) {
    if (array[i] !== undefined && array[i + 1] !== undefined && array[i] >= array[i + 1]) {
      throw new Error('Array is not sorted');
    }
  }
}

// https://jsperf.com/multi-array-concat/24
function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

function sumArrays(arrays) {
  const sums = [];
  const n = arrays.length;

  for (let i = 0, l = arrays[0].length; i < l; i++) {
    sums[i] = 0;

    for (let j = 0; j < n; j++) {
      sums[i] += arrays[j][i];
    }
  }

  return sums;
}

function proxyMerge(obj1, obj2) {
  return new Proxy({}, {
    get: (obj, prop) => {
      return obj2[prop] !== undefined ? obj2[prop] : obj1[prop];
    },
  });
}

function throttle(fn, ms, shouldRunFirst = true, shouldRunLast = true) {
  let waiting = false;
  let args;

  return function (..._args) {
    args = _args;

    if (!waiting) {
      if (shouldRunFirst) {
        fn(...args);
      }

      waiting = true;

      setTimeout(() => {
        waiting = false;

        if (shouldRunLast) {
          fn(...args);
        }
      }, ms);
    }
  };
}

function throttleWithRaf(fn) {
  let waiting = false;
  let args;

  return function (..._args) {
    args = _args;

    if (!waiting) {
      waiting = true;

      requestAnimationFrame(() => {
        waiting = false;
        fn(...args);
      });
    }
  };
}

function debounce(fn, ms, shouldRunFirst = true, shouldRunLast = true) {
  let waitingTimeout = null;

  return function () {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    } else if (shouldRunFirst) {
      fn();
    }

    waitingTimeout = setTimeout(() => {
      if (shouldRunLast) {
        fn();
      }

      waitingTimeout = null;
    }, ms);
  };
}


function buildDayLabels(timestampFrom, timestampTo) {
  timestampFrom = roundToDay(timestampFrom);
  timestampTo = roundToDay(timestampTo);

  const labels = [];

  for (let timestamp = timestampFrom; timestamp <= timestampTo; timestamp += DAY_MS) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];

    labels.push({
      value: timestamp,
      text: `${month} ${day}`,
    });
  }

  return labels;
}

function buildTimeLabels(timestampFrom, timestampTo) {
  timestampFrom = roundToHour(timestampFrom);
  timestampTo = roundToHour(timestampTo);

  const labels = [];

  for (let timestamp = timestampFrom; timestamp <= timestampTo; timestamp += HOUR_MS) {
    const date = new Date(timestamp);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    labels.push({
      value: timestamp,
      text: `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
    });
  }

  return labels;
}

function roundToDay(timestamp) {
  return timestamp - (timestamp % DAY_MS);
}

function roundToHour(timestamp) {
  return timestamp - (timestamp % HOUR_MS);
}

function humanize(value, decimals = 1) {
  if (value >= 1e6) {
    return keepThreeDigits(value / 1e6, decimals) + 'M';
  } else if (value >= 1e3) {
    return keepThreeDigits(value / 1e3, decimals) + 'K';
  }

  return value;
}
function keepThreeDigits(value, decimals) {
  return value
    .toFixed(decimals)
    .replace(/(\d{3,})\.\d+/, '$1')
    .replace(/\.0+$/, '');
}

function formatInteger(n) {
  return String(n).replace(/\d(?=(\d{3})+$)/g, '$& ');
}


function xScaleLevelToStep(scaleLevel) {
  return Math.pow(2, scaleLevel);
}

function xStepToScaleLevel(step) {
  return Math.ceil(Math.log2(step || 1));
}

const SCALE_LEVELS = [
  1, 2, 8, 18, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
  250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000
];

function yScaleLevelToStep(scaleLevel) {
  return SCALE_LEVELS[scaleLevel] || SCALE_LEVELS[SCALE_LEVELS.length - 1];
}

function yStepToScaleLevel(neededStep) {
  return SCALE_LEVELS.findIndex((step) => step >= neededStep) || SCALE_LEVELS.length - 1;
}

function applyYEdgeOpacity(opacity, xPx, plotWidth) {
  const edgeOffset = Math.min(xPx + GUTTER, plotWidth - xPx);
  if (edgeOffset <= GUTTER * 4) {
    opacity = Math.min(1, opacity, edgeOffset / (GUTTER * 4));
  }
  return opacity;
}

function applyXEdgeOpacity(opacity, yPx) {
  return (yPx - GUTTER <= GUTTER * 2)
    ? Math.min(1, opacity, (yPx - GUTTER) / (GUTTER * 2))
    : opacity;
}

function getPieTextSize(percent, radius) {
  return (radius + percent * 150) / 8;
}

function getPieTextShift(percent, radius, shift) {
  return percent >= 0.99 ? 0 : Math.min(1 - Math.log(percent * 30) / 5, 4 / 5) * radius;
}

function getDatasetMinimapVisibility(state, key) {
  return Math.max(0, Math.min(state[`opacity#${key}`] * 2 - 1, 1));
}


const hideOnScroll = (() => {
  const charts = [];
  const showAllDebounced = debounce(showAll, 500, true, false);
  const hideScrolledDebounced = debounce(hideScrolled, 500, false, true);

  function setup(chart) {
    charts.push(chart);

    if (charts.length === 1) {
      window.onscroll = () => {
        showAllDebounced();
        hideScrolledDebounced();
      };
    }
  }

  function showAll() {
    charts.forEach((chart) => {
      chart.classList.remove('hidden');
    });
  }

  function hideScrolled() {
    charts.forEach((chart) => {
      const { top, bottom } = chart.getBoundingClientRect();
      const shouldHide = bottom < 0 || top > window.innerHeight;
      chart.classList.toggle('hidden', shouldHide);
    });
  }

  return setup;
})();
const createElement = (tagName = 'div') => {
  return document.createElement(tagName);
};

function addEventListener(element, event, cb) {
  element.addEventListener(event, cb);
}

function removeEventListener(element, event, cb) {
  element.removeEventListener(event, cb);
}


function setupDrag(element, options) {
  let captureEvent = null;

  function onCapture(e) {
    if (e.target !== element) {
      return;
    }

    e.preventDefault();
    captureEvent = e;

    if (e.type === 'mousedown') {
      addEventListener(document, 'mousemove', onMove);
      addEventListener(document, 'mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      addEventListener(document, 'touchmove', onMove);
      addEventListener(document, 'touchend', onRelease);
      addEventListener(document, 'touchcancel', onRelease);

      // https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
      // Android does not have this value, and iOS has it but as read-only.
      if (e.pageX === undefined) {
        e.pageX = e.touches[0].pageX;
      }
    }

    if (options.draggingCursor) {
      document.body.classList.add(`cursor-${options.draggingCursor}`);
    }

    options.onCapture && options.onCapture(e);
  }

  function onRelease(e) {
    if (captureEvent) {
      if (options.draggingCursor) {
        document.body.classList.remove(`cursor-${options.draggingCursor}`);
      }

      removeEventListener(document, 'mouseup', onRelease);
      removeEventListener(document, 'mousemove', onMove);
      removeEventListener(document, 'touchcancel', onRelease);
      removeEventListener(document, 'touchend', onRelease);
      removeEventListener(document, 'touchmove', onMove);

      captureEvent = null;

      options.onRelease && options.onRelease(e);
    }
  }

  function onMove(e) {
    if (captureEvent) {
      if (e.type === 'touchmove' && e.pageX === undefined) {
        e.pageX = e.touches[0].pageX;
      }

      options.onDrag(e, captureEvent, {
        dragOffsetX: e.pageX - captureEvent.pageX,
      });
    }
  }

  addEventListener(element, 'mousedown', onCapture);
  addEventListener(element, 'touchstart', onCapture);
}


function toggleIn(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.remove('hidden');
}

function toggleOut(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.add('hidden');
}

function toggleText(element, newText, className, inverse = false) {
  const container = element.parentNode;
  container.classList.add('transition-container');

  const newElement = createElement();
  newElement.className = `${className} transition ${inverse ? 'top' : 'bottom'} hidden`;
  newElement.innerHTML = newText;

  const oldElements = container.querySelectorAll(`.${className.split(' ').join('.')}.hidden`);
  oldElements.forEach(e => e.remove());

  element.classList.add('transition');
  element.classList.remove('bottom', 'top');
  element.classList.add(inverse ? 'bottom' : 'top');
  container.insertBefore(newElement, element.nextSibling);

  toggleIn(newElement);
  toggleOut(element);

  return newElement;
}

})();