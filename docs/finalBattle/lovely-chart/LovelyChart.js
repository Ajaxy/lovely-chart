;(function() {

window.Chart = {
  render: createLovelyChart,
};

const DPR = window.devicePixelRatio || 1;

const LABELS_KEY = 'x';

const DEFAULT_RANGE = { begin: 0.8, end: 1 };
const TRANSITION_DEFAULT_DURATION = 300;
const DEFAULT_SKIN = 'skin-day';
const LONG_PRESS_TIMEOUT = 500;

const GUTTER = 10;
const PLOT_HEIGHT = 320;
const PLOT_TOP_PADDING = 10;
const PLOT_LINE_WIDTH = 2;
const PLOT_PIE_RADIUS_FACTOR = 0.9 / 2;
const PLOT_PIE_SHIFT = 10;
const PLOT_BARS_WIDTH_SHIFT = 0.5;

const BALLOON_OFFSET = 20;

const AXES_FONT = '300 10px Helvetica, Arial, sans-serif';
const AXES_MAX_COLUMN_WIDTH = 45;
const AXES_MAX_ROW_HEIGHT = 40;
const X_AXIS_HEIGHT = 30;
const X_AXIS_SHIFT_START = 1;
const Y_AXIS_ZERO_BASED_THRESHOLD = 0.1;

const MINIMAP_HEIGHT = 40;
const MINIMAP_MARGIN = 10;
const MINIMAP_LINE_WIDTH = 1;
const MINIMAP_EAR_WIDTH = 8;

const ZOOM_TIMEOUT = TRANSITION_DEFAULT_DURATION;
const ZOOM_RANGE_DELTA = 0.1;
const ZOOM_RANGE_MIDDLE = .5;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MILISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

const SPEED_TEST_INTERVAL = 200;
const SPEED_TEST_FAST_FPS = 8;

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


function createLovelyChart(container, data) {
  let _stateManager;

  let _element;
  let _plot;
  let _context;
  let _plotSize;

  let _header;
  let _axes;
  let _minimap;
  let _tooltip;
  let _tools;
  let _zoomer;

  let _state;

  const _colors = createColors(data.colors);
  const _data = analyzeData(data);

  const _redrawDebounced = debounce(_redraw, 500, false, true);

  _setupComponents();
  _setupGlobalListeners();

  function _setupComponents() {
    _setupContainer();
    _header = createHeader(_element, data.title, _onZoomOut);
    _setupPlotCanvas();
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _axes = createAxes(_context, _data, _plotSize, _colors);
    _minimap = createMinimap(_element, _data, _colors, _onRangeChange);
    _tooltip = createTooltip(_element, _data, _plotSize, _colors, _onZoomIn, _onFocus);
    _tools = createTools(_element, _data, _onFilterChange);
    _zoomer = _data.isZoomable && createZoomer(_data, data, _colors, _stateManager, _header, _minimap, _tooltip, _tools);
  }

  function _setupContainer() {
    _element = createElement();
    _element.className = `lovely-chart--container`;

    hideOnScroll(_element);

    container.appendChild(_element);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_element, {
      width: _element.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;

    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
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

    const headerCaption =
      (
        !_zoomer ||
        !_zoomer.isZoomed() ||
        isDataRange(_data.xLabels[state.labelFromIndex + 1], _data.xLabels[state.labelToIndex - 1])
      )
        ? (
          `${getLabelDate(_data.xLabels[state.labelFromIndex + 1])}` +
          ' - ' +
          `${getLabelDate(_data.xLabels[state.labelToIndex - 1])}`
        )
        : getFullLabelDate(_data.xLabels[state.labelFromIndex]);
    _header.setCaption(headerCaption);

    clearCanvas(_plot, _context);
    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, _colors,
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

  function _onFocus(focusOn) {
    if (_data.isBars || _data.isPie) {
      _stateManager.update({ focusOn });
    }
  }

  function _onZoomIn(labelIndex) {
    _zoomer.zoomIn(_state, labelIndex);
  }

  function _onZoomOut() {
    _zoomer.zoomOut(_state);
  }

  function _setupGlobalListeners() {
    document.documentElement.addEventListener('darkmode', () => {
      _stateManager.update();
    });

    window.addEventListener('resize', () => {
      _redrawDebounced();
    });

    window.addEventListener('orientationchange', () => {
      _redrawDebounced();
    });
  }

  function _redraw() {
    _element.remove();
    _setupComponents();
  }
}


function createStateManager(data, viewportSize, callback) {
  const _range = { begin: 0, end: 1 };
  const _filter = _buildDefaultFilter();
  const _transitionConfig = _buildTransitionConfig();
  const _transitions = createTransitionManager(_runCallback);
  const _runCallbackOnRaf = throttleWithRaf(_runCallback);

  let _state = {};

  function update({ range = {}, filter = {}, focusOn, minimapDelta } = {}, noTransition) {
    Object.assign(_range, range);
    Object.assign(_filter, filter);

    const prevState = _state;
    _state = calculateState(data, viewportSize, _range, _filter, focusOn, minimapDelta, prevState);

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

  function hasAnimations() {
    return _transitions.isFast();
  }

  function _buildTransitionConfig() {
    const transitionConfig = [];
    const datasetVisibilities = data.datasets.map(({ key }) => `opacity#${key} 300`);

    mergeArrays([
      ANIMATE_PROPS,
      datasetVisibilities,
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
    const state = _transitions.isFast() ? proxyMerge(_state, _transitions.getState()) : _state;
    callback(state);
  }

  return { update, hasAnimations };
}

function calculateState(data, viewportSize, range, filter, focusOn, minimapDelta, prevState) {
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
      filter: Object.assign({}, filter),
      focusOn: focusOn !== undefined ? focusOn : prevState.focusOn,
      minimapDelta: minimapDelta !== undefined ? minimapDelta : prevState.minimapDelta,
    },
    yRanges,
    datasetsOpacity,
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
    const yMinViewportReal = viewportMaxMin.min !== undefined ? viewportMaxMin.min : prevState.yMinViewport;
    yMaxViewport = viewportMaxMin.max !== undefined ? viewportMaxMin.max : prevState.yMaxViewport;
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

  let _testStartedAt = null;
  let _fps = null;
  let _testingFps = null;
  let _slowDetectedAt = null;
  let _startedAsSlow = null;

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
      _resetSpeedTest();
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

  function isFast(forceCheck) {
    if (!forceCheck && (_startedAsSlow || _slowDetectedAt)) {
      return false;
    }

    return _fps === null || _fps >= SPEED_TEST_FAST_FPS;
  }

  function _tick() {
    _speedTest();

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

  function _resetSpeedTest() {
    _testStartedAt = null;
    _testingFps = null;
    if (_slowDetectedAt && Date.now() - _slowDetectedAt > 5000) {
      _slowDetectedAt = null;
    }
    _startedAsSlow = Boolean(_slowDetectedAt) || !isFast(true);
  }

  function _speedTest() {
    if (!_testStartedAt || (Date.now() - _testStartedAt) >= SPEED_TEST_INTERVAL) {
      if (_testingFps) {
        _fps = _testingFps;
        if (!_slowDetectedAt && !isFast(true)) {
          _slowDetectedAt = Date.now();
        }
      }
      _testStartedAt = Date.now();
      _testingFps = 0;
    } else {
      _testingFps++;
    }
  }

  return { add, remove, get, getState, isRunning, isFast };
}


function createHeader(container, title, zoomOutCallback) {
  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;
  let _isFirstUpdate = true;

  const setCaptionThrottled = throttle(setCaption, 400, false, true);

  _setupLayout();

  function setCaption(caption) {
    if (!_captionElement.innerHTML) {
      _captionElement.innerHTML = caption;
      _isFirstUpdate = false;
    } else if (_captionElement.innerHTML !== caption) {
      _captionElement = toggleText(_captionElement, caption, 'lovely-chart--header-caption lovely-chart--position-right');
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    _zoomOutElement = toggleText(_titleElement, 'Zoom Out', 'lovely-chart--header-title lovely-chart--header-zoom-out-control');
    addEventListener(_zoomOutElement, 'click', _onZoomOut);

    setCaption(caption);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--header';

    _titleElement = createElement();
    _titleElement.className = 'lovely-chart--header-title';
    _titleElement.innerHTML = title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'lovely-chart--header-caption lovely-chart--position-right';
    _element.appendChild(_captionElement);

    container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement = toggleText(_zoomOutElement, title, 'lovely-chart--header-title', true);

    zoomOutCallback();
  }

  return {
    setCaption: setCaptionThrottled,
    zoom,
  };
}


function createAxes(context, data, plotSize, colors) {
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

      context.fillStyle = getCssColor(colors, 'x-axis-text', opacity);
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
    const colorKey = secondaryProjection && `dataset#${data.datasets[0].key}`;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

    _drawYAxisScaled(
      state,
      projection,
      Math.round(yAxisScaleTo || yAxisScale),
      yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
      yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
      yAxisScaleFrom ? yAxisScaleProgress : 1,
      colorKey,
    );

    if (yAxisScaleProgress > 0 && isYChanging) {
      _drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== undefined ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== undefined ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        colorKey,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColorKey = `dataset#${data.datasets[data.datasets.length - 1].key}`;
      const isYChanging = yMinViewportSecondFrom !== undefined || yMaxViewportSecondFrom !== undefined;

      _drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== undefined ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== undefined ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColorKey,
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
          secondaryColorKey,
          true,
        );
      }
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, colorKey = null, isSecondary = false) {
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

      context.fillStyle = colorKey
        ? getCssColor(colors, colorKey, textOpacity)
        : getCssColor(colors, 'y-axis-text', textOpacity);

      if (!isSecondary) {
        context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      } else {
        context.fillText(humanize(value), plotSize.width - GUTTER, yPx - GUTTER / 2);
      }

      if (isSecondary) {
        context.strokeStyle = getCssColor(colors, colorKey, opacity);

        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(GUTTER, yPx);
        context.strokeStyle = getCssColor(colors, 'grid-lines', opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    }

    context.stroke();
  }

  return { drawXAxis, drawYAxis };
}


function createMinimap(container, data, colors, rangeCallback) {
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

    _state = proxyMerge(newState, { focusOn: null });
    clearCanvas(_canvas, _context);
    _drawDatasets(_state);
  }

  function toggle(shouldShow) {
    _element.classList.toggle('lovely-chart--state-hidden', !shouldShow);

    requestAnimationFrame(() => {
      _element.classList.toggle('lovely-chart--state-transparent', !shouldShow);
    });
  }

  function _setupLayout() {
    _element = createElement();

    _element.className = 'lovely-chart--minimap';
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
    _ruler.className = 'lovely-chart--minimap-ruler';
    _ruler.innerHTML =
      '<div class="lovely-chart--minimap-mask"></div>' +
      '<div class="lovely-chart--minimap-slider">' +
      '<div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div>' +
      '<div class="lovely-chart--minimap-slider-inner"></div>' +
      '<div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div>' +
      '</div>' +
      '<div class="lovely-chart--minimap-mask"></div>';

    _slider = _ruler.children[1];

    captureEvents(
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onSliderDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'grabbing',
      },
    );

    captureEvents(
      _slider.children[0],
      {
        onCapture: _onDragCapture,
        onDrag: _onLeftEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    captureEvents(
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
      MINIMAP_LINE_WIDTH, visibilities, colors, true,
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
    let nextRange = Object.assign({}, _range, range);

    if (_state && _state.minimapDelta && !isExternal) {
      nextRange = _adjustDiscreteRange(nextRange);
    }

    if (nextRange.begin === _range.begin && nextRange.end === _range.end) {
      return;
    }

    _range = nextRange;
    _updateRulerOnRaf();

    if (!isExternal) {
      rangeCallback(_range);
    }
  }

  function _adjustDiscreteRange(nextRange) {
    const beginChange = nextRange.begin - _range.begin;
    const endChange = nextRange.end - _range.end;
    const beginAbs = Math.abs(beginChange);
    const endAbs = Math.abs(endChange);
    const beginDirection = beginAbs ? beginChange / beginAbs : 1;
    const endDirection = endAbs ? endChange / endAbs : 1;
    const begin = _range.begin + Math.floor(beginAbs / _state.minimapDelta) * _state.minimapDelta * beginDirection;
    const end = _range.end + Math.floor(endAbs / _state.minimapDelta) * _state.minimapDelta * endDirection;

    return { begin, end };
  }

  function _updateRuler() {
    const { begin, end } = _range;

    _ruler.children[0].style.width = `${begin * 100}%`;
    _ruler.children[1].style.width = `${(end - begin) * 100}%`;
    _ruler.children[2].style.width = `${(1 - end) * 100}%`;
  }

  return { update, toggle };
}


function createTooltip(container, data, plotSize, colors, onZoom, onFocus) {
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

  let _isZoomed = false;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);
  const _throttledUpdateContent = throttle(_updateContent, 400, true, true);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _selectLabel(true);
  }

  function toggleSpinner(isLoading) {
    _balloon.classList.toggle('lovely-chart--state-loading', isLoading);
  }

  function toggleIsZoomed(isZoomed) {
    _isZoomed = isZoomed;
    _balloon.classList.toggle('lovely-chart--state-zoomed', isZoomed);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--tooltip';

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
    _balloon.className = 'lovely-chart--tooltip-balloon';
    _balloon.innerHTML = '<div class="lovely-chart--tooltip-title"></div><div class="lovely-chart--tooltip-legend"></div><div class="lovely-chart--spinner"></div>';

    if (data.isZoomable) {
      addEventListener(_balloon, 'click', _onBalloonClick);
    }

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
    if (_balloon.classList.contains('lovely-chart--state-zoomed')) {
      return;
    }

    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
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
    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
    return labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex ? null : labelIndex;
  }

  function _selectLabel(isExternal) {
    if (!_offsetX || !_state) {
      return;
    }

    const labelIndex = _getLabelIndex();
    if (labelIndex === null) {
      _clear(isExternal);
      return;
    }

    const pointerVector = getPointerVector();
    const shouldShowBalloon = data.isPie ? pointerVector.distance <= getPieRadius(_projection) : true;

    if (!isExternal && onFocus) {
      if (data.isPie) {
        onFocus(pointerVector);
      } else {
        onFocus(labelIndex);
      }
    }

    function getValue(values, labelIndex) {
      if (data.isPie) {
        return values.slice(_state.labelFromIndex, _state.labelToIndex + 1).reduce((a, x) => a + x, 0);
      }

      return values[labelIndex];
    }

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const statistics = data.datasets
      .map(({ key, name, values, hasOwnYAxis }, i) => ({
        key,
        name,
        value: getValue(values, labelIndex),
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => _state.filter[key]);

    if (statistics.length && shouldShowBalloon) {
      _updateBalloon(statistics, labelIndex);
    } else {
      _hideBalloon();
    }

    clearCanvas(_canvas, _context);
    if (data.isLines || data.isAreas) {
      if (data.isLines) {
        _drawCircles(statistics, labelIndex);
      }

      _drawTail(xPx, plotSize.height - X_AXIS_HEIGHT, getCssColor(colors, 'grid-lines'));
    }
  }

  function _drawCircles(statistics, labelIndex) {
    statistics.forEach(({ value, key, hasOwnYAxis, originalIndex }) => {
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
        getCssColor(colors, `dataset#${key}`),
        getCssColor(colors, 'background'),
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

  function _getBalloonLeftOffset(labelIndex) {
    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const { angle } = getPointerVector();

    const shouldPlaceRight = data.isPie ? angle > Math.PI / 2 : labelIndex < meanLabel;

    return shouldPlaceRight
        ? _offsetX + BALLOON_OFFSET
        : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);
  }

  function _getBalloonTopOffset() {
    return data.isPie ? `${_offsetY}px` : 0;
  }

  function _updateBalloon(statistics, labelIndex) {
    _balloon.style.transform = `translate3D(${_getBalloonLeftOffset(labelIndex)}px, ${_getBalloonTopOffset()}, 0)`;
    _balloon.classList.add('lovely-chart--state-shown');

    if (data.isPie) {
      _updateContent(null, statistics);
    } else {
      _throttledUpdateContent(_getTitle(data, labelIndex), statistics);
    }
  }

  function _getTitle(data, labelIndex) {
    if (_isZoomed) {
      if (isDataRange(data.xLabels[_state.labelFromIndex + 1], data.xLabels[_state.labelToIndex - 1])) {
        return getLabelDate(data.xLabels[labelIndex], { isShort: true, displayYear: false, displayHours: true });
      }

      return data.xLabels[labelIndex].text;
    }

    return getFullLabelDate(data.xLabels[labelIndex], { isShort: true });
  }

  function _isPieSectorSelected(statistics, value, totalValue, index, pointerVector) {
    const offset = index > 0 ? statistics.slice(0, index).reduce((a, x) => a + x.value, 0) : 0;
    const beginAngle = offset / totalValue * Math.PI * 2 - Math.PI / 2;
    const endAngle = (offset + value) / totalValue * Math.PI * 2 - Math.PI / 2;

    return pointerVector &&
      beginAngle <= pointerVector.angle &&
      pointerVector.angle < endAngle &&
      pointerVector.distance <= getPieRadius(_projection);
  }

  function _updateTitle(title) {
    const titleContainer = _balloon.children[0];

    if (data.isPie) {
      if (titleContainer) {
        titleContainer.style.display = 'none';
      }
    } else {
      if (titleContainer.style.display === 'none') {
        titleContainer.style.display = '';
      }
      const currentTitle = titleContainer.querySelector(':not(.lovely-chart--state-hidden)');

      if (!titleContainer.innerHTML || !currentTitle) {
        titleContainer.innerHTML = `<span>${title}</span>`;
      } else if (currentTitle.innerHTML !== title) {
        toggleText(currentTitle, title, 'lovely-chart--tooltip-title-inner');
      }
    }
  }

  function _insertNewDataSet(dataSetContainer, { name, key, value }, totalValue) {
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right lovely-chart--color-dataset-${key}`;
    const newDataSet = createElement();
    newDataSet.className = 'lovely-chart--tooltip-dataset';
    newDataSet.setAttribute('data-present', 'true');
    newDataSet.setAttribute('data-name', name);
    newDataSet.innerHTML = `<span class="lovely-chart--dataset-title">${name}</span><span class="${className}">${value}</span>`;
    _renderPercentageValue(newDataSet, value, totalValue);

    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    if (totalText) {
      dataSetContainer.insertBefore(newDataSet, totalText);
    } else {
      dataSetContainer.appendChild(newDataSet);
    }
  }

  function _updateDataSet(currentDataSet, { key, value } = {}, totalValue) {
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right lovely-chart--color-dataset-${key}`;
    currentDataSet.setAttribute('data-present', 'true');

    const valueElement = currentDataSet.querySelector(`.lovely-chart--tooltip-dataset-value.lovely-chart--color-dataset-${key}:not(.lovely-chart--state-hidden)`);
    const formattedValue = formatInteger(value);
    if (valueElement.innerHTML !== formattedValue) {
      toggleText(valueElement, formattedValue, className);
    }

    _renderPercentageValue(currentDataSet, value, totalValue);
  }

  function _renderPercentageValue(dataSet, value, totalValue) {
    if (!data.isPercentage) {
      return;
    }

    if (data.isPie) {
      Array.from(dataSet.querySelectorAll(`.lovely-chart--percentage-title`)).forEach(e => e.remove());
      return;
    }

    const percentageValue = Math.round(value / totalValue * 100);
    const percentageElement = dataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);

    if (!percentageElement) {
      const newPercentageTitle = createElement('span');
      newPercentageTitle.className = 'lovely-chart--percentage-title lovely-chart--position-left';
      newPercentageTitle.innerHTML = `${percentageValue}%`;
      dataSet.prepend(newPercentageTitle);
    } else if (percentageElement.innerHTML !== `${percentageValue}%`) {
      toggleText(percentageElement, `${percentageValue}%`, 'lovely-chart--percentage-title lovely-chart--position-left');
    }
  }

  function _updateDataSets(statistics) {
    const dataSetContainer = _balloon.children[1];
    if (data.isPie) {
      dataSetContainer.classList.add('lovely-chart--tooltip-legend-pie');
    }

    Array.from(dataSetContainer.children).forEach((dataSet) => {
      if (!data.isPie && dataSetContainer.classList.contains('lovely-chart--tooltip-legend-pie')) {
        dataSet.remove();
      } else {
        dataSet.setAttribute('data-present', 'false');
      }
    });

    const totalValue = statistics.reduce((a, x) => a + x.value, 0);
    const pointerVector = getPointerVector();
    const finalStatistics = data.isPie ? statistics.filter(({ value }, index) => _isPieSectorSelected(statistics, value, totalValue, index, pointerVector)) : statistics;

    finalStatistics.forEach((statItem) => {
      const currentDataSet = dataSetContainer.querySelector(`[data-name="${statItem.name}"]`);

      if (!currentDataSet) {
        _insertNewDataSet(dataSetContainer, statItem, totalValue);
      } else {
        _updateDataSet(currentDataSet, statItem, totalValue);
      }
    });

    if (data.isBars && data.isStacked) {
      _renderTotal(dataSetContainer, formatInteger(totalValue));
    }

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  function _updateContent(title, statistics) {
    _updateTitle(title);
    _updateDataSets(statistics);
  }

  function _renderTotal(dataSetContainer, totalValue) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      newTotalText.innerHTML = `<span>All</span><span class="${className}">${totalValue}</span>`;
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(`.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`);
        if (valueElement.innerHTML !== totalValue) {
          toggleText(valueElement, totalValue, className);
        }
    }
  }

  function _hideBalloon() {
    _balloon.classList.remove('lovely-chart--state-shown');
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

  return { update, toggleSpinner, toggleIsZoomed };
}



function createTools(container, data, filterCallback) {
  let _element;

  _setupLayout();
  _updateFilter();

  function redraw() {
    if (_element) {
      const oldElement = _element;
      oldElement.classList.add('lovely-chart--state-hidden');
      setTimeout(() => {
        oldElement.parentNode.removeChild(oldElement);
      }, 500);
    }

    _setupLayout();
    _element.classList.add('lovely-chart--state-transparent');
    requestAnimationFrame(() => {
      _element.classList.remove('lovely-chart--state-transparent');
    });
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--tools';

    if (data.datasets.length < 2) {
      _element.className += ' lovely-chart--state-hidden';
    }

    data.datasets.forEach(({ key, name }) => {
      const control = createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = `lovely-chart--button lovely-chart--color-dataset-${key} lovely-chart--state-checked`;
      control.innerHTML = `<span class="lovely-chart--button-check"></span><span class="lovely-chart--button-label">${name}</span>`;

      control.addEventListener('click', (e) => {
        e.preventDefault();

        if (!control.dataset.clickPrevented) {
          _updateFilter(control);
        }

        delete control.dataset.clickPrevented;
      });

      captureEvents(control, {
        onLongPress: () => {
          if (!('ontouchstart' in window)) {
            control.dataset.clickPrevented = 'true';
          }

          _updateFilter(control, true);
        },
      });

      _element.appendChild(control);
    });

    container.appendChild(_element);
  }

  function _updateFilter(button, isLongPress = false) {
    const buttons = Array.from(_element.getElementsByTagName('a'));
    const isSingleChecked = _element.querySelectorAll('.lovely-chart--state-checked').length === 1;

    if (button) {
      if (button.classList.contains('lovely-chart--state-checked') && isSingleChecked) {
        if (isLongPress) {
          buttons.forEach((b) => b.classList.add('lovely-chart--state-checked'));
          button.classList.remove('lovely-chart--state-checked');
        } else {
          button.classList.remove('lovely-chart--state-shake');
          requestAnimationFrame(() => {
            button.classList.add('lovely-chart--state-shake');
          });
        }
      } else if (isLongPress) {
        buttons.forEach((b) => b.classList.remove('lovely-chart--state-checked'));
        button.classList.add('lovely-chart--state-checked');
      } else {
        button.classList.toggle('lovely-chart--state-checked');
      }
    }

    const filter = {};

    buttons.forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('lovely-chart--state-checked');
    });

    filterCallback(filter);
  }

  return {
    redraw,
  };
}


function createZoomer(data, overviewData, colors, stateManager, header, minimap, tooltip, tools) {
  let _isZoomed = false;
  let _stateBeforeZoomIn;
  let _stateBeforeZoomOut;
  let _zoomedDateText;

  function zoomIn(state, labelIndex) {
    if (_isZoomed) {
      return;
    }

    const label = data.xLabels[labelIndex];

    _stateBeforeZoomIn = state;
    header.zoom(getFullLabelDate(label));
    tooltip.toggleSpinner(true);
    tooltip.toggleIsZoomed(true);

    const { value: date } = label;
    const dataPromise = data.shouldZoomToPie ? Promise.resolve(_generatePieData(state)) : data.onZoom(date);
    dataPromise.then((newData) => _replaceData(newData, labelIndex));
  }

  function zoomOut(state) {
    _stateBeforeZoomOut = state;
    tooltip.toggleIsZoomed(false);

    const labelIndex = Math.round((state.labelFromIndex + state.labelToIndex) / 2);
    _replaceData(overviewData, labelIndex);
  }

  function isZoomed() {
    return _isZoomed;
  }

  function _replaceData(newRawData, labelIndex) {
    tooltip.toggleSpinner(false);

    const labelWidth = 1 / data.xLabels.length;
    const labelMiddle = labelIndex / (data.xLabels.length - 1);
    const filter = {};
    data.datasets.forEach(({ key }) => filter[key] = false);
    const newData = analyzeData(newRawData, _isZoomed || data.shouldZoomToPie ? 'days' : 'hours');
    const shouldZoomToLines = Object.keys(data.datasets).length !== Object.keys(newData.datasets).length;

    stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
      filter,
    });

    setTimeout(() => {
      if (!_isZoomed) {
        _zoomedDateText = getFullLabelDate(data.xLabels[labelIndex]);
      } else {
        _zoomedDateText = null;
      }

      Object.assign(data, newData);
      if (shouldZoomToLines) {
        Object.assign(colors, createColors(newRawData.colors));
      }

      if (shouldZoomToLines) {
        minimap.toggle(_isZoomed);
        tools.redraw();
      }

      stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
        focusOn: null,
      }, true);

      const daysCount = _isZoomed || data.shouldZoomToPie ? data.xLabels.length : data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;

      let range;
      let filter;

      if (_isZoomed) {
        range = {
          begin: _stateBeforeZoomIn.begin,
          end: _stateBeforeZoomIn.end,
        };
        filter = shouldZoomToLines ? _stateBeforeZoomIn.filter : _stateBeforeZoomOut.filter;
      } else {
        if (shouldZoomToLines) {
          range = {
            begin: 0,
            end: 1,
          };
          filter = {};
          data.datasets.forEach(({ key }) => filter[key] = true);
        } else {
          range = {
            begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
            end: ZOOM_RANGE_MIDDLE + halfDayWidth,
          };
          filter = _stateBeforeZoomIn.filter;
        }
      }

      stateManager.update({
        range,
        filter,
        minimapDelta: _isZoomed ? null : range.end - range.begin,
      });

      _isZoomed = !_isZoomed;
    }, stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);
  }

  function _generatePieData(state) {
    const pieData = Object.assign({}, overviewData);

    pieData.columns = overviewData.columns.map((c) => {
      const column = c.slice(state.labelFromIndex + 1, state.labelToIndex + 1);
      column.unshift(c[0]);
      return column;
    });

    pieData.types = {};
    Object.keys(overviewData.types).forEach((key) => {
      if (key !== 'x') {
        pieData.types[key] = 'pie';
      }
    });

    pieData.pie = true;

    return pieData;
  }

  return { zoomIn, zoomOut, isZoomed };
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


function analyzeData(data, type) {
  const { datasets, labels } = prepareDatasets(data);

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

  const analyzed = {
    datasets,
    yMin: totalYMin,
    yMax: totalYMax,
    xLabels: type === 'hours' ? buildTimeLabels(labels) : buildDayLabels(labels),
    hasSecondYAxis: data.y_scaled,
    isStacked: data.stacked,
    isPercentage: data.percentage,
    isPie: data.pie,
    isLines: datasets.some(({ type }) => type === 'line'),
    isBars: datasets.some(({ type }) => type === 'bar'),
    isAreas: datasets.some(({ type }) => type === 'area'),
    onZoom: data.x_on_zoom,
  };

  analyzed.shouldZoomToPie = !analyzed.onZoom && analyzed.isPercentage;
  analyzed.isZoomable = analyzed.onZoom || analyzed.shouldZoomToPie;

  return analyzed;
}

function prepareDatasets(chartData) {
  const { columns, names, types, y_scaled: hasSecondYAxis } = chartData;

  let labels = [];
  const datasets = [];

  columns.forEach((originalValues, i) => {
    const values = originalValues.slice(0);
    const key = values.shift();

    if (key === LABELS_KEY) {
      labels = values;
      return;
    }

    datasets.push({
      key,
      name: names[key],
      type: types[key],
      values,
      hasOwnYAxis: hasSecondYAxis && i === columns.length - 1,
    });
  });

  return { datasets, labels };
}


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

  function findClosestLabelIndex(xPx) {
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
    findClosestLabelIndex,
    copy,
    getCenter,
    getSize,
    getParams,
  };
}


function drawDatasets(
  context, state, data,
  range, points, projection, secondaryPoints, secondaryProjection,
  lineWidth, visibilities, colors, pieToBar,
) {
  data.datasets.forEach(({ key, type, hasOwnYAxis }, i) => {
    if (!visibilities[i]) {
      return;
    }

    const options = {
      color: getCssColor(colors, `dataset#${key}`),
      lineWidth,
      opacity: data.isStacked ? 1 : visibilities[i],
    };

    const datasetType = type === 'pie' && pieToBar ? 'bar' : type;
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
      options.radius = getPieRadius(projection);
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
      lineWidth: x1 - x0,
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
    const rectW = options.opacity === 1 ? options.lineWidth + PLOT_BARS_WIDTH_SHIFT : options.lineWidth;
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
  context.fillRect(xCenter - width / 2, yCenter - height / 2, x - options.lineWidth / 2 + PLOT_BARS_WIDTH_SHIFT, height);
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
    `${Math.round(percent * 100)}%`, x + directionX * textShift + shiftX, y + directionY * textShift + shiftY,
  );

  context.restore();
}


let skin = DEFAULT_SKIN;

const COLORS = {
  'skin-day': {
    'background': '#FFFFFF',
    'text-color': '#222222',
    'minimap-mask': '#E2EEF9/0.6',
    'minimap-slider': '#C0D1E1',
    'grid-lines': '#182D3B/0.1',
    'zoom-out-text': '#108BE3',
    'tooltip-background': '#FFFFFF',
    'tooltip-arrow': '#D2D5D7',
    'mask': '#FFFFFF/0.5',
    'x-axis-text': '#252529/0.6',
    'y-axis-text': '#252529/0.6',
  },
  'skin-night': {
    'background': '#242F3E',
    'text-color': '#FFFFFF',
    'minimap-mask': '#304259/0.6',
    'minimap-slider': '#56626D',
    'grid-lines': '#FFFFFF/0.1',
    'zoom-out-text': '#48AAF0',
    'tooltip-background': '#1c2533',
    'tooltip-arrow': '#D2D5D7',
    'mask': '#242F3E/0.5',
    'x-axis-text': '#A3B1C2/0.6',
    'y-axis-text': '#A3B1C2/0.6',
  },
};

document.documentElement.addEventListener('darkmode', () => {
  skin = document.documentElement.classList.contains('dark') ? 'skin-night' : 'skin-day';
});

function createColors(datasetColors) {
  const colors = {};

  ['skin-day', 'skin-night'].forEach((skin) => {
    colors[skin] = {};

    Object.keys(COLORS[skin]).forEach((prop) => {
      colors[skin][prop] = hexToChannels(COLORS[skin][prop]);
    });

    Object.keys(datasetColors).forEach((key) => {
      colors[skin][`dataset#${key}`] = hexToChannels(datasetColors[key]);
    });
  });

  return colors;
}

function getCssColor(colors, key, opacity) {
  return buildCssColor(colors[skin][key], opacity);
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


function captureEvents(element, options) {
  let captureEvent = null;
  let longPressTimeout = null;

  function onCapture(e) {
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

    if (options.onLongPress) {
      longPressTimeout = setTimeout(() => options.onLongPress(), LONG_PRESS_TIMEOUT);
    }
  }

  function onRelease(e) {
    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }

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
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }

      if (e.type === 'touchmove' && e.pageX === undefined) {
        e.pageX = e.touches[0].pageX;
      }

      options.onDrag && options.onDrag(e, captureEvent, {
        dragOffsetX: e.pageX - captureEvent.pageX,
      });
    }
  }

  addEventListener(element, 'mousedown', onCapture);
  addEventListener(element, 'touchstart', onCapture);
}


function buildDayLabels(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const day = date.getDate();
    const month = MONTHS_SHORT[date.getMonth()];

    return ({
      value,
      text: `${day} ${month}`,
    });
  });
}

