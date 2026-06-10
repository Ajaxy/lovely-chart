const DPR = window.devicePixelRatio ?? 1;
const DEFAULT_RANGE = { begin: 0.8, end: 1 };
const NO_FOCUS = Symbol("NO_FOCUS");
const GAP = null;
const TRANSITION_DEFAULT_DURATION = 400;
const LONG_PRESS_TIMEOUT = 500;
const GUTTER = 10;
const PLOT_HEIGHT = 320;
const PLOT_TOP_PADDING = 15;
const PLOT_LINE_WIDTH = 2;
const PLOT_PIE_RADIUS_FACTOR = 0.9 / 2;
const PLOT_PIE_SHIFT = 10;
const PLOT_BARS_WIDTH_SHIFT = 0.5;
const PIE_MINIMUM_VISIBLE_PERCENT = 0.02;
const PIE_DONUT_INNER_RADIUS_FACTOR = 0.5;
const BALLOON_OFFSET = 20;
const MAX_TOOLTIP_ITEMS = 12;
const AXES_FONT_STYLE = "300 10px";
const AXES_MAX_COLUMN_WIDTH = 45;
const AXES_MAX_ROW_HEIGHT = 50;
const X_AXIS_HEIGHT = 30;
const X_AXIS_SHIFT_START = 1;
const Y_AXIS_ZERO_BASED_THRESHOLD = 0.1;
const MINIMAP_HEIGHT = 40;
const MINIMAP_MARGIN = 10;
const MINIMAP_LINE_WIDTH = 1;
const MINIMAP_EAR_WIDTH = 8;
const MINIMAP_MAX_ANIMATED_DATASETS = 4;
const ZOOM_TIMEOUT = TRANSITION_DEFAULT_DURATION;
const ZOOM_RANGE_DELTA = 0.1;
const ZOOM_RANGE_MIDDLE = 0.5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1e3;
const MILLISECONDS_IN_WEEK = 7 * MILLISECONDS_IN_DAY;
const SPEED_TEST_INTERVAL = 200;
const SPEED_TEST_FAST_FPS = 4;
const SIMPLIFIER_MIN_POINTS = 1e3;
const SIMPLIFIER_PLOT_FACTOR = 1;
const SIMPLIFIER_MINIMAP_FACTOR = 0.5;
const ANIMATE_PROPS = [
  // Viewport X-axis
  "begin 200 fast",
  "end 200 fast",
  "labelFromIndex 200 fast floor",
  "labelToIndex 200 fast ceil",
  // X-axis labels
  "xAxisScale 400",
  // Viewport Y-axis
  "yMinViewport",
  "yMaxViewport",
  "yMinViewportSecond",
  "yMaxViewportSecond",
  // Minimap Y-axis
  "yMinMinimap",
  "yMaxMinimap",
  "yMinMinimapSecond",
  "yMaxMinimapSecond",
  // Y-axis labels
  "yAxisScale",
  "yAxisScaleSecond"
];

function formatDayHour(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, "0");
    return {
      value,
      text: `${date.getDate()} ${MONTHS[date.getMonth()]} ${hours}:00`
    };
  });
}
function formatDayHourFull(value) {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${hours}:00`;
}
function formatDay(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    return {
      value,
      text: `${day} ${month}`
    };
  });
}
function formatMin(labels) {
  return labels.map((value) => ({
    value,
    text: new Date(value).toString().match(/(\d+:\d+):/)[1]
  }));
}
function formatWeek(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
    return {
      value,
      text: `Week ${Math.floor((value - yearStart) / MILLISECONDS_IN_WEEK) + 1}`
    };
  });
}
function formatMonth(labels) {
  return labels.map((value) => ({
    value,
    text: MONTHS_FULL[new Date(value).getUTCMonth()]
  }));
}
function formatYear(labels) {
  return labels.map((value) => ({
    value,
    text: String(new Date(value).getUTCFullYear())
  }));
}
function formatText(labels) {
  return labels.map((value, i) => {
    return {
      value: i,
      text: String(value)
    };
  });
}
function humanize(value, decimals = 1) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e6) {
    return sign + keepThreeDigits(abs / 1e6, decimals) + "M";
  } else if (abs >= 1e3) {
    return sign + keepThreeDigits(abs / 1e3, decimals) + "K";
  }
  return formatInteger(value);
}
function keepThreeDigits(value, decimals) {
  return value.toFixed(decimals).replace(/(\d{3,})\.\d+/, "$1").replace(/\.0+$/, "");
}
function formatInteger(n) {
  if (!Number.isInteger(n)) {
    const abs = Math.abs(n);
    const decimals = abs > 0 && abs < 1 ? Math.max(2, -Math.floor(Math.log10(abs)) + 1) : 2;
    const [intPart, decPart] = n.toFixed(decimals).split(".");
    const trimmed = decPart.replace(/0+$/, "");
    return trimmed ? addThousandSeparators(intPart) + "." + trimmed : addThousandSeparators(intPart);
  }
  return addThousandSeparators(String(n));
}
function addThousandSeparators(s) {
  return s.replace(/\d(?=(\d{3})+$)/g, "$& ");
}
function getFullLabelDate(label, { isShort = false } = {}) {
  return getLabelDate(label, { isShort, displayWeekDay: true });
}
function getLabelDate(label, { isShort = false, displayWeekDay = false, displayYear = true, displayHours = false } = {}) {
  const { value } = label;
  const date = new Date(value);
  const weekDaysArray = isShort ? WEEK_DAYS_SHORT : WEEK_DAYS;
  let string = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  if (displayWeekDay) {
    string = `${weekDaysArray[date.getUTCDay()]}, ` + string;
  }
  if (displayYear) {
    string += ` ${date.getUTCFullYear()}`;
  }
  if (displayHours) {
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    string += `, ${hours}:${minutes}`;
  }
  return string;
}
function getLabelTime(label) {
  return new Date(label.value).toString().match(/(\d+:\d+):/)[1];
}

function xScaleLevelToStep(scaleLevel) {
  return Math.pow(2, scaleLevel);
}
function xStepToScaleLevel(step) {
  return Math.ceil(Math.log2(step || 1));
}
const SCALE_LEVELS = [
  // Sub-unit steps for fine-grained data (e.g. portfolio P&L denominated in cents)
  1e-4,
  2e-4,
  5e-4,
  1e-3,
  2e-3,
  5e-3,
  0.01,
  0.02,
  0.05,
  0.1,
  0.2,
  0.5,
  1,
  2,
  8,
  18,
  50,
  100,
  250,
  500,
  1e3,
  2500,
  5e3,
  1e4,
  25e3,
  5e4,
  1e5,
  25e4,
  5e5,
  1e6,
  25e5,
  5e6,
  1e7,
  25e6,
  5e7,
  1e8
];
function yScaleLevelToStep(scaleLevel) {
  return SCALE_LEVELS[scaleLevel] || SCALE_LEVELS.at(-1);
}
function yStepToScaleLevel(neededStep) {
  const idx = SCALE_LEVELS.findIndex((step) => step >= neededStep);
  return idx === -1 ? SCALE_LEVELS.length - 1 : idx;
}
function applyYEdgeOpacity(opacity, xPx, plotWidth) {
  const edgeOffset = Math.min(xPx + GUTTER, plotWidth - xPx);
  if (edgeOffset <= GUTTER * 4) {
    opacity = Math.min(1, opacity, edgeOffset / (GUTTER * 4));
  }
  return opacity;
}
function applyXEdgeOpacity(opacity, yPx) {
  return yPx - GUTTER <= GUTTER * 2 ? Math.min(1, opacity, (yPx - GUTTER) / (GUTTER * 2)) : opacity;
}
function getPieRadius(projection) {
  return Math.max(0, Math.min(...projection.getSize())) * PLOT_PIE_RADIUS_FACTOR;
}
function getPieTextSize(percent, radius) {
  return (radius + percent * 200) / 10;
}
function getPieTextShift(percent, radius) {
  return percent >= 0.99 ? 0 : Math.min(1 - Math.log(percent * 30) / 5, 4 / 5) * radius;
}
function isDataRange(labelFrom, labelTo) {
  return Math.abs(labelTo.value - labelFrom.value) > MILLISECONDS_IN_DAY;
}
function getSimplificationDelta(pointsLength) {
  return pointsLength >= SIMPLIFIER_MIN_POINTS ? Math.min(pointsLength / 1e3, 1) : 0;
}

const COLOR_CLOSENESS_THRESHOLD = 70;
function detectSkin() {
  return document.documentElement.classList.contains("theme-dark") ? "skin-night" : "skin-day";
}
let skin = detectSkin();
const COLORS = {
  "skin-day": {
    background: "#FFFFFF",
    "text-color": "#222222",
    "minimap-mask": "#E2EEF9/0.6",
    "minimap-slider": "#C0D1E1",
    "grid-lines": "#182D3B/0.1",
    "zoom-out-text": "#108BE3",
    "tooltip-background": "#FFFFFF",
    "tooltip-arrow": "#D2D5D7",
    mask: "#FFFFFF/0.5",
    "x-axis-text": "#252529/0.6",
    "y-axis-text": "#252529/0.6"
  },
  "skin-night": {
    background: "#242F3E",
    "text-color": "#FFFFFF",
    "minimap-mask": "#304259/0.6",
    "minimap-slider": "#56626D",
    "grid-lines": "#FFFFFF/0.1",
    "zoom-out-text": "#48AAF0",
    "tooltip-background": "#1c2533",
    "tooltip-arrow": "#D2D5D7",
    mask: "#242F3E/0.5",
    "x-axis-text": "#A3B1C2/0.6",
    "y-axis-text": "#A3B1C2/0.6"
  }
};
let styleSheet;
if (typeof CSSStyleSheet === "function") {
  try {
    styleSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
  } catch {
    styleSheet = void 0;
  }
}
if (!styleSheet) {
  const styleElement = document.createElement("style");
  styleElement.type = "text/css";
  styleElement.appendChild(document.createTextNode(""));
  document.head.appendChild(styleElement);
  styleSheet = styleElement.sheet;
}
new MutationObserver(() => {
  skin = detectSkin();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
function createColors(datasetColors) {
  const colors = {};
  const baseClass = `.lovely-chart--color`;
  ["skin-day", "skin-night"].forEach((skin2) => {
    colors[skin2] = {};
    Object.entries(COLORS[skin2]).forEach(([prop, value]) => {
      colors[skin2][prop] = hexToChannels(value);
    });
    Object.entries(datasetColors).forEach(([key, color]) => {
      const colorSuffix = color.slice(1);
      colors[skin2][`dataset#${key}`] = hexToChannels(color);
      addCssRule(
        styleSheet,
        `.lovely-chart--tooltip-dataset-value${baseClass}-${colorSuffix}`,
        `color: ${color}`
      );
      addCssRule(
        styleSheet,
        `.lovely-chart--button${baseClass}-${colorSuffix}`,
        `border-color: ${color}; color: ${color}`
      );
      const checkedButtonSelector = `.lovely-chart--button.lovely-chart--state-checked${baseClass}-${colorSuffix}`;
      addCssRule(styleSheet, checkedButtonSelector, `background-color: ${color}`);
    });
  });
  return colors;
}
function getCssColor(colors, key, opacity) {
  return buildCssColor(colors[skin][key], opacity);
}
function hexToChannels(hexWithAlpha) {
  const [hex, alpha] = hexWithAlpha.replace("#", "").split("/");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    alpha ? parseFloat(alpha) : 1
  ];
}
function buildCssColor([r, g, b, a = 1], opacity = 1) {
  return `rgba(${r}, ${g}, ${b}, ${a * opacity})`;
}
function isColorCloseToBackground(colors, hex) {
  const background = colors[skin]["tooltip-background"];
  const foreground = hexToChannels(hex);
  return getColorDistance(background, foreground) < COLOR_CLOSENESS_THRESHOLD;
}
function isColorCloseToWhite(hex) {
  return getColorDistance(hexToChannels(hex), [255, 255, 255]) < COLOR_CLOSENESS_THRESHOLD;
}
function getColorDistance([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
function addCssRule(sheet, selector, rule) {
  sheet.insertRule(`${selector} { ${rule} }`, sheet.cssRules.length);
}

class Axes {
  #context;
  #data;
  #plotSize;
  #colors;
  constructor(context, data, plotSize, colors) {
    this.#context = context;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
  }
  drawXAxis(state, projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    context.clearRect(0, plotSize.height - X_AXIS_HEIGHT + 1, plotSize.width, X_AXIS_HEIGHT + 1);
    const topOffset = plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);
    context.font = getAxesFont(context);
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      const shiftedI = i - X_AXIS_SHIFT_START;
      if (shiftedI % step !== 0) {
        continue;
      }
      const label = this.#data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotSize.width);
      context.fillStyle = getCssColor(this.#colors, "x-axis-text", opacity);
      context.fillText(label.text, xPx, topOffset);
    }
  }
  drawYAxis(state, projection, secondaryProjection) {
    const {
      yAxisScale,
      yAxisScaleFrom,
      yAxisScaleTo,
      yAxisScaleProgress = 0,
      yMinViewport,
      yMinViewportFrom,
      yMinViewportTo,
      yMaxViewport,
      yMaxViewportFrom,
      yMaxViewportTo,
      yMinViewportSecond,
      yMinViewportSecondFrom,
      yMinViewportSecondTo,
      yMaxViewportSecond,
      yMaxViewportSecondFrom,
      yMaxViewportSecondTo
    } = state;
    const colorKey = secondaryProjection ? `dataset#${this.#data.datasets[0].key}` : void 0;
    const isYChanging = yMinViewportFrom !== void 0 || yMaxViewportFrom !== void 0;
    if (this.#data.isPercentage) {
      this.#drawYAxisPercents(projection);
    } else if (this.#data.secondaryYAxis) {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== void 0 ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== void 0 ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1
      );
      this.#drawSecondaryYAxis(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== void 0 ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== void 0 ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
        this.#data.secondaryYAxis
      );
    } else {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== void 0 ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== void 0 ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
        colorKey
      );
    }
    if (yAxisScaleProgress > 0 && isYChanging) {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== void 0 ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== void 0 ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        colorKey
      );
    }
    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColorKey = `dataset#${this.#data.datasets.at(-1).key}`;
      const isYChanging2 = yMinViewportSecondFrom !== void 0 || yMaxViewportSecondFrom !== void 0;
      this.#drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== void 0 ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== void 0 ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColorKey,
        true
      );
      if (yAxisScaleSecondProgress > 0 && isYChanging2) {
        this.#drawYAxisScaled(
          state,
          secondaryProjection,
          Math.round(yAxisScaleSecondFrom),
          yMinViewportSecondFrom !== void 0 ? yMinViewportSecondFrom : yMinViewportSecond,
          yMaxViewportSecondFrom !== void 0 ? yMaxViewportSecondFrom : yMaxViewportSecond,
          1 - yAxisScaleSecondProgress,
          secondaryColorKey,
          true
        );
      }
    }
  }
  #drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, colorKey, isSecondary = false) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;
    context.font = getAxesFont(context);
    context.textAlign = isSecondary ? "right" : "left";
    context.textBaseline = "bottom";
    context.lineWidth = 1;
    context.beginPath();
    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);
      context.fillStyle = colorKey ? getCssColor(this.#colors, colorKey, textOpacity) : getCssColor(this.#colors, "y-axis-text", textOpacity);
      const label = isSecondary ? humanize(value) : this.#formatPrimaryAxisLabel(value);
      if (!isSecondary) {
        context.fillText(label, GUTTER, yPx - GUTTER / 2);
      } else {
        context.fillText(label, plotSize.width - GUTTER, yPx - GUTTER / 2);
      }
      if (isSecondary) {
        context.strokeStyle = getCssColor(this.#colors, colorKey, opacity);
        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(GUTTER, yPx);
        context.strokeStyle = getCssColor(this.#colors, "grid-lines", opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    }
    context.stroke();
  }
  #drawYAxisPercents(projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const percentValues = [0, 0.25, 0.5, 0.75, 1];
    const [, height] = projection.getSize();
    context.font = getAxesFont(context);
    context.textAlign = "left";
    context.textBaseline = "bottom";
    context.lineWidth = 1;
    context.beginPath();
    percentValues.forEach((value) => {
      const yPx = height - height * value + PLOT_TOP_PADDING;
      context.fillStyle = getCssColor(this.#colors, "y-axis-text", 1);
      context.fillText(`${value * 100}%`, GUTTER, yPx - GUTTER / 4);
      context.moveTo(GUTTER, yPx);
      context.strokeStyle = getCssColor(this.#colors, "grid-lines", 1);
      context.lineTo(plotSize.width - GUTTER, yPx);
    });
    context.stroke();
  }
  #drawSecondaryYAxis(state, projection, scaleLevel, yMin, yMax, opacity = 1, secondaryYAxis) {
    const context = this.#context;
    const { multiplier, prefix = "", suffix = "" } = secondaryYAxis;
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;
    context.font = getAxesFont(context);
    context.textAlign = "right";
    context.textBaseline = "bottom";
    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);
      const secondaryValue = value * multiplier;
      context.fillStyle = getCssColor(this.#colors, "y-axis-text", textOpacity);
      context.fillText(
        `${prefix}${humanize(secondaryValue)}${suffix}`,
        this.#plotSize.width - GUTTER,
        yPx - GUTTER / 2
      );
    }
  }
  #formatPrimaryAxisLabel(value) {
    const formatted = String(humanize(value));
    const prefix = this.#data.valuePrefix || "";
    const suffix = this.#data.valueSuffix || "";
    if (this.#data.isCurrencyPrefix && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }
}
function getAxesFont(context) {
  const fontFamily = getComputedStyle(context.canvas).fontFamily || "sans-serif";
  return `${AXES_FONT_STYLE} ${fontFamily}`;
}

function createElement(tagName = "div") {
  return document.createElement(tagName);
}
function addEventListener(element, event, cb) {
  element.addEventListener(event, cb);
}
function removeEventListener(element, event, cb) {
  element.removeEventListener(event, cb);
}

function setupCanvas(container, { width, height }) {
  const canvas = createElement("canvas");
  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = "100%";
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.scale(DPR, DPR);
  container.appendChild(canvas);
  return { canvas, context };
}
function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function getMaxMin(array) {
  const length = array.length;
  let max;
  let min;
  for (let i = 0; i < length; i++) {
    const value = array[i];
    if (value === GAP || value === void 0) continue;
    if (max === void 0 || value > max) max = value;
    if (min === void 0 || value < min) min = value;
  }
  return { max, min };
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
function mergeProxied(base, override) {
  return new Proxy({}, {
    get: (target, prop) => {
      if (target[prop] !== void 0) {
        return target[prop];
      } else if (override[prop] !== void 0) {
        return override[prop];
      } else {
        return base[prop];
      }
    }
  });
}
function throttle(fn, ms, shouldRunFirst = true) {
  let interval;
  let isPending;
  let args;
  return (..._args) => {
    isPending = true;
    args = _args;
    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }
      interval = window.setInterval(() => {
        if (!isPending) {
          window.clearInterval(interval);
          interval = void 0;
          return;
        }
        isPending = false;
        fn(...args);
      }, ms);
    }
  };
}
function throttleWithRaf(fn) {
  let isWaiting = false;
  let args;
  return function(..._args) {
    args = _args;
    if (!isWaiting) {
      isWaiting = true;
      requestAnimationFrame(() => {
        isWaiting = false;
        fn(...args);
      });
    }
  };
}
function debounce(fn, ms, shouldRunFirst = true, shouldRunLast = true) {
  let waitingTimeout;
  return function() {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = void 0;
    } else if (shouldRunFirst) {
      fn();
    }
    waitingTimeout = window.setTimeout(() => {
      if (shouldRunLast) {
        fn();
      }
      waitingTimeout = void 0;
    }, ms);
  };
}

