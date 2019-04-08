import { mergeArrays } from './fast';

export const LABELS_KEY = 'x';

export const DEFAULT_RANGE = { begin: 0.333, end: 0.667 };
export const GUTTER = 10;

export const PLOT_HEIGHT = 320;
export const PLOT_TOP_PADDING = 10;
export const PLOT_LINE_WIDTH = 2;

export const AXES_FONT = '300 10px Helvetica, Arial, sans-serif';
export const AXES_MAX_COLUMN_WIDTH = 45;
export const AXES_MAX_ROW_HEIGHT = 50;
export const X_AXIS_HEIGHT = 30;
export const X_AXIS_SHIFT_START = 1;
export const Y_AXIS_ZERO_BASED_THRESHOLD = 0.1;

export const MINIMAP_HEIGHT = 40;
export const MINIMAP_MARGIN = 10;
export const MINIMAP_LINE_WIDTH = 1;
export const MINIMAP_EAR_WIDTH = 5;
export const MINIMAP_RULER_HTML
  = '<div class="mask"></div><div class="slider"><div></div><div></div></div><div class="mask"></div>';

export const DPR = window.devicePixelRatio || 1;

export const DAY_MS = 1000 * 60 * 60 * 24;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const BALLOON_OFFSET = 20;

export const TRANSITION_DURATION = 300;

export const SKINS = {
  day: {
    bg: [255, 255, 255],
    axesText: [150, 162, 170],
    yAxisRulers: [242, 244, 245],
    tooltipTail: [223, 230, 235],
  },
  night: {
    bg: [36, 47, 62],
    axesText: [84, 103, 120],
    yAxisRulers: [41, 53, 68],
    tooltipTail: [59, 74, 90],
  },
};

const SKIN_STATE_PROPS = mergeArrays(Object.keys(SKINS.day).map((key) => (
  ['R', 'G', 'B'].map((channel) => `colorChannels#${key}#${channel}`)
)));

export const ANIMATE_PROPS = [
  'yMinViewport', 'yMaxViewport', 'yMinMinimap', 'yMaxMinimap',
  'yMinViewportSecond', 'yMaxViewportSecond', 'yMinMinimapSecond', 'yMaxMinimapSecond',
  'xAxisScale', 'yAxisScale', 'yAxisScaleSecond',
  ...SKIN_STATE_PROPS
];