function buildTimeLabels(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    return ({
      value,
      text: `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
    });
  });
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

function getFullLabelDate(label, { isShort = false } = {}) {
  return getLabelDate(label, { isShort, displayWeekDay: true });
}

function getLabelDate(label, { isShort = false, displayWeekDay = false, displayYear = true, displayHours = false } = {}) {
  const { value } = label;
  const date = new Date(value);
  const monthsArray = isShort ? MONTHS_SHORT : MONTHS;
  const weekDaysArray = isShort ? WEEK_DAYS_SHORT : WEEK_DAYS;

  let string = `${date.getUTCDate()} ${monthsArray[date.getUTCMonth()]}`;
  if (displayWeekDay) {
    string = `${weekDaysArray[date.getUTCDay()]}, ` + string;
  }
  if (displayYear) {
    string += ` ${date.getUTCFullYear()}`;
  }
  if (displayHours) {
    string += `, ${('0' + date.getUTCHours()).slice(-2)}:${('0' + date.getUTCMinutes()).slice(-2)}`
  }

  return string;
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

function getPieRadius(projection) {
  return Math.min(...projection.getSize()) * PLOT_PIE_RADIUS_FACTOR;
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

function isDataRange(labelFrom, labelTo) {
  return Math.abs(labelTo.value - labelFrom.value) > MILISECONDS_IN_DAY;
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
      chart.classList.remove('lovely-chart--state-invisible');
    });
  }

  function hideScrolled() {
    charts.forEach((chart) => {
      const { top, bottom } = chart.getBoundingClientRect();
      const shouldHide = bottom < 0 || top > window.innerHeight;
      chart.classList.toggle('lovely-chart--state-invisible', shouldHide);
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


function toggleText(element, newText, className = '', inverse = false) {
  const container = element.parentNode;
  container.classList.add('lovely-chart--transition-container');

  const newElement = createElement(element.tagName);
  newElement.className = `${className} lovely-chart--transition lovely-chart--position-${inverse ? 'top' : 'bottom'} lovely-chart--state-hidden`;
  newElement.innerHTML = newText;

  const selector = className.length ? `.${className.split(' ').join('.')}` : '';
  const oldElements = container.querySelectorAll(`${selector}.lovely-chart--state-hidden`);
  oldElements.forEach(e => e.remove());

  element.classList.add('lovely-chart--transition');
  element.classList.remove('lovely-chart--position-bottom', 'lovely-chart--position-top');
  element.classList.add(inverse ? 'lovely-chart--position-bottom' : 'lovely-chart--position-top');
  container.insertBefore(newElement, element.nextSibling);

  toggleElementIn(newElement);
  toggleElementOut(element);

  return newElement;
}

function toggleElementIn(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('lovely-chart--state-animated');
  element.classList.add('lovely-chart--state-animated');
  element.classList.remove('lovely-chart--state-hidden');
}

function toggleElementOut(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('lovely-chart--state-animated');
  element.classList.add('lovely-chart--state-animated');
  element.classList.add('lovely-chart--state-hidden');
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
  let isPending;

  return function (..._args) {
    args = _args;
    isPending = true;

    if (!waiting) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }

      waiting = true;

      setTimeout(() => {
        waiting = false;

        if (shouldRunLast && isPending) {
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

})();