const DEFAULT_COLORS = [
  "#3497ED",
  "#2373DB",
  "#9ED448",
  "#5FB641",
  "#F5BD25",
  "#F79E39",
  "#E65850",
  "#5D5CDC"
];
const DEFAULT_COLORS_SUBSETS = [
  [],
  [0],
  [0, 2],
  [0, 2, 5],
  [0, 2, 5, 7],
  [0, 2, 4, 5, 7],
  [0, 1, 2, 4, 5, 7],
  [0, 1, 2, 3, 4, 5, 7]
];
const LABEL_TYPE_TO_FORMATTER = {
  year: "statsFormatYear",
  month: "statsFormatMonth",
  week: "statsFormatWeek",
  day: "statsFormat('day')",
  hour: "statsFormat('hour')",
  "5min": "statsFormat('5min')",
  dayHour: "statsFormatDayHour",
  text: void 0
};
function analyzeData(data, fallbackLabelType) {
  const {
    title,
    labelFormatter: labelFormatterRaw,
    tooltipFormatter,
    secondaryYAxis,
    hasSecondYAxis,
    onZoom,
    withMinimap,
    minimapRange,
    noCaption,
    zoomOutLabel,
    valuePrefix,
    valueSuffix,
    isCurrencyPrefix,
    limitDate,
    onLimitedRangeClick
  } = data;
  const isPie = data.type === "pie";
  const isStacked = isPie || Boolean(data.isStacked);
  const isPercentage = isPie || Boolean(data.isPercentage);
  const labelType = data.labelType || inferLabelType(data.labels) || fallbackLabelType;
  const labelFormatter = labelFormatterRaw || (labelType ? LABEL_TYPE_TO_FORMATTER[labelType] : void 0);
  const { datasets, labels } = prepareDatasets(data);
  const colors = {};
  let totalYMin = Infinity;
  let totalYMax = -Infinity;
  datasets.forEach(({ key, color, yMin, yMax }) => {
    colors[key] = color;
    if (yMin !== void 0 && yMin < totalYMin) {
      totalYMin = yMin;
    }
    if (yMax !== void 0 && yMax > totalYMax) {
      totalYMax = yMax;
    }
  });
  let xLabels;
  switch (labelFormatter) {
    case "statsFormatYear":
      xLabels = formatYear(labels);
      break;
    case "statsFormatMonth":
      xLabels = formatMonth(labels);
      break;
    case "statsFormatWeek":
      xLabels = formatWeek(labels);
      break;
    case "statsFormatDayHour":
      xLabels = formatDayHour(labels);
      break;
    case "statsFormat('day')":
      xLabels = formatDay(labels);
      break;
    case "statsFormat('hour')":
    case "statsFormat('5min')":
      xLabels = formatMin(labels);
      break;
    default:
      xLabels = formatText(labels);
      break;
  }
  let limitBegin;
  if (limitDate !== void 0) {
    const totalXWidth = labels.length - 1;
    const index = labels.findIndex((label) => label >= limitDate);
    if (index > 0) {
      limitBegin = index / totalXWidth;
    }
  }
  const shouldZoomToPie = !onZoom && Boolean(isPercentage);
  const analyzed = {
    title,
    labelType,
    labelFormatter,
    tooltipFormatter,
    xLabels,
    datasets,
    isStacked,
    isPercentage,
    secondaryYAxis,
    hasSecondYAxis,
    valuePrefix,
    valueSuffix,
    isCurrencyPrefix,
    onZoom,
    isLines: data.type === "line",
    isBars: data.type === "bar",
    isSteps: data.type === "step",
    isAreas: data.type === "area",
    isPie,
    isDonut: Boolean(data.isDonut),
    withGradient: Boolean(data.withGradient),
    yMin: totalYMin,
    yMax: totalYMax,
    colors,
    withMinimap: Boolean(withMinimap),
    minimapRange: buildMinimapRange(minimapRange),
    noCaption,
    zoomOutLabel,
    limitBegin,
    onLimitedRangeClick,
    shouldZoomToPie,
    isZoomable: Boolean(onZoom) || shouldZoomToPie
  };
  return analyzed;
}
function inferLabelType(labels) {
  const [first, second] = labels;
  if (typeof first === "string") {
    return "text";
  }
  if (typeof first !== "number") {
    return void 0;
  }
  if (typeof second !== "number") {
    return "day";
  }
  const step = Math.abs(second - first);
  if (step >= 365 * MILLISECONDS_IN_DAY) {
    return "year";
  }
  if (step >= 28 * MILLISECONDS_IN_DAY) {
    return "month";
  }
  if (step >= 7 * MILLISECONDS_IN_DAY) {
    return "week";
  }
  if (step >= MILLISECONDS_IN_DAY) {
    return "day";
  }
  if (step >= MILLISECONDS_IN_DAY / 24) {
    return "hour";
  }
  return "5min";
}
function buildMinimapRange(minimapRange) {
  if (!minimapRange) {
    return void 0;
  }
  if (minimapRange === "full") {
    return { begin: 0, end: 1 };
  }
  const [begin, end] = minimapRange;
  return { begin, end };
}
function prepareDatasets(data) {
  const { type, labels, datasets, hasSecondYAxis } = data;
  const defaultColors = getDefaultColors(datasets.length);
  let nextDefaultColor = 0;
  return {
    labels: [...labels],
    datasets: datasets.map(({ name, color, values }, i) => {
      const { min: yMin, max: yMax } = getMaxMin(values);
      return {
        type,
        key: `y${i}`,
        name,
        color: color || defaultColors[nextDefaultColor++ % defaultColors.length],
        values: [...values],
        hasOwnYAxis: hasSecondYAxis && i === datasets.length - 1,
        yMin,
        yMax
      };
    })
  };
}
function getDefaultColors(datasetsCount) {
  const subset = DEFAULT_COLORS_SUBSETS[datasetsCount];
  return subset ? subset.map((index) => DEFAULT_COLORS[index]) : DEFAULT_COLORS;
}

const MIN_DELTA = 1 / 2 ** 22;
const MAX_LIMIT = 1e5;
function simplify(points, indexes, fixedPoints) {
  if (points.length < 6) {
    return () => ({
      points,
      indexes: indexes ?? points.map((_, i) => i),
      removed: []
    });
  }
  const calcDistances = precalculate(points, fixedPoints);
  return (delta) => {
    const result = [];
    const resultIndexes = [];
    const removed = [];
    const delta2 = delta * delta;
    const markers = calcDistances(delta2);
    for (let i = 0, l = points.length; i < l; i++) {
      if (markers[i] >= delta2 || i === 0 || i === l - 1) {
        result.push(points[i]);
        resultIndexes.push(indexes ? indexes[i] : i);
      } else {
        removed.push(i);
      }
    }
    return {
      points: result,
      indexes: resultIndexes,
      removed
    };
  };
}
function precalculate(points, fixedPoints = []) {
  const len = points.length;
  const distances = new Array(len).fill(0);
  const queue = [];
  let maximumDelta = 0;
  let subdivisionTree = 0;
  for (let i = 0, l = fixedPoints.length; i < l; ++i) {
    distances[fixedPoints[i]] = MAX_LIMIT;
  }
  function processSubdivision(params) {
    const { start, end, currentLimit } = params;
    let { record } = params;
    let usedDistance = 0;
    if (!record) {
      let usedIndex = -1;
      const vector = [
        points[end][0] - points[start][0],
        points[end][1] - points[start][1]
      ];
      for (let i = 0, l = fixedPoints.length; i < l; ++i) {
        const fixId = fixedPoints[i];
        if (fixId > start) {
          if (fixId < end) {
            usedIndex = fixId;
            usedDistance = MAX_LIMIT;
          }
          break;
        }
      }
      if (usedIndex < 0) {
        if (Math.abs(vector[0]) > MIN_DELTA || Math.abs(vector[1]) > MIN_DELTA) {
          const vectorLength = vector[0] * vector[0] + vector[1] * vector[1];
          const invVectorLength = 1 / vectorLength;
          for (let i = start + 1; i < end; ++i) {
            const segmentDistance = getSegmentDistanceSquare(
              points[i],
              points[start],
              points[end],
              vector,
              invVectorLength
            );
            if (segmentDistance > usedDistance) {
              usedIndex = i;
              usedDistance = segmentDistance;
            }
          }
        } else {
          usedIndex = Math.round((start + end) * 0.5);
          usedDistance = currentLimit;
        }
        distances[usedIndex] = usedDistance;
      }
      record = {
        start,
        end,
        index: usedIndex,
        distance: usedDistance
      };
    }
    if (record.index && record.distance > maximumDelta) {
      if (record.index - start >= 2) {
        queue.push({
          start,
          end: record.index,
          record: record.left,
          currentLimit: record.distance,
          parent: record,
          parentProperty: "left"
        });
      }
      if (end - record.index >= 2) {
        queue.push({
          start: record.index,
          end,
          record: record.right,
          currentLimit: record.distance,
          parent: record,
          parentProperty: "right"
        });
      }
    }
    return record;
  }
  function tick() {
    const request = queue.pop();
    const result = processSubdivision(request);
    if (request.parent && request.parentProperty) {
      request.parent[request.parentProperty] = result;
    }
    return result;
  }
  return (delta) => {
    maximumDelta = delta;
    queue.push({
      start: 0,
      end: len - 1,
      record: subdivisionTree,
      currentLimit: MAX_LIMIT
    });
    subdivisionTree = tick();
    while (queue.length) {
      tick();
    }
    return distances;
  };
}
function getSegmentDistanceSquare(point, segmentStart, segmentEnd, vector, invLength) {
  let vx = segmentStart[0];
  let vy = segmentStart[1];
  const projection = ((point[0] - vx) * vector[0] + (point[1] - vy) * vector[1]) * invLength;
  if (projection > 1) {
    vx = segmentEnd[0];
    vy = segmentEnd[1];
  } else if (projection > 0) {
    vx += vector[0] * projection;
    vy += vector[1] * projection;
  }
  const dx = point[0] - vx;
  const dy = point[1] - vy;
  return dx * dx + dy * dy;
}

function drawDatasets(context, state, data, range, points, projection, secondaryPoints, secondaryProjection, lineWidth, visibilities, colors, shouldConvertToBars, simplification) {
  data.datasets.forEach(({ key, type, hasOwnYAxis }, i) => {
    if (!visibilities[i]) {
      return;
    }
    const options = {
      color: getCssColor(colors, `dataset#${key}`),
      lineWidth,
      opacity: data.isStacked ? 1 : visibilities[i],
      simplification
    };
    const datasetType = type === "pie" && shouldConvertToBars ? "bar" : type;
    let datasetPoints = hasOwnYAxis ? secondaryPoints : points[i];
    const datasetProjection = hasOwnYAxis ? secondaryProjection : projection;
    if (datasetType === "area") {
      const bottomLine = [
        { labelIndex: range.from, stackValue: 0 },
        { labelIndex: range.to, stackValue: 0 }
      ];
      const lowerBoundary = points[i - 1] || bottomLine;
      const upperBoundary = points[i].slice().reverse();
      datasetPoints = [...lowerBoundary, ...upperBoundary];
    }
    if (datasetType === "pie") {
      options.center = projection.getCenter();
      options.radius = getPieRadius(projection);
      options.shift = (state[`pieShift#${key}`] || 0) * PLOT_PIE_SHIFT;
      options.isDonut = data.isDonut;
      options.withGradient = data.withGradient;
    }
    if (datasetType === "bar") {
      const [x0] = projection.toPixels(0, 0);
      const [x1] = projection.toPixels(1, 0);
      options.lineWidth = x1 - x0;
      options.focusOn = state.focusOn;
    }
    drawDataset(datasetType, context, datasetPoints, datasetProjection, options);
  });
  if (state.focusOn !== void 0 && state.focusOn !== NO_FOCUS && (data.isBars || data.isSteps)) {
    const [x0] = projection.toPixels(0, 0);
    const [x1] = projection.toPixels(1, 0);
    drawBarsMask(context, projection, {
      focusOn: state.focusOn,
      color: getCssColor(colors, "mask"),
      lineWidth: data.isSteps ? x1 - x0 + lineWidth : x1 - x0
    });
  }
}
function drawDataset(type, context, points, projection, options) {
  switch (type) {
    case "line":
      return drawDatasetLine(context, points, projection, options);
    case "bar":
      return drawDatasetBars(context, points, projection, options);
    case "step":
      return drawDatasetSteps(context, points, projection, options);
    case "area":
      return drawDatasetArea(context, points, projection, options);
    case "pie":
      return drawDatasetPie(context, points, projection, options);
  }
}
function drawDatasetLine(context, points, projection, options) {
  context.beginPath();
  const segments = [];
  let current = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const point = points[j];
    if (point.isGap) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(projection.toPixels(point.labelIndex, point.stackValue));
  }
  if (current.length) segments.push(current);
  segments.forEach((segment) => {
    let pixels = segment;
    if (options.simplification) {
      pixels = simplify(pixels)(options.simplification).points;
    }
    pixels.forEach(([x, y], k) => {
      if (k === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });
  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = "bevel";
  context.lineCap = "butt";
  context.stroke();
  context.restore();
}
function drawDatasetBars(context, points, projection, options) {
  const { yMin } = projection.getParams();
  context.save();
  context.globalAlpha = options.opacity;
  context.fillStyle = options.color;
  for (let j = 0, l = points.length; j < l; j++) {
    if (points[j].isGap) continue;
    const { labelIndex, stackValue, stackOffset = 0 } = points[j];
    const [, yFrom] = projection.toPixels(labelIndex, Math.max(stackOffset, yMin));
    const [x, yTo] = projection.toPixels(labelIndex, stackValue);
    const rectX = x - options.lineWidth / 2;
    const rectY = yTo;
    const rectW = options.opacity === 1 ? options.lineWidth + PLOT_BARS_WIDTH_SHIFT : options.lineWidth + PLOT_BARS_WIDTH_SHIFT * options.opacity;
    const rectH = yFrom - yTo;
    context.fillRect(rectX, rectY, rectW, rectH);
  }
  context.restore();
}
function drawDatasetSteps(context, points, projection, options) {
  context.beginPath();
  const segments = [];
  let current = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const point = points[j];
    if (point.isGap) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(
      projection.toPixels(point.labelIndex - PLOT_BARS_WIDTH_SHIFT, point.stackValue),
      projection.toPixels(point.labelIndex + PLOT_BARS_WIDTH_SHIFT, point.stackValue)
    );
  }
  if (current.length) segments.push(current);
  segments.forEach((segment) => {
    segment.forEach(([x, y], k) => {
      if (k === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });
  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.stroke();
  context.restore();
}
function drawBarsMask(context, projection, options) {
  const [xCenter, yCenter] = projection.getCenter();
  const [width, height] = projection.getSize();
  const [x] = projection.toPixels(options.focusOn, 0);
  context.fillStyle = options.color;
  context.fillRect(
    xCenter - width / 2,
    yCenter - height / 2,
    x - options.lineWidth / 2 + PLOT_BARS_WIDTH_SHIFT,
    height
  );
  context.fillRect(x + options.lineWidth / 2, yCenter - height / 2, width - (x + options.lineWidth / 2), height);
}
function drawDatasetArea(context, points, projection, options) {
  context.beginPath();
  let pixels = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue } = points[j];
    pixels.push(projection.toPixels(labelIndex, stackValue));
  }
  if (options.simplification) {
    const simplifierFn = simplify(pixels);
    pixels = simplifierFn(options.simplification).points;
  }
  pixels.forEach(([x, y]) => {
    context.lineTo(x, y);
  });
  context.save();
  context.fillStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = "bevel";
  context.lineCap = "butt";
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
  const { radius = 120, center: [x, y] = [0, 0], shift = 0, isDonut, withGradient } = options;
  const innerRadius = isDonut ? radius * PIE_DONUT_INNER_RADIUS_FACTOR : 0;
  const shiftAngle = (beginAngle + endAngle) / 2;
  const directionX = Math.cos(shiftAngle);
  const directionY = Math.sin(shiftAngle);
  const shiftX = directionX * shift;
  const shiftY = directionY * shift;
  context.save();
  context.beginPath();
  context.fillStyle = withGradient ? buildPieGradient(context, x + shiftX, y + shiftY, innerRadius, radius, options.color) : options.color;
  if (isDonut) {
    context.arc(x + shiftX, y + shiftY, radius, beginAngle, endAngle);
    context.arc(x + shiftX, y + shiftY, innerRadius, endAngle, beginAngle, true);
    context.closePath();
  } else {
    context.moveTo(x + shiftX, y + shiftY);
    context.arc(x + shiftX, y + shiftY, radius, beginAngle, endAngle);
    context.lineTo(x + shiftX, y + shiftY);
  }
  context.fill();
  if (percent >= PIE_MINIMUM_VISIBLE_PERCENT) {
    const fontFamily = getComputedStyle(context.canvas).fontFamily || "sans-serif";
    context.font = `700 ${getPieTextSize(percent, radius)}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";
    const textShift = isDonut ? (radius + innerRadius) / 2 : getPieTextShift(percent, radius);
    context.fillText(
      `${Math.round(percent * 100)}%`,
      x + directionX * textShift + shiftX,
      y + directionY * textShift + shiftY
    );
  }
  context.restore();
}
function buildPieGradient(context, cx, cy, innerRadius, radius, color) {
  const channels = parseRgba(color);
  const gradient = context.createRadialGradient(cx, cy, innerRadius, cx, cy, radius);
  gradient.addColorStop(0, shadeColor(channels, 0.1));
  gradient.addColorStop(1, shadeColor(channels, -0.1));
  return gradient;
}
function parseRgba(color) {
  const channels = color.match(/[\d.]+/g);
  return channels ? channels.map(Number) : [0, 0, 0, 1];
}
function shadeColor([r, g, b, a = 1], amount) {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel) => Math.round(channel + (target - channel) * t);
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${a})`;
}

function toggleText(element, newText, className = "", inverse = false) {
  const container = element.parentNode;
  container.classList.add("lovely-chart--transition-container");
  const newElement = createElement(element.tagName);
  newElement.className = `${className} lovely-chart--transition lovely-chart--position-${inverse ? "top" : "bottom"} lovely-chart--state-hidden`;
  newElement.textContent = newText;
  const selector = className.length ? `.${className.split(" ").join(".")}` : "";
  const oldElements = container.querySelectorAll(`${selector}.lovely-chart--state-hidden`);
  oldElements.forEach((oldElement) => oldElement.remove());
  element.classList.add("lovely-chart--transition");
  element.classList.remove("lovely-chart--position-bottom", "lovely-chart--position-top");
  element.classList.add(inverse ? "lovely-chart--position-bottom" : "lovely-chart--position-top");
  container.insertBefore(newElement, element.nextSibling);
  toggleElementIn(newElement);
  toggleElementOut(element);
  return newElement;
}
function toggleElementIn(element) {
  element.classList.remove("lovely-chart--state-animated");
  element.classList.add("lovely-chart--state-animated");
  element.classList.remove("lovely-chart--state-hidden");
}
function toggleElementOut(element) {
  element.classList.remove("lovely-chart--state-animated");
  element.classList.add("lovely-chart--state-animated");
  element.classList.add("lovely-chart--state-hidden");
}

const CAPTION_THROTTLE_MS = 100;
const ZOOM_OUT_BIND_DELAY = 500;
class Header {
  #container;
  #title;
  #zoomOutLabel;
  #zoomOutCallback;
  #element;
  #titleElement;
  #zoomOutElement;
  #captionElement;
  #isZooming;
  #zoomBindTimeout;
  setCaption = throttle((caption) => this.#setCaption(caption), CAPTION_THROTTLE_MS, false);
  constructor(container, title, zoomOutLabel = "Zoom out", zoomOutCallback) {
    this.#container = container;
    this.#title = title;
    this.#zoomOutLabel = zoomOutLabel;
    this.#zoomOutCallback = zoomOutCallback;
    this.#setupLayout();
  }
  zoom(caption) {
    this.#zoomOutElement = toggleText(
      this.#titleElement,
      this.#zoomOutLabel,
      "lovely-chart--header-title lovely-chart--header-zoom-out-control"
    );
    this.#zoomBindTimeout = window.setTimeout(() => {
      this.#zoomBindTimeout = void 0;
      addEventListener(this.#zoomOutElement, "click", this.#onZoomOut);
    }, ZOOM_OUT_BIND_DELAY);
    this.#setCaption(caption);
  }
  destroy() {
    if (this.#zoomBindTimeout !== void 0) {
      clearTimeout(this.#zoomBindTimeout);
      this.#zoomBindTimeout = void 0;
    }
  }
  toggleIsZooming(isZooming) {
    this.#isZooming = isZooming;
  }
  #setCaption(caption) {
    if (this.#isZooming) {
      return;
    }
    this.#captionElement.textContent = caption;
  }
  #setupLayout() {
    this.#element = createElement();
    this.#element.className = "lovely-chart--header";
    this.#titleElement = createElement();
    this.#titleElement.className = "lovely-chart--header-title";
    this.#titleElement.textContent = this.#title;
    this.#element.appendChild(this.#titleElement);
    this.#captionElement = createElement();
    this.#captionElement.className = "lovely-chart--header-caption lovely-chart--position-right";
    this.#element.appendChild(this.#captionElement);
    this.#container.appendChild(this.#element);
  }
  #onZoomOut = () => {
    this.#titleElement = toggleText(this.#zoomOutElement, this.#title, "lovely-chart--header-title", true);
    this.#titleElement.classList.remove("lovely-chart--transition");
    this.#zoomOutCallback();
  };
}

function captureEvents(element, options) {
  let captureEvent;
  let longPressTimeout;
  function onCapture(e) {
    captureEvent = e;
    if (e.type === "mousedown") {
      addEventListener(document, "mousemove", onMove);
      addEventListener(document, "mouseup", onRelease);
    } else if (e.type === "touchstart") {
      addEventListener(document, "touchmove", onMove);
      addEventListener(document, "touchend", onRelease);
      addEventListener(document, "touchcancel", onRelease);
      if (e.pageX === void 0) {
        e.pageX = e.touches[0].pageX;
      }
    }
    if (options.draggingCursor) {
      document.documentElement.classList.add(`cursor-${options.draggingCursor}`);
    }
    options.onCapture?.(e);
    if (options.onLongPress) {
      longPressTimeout = window.setTimeout(() => options.onLongPress(), LONG_PRESS_TIMEOUT);
    }
  }
  function onRelease(e) {
    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = void 0;
      }
      if (options.draggingCursor) {
        document.documentElement.classList.remove(`cursor-${options.draggingCursor}`);
      }
      removeEventListener(document, "mouseup", onRelease);
      removeEventListener(document, "mousemove", onMove);
      removeEventListener(document, "touchcancel", onRelease);
      removeEventListener(document, "touchend", onRelease);
      removeEventListener(document, "touchmove", onMove);
      captureEvent = void 0;
      options.onRelease?.(e);
    }
  }
  function onMove(e) {
    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = void 0;
      }
      if (e.type === "touchmove" && e.pageX === void 0) {
        e.pageX = e.touches[0].pageX;
      }
      options.onDrag?.(e, captureEvent, {
        dragOffsetX: e.pageX - captureEvent.pageX
      });
    }
  }
  addEventListener(element, "mousedown", onCapture);
  addEventListener(element, "touchstart", onCapture);
}

function preparePoints(data, datasets, range, visibilities, bounds, shouldConvertToArea) {
  let values = datasets.map(({ values: values2 }) => values2.slice(range.from, range.to + 1));
  if (data.isPie && !shouldConvertToArea) {
    values = prepareSumsByX(values);
  }
  const points = values.map((datasetValues, i) => datasetValues.map((value, j) => {
    const isGap = value === GAP;
    let visibleValue = isGap ? 0 : value;
    if (data.isStacked && !isGap) {
      visibleValue *= visibilities[i];
    }
    return {
      labelIndex: range.from + j,
      value,
      visibleValue,
      stackOffset: 0,
      stackValue: visibleValue,
      isGap
    };
  }));
  if (data.isPercentage) {
    preparePercentage(points, bounds);
  }
  if (data.isStacked) {
    prepareStacked(points);
  }
  return points;
}
function preparePercentage(points, bounds) {
  const sumsByY = getSumsByY(points);
  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      point.percent = point.visibleValue / sumsByY[j];
      point.visibleValue = point.percent * bounds.yMax;
    });
  });
}
function getSumsByY(points) {
  return sumArrays(points.map((datasetPoints) => datasetPoints.map(({ visibleValue }) => visibleValue)));
}
function prepareStacked(points) {
  const posAccum = [];
  const negAccum = [];
  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      posAccum[j] ??= 0;
      negAccum[j] ??= 0;
      if (point.isGap) {
        point.stackOffset = posAccum[j];
        point.stackValue = posAccum[j];
        return;
      }
      if (point.visibleValue >= 0) {
        point.stackOffset = posAccum[j];
        posAccum[j] += point.visibleValue;
        point.stackValue = posAccum[j];
      } else {
        point.stackOffset = negAccum[j];
        negAccum[j] += point.visibleValue;
        point.stackValue = negAccum[j];
      }
    });
  });
}
function prepareSumsByX(values) {
  return values.map((datasetValues) => [datasetValues.reduce((sum, value) => sum + (value ?? 0), 0)]);
}

class Projection {
  #params;
  #totalXWidth;
  #withColumns;
  #availableWidth;
  #availableHeight;
  #effectiveHeight;
  #xFactor;
  #xOffsetPx;
  #yFactor;
  #yOffsetPx;
  constructor(params) {
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
      withColumns = false
    } = params;
    this.#params = params;
    this.#totalXWidth = totalXWidth;
    this.#withColumns = withColumns;
    this.#availableWidth = availableWidth;
    this.#availableHeight = availableHeight;
    const xUnitsCount = withColumns ? totalXWidth + 1 : totalXWidth;
    const xRatio = end !== begin ? end - begin : 1;
    const baseXFactor = availableWidth / (xRatio * xUnitsCount);
    const leftPadding = Math.max(0, xPadding - begin * xUnitsCount * baseXFactor);
    const rightPadding = Math.max(0, xPadding - (1 - end) * xUnitsCount * baseXFactor);
    const effectiveWidth = availableWidth - leftPadding - rightPadding;
    this.#xFactor = effectiveWidth / (xRatio * xUnitsCount);
    this.#xOffsetPx = begin * xUnitsCount * this.#xFactor - leftPadding;
    if (withColumns) {
      this.#xOffsetPx -= this.#xFactor / 2;
    }
    this.#effectiveHeight = availableHeight - yPadding;
    this.#yFactor = this.#effectiveHeight / (yMax - yMin);
    this.#yOffsetPx = yMin * this.#yFactor;
  }
  toPixels(labelIndex, value) {
    return [
      labelIndex * this.#xFactor - this.#xOffsetPx,
      this.#availableHeight - (value * this.#yFactor - this.#yOffsetPx)
    ];
  }
  findClosestLabelIndex(xPx) {
    const labelIndex = Math.round((xPx + this.#xOffsetPx) / this.#xFactor);
    return this.#withColumns ? Math.max(0, Math.min(labelIndex, this.#totalXWidth)) : labelIndex;
  }
  copy(overrides) {
    return new Projection(mergeProxied(this.#params, overrides));
  }
  getCenter() {
    return [
      this.#availableWidth / 2,
      this.#availableHeight - this.#effectiveHeight / 2
    ];
  }
  getSize() {
    return [this.#availableWidth, this.#effectiveHeight];
  }
  getParams() {
    return this.#params;
  }
}

class Minimap {
  #container;
  #data;
  #colors;
  #rangeCallback;
  #element;
  #canvas;
  #context;
  #canvasSize;
  #ruler;
  #slider;
  #limitMask;
  #capturedOffset;
  #range = {};
  #state;
  #limitBegin;
  #updateRulerOnRaf = throttleWithRaf(() => this.#updateRuler());
  constructor(container, data, colors, rangeCallback) {
    this.#container = container;
    this.#data = data;
    this.#colors = colors;
    this.#rangeCallback = rangeCallback;
    this.#limitBegin = data.limitBegin;
    this.#setupLayout();
    this.#updateRange(data.minimapRange ?? DEFAULT_RANGE);
  }
  update(newState) {
    const { begin, end } = newState;
    if (!this.#capturedOffset) {
      this.#updateRange({ begin, end }, true);
    }
    if (this.#data.datasets.length >= MINIMAP_MAX_ANIMATED_DATASETS) {
      newState = newState.static;
    }
    if (!this.#isStateChanged(newState)) {
      return;
    }
    this.#state = mergeProxied(newState, { focusOn: NO_FOCUS });
    clearCanvas(this.#canvas, this.#context);
    this.#drawDatasets(this.#state);
  }
  toggle(shouldShow) {
    this.#element.classList.toggle("lovely-chart--state-hidden", !shouldShow);
    requestAnimationFrame(() => {
      this.#element.classList.toggle("lovely-chart--state-transparent", !shouldShow);
    });
  }
  #setupLayout() {
    this.#element = createElement();
    this.#element.className = "lovely-chart--minimap";
    this.#element.style.height = `${MINIMAP_HEIGHT}px`;
    this.#setupCanvas();
    this.#setupRuler();
    this.#setupLimitMask();
    this.#container.appendChild(this.#element);
    this.#canvasSize = {
      width: this.#canvas.offsetWidth,
      height: this.#canvas.offsetHeight
    };
  }
  #getSize() {
    return {
      width: this.#container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT
    };
  }
  #setupCanvas() {
    const { canvas, context } = setupCanvas(this.#element, this.#getSize());
    this.#canvas = canvas;
    this.#context = context;
  }
  #setupRuler() {
    this.#ruler = createElement();
    this.#ruler.className = "lovely-chart--minimap-ruler";
    this.#ruler.innerHTML = '<div class="lovely-chart--minimap-mask"></div><div class="lovely-chart--minimap-slider"><div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div><div class="lovely-chart--minimap-slider-inner"></div><div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div></div><div class="lovely-chart--minimap-mask"></div>';
    this.#slider = this.#ruler.children[1];
    captureEvents(
      this.#slider.children[1],
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onSliderDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: "grabbing"
      }
    );
    captureEvents(
      this.#slider.children[0],
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onLeftEarDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: "ew-resize"
      }
    );
    captureEvents(
      this.#slider.children[2],
      {
        onCapture: this.#onDragCapture,
        onDrag: this.#onRightEarDrag,
        onRelease: this.#onDragRelease,
        draggingCursor: "ew-resize"
      }
    );
    this.#element.appendChild(this.#ruler);
  }
  #setupLimitMask() {
    if (this.#limitBegin === void 0) return;
    this.#limitMask = createElement();
    this.#limitMask.className = "lovely-chart--minimap-limit-mask";
    this.#limitMask.style.width = `${this.#limitBegin * 100}%`;
    this.#limitMask.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16.5265 10.2173V7.54299C16.5265 5.08532 14.4958 3.08585 11.9997 3.08585C9.50365 3.08585 7.47293 5.08532 7.47293 7.54299V10.2173C6.2992 10.2173 5.36524 11.2011 5.42629 12.3733L5.60706 15.844C5.6879 17.3962 5.72833 18.1723 6.00269 18.7852C6.39058 19.6518 7.10506 20.33 7.9906 20.6723C8.61698 20.9144 9.39412 20.9144 10.9484 20.9144H13.051C14.6053 20.9144 15.3825 20.9144 16.0088 20.6723C16.8944 20.33 17.6089 19.6518 17.9967 18.7852C18.2711 18.1723 18.3115 17.3962 18.3924 15.844L18.5731 12.3733C18.6342 11.2011 17.7002 10.2173 16.5265 10.2173ZM11.9997 4.8687C10.5023 4.8687 9.28364 6.06857 9.28364 7.54299V10.2173H14.7158V7.54299C14.7158 6.06857 13.4972 4.8687 11.9997 4.8687Z" fill="currentColor"/>
      </svg>`;
    if (this.#data.onLimitedRangeClick) {
      this.#limitMask.classList.add("lovely-chart--state-interactive");
      this.#limitMask.addEventListener("click", this.#data.onLimitedRangeClick);
    }
    this.#element.appendChild(this.#limitMask);
  }
  #isStateChanged(newState) {
    if (!this.#state) {
      return true;
    }
    const { datasets } = this.#data;
    if (datasets.some(({ key }) => this.#state[`opacity#${key}`] !== newState[`opacity#${key}`])) {
      return true;
    }
    if (this.#state.yMaxMinimap !== newState.yMaxMinimap) {
      return true;
    }
    return false;
  }
  #drawDatasets(state = {}) {
    const { datasets } = this.#data;
    const range = {
      from: 0,
      to: state.totalXWidth
    };
    const boundsAndParams = {
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: this.#canvasSize.width,
      availableHeight: this.#canvasSize.height,
      yPadding: 1,
      withColumns: this.#data.isBars || this.#data.isSteps || this.#data.isPie
    };
    const visibilities = datasets.map(({ key }) => this.#state[`opacity#${key}`]);
    const points = preparePoints(this.#data, datasets, range, visibilities, boundsAndParams, true);
    const projection = new Projection(boundsAndParams);
    let secondaryPoints;
    let secondaryProjection;
    if (this.#data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = { yMin: state.yMinMinimapSecond, yMax: state.yMaxMinimapSecond };
      secondaryPoints = preparePoints(this.#data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }
    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_MINIMAP_FACTOR;
    drawDatasets(
      this.#context,
      state,
      this.#data,
      range,
      points,
      projection,
      secondaryPoints,
      secondaryProjection,
      MINIMAP_LINE_WIDTH,
      visibilities,
      this.#colors,
      true,
      simplification
    );
  }
  #onDragCapture = (e) => {
    e.preventDefault();
    this.#capturedOffset = e.target.offsetLeft;
  };
  #onDragRelease = () => {
    this.#capturedOffset = void 0;
  };
  #onSliderDrag = (moveEvent, captureEvent, { dragOffsetX }) => {
    const limitX = this.#limitBegin !== void 0 ? this.#limitBegin * this.#canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = this.#canvasSize.width - this.#slider.offsetWidth;
    const newX1 = Math.max(minX1, Math.min(this.#capturedOffset + dragOffsetX - MINIMAP_EAR_WIDTH, maxX1));
    const newX2 = newX1 + this.#slider.offsetWidth;
    const begin = newX1 / this.#canvasSize.width;
    const end = newX2 / this.#canvasSize.width;
    this.#updateRange({ begin, end });
  };
  #onLeftEarDrag = (moveEvent, captureEvent, { dragOffsetX }) => {
    const limitX = this.#limitBegin !== void 0 ? this.#limitBegin * this.#canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = this.#slider.offsetLeft + this.#slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;
    const newX1 = Math.min(maxX1, Math.max(minX1, this.#capturedOffset + dragOffsetX));
    const begin = newX1 / this.#canvasSize.width;
    this.#updateRange({ begin });
  };
  #onRightEarDrag = (moveEvent, captureEvent, { dragOffsetX }) => {
    const minX2 = this.#slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = this.#canvasSize.width;
    const newX2 = Math.max(minX2, Math.min(this.#capturedOffset + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / this.#canvasSize.width;
    this.#updateRange({ end });
  };
  #updateRange(range, isExternal) {
    let nextRange = { ...this.#range, ...range };
    if (this.#state?.minimapDelta && !isExternal) {
      nextRange = this.#adjustDiscreteRange(nextRange);
    }
    if (this.#limitBegin !== void 0 && nextRange.begin < this.#limitBegin) {
      nextRange.begin = this.#limitBegin;
    }
    if (nextRange.begin === this.#range.begin && nextRange.end === this.#range.end) {
      return;
    }
    this.#range = nextRange;
    this.#updateRulerOnRaf();
    if (!isExternal) {
      this.#rangeCallback(this.#range);
    }
  }
  #adjustDiscreteRange(nextRange) {
    const begin = Math.round(nextRange.begin / this.#state.minimapDelta) * this.#state.minimapDelta;
    const end = Math.round(nextRange.end / this.#state.minimapDelta) * this.#state.minimapDelta;
    return { begin, end };
  }
  #updateRuler() {
    const { begin, end } = this.#range;
    this.#ruler.children[0].style.width = `${begin * 100}%`;
    this.#ruler.children[1].style.width = `${(end - begin) * 100}%`;
    this.#ruler.children[2].style.width = `${(1 - end) * 100}%`;
  }
}

const SLOW_FPS_COOLDOWN = 5e3;
class TransitionManager {
  #onTick;
  #transitions = {};
  #nextFrame;
  #testStartedAt;
  #fps;
  #testingFps;
  #slowDetectedAt;
  #startedAsSlow;
  constructor(onTick) {
    this.#onTick = onTick;
  }
  add(prop, from, to, duration, options) {
    this.#transitions[prop] = {
      from,
      to,
      duration,
      options,
      current: from,
      startedAt: Date.now(),
      progress: 0
    };
    if (!this.#nextFrame) {
      this.#resetSpeedTest();
      this.#nextFrame = requestAnimationFrame(this.#tick);
    }
  }
  remove(prop) {
    delete this.#transitions[prop];
    if (!this.isRunning()) {
      cancelAnimationFrame(this.#nextFrame);
      this.#nextFrame = void 0;
    }
  }
  get(prop) {
    return this.#transitions[prop];
  }
  getState() {
    const state = {};
    Object.entries(this.#transitions).forEach(([prop, { current, from, to, progress }]) => {
      state[prop] = current;
      state[`${prop}From`] = from;
      state[`${prop}To`] = to;
      state[`${prop}Progress`] = progress;
    });
    return state;
  }
  isRunning() {
    return Boolean(Object.keys(this.#transitions).length);
  }
  isFast(force) {
    if (!force && (this.#startedAsSlow || this.#slowDetectedAt)) {
      return false;
    }
    return this.#fps === void 0 || this.#fps >= SPEED_TEST_FAST_FPS;
  }
  destroy() {
    if (this.#nextFrame) {
      cancelAnimationFrame(this.#nextFrame);
      this.#nextFrame = void 0;
    }
    this.#transitions = {};
  }
  #tick = () => {
    const isSlow = !this.isFast();
    this.#speedTest();
    const state = {};
    Object.entries(this.#transitions).forEach(([prop, item]) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = item;
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * easeOut(progress);
      if (options.includes("ceil")) {
        current = Math.ceil(current);
      } else if (options.includes("floor")) {
        current = Math.floor(current);
      }
      item.current = current;
      item.progress = progress;
      state[prop] = current;
      if (progress === 1) {
        this.remove(prop);
      }
    });
    if (!isSlow) {
      this.#onTick(state);
    }
    if (this.isRunning()) {
      this.#nextFrame = requestAnimationFrame(this.#tick);
    }
  };
  #resetSpeedTest() {
    this.#testStartedAt = void 0;
    this.#testingFps = void 0;
    if (this.#slowDetectedAt && Date.now() - this.#slowDetectedAt > SLOW_FPS_COOLDOWN) {
      this.#slowDetectedAt = void 0;
    }
    this.#startedAsSlow = Boolean(this.#slowDetectedAt) || !this.isFast(true);
  }
  #speedTest() {
    if (!this.#testStartedAt || Date.now() - this.#testStartedAt >= SPEED_TEST_INTERVAL) {
      if (this.#testingFps) {
        this.#fps = this.#testingFps;
        if (!this.#slowDetectedAt && !this.isFast(true)) {
          this.#slowDetectedAt = Date.now();
        }
      }
      this.#testStartedAt = Date.now();
      this.#testingFps = 0;
    } else {
      this.#testingFps = (this.#testingFps || 0) + 1;
    }
  }
}
function easeOut(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

class StateManager {
  #data;
  #viewportSize;
  #callback;
  #range = { begin: 0, end: 1 };
  #filter;
  #transitionConfig;
  #transitions;
  #runCallbackOnRaf;
  #state = {};
  #isDestroyed = false;
  constructor(data, viewportSize, callback) {
    this.#data = data;
    this.#viewportSize = viewportSize;
    this.#callback = callback;
    this.#filter = this.#buildDefaultFilter();
    this.#transitionConfig = this.#buildTransitionConfig();
    this.#transitions = new TransitionManager(this.#runCallback);
    this.#runCallbackOnRaf = throttleWithRaf(this.#runCallback);
  }
  update({ range = {}, filter = {}, focusOn, minimapDelta } = {}, noTransition) {
    if (this.#isDestroyed) return;
    Object.assign(this.#range, range);
    Object.assign(this.#filter, filter);
    const prevState = this.#state;
    this.#state = calculateState(
      this.#data,
      this.#viewportSize,
      this.#range,
      this.#filter,
      focusOn,
      minimapDelta,
      prevState
    );
    if (!noTransition) {
      this.#transitionConfig.forEach(({ prop, duration, options }) => {
        const transition = this.#transitions.get(prop);
        const currentTarget = transition ? transition.to : prevState[prop];
        if (currentTarget !== void 0 && currentTarget !== this.#state[prop]) {
          const current = transition ? options.includes("fast") ? prevState[prop] : transition.current : prevState[prop];
          if (transition) {
            this.#transitions.remove(prop);
          }
          this.#transitions.add(prop, current, this.#state[prop], duration, options);
        }
      });
    }
    if (!this.#transitions.isRunning() || !this.#transitions.isFast()) {
      this.#runCallbackOnRaf();
    }
  }
  hasAnimations() {
    return this.#transitions.isFast();
  }
  destroy() {
    this.#isDestroyed = true;
    this.#transitions.destroy();
  }
  #buildTransitionConfig() {
    const transitionConfig = [];
    const datasetVisibilities = this.#data.datasets.map(({ key }) => `opacity#${key} ${TRANSITION_DEFAULT_DURATION}`);
    const datasetPieShifts = this.#data.datasets.map(({ key }) => `pieShift#${key} 200`);
    [
      ...ANIMATE_PROPS,
      ...datasetVisibilities,
      ...datasetPieShifts
    ].forEach((transition) => {
      const [prop, duration, ...options] = transition.split(" ");
      transitionConfig.push({ prop, duration: duration ? Number(duration) : void 0, options });
    });
    return transitionConfig;
  }
  #buildDefaultFilter() {
    const filter = {};
    this.#data.datasets.forEach(({ key }) => {
      filter[key] = true;
    });
    return filter;
  }
  #runCallback = () => {
    if (this.#isDestroyed) return;
    const state = this.#transitions.isFast() ? mergeProxied(this.#state, this.#transitions.getState()) : this.#state;
    state.static = this.#state;
    this.#callback(state);
  };
}
function calculateState(data, viewportSize, range, filter, focusOn, minimapDelta, prevState) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length - 1;
  const labelFromIndex = Math.max(0, Math.ceil(totalXWidth * begin));
  const labelToIndex = Math.min(Math.floor(totalXWidth * end), totalXWidth);
  const xAxisScale = calculateXAxisScale(viewportSize.width, labelFromIndex, labelToIndex);
  const yRanges = data.isStacked ? calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState) : calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState);
  const yAxisScale = calculateYAxisScale(viewportSize.height, yRanges.yMinViewport, yRanges.yMaxViewport);
  const yAxisScaleSecond = data.hasSecondYAxis && calculateYAxisScale(viewportSize.height, yRanges.yMinViewportSecond, yRanges.yMaxViewportSecond);
  const yStep = yScaleLevelToStep(yAxisScale);
  yRanges.yMinViewport = Math.floor(yRanges.yMinViewport / yStep) * yStep;
  if (yAxisScaleSecond) {
    const yStepSecond = yScaleLevelToStep(yAxisScaleSecond);
    yRanges.yMinViewportSecond = Math.floor(yRanges.yMinViewportSecond / yStepSecond) * yStepSecond;
  }
  const datasetsOpacity = {};
  data.datasets.forEach(({ key }) => {
    datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });
  const extendedLabelFromIndex = Math.max(0, labelFromIndex - 1);
  const extendedLabelToIndex = Math.min(labelToIndex + 1, totalXWidth);
  const resolvedFocusOn = focusOn !== void 0 ? focusOn : prevState.focusOn;
  const datasetsPieShift = data.isPie ? calculatePieShifts(
    // For pie charts `focusOn` is never a plain label index
    data,
    viewportSize,
    filter,
    resolvedFocusOn,
    extendedLabelFromIndex,
    extendedLabelToIndex
  ) : void 0;
  return {
    totalXWidth,
    xAxisScale,
    yAxisScale,
    yAxisScaleSecond,
    labelFromIndex: extendedLabelFromIndex,
    labelToIndex: extendedLabelToIndex,
    filter: { ...filter },
    focusOn: resolvedFocusOn,
    minimapDelta: minimapDelta !== void 0 ? minimapDelta : prevState.minimapDelta,
    ...yRanges,
    ...datasetsOpacity,
    ...datasetsPieShift,
    ...range
  };
}
function calculatePieShifts(data, viewportSize, filter, pointerVector, labelFromIndex, labelToIndex) {
  const radius = Math.max(0, Math.min(
    viewportSize.width,
    viewportSize.height - X_AXIS_HEIGHT - PLOT_TOP_PADDING
  )) * PLOT_PIE_RADIUS_FACTOR;
  const sums = data.datasets.map(({ key, values }) => filter[key] ? values.slice(labelFromIndex, labelToIndex + 1).reduce((a, x) => a + (x || 0), 0) : 0);
  const total = sums.reduce((a, x) => a + x, 0);
  const shifts = {};
  let offset = 0;
  data.datasets.forEach(({ key }, i) => {
    const beginAngle = offset / total * Math.PI * 2 - Math.PI / 2;
    offset += sums[i];
    const endAngle = offset / total * Math.PI * 2 - Math.PI / 2;
    const isFocused = Boolean(
      pointerVector && pointerVector !== NO_FOCUS && beginAngle <= pointerVector.angle && pointerVector.angle < endAngle && pointerVector.distance <= radius
    );
    shifts[`pieShift#${key}`] = isFocused ? 1 : 0;
  });
  return shifts;
}
function calculateYRanges(data, filter, labelFromIndex, labelToIndex, prevState) {
  const secondaryYAxisDataset = data.hasSecondYAxis ? data.datasets.at(-1) : void 0;
  const filteredDatasets = data.datasets.filter((d) => filter[d.key] && d !== secondaryYAxisDataset);
  const yRanges = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, filteredDatasets);
  if (secondaryYAxisDataset) {
    const {
      yMinViewport: yMinViewportSecond,
      yMaxViewport: yMaxViewportSecond,
      yMinMinimap: yMinMinimapSecond,
      yMaxMinimap: yMaxMinimapSecond
    } = calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, [secondaryYAxisDataset]);
    Object.assign(yRanges, {
      yMinViewportSecond,
      yMaxViewportSecond,
      yMinMinimapSecond,
      yMaxMinimapSecond
    });
  }
  return yRanges;
}
function calculateYRangesForGroup(data, labelFromIndex, labelToIndex, prevState, datasets) {
  const { min: yMinMinimapReal = prevState.yMinMinimap, max: yMaxMinimap = prevState.yMaxMinimap } = getMaxMin(datasets.flatMap(({ yMax, yMin }) => [yMax, yMin]));
  const yMinMinimap = yMinMinimapReal < 0 ? yMinMinimapReal : yMinMinimapReal / yMaxMinimap > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinMinimapReal : 0;
  let yMinViewport;
  let yMaxViewport;
  if (labelFromIndex === 0 && labelToIndex === data.xLabels.length - 1) {
    yMinViewport = yMinMinimap;
    yMaxViewport = yMaxMinimap;
  } else {
    const filteredValues = datasets.map(({ values }) => values);
    const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex + 1));
    const viewportMaxMin = getMaxMin(viewportValues.flat());
    const yMinViewportReal = viewportMaxMin.min !== void 0 ? viewportMaxMin.min : prevState.yMinViewport;
    yMaxViewport = viewportMaxMin.max !== void 0 ? viewportMaxMin.max : prevState.yMaxViewport;
    yMinViewport = yMinViewportReal < 0 ? yMinViewportReal : yMinViewportReal / yMaxViewport > Y_AXIS_ZERO_BASED_THRESHOLD ? yMinViewportReal : 0;
  }
  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap
  };
}
function calculateYRangesStacked(data, filter, labelFromIndex, labelToIndex, prevState) {
  const filteredDatasets = data.datasets.filter((d) => filter[d.key]);
  const filteredValues = filteredDatasets.map(({ values }) => values);
  const length = filteredValues[0] ? filteredValues[0].length : 0;
  const posSums = new Array(length).fill(0);
  const negSums = new Array(length).fill(0);
  for (let i = 0; i < filteredValues.length; i++) {
    for (let j = 0; j < length; j++) {
      const value = filteredValues[i][j];
      if (value === GAP) continue;
      if (value >= 0) {
        posSums[j] += value;
      } else {
        negSums[j] += value;
      }
    }
  }
  const { max: yMaxMinimap = prevState.yMaxMinimap } = getMaxMin(posSums);
  const { min: yMinMinimap = prevState.yMinMinimap } = getMaxMin(negSums);
  const { max: yMaxViewport = prevState.yMaxViewport } = getMaxMin(posSums.slice(labelFromIndex, labelToIndex + 1));
  const { min: yMinViewport = prevState.yMinViewport } = getMaxMin(negSums.slice(labelFromIndex, labelToIndex + 1));
  return {
    yMinViewport,
    yMaxViewport,
    yMinMinimap,
    yMaxMinimap
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

const HIDE_TIMEOUT = 500;
class Tools {
  #container;
  #data;
  #filterCallback;
  #element;
  constructor(container, data, filterCallback) {
    this.#container = container;
    this.#data = data;
    this.#filterCallback = filterCallback;
    this.#setupLayout();
    this.#updateFilter();
  }
  redraw() {
    const oldElement = this.#element;
    oldElement.classList.add("lovely-chart--state-hidden");
    setTimeout(() => {
      oldElement.parentNode.removeChild(oldElement);
    }, HIDE_TIMEOUT);
    this.#setupLayout();
    this.#element.classList.add("lovely-chart--state-transparent");
    requestAnimationFrame(() => {
      this.#element.classList.remove("lovely-chart--state-transparent");
    });
  }
  #setupLayout() {
    this.#element = createElement();
    this.#element.className = "lovely-chart--tools";
    if (this.#data.datasets.length < 2) {
      this.#element.className += " lovely-chart--state-hidden";
    }
    this.#data.datasets.forEach(({ key, name }) => {
      const color = this.#data.colors[key];
      const control = createElement("a");
      control.href = "#";
      control.dataset.key = key;
      const darkContent = isColorCloseToWhite(color) ? " lovely-chart--dark-content" : "";
      control.className = `lovely-chart--button lovely-chart--color-${color.slice(1)} lovely-chart--state-checked${darkContent}`;
      const check = createElement("span");
      check.className = "lovely-chart--button-check";
      control.appendChild(check);
      const label = createElement("span");
      label.className = "lovely-chart--button-label";
      label.textContent = name;
      control.appendChild(label);
      control.addEventListener("click", (e) => {
        e.preventDefault();
        if (!control.dataset.clickPrevented) {
          this.#updateFilter(control);
        }
        delete control.dataset.clickPrevented;
      });
      captureEvents(control, {
        onLongPress: () => {
          control.dataset.clickPrevented = "true";
          this.#updateFilter(control, true);
        }
      });
      this.#element.appendChild(control);
    });
    this.#container.appendChild(this.#element);
  }
  #updateFilter(button, isLongPress = false) {
    const buttons = Array.from(this.#element.getElementsByTagName("a"));
    const isSingleChecked = this.#element.querySelectorAll(".lovely-chart--state-checked").length === 1;
    if (button) {
      if (button.classList.contains("lovely-chart--state-checked") && isSingleChecked) {
        if (isLongPress) {
          buttons.forEach((b) => b.classList.add("lovely-chart--state-checked"));
          button.classList.remove("lovely-chart--state-checked");
        } else {
          button.classList.remove("lovely-chart--state-shake");
          requestAnimationFrame(() => {
            button.classList.add("lovely-chart--state-shake");
          });
        }
      } else if (isLongPress) {
        buttons.forEach((b) => b.classList.remove("lovely-chart--state-checked"));
        button.classList.add("lovely-chart--state-checked");
      } else {
        button.classList.toggle("lovely-chart--state-checked");
      }
    }
    const filter = {};
    buttons.forEach((input) => {
      filter[input.dataset.key] = input.classList.contains("lovely-chart--state-checked");
    });
    this.#filterCallback(filter);
  }
}

const CONTENT_THROTTLE_MS = 100;
const CIRCLE_RADIUS = 4;
const CIRCLE_LINE_WIDTH = 2;
class Tooltip {
  #container;
  #data;
  #plotSize;
  #colors;
  #onZoom;
  #onFocus;
  #state;
  #points;
  #projection;
  #secondaryPoints;
  #secondaryProjection;
  #element;
  #canvas;
  #context;
  #balloon;
  #offsetX;
  #offsetY;
  #clickedOnLabel;
  #isZoomed = false;
  #isZooming = false;
  #documentMoveEvent;
  #selectLabelOnRaf = throttleWithRaf((isExternal) => this.#selectLabel(isExternal));
  #throttledUpdateContent = throttle(
    (title, statistics) => this.#updateContent(title, statistics),
    CONTENT_THROTTLE_MS,
    true
  );
  constructor(container, data, plotSize, colors, onZoom, onFocus) {
    this.#container = container;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
    this.#onZoom = onZoom;
    this.#onFocus = onFocus;
    this.#setupLayout();
  }
  update(state, points, projection, secondaryPoints, secondaryProjection) {
    this.#state = state;
    this.#points = points;
    this.#projection = projection;
    this.#secondaryPoints = secondaryPoints;
    this.#secondaryProjection = secondaryProjection;
    this.#selectLabel(true);
  }
  toggleLoading(isLoading) {
    this.#balloon.classList.toggle("lovely-chart--state-loading", isLoading);
    if (!isLoading) {
      this.#clear();
    }
  }
  toggleIsZoomed(isZoomed) {
    if (isZoomed !== this.#isZoomed) {
      this.#isZooming = true;
    }
    this.#isZoomed = isZoomed;
    this.#balloon.classList.toggle("lovely-chart--state-inactive", isZoomed);
  }
  destroy() {
    removeEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
    this.#documentMoveEvent = void 0;
  }
  #setupLayout() {
    this.#element = createElement();
    this.#element.className = `lovely-chart--tooltip`;
    this.#setupCanvas();
    this.#setupBalloon();
    if ("ontouchstart" in window) {
      addEventListener(this.#element, "touchmove", this.#onMouseMove);
      addEventListener(this.#element, "touchstart", this.#onMouseMove);
      this.#documentMoveEvent = "touchstart";
      addEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
    } else {
      addEventListener(this.#element, "mousemove", this.#onMouseMove);
      addEventListener(this.#element, "click", this.#onClick);
      this.#documentMoveEvent = "mousemove";
      addEventListener(document, this.#documentMoveEvent, this.#onDocumentMove);
    }
    this.#container.appendChild(this.#element);
  }
  #setupCanvas() {
    const { canvas, context } = setupCanvas(this.#element, this.#plotSize);
    this.#canvas = canvas;
    this.#context = context;
  }
  #setupBalloon() {
    this.#balloon = createElement();
    this.#balloon.className = `lovely-chart--tooltip-balloon${!this.#data.isZoomable ? " lovely-chart--state-inactive" : ""}`;
    this.#balloon.innerHTML = `
      <div class="lovely-chart--tooltip-title"></div>
      <div class="lovely-chart--tooltip-legend"></div>
      <div class="lovely-chart--spinner"></div>`;
    if ("ontouchstart" in window && this.#data.isZoomable) {
      addEventListener(this.#balloon, "click", this.#onBalloonClick);
    }
    this.#element.appendChild(this.#balloon);
  }
  #onMouseMove = (e) => {
    if (e.target === this.#balloon || this.#balloon.contains(e.target) || this.#clickedOnLabel !== void 0) {
      return;
    }
    this.#isZooming = false;
    const event = e;
    const pageOffset = this.#getPageOffset(this.#element);
    this.#offsetX = (event.touches ? event.touches[0].clientX : event.clientX) - pageOffset.left;
    this.#offsetY = (event.touches ? event.touches[0].clientY : event.clientY) - pageOffset.top;
    this.#selectLabelOnRaf();
  };
  #onDocumentMove = (e) => {
    if (this.#offsetX !== void 0 && e.target !== this.#element && !this.#element.contains(e.target)) {
      this.#clear();
    }
  };
  #onClick = (e) => {
    if (this.#isZooming || !this.#data.isZoomable) {
      return;
    }
    const oldLabelIndex = this.#clickedOnLabel;
    this.#clickedOnLabel = void 0;
    this.#onMouseMove(e);
    const newLabelIndex = this.#getLabelIndex();
    if (newLabelIndex !== oldLabelIndex) {
      this.#clickedOnLabel = newLabelIndex;
    }
    this.#onZoom(newLabelIndex);
  };
  #onBalloonClick = () => {
    if (this.#balloon.classList.contains("lovely-chart--state-inactive")) {
      return;
    }
    const labelIndex = this.#projection.findClosestLabelIndex(this.#offsetX);
    this.#onZoom(labelIndex);
  };
  #clear(isExternal) {
    this.#offsetX = void 0;
    this.#clickedOnLabel = void 0;
    clearCanvas(this.#canvas, this.#context);
    this.#hideBalloon();
    if (!isExternal) {
      this.#onFocus?.(NO_FOCUS);
    }
  }
  #getLabelIndex() {
    const labelIndex = this.#projection.findClosestLabelIndex(this.#offsetX);
    return labelIndex < this.#state.labelFromIndex || labelIndex > this.#state.labelToIndex ? void 0 : labelIndex;
  }
  #selectLabel(isExternal) {
    if (this.#offsetX === void 0 || !this.#state || this.#isZooming) {
      return;
    }
    const labelIndex = this.#getLabelIndex();
    if (labelIndex === void 0) {
      this.#clear(isExternal);
      return;
    }
    const pointerVector = this.#getPointerVector();
    const shouldShowBalloon = this.#data.isPie ? pointerVector.distance <= getPieRadius(this.#projection) : true;
    if (!isExternal) {
      if (this.#data.isPie) {
        this.#onFocus?.(pointerVector);
      } else {
        this.#onFocus?.(labelIndex);
      }
    }
    const getValue = (values, labelIndex2) => {
      if (this.#data.isPie) {
        return values.slice(this.#state.labelFromIndex, this.#state.labelToIndex + 1).reduce((a, x) => a + (x ?? 0), 0);
      }
      return values[labelIndex2];
    };
    const [xPx] = this.#projection.toPixels(labelIndex, 0);
    const statistics = this.#data.datasets.map(({ key, name, values, hasOwnYAxis }, i) => ({
      key,
      name,
      value: getValue(values, labelIndex),
      hasOwnYAxis,
      originalIndex: i
    })).filter(({ key }) => this.#state.filter[key]);
    if (statistics.length && shouldShowBalloon) {
      this.#updateBalloon(statistics, labelIndex);
    } else {
      this.#hideBalloon();
    }
    clearCanvas(this.#canvas, this.#context);
    if (this.#data.isLines || this.#data.isAreas) {
      if (this.#data.isLines) {
        this.#drawCircles(statistics, labelIndex);
      }
      this.#drawTail(xPx, this.#plotSize.height - X_AXIS_HEIGHT, getCssColor(this.#colors, "grid-lines"));
    }
  }
  #drawCircles(statistics, labelIndex) {
    statistics.forEach(({ value, key, hasOwnYAxis, originalIndex }) => {
      if (value === GAP) return;
      const pointIndex = labelIndex - this.#state.labelFromIndex;
      const point = hasOwnYAxis ? this.#secondaryPoints[pointIndex] : this.#points[originalIndex][pointIndex];
      if (!point) {
        return;
      }
      const [x, y] = hasOwnYAxis ? this.#secondaryProjection.toPixels(labelIndex, point.stackValue) : this.#projection.toPixels(labelIndex, point.stackValue);
      this.#drawCircle(
        [x, y],
        getCssColor(this.#colors, `dataset#${key}`),
        getCssColor(this.#colors, "background")
      );
    });
  }
  #drawCircle([xPx, yPx], strokeColor, fillColor) {
    this.#context.strokeStyle = strokeColor;
    this.#context.fillStyle = fillColor;
    this.#context.lineWidth = CIRCLE_LINE_WIDTH;
    this.#context.beginPath();
    this.#context.arc(xPx, yPx, CIRCLE_RADIUS, 0, 2 * Math.PI);
    this.#context.fill();
    this.#context.stroke();
  }
  #drawTail(xPx, height, color) {
    this.#context.strokeStyle = color;
    this.#context.lineWidth = 1;
    this.#context.beginPath();
    this.#context.moveTo(xPx, 0);
    this.#context.lineTo(xPx, height);
    this.#context.stroke();
  }
  #getBalloonLeftOffset(labelIndex) {
    const meanLabel = (this.#state.labelFromIndex + this.#state.labelToIndex) / 2;
    const { angle } = this.#getPointerVector();
    const shouldPlaceRight = this.#data.isPie ? angle > Math.PI / 2 : labelIndex < meanLabel;
    const leftOffset = shouldPlaceRight ? this.#offsetX + BALLOON_OFFSET : this.#offsetX - (this.#balloon.offsetWidth + BALLOON_OFFSET);
    return Math.min(Math.max(0, leftOffset), this.#container.offsetWidth - this.#balloon.offsetWidth);
  }
  #getBalloonTopOffset() {
    return this.#data.isPie ? `${this.#offsetY}px` : 0;
  }
  #updateBalloon(statistics, labelIndex) {
    this.#balloon.style.transform = `translate3D(${this.#getBalloonLeftOffset(labelIndex)}px, ${this.#getBalloonTopOffset()}, 0)`;
    this.#balloon.classList.add("lovely-chart--state-shown");
    if (this.#data.isPie) {
      this.#updateContent(void 0, statistics);
    } else {
      this.#throttledUpdateContent(this.#getTitle(this.#data, labelIndex), statistics);
    }
  }
  #getTitle(data, labelIndex) {
    switch (data.tooltipFormatter) {
      case "statsFormatDayHourFull":
        return formatDayHourFull(data.xLabels[labelIndex].value);
      case "statsTooltipFormat('day')":
        return getLabelDate(data.xLabels[labelIndex]);
      case "statsTooltipFormat('hour')":
      case "statsTooltipFormat('5min')":
        return getLabelTime(data.xLabels[labelIndex]);
      default:
        return data.xLabels[labelIndex].text;
    }
  }
  // The angular offset must come from the item's position in the original
  // (dataset-order) statistics — sectors are drawn in that order, while the
  // displayed entries are sorted by value
  #isPieSectorSelected(statistics, statItem, totalValue, pointerVector) {
    const index = statistics.indexOf(statItem);
    const { value } = statItem;
    const offset = index > 0 ? statistics.slice(0, index).reduce((a, x) => a + (x.value ?? 0), 0) : 0;
    const beginAngle = offset / totalValue * Math.PI * 2 - Math.PI / 2;
    const endAngle = (offset + (value ?? 0)) / totalValue * Math.PI * 2 - Math.PI / 2;
    return Boolean(pointerVector) && beginAngle <= pointerVector.angle && pointerVector.angle < endAngle && pointerVector.distance <= getPieRadius(this.#projection);
  }
  #updateTitle(title) {
    const titleContainer = this.#balloon.children[0];
    if (this.#data.isPie) {
      titleContainer.style.display = "none";
      return;
    }
    if (titleContainer.style.display === "none") {
      titleContainer.style.display = "";
    }
    const currentTitle = titleContainer.querySelector(":not(.lovely-chart--state-hidden)");
    if (!titleContainer.textContent || !currentTitle) {
      const newTitle = createElement("span");
      newTitle.textContent = title;
      titleContainer.replaceChildren(newTitle);
    } else {
      currentTitle.textContent = title;
    }
  }
  #insertNewDataSet(dataSetContainer, { name, key, value }, totalValue) {
    const colorHex = this.#data.colors[key];
    const colorClass = isColorCloseToBackground(this.#colors, colorHex) ? "" : ` lovely-chart--color-${colorHex.slice(1)}`;
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right${colorClass}`;
    const newDataSet = createElement();
    newDataSet.className = "lovely-chart--tooltip-dataset";
    newDataSet.setAttribute("data-present", "true");
    newDataSet.setAttribute("data-name", name);
    const titleElement = createElement("span");
    titleElement.className = "lovely-chart--dataset-title";
    titleElement.textContent = name;
    newDataSet.appendChild(titleElement);
    const valueElement = createElement("span");
    valueElement.className = className;
    valueElement.textContent = this.#formatValue(value);
    newDataSet.appendChild(valueElement);
    this.#renderPercentageValue(newDataSet, value, totalValue);
    dataSetContainer.appendChild(newDataSet);
  }
  #updateDataSet(currentDataSet, { value }, totalValue) {
    currentDataSet.setAttribute("data-present", "true");
    const valueElement = currentDataSet.querySelector(`.lovely-chart--tooltip-dataset-value`);
    if (valueElement) {
      valueElement.textContent = this.#formatValue(value);
    }
    this.#renderPercentageValue(currentDataSet, value, totalValue);
  }
  #formatValue(value) {
    const formatted = formatInteger(value);
    const prefix = this.#data.valuePrefix || "";
    const suffix = this.#data.valueSuffix || "";
    if (this.#data.isCurrencyPrefix && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }
  #renderPercentageValue(dataSet, value, totalValue) {
    if (!this.#data.isPercentage) {
      return;
    }
    if (this.#data.isPie) {
      Array.from(dataSet.querySelectorAll(`.lovely-chart--percentage-title`)).forEach((element) => element.remove());
      return;
    }
    const percentageValue = totalValue ? Math.round(value / totalValue * 100) : 0;
    const percentageElement = dataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);
    if (!percentageElement) {
      const newPercentageTitle = createElement("span");
      newPercentageTitle.className = "lovely-chart--percentage-title lovely-chart--position-left";
      newPercentageTitle.textContent = `${percentageValue}%`;
      dataSet.prepend(newPercentageTitle);
    } else {
      percentageElement.textContent = `${percentageValue}%`;
    }
  }
  #updateDataSets(statistics) {
    const dataSetContainer = this.#balloon.children[1];
    if (this.#data.isPie) {
      dataSetContainer.classList.add("lovely-chart--tooltip-legend-pie");
    }
    Array.from(dataSetContainer.children).forEach((dataSet) => {
      if (!this.#data.isPie && dataSetContainer.classList.contains("lovely-chart--tooltip-legend-pie")) {
        dataSet.remove();
      } else {
        dataSet.setAttribute("data-present", "false");
      }
    });
    const totalValue = statistics.reduce((a, x) => a + (x.value ?? 0), 0);
    const pointerVector = this.#getPointerVector();
    const filteredStatistics = statistics.filter(({ value }) => value !== 0 && value !== GAP);
    const sortedStatistics = filteredStatistics.sort((a, b) => b.value - a.value);
    const limitedStatistics = sortedStatistics.slice(0, MAX_TOOLTIP_ITEMS);
    const finalStatistics = this.#data.isPie ? limitedStatistics.filter(
      (statItem) => this.#isPieSectorSelected(statistics, statItem, totalValue, pointerVector)
    ) : limitedStatistics;
    finalStatistics.forEach((statItem) => {
      const currentDataSet = Array.from(dataSetContainer.children).find((element) => element.dataset.name === statItem.name);
      if (!currentDataSet) {
        this.#insertNewDataSet(dataSetContainer, statItem, totalValue);
      } else {
        this.#updateDataSet(currentDataSet, statItem, totalValue);
        dataSetContainer.appendChild(currentDataSet);
      }
    });
    if ((this.#data.isBars || this.#data.isSteps || this.#data.isAreas) && this.#data.isStacked) {
      this.#renderTotal(dataSetContainer, this.#formatValue(totalValue));
    }
    if (this.#data.secondaryYAxis) {
      this.#renderSecondaryTotal(dataSetContainer, totalValue);
    }
    Array.from(dataSetContainer.querySelectorAll('[data-total="true"]')).forEach((element) => dataSetContainer.appendChild(element));
    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]')).forEach((dataSet) => {
      dataSet.remove();
    });
  }
  #updateContent(title, statistics) {
    this.#updateTitle(title);
    this.#updateDataSets(statistics);
  }
  #renderTotal(dataSetContainer, totalValue) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = "lovely-chart--tooltip-dataset lovely-chart--tooltip-dataset-total";
      newTotalText.setAttribute("data-present", "true");
      newTotalText.setAttribute("data-total", "true");
      const titleElement = createElement("span");
      titleElement.textContent = "Total";
      newTotalText.appendChild(titleElement);
      const valueElement = createElement("span");
      valueElement.className = className;
      valueElement.textContent = totalValue;
      newTotalText.appendChild(valueElement);
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute("data-present", "true");
      const valueElement = totalText.querySelector(
        `.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`
      );
      valueElement.textContent = totalValue;
    }
  }
  #renderSecondaryTotal(dataSetContainer, totalValue) {
    const { label, multiplier, prefix = "", suffix = "" } = this.#data.secondaryYAxis;
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    const secondaryValue = (totalValue * multiplier).toFixed(2);
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = "lovely-chart--tooltip-dataset lovely-chart--tooltip-dataset-total";
      newTotalText.setAttribute("data-present", "true");
      newTotalText.setAttribute("data-total", "true");
      const titleElement = createElement("span");
      titleElement.textContent = label;
      newTotalText.appendChild(titleElement);
      const valueElement = createElement("span");
      valueElement.className = className;
      valueElement.textContent = `${prefix}${secondaryValue}${suffix}`;
      newTotalText.appendChild(valueElement);
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute("data-present", "true");
      const valueElement = totalText.querySelector(
        `.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`
      );
      valueElement.textContent = `${prefix}${secondaryValue}${suffix}`;
    }
  }
  #hideBalloon() {
    this.#balloon.classList.remove("lovely-chart--state-shown");
  }
  #getPointerVector() {
    const elementRect = this.#element.getBoundingClientRect();
    const canvasRect = this.#canvas.getBoundingClientRect();
    const pointerX = this.#offsetX - (canvasRect.left - elementRect.left);
    const pointerY = this.#offsetY - (canvasRect.top - elementRect.top);
    const center = this.#data.isPie && this.#projection ? this.#projection.getCenter() : [canvasRect.width / 2, canvasRect.height / 2];
    const angle = Math.atan2(pointerY - center[1], pointerX - center[0]);
    const distance = Math.sqrt((pointerX - center[0]) ** 2 + (pointerY - center[1]) ** 2);
    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance
    };
  }
  #getPageOffset(element) {
    return element.getBoundingClientRect();
  }
}

const ZOOM_ANIMATING_TIMEOUT = 1e3;
const PIE_LABELS_AROUND = 3;
class Zoomer {
  #data;
  #overviewData;
  #colors;
  #stateManager;
  #container;
  #header;
  #minimap;
  #tooltip;
  #tools;
  #isZoomed = false;
  #isDestroyed = false;
  #stateBeforeZoomIn;
  #stateBeforeZoomOut;
  #swapDataTimeout;
  #stateAnimatingTimeout;
  constructor(data, overviewData, colors, stateManager, container, header, minimap, tooltip, tools) {
    this.#data = data;
    this.#overviewData = overviewData;
    this.#colors = colors;
    this.#stateManager = stateManager;
    this.#container = container;
    this.#header = header;
    this.#minimap = minimap;
    this.#tooltip = tooltip;
    this.#tools = tools;
  }
  zoomIn(state, labelIndex) {
    if (this.#isZoomed) {
      return;
    }
    const label = this.#data.xLabels[labelIndex];
    this.#stateBeforeZoomIn = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(true);
    if (this.#data.shouldZoomToPie) {
      this.#container.classList.add("lovely-chart--state-zoomed-in");
      this.#container.classList.add("lovely-chart--state-animating");
    }
    const { value } = label;
    const dataPromise = this.#data.shouldZoomToPie ? Promise.resolve(this.#generatePieData(labelIndex)) : this.#data.onZoom(value);
    void dataPromise.then((newData) => this.#replaceData(newData, labelIndex, label));
  }
  zoomOut(state) {
    if (!this.#isZoomed) {
      return;
    }
    this.#stateBeforeZoomOut = state;
    this.#header.toggleIsZooming(true);
    this.#tooltip.toggleLoading(true);
    this.#tooltip.toggleIsZoomed(false);
    if (this.#data.shouldZoomToPie) {
      this.#container.classList.remove("lovely-chart--state-zoomed-in");
      this.#container.classList.add("lovely-chart--state-animating");
    }
    const labelIndex = Math.round((state.labelFromIndex + state.labelToIndex) / 2);
    this.#replaceData(this.#overviewData, labelIndex);
  }
  isZoomed() {
    return this.#isZoomed;
  }
  destroy() {
    this.#isDestroyed = true;
    if (this.#swapDataTimeout !== void 0) {
      clearTimeout(this.#swapDataTimeout);
      this.#swapDataTimeout = void 0;
    }
    if (this.#stateAnimatingTimeout !== void 0) {
      clearTimeout(this.#stateAnimatingTimeout);
      this.#stateAnimatingTimeout = void 0;
    }
  }
  #replaceData(newRawData, labelIndex, zoomInLabel) {
    if (this.#isDestroyed) return;
    if (!newRawData) {
      this.#tooltip.toggleLoading(false);
      this.#tooltip.toggleIsZoomed(false);
      this.#header.toggleIsZooming(false);
      return;
    }
    this.#tooltip.toggleLoading(false);
    const labelWidth = 1 / this.#data.xLabels.length;
    const labelMiddle = labelIndex / (this.#data.xLabels.length - 1);
    const filter = {};
    this.#data.datasets.forEach(({ key }) => filter[key] = false);
    const newData = analyzeData(newRawData, this.#isZoomed || this.#data.shouldZoomToPie ? "day" : "hour");
    const shouldZoomToLines = Object.keys(this.#data.datasets).length !== Object.keys(newData.datasets).length;
    this.#stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2
      },
      filter
    });
    this.#swapDataTimeout = window.setTimeout(() => {
      this.#swapDataTimeout = void 0;
      Object.assign(this.#data, newData);
      if (shouldZoomToLines && newRawData.colors) {
        Object.assign(this.#colors, createColors(newRawData.colors));
      }
      if (shouldZoomToLines) {
        this.#minimap?.toggle(this.#isZoomed);
        this.#tools.redraw();
        this.#container.style.width = `${this.#container.scrollWidth}px`;
        this.#container.style.height = `${this.#container.scrollHeight}px`;
      }
      this.#stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA
        },
        focusOn: NO_FOCUS
      }, true);
      const daysCount = this.#isZoomed || this.#data.shouldZoomToPie ? this.#data.xLabels.length : this.#data.xLabels.length / 24;
      const halfDayWidth = 1 / daysCount / 2;
      const centeredDayRange = {
        begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
        end: ZOOM_RANGE_MIDDLE + halfDayWidth
      };
      let range;
      let filter2;
      if (this.#isZoomed) {
        range = {
          begin: this.#stateBeforeZoomIn.begin,
          end: this.#stateBeforeZoomIn.end
        };
        filter2 = shouldZoomToLines ? this.#stateBeforeZoomIn.filter : this.#stateBeforeZoomOut.filter;
      } else {
        if (shouldZoomToLines) {
          range = {
            begin: 0,
            end: 1
          };
          filter2 = {};
          this.#data.datasets.forEach(({ key }) => filter2[key] = true);
        } else {
          range = this.#data.shouldZoomToPie ? centeredDayRange : newData.minimapRange ?? this.#buildDayRange(newData.xLabels, zoomInLabel.value) ?? centeredDayRange;
          filter2 = this.#stateBeforeZoomIn.filter;
        }
      }
      this.#stateManager.update({
        range,
        filter: filter2,
        // 0 disables discrete range snapping (when zooming back out)
        minimapDelta: this.#isZoomed ? 0 : range.end - range.begin
      });
      if (zoomInLabel) {
        this.#header.zoom(getFullLabelDate(zoomInLabel));
      }
      this.#isZoomed = !this.#isZoomed;
      this.#header.toggleIsZooming(false);
    }, this.#stateManager.hasAnimations() ? ZOOM_TIMEOUT : 0);
    this.#stateAnimatingTimeout = window.setTimeout(() => {
      this.#stateAnimatingTimeout = void 0;
      if (this.#data.shouldZoomToPie) {
        this.#container.classList.remove("lovely-chart--state-animating");
      }
    }, this.#stateManager.hasAnimations() ? ZOOM_ANIMATING_TIMEOUT : 0);
  }
  // The hourly window in zoomed data may be clamped at the data edges, so the
  // requested day is not necessarily in its middle — locate it by timestamp
  #buildDayRange(xLabels, dayValue) {
    const dayStart = xLabels.findIndex(({ value }) => value === dayValue);
    if (dayStart === -1) {
      return void 0;
    }
    const totalXWidth = xLabels.length - 1;
    let dayEnd = dayStart;
    while (dayEnd < totalXWidth && xLabels[dayEnd + 1].value < dayValue + MILLISECONDS_IN_DAY) {
      dayEnd++;
    }
    return {
      begin: Math.max(0, (dayStart - 0.5) / totalXWidth),
      end: Math.min(1, (dayEnd + 0.5) / totalXWidth)
    };
  }
  #generatePieData(labelIndex) {
    return {
      ...this.#overviewData,
      type: "pie",
      labels: this.#overviewData.labels.slice(labelIndex - PIE_LABELS_AROUND, labelIndex + PIE_LABELS_AROUND + 1),
      datasets: this.#overviewData.datasets.map((dataset) => {
        return {
          ...dataset,
          values: dataset.values.slice(labelIndex - PIE_LABELS_AROUND, labelIndex + PIE_LABELS_AROUND + 1)
        };
      })
    };
  }
}

const REDRAW_DEBOUNCE_MS = 500;
class LovelyChart {
  #container;
  #stateManager;
  #element;
  #plot;
  #context;
  #plotSize;
  #header;
  #axes;
  #minimap;
  #tooltip;
  #tools;
  #zoomer;
  #state;
  #windowWidth = window.innerWidth;
  #originalData;
  #isDestroyed = false;
  #themeObserver;
  #onWindowResize;
  #onWindowOrientationChange;
  #data;
  #colors;
  #redrawDebounced = debounce(() => this.#redraw(), REDRAW_DEBOUNCE_MS, false, true);
  constructor(container, originalData) {
    this.#container = container;
    this.#originalData = originalData;
    this.#data = analyzeData(this.#originalData);
    this.#colors = createColors(this.#data.colors);
    this.#setupComponents();
    this.#setupGlobalListeners();
  }
  update(newData) {
    if (this.#isDestroyed) return;
    this.#originalData = newData;
    this.#destroyComponents();
    const fresh = analyzeData(this.#originalData);
    Object.keys(this.#data).forEach((k) => {
      delete this.#data[k];
    });
    Object.assign(this.#data, fresh);
    Object.assign(this.#colors, createColors(this.#data.colors));
    this.#setupComponents();
  }
  destroy() {
    if (this.#isDestroyed) return;
    this.#isDestroyed = true;
    this.#themeObserver.disconnect();
    this.#themeObserver = void 0;
    window.removeEventListener("resize", this.#onWindowResize);
    this.#onWindowResize = void 0;
    window.removeEventListener("orientationchange", this.#onWindowOrientationChange);
    this.#onWindowOrientationChange = void 0;
    this.#destroyComponents();
  }
  #setupComponents() {
    this.#setupContainer();
    this.#header = new Header(this.#element, this.#data.title, this.#data.zoomOutLabel, this.#onZoomOut);
    this.#setupPlotCanvas();
    this.#stateManager = new StateManager(this.#data, this.#plotSize, this.#onStateUpdate);
    this.#axes = new Axes(this.#context, this.#data, this.#plotSize, this.#colors);
    if (this.#data.withMinimap) {
      this.#minimap = new Minimap(this.#element, this.#data, this.#colors, this.#onRangeChange);
    } else {
      this.#stateManager.update({ range: this.#data.minimapRange });
    }
    this.#tooltip = new Tooltip(
      this.#element,
      this.#data,
      this.#plotSize,
      this.#colors,
      this.#onZoomIn,
      this.#onFocus
    );
    this.#tools = new Tools(this.#element, this.#data, this.#onFilterChange);
    this.#zoomer = this.#data.isZoomable ? new Zoomer(
      this.#data,
      this.#originalData,
      this.#colors,
      this.#stateManager,
      this.#element,
      this.#header,
      this.#minimap,
      this.#tooltip,
      this.#tools
    ) : void 0;
  }
  #setupContainer() {
    this.#element = createElement();
    this.#element.className = `lovely-chart--container${this.#data.shouldZoomToPie ? " lovely-chart--container-type-pie" : ""}`;
    this.#container.appendChild(this.#element);
  }
  #setupPlotCanvas() {
    const { canvas, context } = setupCanvas(this.#element, {
      width: this.#element.clientWidth,
      height: PLOT_HEIGHT
    });
    this.#plot = canvas;
    this.#context = context;
    this.#plotSize = {
      width: this.#plot.offsetWidth,
      height: this.#plot.offsetHeight
    };
  }
  #onStateUpdate = (state) => {
    if (this.#isDestroyed) return;
    this.#state = state;
    const { datasets } = this.#data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex
    };
    const boundsAndParams = {
      begin: state.begin,
      end: state.end,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: this.#plotSize.width,
      availableHeight: this.#plotSize.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
      withColumns: this.#data.isBars || this.#data.isSteps
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`]);
    const points = preparePoints(this.#data, datasets, range, visibilities, boundsAndParams);
    const projection = new Projection(boundsAndParams);
    let secondaryPoints;
    let secondaryProjection;
    if (this.#data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = {
        yMin: state.yMinViewportSecond,
        yMax: state.yMaxViewportSecond
      };
      secondaryPoints = preparePoints(this.#data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }
    if (!this.#data.noCaption && this.#data.labelType !== "text") {
      this.#header.setCaption(this.#getCaption(state));
    }
    clearCanvas(this.#plot, this.#context);
    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_PLOT_FACTOR;
    drawDatasets(
      this.#context,
      state,
      this.#data,
      range,
      points,
      projection,
      secondaryPoints,
      secondaryProjection,
      PLOT_LINE_WIDTH,
      visibilities,
      this.#colors,
      false,
      simplification
    );
    if (!this.#data.isPie) {
      this.#axes.drawYAxis(state, projection, secondaryProjection);
      this.#axes.drawXAxis(state, projection);
    }
    this.#minimap?.update(state);
    this.#tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  };
  #onRangeChange = (range) => {
    this.#stateManager.update({ range });
  };
  #onFilterChange = (filter) => {
    this.#stateManager.update({ filter });
  };
  #onFocus = (focusOn) => {
    if (this.#data.isBars || this.#data.isPie || this.#data.isSteps) {
      this.#stateManager.update({ focusOn });
    }
  };
  #onZoomIn = (labelIndex) => {
    this.#zoomer.zoomIn(this.#state, labelIndex);
  };
  #onZoomOut = () => {
    this.#zoomer.zoomOut(this.#state);
  };
  #setupGlobalListeners() {
    this.#themeObserver = new MutationObserver(() => {
      if (this.#isDestroyed || !this.#stateManager) return;
      this.#stateManager.update();
    });
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    this.#onWindowResize = () => {
      if (window.innerWidth !== this.#windowWidth) {
        this.#windowWidth = window.innerWidth;
        this.#redrawDebounced();
      }
    };
    window.addEventListener("resize", this.#onWindowResize);
    this.#onWindowOrientationChange = () => {
      this.#redrawDebounced();
    };
    window.addEventListener("orientationchange", this.#onWindowOrientationChange);
  }
  #destroyComponents() {
    this.#zoomer?.destroy();
    this.#tooltip?.destroy();
    this.#header?.destroy();
    this.#stateManager?.destroy();
    if (this.#element?.parentNode) {
      this.#element.remove();
    }
    this.#element = void 0;
    this.#plot = void 0;
    this.#context = void 0;
    this.#header = void 0;
    this.#axes = void 0;
    this.#minimap = void 0;
    this.#tooltip = void 0;
    this.#tools = void 0;
    this.#zoomer = void 0;
    this.#stateManager = void 0;
  }
  #redraw() {
    if (this.#isDestroyed) return;
    this.#destroyComponents();
    Object.assign(this.#data, analyzeData(this.#originalData));
    this.#setupComponents();
  }
  #getCaption(state) {
    let startIndex;
    let endIndex;
    if (this.#zoomer?.isZoomed()) {
      startIndex = state.labelFromIndex === 0 ? 0 : state.labelFromIndex + 1;
      endIndex = state.labelToIndex === state.totalXWidth - 1 ? state.labelToIndex : state.labelToIndex - 1;
    } else {
      startIndex = state.labelFromIndex;
      endIndex = state.labelToIndex;
    }
    return isDataRange(this.#data.xLabels[startIndex], this.#data.xLabels[endIndex]) ? `${getLabelDate(this.#data.xLabels[startIndex])} — ${getLabelDate(this.#data.xLabels[endIndex])}` : getFullLabelDate(this.#data.xLabels[startIndex]);
  }
}
function create(container, data) {
  return new LovelyChart(container, data);
}

export { create };
