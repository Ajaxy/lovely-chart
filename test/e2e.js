/**
 * End-to-end smoke test: serves the demo page (docs/) with the freshly built
 * library (dist/) overlaid, drives it in headless Chrome and asserts that
 * rendering and every interaction work: tooltips, minimap dragging, legend
 * toggling, zoom in/out, pie hover, reference lines, comparison, selection
 * callbacks, the plot-area variables, a late web font, colour schemes, theme
 * switch, resize redraw, and `update()` and `destroy()` mid-interaction.
 *
 * Run via `npm test` (builds first). Runs in the headless shell of the Chromium
 * the locked playwright-core pins (`npx playwright-core install --only-shell
 * chromium`), or in an installed browser such as Google Chrome with
 * `E2E_CHANNEL=chrome`. The sections run on 4 pages of the demo at once, or on
 * as many as `E2E_WORKERS` sets, 1 to run them in turn; `E2E_TIMINGS=1`, as CI,
 * lists the slowest sections at the end.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';

import { buildWideFont, WIDE_FONT_FAMILY } from './wideFont.js';

// Demo charts rendered by docs/app.js
const EXPECTED_CHARTS = 24;
const COMPARISON_CHART = 9;
const LIMIT_CHART = 10;
const SPARKLINE_CHART = 11;
const SMOOTH_CHART = 12;
const FORECAST_CHART = 13;
const DAY_PICKER_CHART = 14;
const RTL_CHART = 15;
const SPENDING_CHART = 16;
const TWO_AXES_CHART = 17;
// The datasets of the smooth demo chart, the last of which starts hidden, and its axis labels in each skin
const SMOOTH_COLORS = ['#E65850', '#F79E39', '#5FB641'];
const SMOOTH_AXIS_FONT_SIZE = 12;
const SMOOTH_AXIS_COLORS = { night: '#7FB8F0', day: '#2373DB' };
// The days of the forecast demo chart, the last week of which it hatches in the accent of each skin, and the inset of
// the badge it pins to the bottom start of the plot
const FORECAST_DAYS = 28;
const FORECAST_WEEK = 7;
const FORECAST_LINE_COLOR = '#3497ED';
const FORECAST_ACCENTS = { day: '#108BE3', night: '#48AAF0' };
const FORECAST_BADGE_INSET = 6;
// The colours probe charts hatch and draw event rules in, and the bounds of each channel that pick their pixels: the
// hatch over a clear canvas at a fraction of its opacity, a dashed rule and a label at full opacity, the hatch over
// blue fills, and that under the focus mask of the night skin, about (54, 24, 159), not a hatch over the mask, about
// (84, 17, 186). Any of the hatch ones counts where the hatch must not show at all, its green too low for the
// antialiased edge of white text over blue.
const PROBE_MAGENTA = '#FF00FF';
const PROBE_CYAN = '#00FFFF';
const CLEAR_HATCH_PIXEL = { red: [200, 255], green: [0, 60], blue: [200, 255], alpha: [5, 120] };
const OPAQUE_MAGENTA_PIXEL = { red: [200, 255], green: [0, 60], blue: [200, 255], alpha: [200, 255] };
const BAR_HATCH_PIXEL = { red: [40, 120], green: [0, 30], blue: [200, 255], alpha: [200, 255] };
const MASKED_BAR_HATCH_PIXEL = { red: [44, 64], green: [14, 34], blue: [148, 170], alpha: [200, 255] };
const ANY_HATCH_PIXEL = { red: [40, 255], green: [0, 30], blue: [200, 255], alpha: [5, 255] };
// The bounds that pick the cyan probe colour over a clear canvas, at full opacity and over blue fills
const CLEAR_CYAN_PIXEL = { red: [0, 60], green: [200, 255], blue: [200, 255], alpha: [5, 120] };
const OPAQUE_CYAN_PIXEL = { red: [0, 60], green: [200, 255], blue: [200, 255], alpha: [200, 255] };
const BAR_CYAN_HATCH_PIXEL = { red: [0, 30], green: [40, 120], blue: [200, 255], alpha: [200, 255] };
// The opaque core of a blue line that a hatch over it tints, which a hatch under the lines leaves pure blue, and a green
// area border that the hatch tints, which a hatch under the border would leave green
const TINTED_LINE_PIXEL = { red: [20, 60], green: [0, 10], blue: [240, 255], alpha: [250, 255] };
const HATCHED_BORDER_PIXEL = { red: [40, 120], green: [120, 255], blue: [0, 140], alpha: [200, 255] };
// The least pixels of a steep green area border that a hatch over it tints across a band, where one under the border
// tints none but where a grid line crosses it
const MIN_HATCHED_BORDER_PIXELS = 20;
// The highest alpha of the hatch over a clear canvas at the tone under lines, about 36, short of the 71 of the tone over
// fills
const MAX_UNDER_LINES_ALPHA = 50;
// The label of an accruing range, narrower than its band but wider than the room before the label of the next range
const ACCRUING_LABEL = 'Accruing this month';
// The least picked pixels a column of a hatched band holds, its stripes covering a quarter of it, and the share of the
// plot height a dashed edge covers at the least and at the most, its dashes six parts of every ten
const MIN_HATCH_COLUMN_PIXELS = 10;
const MIN_EDGE_COVER = 0.4;
const MAX_EDGE_COVER = 0.75;
// How far apart along a row the stripes of a hatch start, 8px apart across them, how far the ends of a stripe may stand
// from where they belong, and how far a range label stands in from the start of its range's span
const HATCH_STRIPE_STEP = 8 * Math.SQRT2;
const HATCH_STRIPE_TOLERANCE = 0.01;
const HATCH_LABEL_INSET = 4;
// How far the alpha of a hatch may differ between two parts of one band, a hatch stroked twice over itself about 30
// more opaque than one stroked once
const MAX_HATCH_ALPHA_GAP = 5;
// The axis font size of a chart that sets none, which the demo forecast labels its band in
const DEFAULT_AXIS_FONT_SIZE = 10;
// How far the channels of a hatch pixel over a clear canvas may stand from its colour, its low alpha rounding them
const HATCH_COLOR_TOLERANCE = 12;
// The least share of its pixels a line over a hatch keeps, its antialiased edges blending into the stripes
const MIN_LINE_SHARE_OVER_HATCH = 0.97;
// The day of the forecast demo chart a promotion starts halfway through, marked by an event rule in the axis text colour
// of each skin, which draws at 60% opacity
const FORECAST_PROMO_DAY = 9;
const FORECAST_PROMO_OFFSET = 0.5;
const AXIS_TEXT_COLORS = { day: '#252529', night: '#A3B1C2' };
const AXIS_TEXT_ALPHA = [100, 210];
// The space between an event label and its rule, and the columns beside a rule that hold its label
const EVENT_LABEL_GAP = 4;
const EVENT_LABEL_COLUMNS = 30;
// A dash and a gap of a dashed event rule and of a dotted one, as those of a dataset, and how far a run down a rule may
// stand from them, in px
const RULE_DASH = [6, 4];
const RULE_DOT = [2, 3];
const RULE_RUN_TOLERANCE = 1;
// The radius of the head of a pinned event rule and the width of the ring of the background colour around it, which
// rests on the top of the canvas, how far an edge of the head may stand from where it belongs, its antialiased edge
// included, and the columns either side of a rule that a row through a head is read across
const PIN_HEAD_RADIUS = 4;
const PIN_RING_WIDTH = 1.5;
const PIN_HEAD_TOLERANCE = 1;
const PIN_ROW_REACH = 10;
// The lines of the note the demo forecast pins to its promotion, the opacity of the axis text colour of its pin, whose
// head paints over a ring of the chart background in each skin, and how far a channel of the head may stand from that
const FORECAST_PROMO_HINT = ['Promo from noon:', '20% off for a week'];
const AXIS_TEXT_OPACITY = 0.6;
const CHART_BACKGROUNDS = { day: '#FFFFFF', night: '#242F3E' };
const PIN_HEAD_COLOR_TOLERANCE = 16;
// A pixel of the probes' magenta with nothing over it, and any pixel the canvas paints, a faded label's included
const PURE_MAGENTA_PIXEL = { red: [245, 255], green: [0, 10], blue: [245, 255], alpha: [250, 255] };
const PAINTED_PIXEL = { red: [0, 255], green: [0, 255], blue: [0, 255], alpha: [10, 255] };
// The width of a small phone, which the demo page fits
const PHONE_WIDTH = 375;
// The planned days of the demo steps, the last 5 of 30, hatched under the steps from a dashed edge, the estimated
// months of the demo spending, the last 2 of 12, hatched over the bars, and the opacity of the stripes in each case
const LIMIT_DAYS = 30;
const PLANNED_DAYS = 5;
const SPENDING_MONTHS = 12;
const ESTIMATED_MONTHS = 2;
const UNDER_LINES_HATCH_OPACITY = 0.14;
const OVER_FILLS_HATCH_OPACITY = 0.28;
// How far a stripe of a hatch may stand from 45°, in px over its run
const STRIPE_SLOPE_TOLERANCE = 0.01;
// The colour of the share of apples beside the demo stack of fruits, on a Y axis of its own, that of the apples at the
// bottom of the stack, and how many times the pixels of the line the bars of the apples outnumber at the least
const TWO_AXES_SHARE_COLOR = '#2373DB';
const TWO_AXES_APPLES_COLOR = '#E65850';
const MIN_BARS_PER_LINE_PIXEL = 10;
// The accent and the background of the demo page in each skin, which the readout chart takes through `var()` for its
// datasets in full and in two `color-mix()`es with the background, and how far a channel of a mix may stand from it
const PAGE_ACCENTS = { night: '#48AAF0', day: '#108BE3' };
const PAGE_BACKGROUNDS = { night: '#242F3E', day: '#FFFFFF' };
const READOUT_ACCENT_SHARES = [1, 0.6, 0.3];
const MIX_TOLERANCE = 3;
// The least time the demo takes to load the data of its skeleton chart, the skeleton colour the page sets for it in
// each skin, the alpha of each over a clear canvas and the colour of the first line its data draws
const MIN_LOADING_TIME = 1500;
const SKELETON_TINTS = {
  night: { css: 'rgba(72,170,240,0.16)', hex: '#48AAF0', alpha: [30, 52] },
  day: { css: 'rgba(16,139,227,0.12)', hex: '#108BE3', alpha: [20, 42] },
};
const LOADED_LINE_COLOR = '#78D94B';
// The share of the plot canvas a skeleton covers at the least: the data area, short of the X-axis labels and the
// gutters
const MIN_SKELETON_COVER = 0.6;
// The fruits of the demo small multiples, the colour of their lines, the space the page sets over each plot, which no
// header band pushes down, and the least width of each on a phone
const MULTIPLE_FRUITS = ['Apples', 'Oranges', 'Lemons', 'Apricots'];
const MULTIPLE_PLOT_MARGIN_TOP = 4;
const MULTIPLE_COLOR = '#3497ED';
const MIN_PHONE_MULTIPLE_WIDTH = 140;

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'docs');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How many of the sections that took the longest `E2E_TIMINGS` lists, and of the commonest things that kept a page busy
// to the cap of a wait the run names
const SLOWEST_SECTIONS = 20;
const COMMONEST_CAP_CAUSES = 5;
// The pages of the demo that run the sections at once, 4 unless `E2E_WORKERS` sets another count, the least time the
// demo page settles after it loads, and the longest its charts take to paint, each over more pixels than the least
// that tell a chart drew its data
const WORKER_COUNT = Number(process.env.E2E_WORKERS) || 4;
const DEMO_SETTLE_TIME = 1500;
const DEMO_PAINT_TIMEOUT = 10000;
const MIN_PAINTED_PIXELS = 1000;
// The frames in a row with nothing pending that make a page idle, and the longest a chart takes to settle after it is
// built and after it is destroyed, which a wait cuts short once the page is idle
const IDLE_QUIET_FRAMES = 3;
const MOUNT_SETTLE_TIME = 1800;
const UNMOUNT_SETTLE_TIME = 200;

// A web font the server holds back until `releaseWideFont()`, so it loads after the chart that uses it is built
const WIDE_FONT_PATH = '/wide-font.ttf';
const heldFontResponses = [];

// Series fills of a dashboard's light and dark themes, pale and deep, for the legend label contrast check
const LEGEND_FILLS = {
  'light ink': '#343D47',
  'light ink soft': '#7D8995',
  'light neutral': '#C5CCD3',
  'light amber': '#B07800',
  'light danger soft': '#EBA39E',
  'light caution soft': '#E9B949',
  positive: '#1BB866',
  danger: '#F35B5B',
  caution: '#FFB020',
  accent: '#0191FF',
  'dark ink': '#DFE5EA',
  'dark ink soft': '#8A97A5',
  'dark neutral': '#46525E',
  'dark danger soft': '#8F4A47',
  'dark caution soft': '#8A6A1F',
};
// The middle of the plot, where the lines run clear of the axis labels at either side
const CONSTANT_LINE_BAND = [0.2, 0.8];
// How far each channel of a pixel may stand from a colour to count as it, and how far under the grid line of a Y
// tick, whose tenth of the night skin's white lifts a 0 channel to 26
const COLOR_TOLERANCE = 24;
const GRID_TINTED_COLOR_TOLERANCE = 32;
// The middle of the plot, where the dot of a single label sits
const SINGLE_LABEL_BAND = [0.45, 0.55];
// The plot of the default 320px canvas runs from under its top padding to over the X-axis band
const PLOT_TOP = 15;
const PLOT_BOTTOM = 290;
// The minimap plots its 40px canvas under a 1px top padding
const MINIMAP_PLOT_TOP = 1;
const MINIMAP_PLOT_BOTTOM = 40;
// The finest Y-axis step, below which a label could only be float noise
const FINEST_Y_STEP = 0.0001;
// A value in the trillions, past which a Y-axis step of a ten-thousandth adds nothing, the `T` its label abbreviates it
// by, and how far the label may round it
const TRILLION_VALUE = 1.234e12;
const TRILLION = 1e12;
const TRILLION_LABEL_TOLERANCE = 0.05;
// How long a page that draws no frame takes to count as frozen
const FREEZE_TIMEOUT_MS = 15_000;
// A sparkline insets its plot from every edge of the canvas
const SPARKLINE_INSET = 2;
// A pan step of the minimap slider, in px, that lands each frame on a window a little further on
const NARROW_PAN_STEP = 4;
// The texts a frame of a panned chart prints, its X-axis and Y-axis labels, the fading ones included
const MAX_PAN_TEXTS_PER_FRAME = 100;
// The least contrast of a white legend label on its fill, below which the dark label takes over, so every label
// reaches it
const MIN_LEGEND_LABEL_CONTRAST = 2;
// The eight colours of the default palette in order, and the pale ones of them, whose legend buttons take dark labels
const DEFAULT_PALETTE = ['#3497ED', '#2373DB', '#9ED448', '#5FB641', '#F5BD25', '#F79E39', '#E65850', '#5D5CDC'];
const DARK_LABEL_DEFAULT_COLORS = ['#9ED448', '#F5BD25'];
// Dataset counts from one to past the eight default colours, which a chart of more datasets takes again from the first,
// and a colour of a dataset's own, past which the next datasets take the default colours
const PALETTE_DATASET_COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);
const OWN_DATASET_COLOR = '#FF00FF';
// The spacing of the header, the minimap and the legend by default, and under the spacing variables of a page, which
// set the side inset, the space under the minimap, the row and the column gap of the legend, the space under it, and the
// padding, corner radius and font size of a legend button, in px
const DEFAULT_SPACING = {
  inset: 10, minimapGap: 16, rowGap: 8, columnGap: 6, bottom: 24, buttonPadding: 7, buttonRadius: 18, fontSize: 13,
};
const PAGE_SPACING = {
  inset: 0, minimapGap: 20, rowGap: 4, columnGap: 12, bottom: 0, buttonPadding: 3, buttonRadius: 5, fontSize: 11,
};
const PAGE_SPACING_STYLE = [
  `--lovely-chart-inset: ${PAGE_SPACING.inset}px`,
  `--lovely-chart-minimap-margin-bottom: ${PAGE_SPACING.minimapGap}px`,
  `--lovely-chart-legend-gap: ${PAGE_SPACING.rowGap}px ${PAGE_SPACING.columnGap}px`,
  `--lovely-chart-legend-padding-bottom: ${PAGE_SPACING.bottom}px`,
  `--lovely-chart-button-padding: ${PAGE_SPACING.buttonPadding}px`,
  `--lovely-chart-button-radius: ${PAGE_SPACING.buttonRadius}px`,
  `--lovely-chart-button-font-size: ${PAGE_SPACING.fontSize}px`,
].join('; ');
// A chart narrow enough to wrap its legend of five datasets and a comparison, and how far a length may stand from the
// one it reads
const SPACING_PROBE_WIDTH = 360;
const SPACING_TOLERANCE = 0.5;
// The space between the edge of the canvas and the plot or the Y-axis labels
const GUTTER = 10;
// How far contrast Y-axis labels stand in from their side of the chart
const CONTRAST_LABEL_PADDING = 2;
// The space between an outward Y-label column and the plot
const Y_AXIS_LABEL_GAP = 6;
// How far an edge of the plot-area overlay may stand from the pixels it frames, an antialiased 2px line included
const PLOT_AREA_TOLERANCE = 1.5;
// How far inside the plot area a run of points stands for its pixels to read whole, past the tolerance of its edges
const INNER_RUN_MARGIN = 3;
// The wait of a zoom before its data swaps in, the length of the transitions it starts, and how much later a busy main
// thread can run the swap
const ZOOM_SWAP_TIMEOUT = 400;
const LATE_SWAP_DELAY = 100;
// How long the `onZoom` of a chart that opens zoomed takes to return its data
const LATE_ZOOM_DATA_MS = 300;
// A host with a padding and a border of its own, which the plot-area properties count from the inside of
const PADDED_HOST_STYLE = 'position: relative; padding: 13px 21px 17px 9px; border: 4px solid #8A97A5';
const PLOT_AREA_PATTERN = /^-?\d+(\.\d+)?px$/;
// A host scaled to three quarters of its width, as a dashboard scaled to fit, and how far its plot-area properties may
// stand from those of the same host at full size
const SCALED_HOST_WIDTH = 600;
const HOST_SCALE = 0.75;
const PLOT_AREA_SCALE_TOLERANCE = 0.01;
// How far an edge of the minimap slider may stand from where its range puts it, as a fraction of the minimap
const MINIMAP_SLIDER_TOLERANCE = 0.002;
// A compact header a page sets through the variables: a 16px band 6px down the chart, and the plot right under it
const COMPACT_HEADER = { height: 16, marginTop: 6, plotMarginTop: 0 };
const COMPACT_HEADER_STYLE = `--lovely-chart-header-height: ${COMPACT_HEADER.height}px; `
  + `--lovely-chart-header-margin-top: ${COMPACT_HEADER.marginTop}px; `
  + `--lovely-chart-plot-margin-top: ${COMPACT_HEADER.plotMarginTop}px`;
// The default header band and the margin under it, the space between the header and the top of the balloon, and how
// far the middle of a hover dot may stand from that of the line it marks
const HEADER_HEIGHT = 30;
const PLOT_MARGIN_TOP = 10;
const BALLOON_HEADER_GAP = 5;
const HOVER_DOT_TOLERANCE = 1;
// The half width of the band of the plot around a hover dot where its line is measured
const HOVER_DOT_BAND = 4;
// A taller header a style of the page sets with no variables
const RESTYLED_HEADER = { height: 48, marginTop: 4 };
// The margin a style of the page sets on both canvases, as 2.1 needed to move the plot
const PAGE_CANVAS_MARGIN_TOP = 20;
// The height a style of the page fixes the chart element at, which a folded or taller header leaves unchanged
const FIXED_CHART_HEIGHT = 480;
// The units an axis label abbreviates its value in
const AXIS_UNITS = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
// A digit after the point that adds nothing, as `6.10K` or `6.0K` shows
const TRAILING_ZERO_PATTERN = /\.\d*0\D*$/;
// The float error two steps of a pass of exact labels can differ by, relative to the step
const EVEN_STEP_TOLERANCE = 1e-9;
// The least space between two neighbouring X-axis labels, and how far an edge label may stand past the plot area by
// float error
const X_LABEL_GAP = 8;
const X_LABEL_EDGE_TOLERANCE = 0.01;
// Weekly dates on the X axis of a chart too narrow to label each one, from 5 Aug 2026, and the text of the newest
const WEEK_DATE_COUNT = 12;
const WEEKS_PROBE_WIDTH = 330;
const NEWEST_WEEK_TEXT = '21 Oct';
// Months of a column chart with room for a label each
const MONTH_LABELS = ['August', 'September', 'October', 'November'];
const MONTHS_PROBE_WIDTH = 340;
// Two-digit labels of a column chart whose grid steps every other label at its width. In the wide font, whose digits
// are 1.5em wide, the labels of the first axis font size fit that grid, and those of the second would crowd the
// neighbours of the edge labels, which the grid pins inside the plot, so it steps every fourth label.
const WEEK_NUMBER_LABELS = Array.from({ length: 13 }, (_, i) => String(34 + i));
const WEEK_NUMBERS_PROBE_WIDTH = 348;
const FITTING_DIGITS_FONT_SIZE = 12;
const CROWDING_DIGITS_FONT_SIZE = 13;
// A compact chart of percentages, its plot height, axis font size and width, and the fewest pixels of its zero label
// that a contrast label shows below its grid line, over the X-axis band. The halo of a label reaches half its 3px
// stroke past the text.
const COMPACT_PLOT_HEIGHT = 130;
const COMPACT_AXIS_FONT_SIZE = 11.5;
const COMPACT_PROBE_WIDTH = 320;
const MIN_ZERO_LABEL_HALF_PIXELS = 4;
const HALO_REACH = 1.5;
// How far a 1px grid line reaches past its y
const GRID_LINE_REACH = 0.5;
// The pixels of a label in the magenta probe colour over its halo, antialiased edges and the grey of a GPU-less canvas
// included
const MAGENTA_TEXT_PIXEL = { red: [150, 255], green: [0, 110], blue: [150, 255], alpha: [60, 255] };

// A sloped series that a window of a fifth of its labels pans across, the steps of the pan, the first of which settle
// the window, and how far the pattern may move at one point of the series as the window pans, a smooth line's curves
// measured in chords
const PAN_PHASE_VALUES = [10, 47, 23, 61, 30, 52, 17];
const PAN_PHASE_LABELS = 60;
const PAN_PHASE_STEPS = 40;
const PAN_PHASE_SETTLE_STEPS = 5;
const PHASE_CURVE_CHORDS = 256;
const MAX_PAN_PHASE_SHIFT = 0.1;
// How far the X scale of a frame of a pan may stand from that of another, as a share of it: ends of the window that
// take their progress a millisecond apart change it by about 1e-4, and float error by under 1e-13
const MAX_PAN_SCALE_DRIFT = 1e-9;

// Values of more datasets than a tooltip holds, their order by size unlike their order in the legend
const TOOLTIP_ROW_VALUES = [10, 80, 20, 90, 30, 100, 40, 110, 50, 120, 60, 130, 70];
const TOOLTIP_ROW_COLORS = [
  '#3497ED', '#2373DB', '#9ED448', '#5FB641', '#F5BD25', '#F79E39', '#E65850',
  '#5D5CDC', '#8E44AD', '#16A085', '#C0392B', '#2C3E50', '#D35400',
];
const DEFAULT_COMPARISON_COLOR = '#6B7280';
// Text labels too long for the tooltip title to fit on one line beside the zoom chevron
const LONG_TITLE_LABELS = Array.from({ length: 8 }, (_, i) => `A rather long text label number ${i}`);
// The least contrast of the muted text of a tooltip on its background, the AA level of body text
const MIN_MUTED_TOOLTIP_CONTRAST = 4.5;
// The layers of a probe chart a balloon layering check lists, the balloon and the overlay first, as they overlap
const BALLOON_LAYER_SELECTORS = {
  balloon: '#probe .lovely-chart--tooltip-balloon',
  overlay: '#probe-overlay',
  'hover line': '#probe .lovely-chart--tooltip canvas',
};
// A sticky header of the page, the place it scrolls the balloon to under it, and the room under the chart to scroll
const PAGE_HEADER_HEIGHT = 120;
const BALLOON_UNDER_HEADER_TOP = 60;
const PAGE_SCROLL_ROOM = 2000;
// A z-index of an overlay above the one of the tooltip balloon and a floating zoom-out control
const OVER_BALLOON_Z_INDEX = '2';
// The datasets and the plot height of a chart whose balloon runs past the plot over its legend
const TALL_BALLOON_DATASETS = 12;
const SHORT_PLOT_HEIGHT = 110;
// The notes of a tooltip notes probe of five days: two hatched ranges that overlap and share a line, and the notes its
// `resolveTooltipNotes` gives by label index, an empty line, a line of the ranges, markup and a line too long for the
// rows among them. Then the notes and the title note each label shows.
const NOTE_RANGES = [
  { from: 2, to: 4, note: 'Estimated\nFrom partial data', titleNote: 'est.' },
  { from: 3, to: 4, note: 'Today is still in progress\nEstimated', titleNote: 'partial' },
];
const RESOLVED_NOTES = {
  1: { notes: ['', 'Excludes 2 unpriced swaps'] },
  4: {
    titleNote: 'upd. 14:05 UTC',
    notes: ['Estimated', '<b>Excludes</b> 3 unpriced swaps, which no price source covered on the day'],
  },
};
const LABEL_NOTES = [
  [],
  ['Excludes 2 unpriced swaps'],
  ['Estimated', 'From partial data'],
  ['Estimated', 'From partial data', 'Today is still in progress'],
  [
    'Estimated', 'From partial data', 'Today is still in progress',
    '<b>Excludes</b> 3 unpriced swaps, which no price source covered on the day',
  ],
];
const LABEL_TITLE_NOTES = [undefined, undefined, 'est.', 'est.', 'upd. 14:05 UTC'];

// The first colour of the default palette, which the first dataset without a colour of its own takes
const DEFAULT_PALETTE_COLOR = '#3497ED';
// An axis text colour of the chart, which a zoom keeps
const ZOOM_AXIS_TEXT_COLOR = '#FF8800';
// The last of the 10 labels of a `mountLinesZoom` overview, in the window the minimap opens on
const LINES_ZOOM_LAST_LABEL_INDEX = 9;
// The labels of the balloon placement probe, the newest of them at the right edge of the plot
const EDGE_LABEL_COUNT = 8;
const HOUR_MS = 3_600_000;
// The colours of three datasets sharing a name, the last of which starts hidden
const SHARED_NAME_COLORS = ['#FF0000', '#00FF00', '#0000FF'];
// The labels of a selection bounds probe, the indexes `selectLabel()` ignores there, before the first label, past the
// last, between two and none at all, the labels it selects before them, the last of which no clamping or rounding of an
// ignored index lands on, and how far the hover line may stand from the label it marks
const BOUNDS_LABEL_COUNT = 6;
const IGNORED_LABEL_INDEXES = [-1, BOUNDS_LABEL_COUNT, 1.5, NaN, Infinity];
const PRESELECTED_LABEL_INDEXES = [1, 3];
const HOVER_LINE_TOLERANCE = 1;
// The band in px a page keeps for a header with nothing to show, and the time a zoom in or out takes to settle
const EMPTY_HEADER_BAND = 20;
const ZOOM_SETTLE_MS = 1500;
// The distance in px from the left of the plot at which the pointer opens the balloon of a label left of the middle
// over the floating zoom-out control
const FLOATING_CONTROL_HOVER_X = 40;
// The text a page gives the zoom-out control, and the one it has by default
const ZOOM_OUT_LABEL = 'Back to trend';
const DEFAULT_ZOOM_OUT_LABEL = 'Zoom out';
// The grey channels of the sector a gradient probe reads, the fractions of the radius at which it reads a pie and the
// ring of a donut near their inner and their outer edge, the least a shaded pixel there stands from the grey, about 7
// inside and 10 outside, and the most a plain one does
const GRADIENT_GREY = 128;
const PIE_RADIUS_FRACTIONS = [0.25, 0.9];
const DONUT_RADIUS_FRACTIONS = [0.6, 0.95];
const MIN_GRADIENT_SHADE = 4;
const PLAIN_SECTOR_TOLERANCE = 2;
// The daily labels of a limit probe, the index of the first one its `limitDate` leaves open, and how far the share of
// the minimap the mask covers, or the window's start, may stand from that of the labels before it
const LIMIT_LABEL_COUNT = 20;
const LIMIT_LABEL_INDEX = 10;
const LIMIT_MASK_TOLERANCE = 0.02;
// The last label of a `minimapRange` that a limit probe asks of the labels its `limitDate` locks
const LOCKED_RANGE_LAST_INDEX = 4;
// How far past or short of the centre of a column a drag of a minimap ear sets an edge of the window, in px, and the
// label from which the `limitDate` of a probe of 11 bars opens them, past the middle of the labels
const COLUMN_CENTRE_NUDGE = 2;
const BAR_LIMIT_INDEX = 6;
// The steps of a mouse drag across the plot of a probe, the fraction of the plot height it drags at, the time its range
// takes to settle after the release, and how far in px the band of the drag may stand from where the pointer put it
const RANGE_DRAG_STEPS = 8;
const RANGE_DRAG_HEIGHT = 0.75;
const RANGE_SETTLE_MS = 700;
const RANGE_BAND_TOLERANCE = 1;
// A move under the threshold of a drag across the plot, in px
const RANGE_CLICK_MOVE = 2;
// The labels of a line with a minimap whose window of two of them its ears widen, the first of the two, and the width
// in px the ears leave a window
const DENSE_LABEL_COUNT = 200;
const DENSE_SELECTED_INDEX = 100;
const MINIMAP_EARS_WIDTH = 16;
// The label from which the `limitDate` of a probe of 11 points opens them
const LINE_LIMIT_INDEX = 4;
// The pointer id of a touch dispatched across the plot
const TOUCH_POINTER_ID = 7;
// A phone page whose chart, of `SWIPE_LABEL_COUNT` labels and `SWIPE_CHART_WIDTH` px, has `SWIPE_PAGE_ROOM` px of the
// page after it; a swipe of `SWIPE_DISTANCE` px down, drifting `SWIPE_DRIFT` px across, or of `SWIPE_ACROSS` px across,
// at `SWIPE_SPEED` px a second; the least scroll of a swipe down, and how far in px an edge of the window may move
// while it stays
const SWIPE_VIEWPORT = { width: 390, height: 700 };
const SWIPE_LABEL_COUNT = 60;
const SWIPE_CHART_WIDTH = 380;
const SWIPE_PAGE_ROOM = 2000;
const SWIPE_DISTANCE = 200;
const SWIPE_DRIFT = 25;
const SWIPE_ACROSS = 80;
const SWIPE_SPEED = 600;
const SWIPE_MIN_SCROLL = 100;
const SWIPE_EDGE_TOLERANCE = 0.5;
// The default `--range-selection-color` of the day skin and of the night skin
const RANGE_SELECTION_COLORS = ['rgb(16, 139, 227)', 'rgb(72, 170, 240)'];
// How far from the centre of a column the outer and the inner edge of a window inside half of it stand, in columns
const HALF_COLUMN_OUTER_EDGE = 0.4;
const HALF_COLUMN_INNER_EDGE = 0.05;
// The opacity a loading chart dims its data to, and the width of the elements the loading probes are built in
const LOADING_OPACITY = 0.4;
const LOADING_PROBE_WIDTH = 600;
// The fade of the minimap and the legend of a chart that starts or stops loading, and a margin
const LOADING_FADE_MS = 600;
// The pixels of a skeleton in the day and the night skin, a tenth of a dark blue and of white
const DAY_SKELETON_PIXEL = { red: [0, 100], green: [0, 100], blue: [0, 100], alpha: [10, 60] };
const NIGHT_SKELETON_PIXEL = { red: [180, 255], green: [180, 255], blue: [180, 255], alpha: [10, 60] };
// The fewest pixels of its colour that show a dataset drawn on a canvas
const MIN_DATASET_PIXELS = 100;
// The fewest pixels of its colour that show a thin line or a halo drawn on a canvas, as a dashed comparison line
const MIN_THIN_PIXELS = 20;
// Custom properties of the page on the probe's element: a series colour with a night value under the `theme-dark`
// class and another under an attribute of the page's own, a `color-mix()`, and a colour with a night value under the
// system's dark scheme. The page also eases its colours, which a colour read mid-way would catch.
const PAGE_TOKENS_STYLE = `
  #probe {
    --probe-series: #FF0000;
    --probe-mix: color-mix(in srgb, #FF0000 50%, #0000FF);
    --probe-comparison: rgb(255 128 0);
    --probe-reference: #00FF00;
    --probe-hatch: #FF00FF;
    --probe-axis: #0000FF;
    --probe-surface: #FFFF00;
    --probe-system: #FF00FF;
  }
  html.theme-dark #probe { --probe-series: #00FFFF; }
  #probe[data-theme='alt'] { --probe-series: #8000FF; }
  @media (prefers-color-scheme: dark) { #probe { --probe-system: #00FFFF; } }
  #probe span { transition: color 2s; }
`;
const PAGE_TOKEN_COLORS = {
  series: '#FF0000',
  seriesNight: '#00FFFF',
  seriesAlt: '#8000FF',
  mix: '#800080',
  comparison: '#FF8000',
  reference: '#00FF00',
  hatch: '#FF00FF',
  axis: '#0000FF',
  surface: '#FFFF00',
  system: '#FF00FF',
  systemNight: '#00FFFF',
};
// The time from a zoom out of a pie that the transition class holds through, short of the transition's end
const QUICK_ZOOM_OUT_WATCH = 400;
// The time between two zoom clicks, the second before the zoom of the first settles
const DOUBLE_ZOOM_CLICK_GAP = 50;
// The labels of a bar chart that a callback destroys or rebuilds, and the fewer labels it rebuilds it with
const CALLBACK_CHART_LABELS = 30;
const CALLBACK_UPDATE_LABELS = 5;
// The labels of a chart that `update()` or `destroy()` interrupts, and the fewer labels `update()` brings
const INTERRUPTED_LABELS = 30;
const INTERRUPTING_LABELS = 7;
// The colours of the two datasets of an interrupted chart
const INTERRUPTED_COLORS = ['#3497ED', '#F34C44'];
// The minimap window of a chart whose view `update()` keeps, the window its next data asks for, and that of data with
// other labels
const KEPT_RANGE = [0.2, 0.5];
const UPDATE_RANGE = [0.6, 0.9];
const OTHER_LABELS_RANGE = [0.1, 0.4];
// The label a chart whose selection `update()` keeps selects
const KEPT_SELECTED_INDEX = 5;
// The colour of the chart `update()` cross-fades from and that of the data it fades into, the time into the 400ms fade
// when a probe reads both charts, and a time after it ends
const FADE_FROM_COLOR = '#FF0000';
const FADE_TO_COLOR = '#0000FF';
const MID_FADE_MS = 200;
const PAST_FADE_MS = 700;
// How far the opacity a chart fades out from can sit above the one it had reached fading in
const FADE_OPACITY_TOLERANCE = 0.01;
// How far a focused sector of a pie or donut moves out of the circle
const CIRCLE_SHIFT = 10;
// The colour a probe paints over its whole plot canvas, to show what a clip leaves of it
const CLIP_PROBE_COLOR = [255, 0, 255];
// The pixels over which the antialiased edge of a clip or a circle may land
const CLIP_EDGE_TOLERANCE = 2;
// Fractions of the zoom-in and zoom-out transitions of a circle, and those of them that clip it the tightest
const CIRCLE_IN_FRACTIONS = [0, 0.1, 0.25, 0.5, 0.75, 0.85];
const CIRCLE_IN_TIGHT_FRACTIONS = [0.25, 0.5, 0.75];
const CIRCLE_OUT_FRACTIONS = [0, 0.25, 0.5, 0.6, 0.7, 0.9];
const CIRCLE_OUT_TIGHT_FRACTIONS = [0, 0.25, 0.5];

const SPANISH_DATE_LOCALE = {
  months: 'ene,feb,mar,abr,may,jun,jul,ago,sep,oct,nov,dic'.split(','),
  weekDays: 'domingo,lunes,martes,miércoles,jueves,viernes,sábado'.split(','),
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (urlPath === WIDE_FONT_PATH) {
      heldFontResponses.push(res);
      return;
    }
    const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    // dist/ takes precedence so the test exercises the current build,
    // not the published copies committed in docs/
    const file = [path.join(DIST, rel), path.join(DOCS, rel)]
      .find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function releaseWideFont() {
  const font = buildWideFont();
  heldFontResponses.splice(0).forEach((res) => {
    res.writeHead(200, { 'Content-Type': 'font/ttf' });
    res.end(font);
  });
}

// The browser of the run: the headless shell the lockfile pins, the same here and in CI, or the channel `E2E_CHANNEL`
// names, whose version is that of the browser installed
async function launchBrowser() {
  const channel = process.env.E2E_CHANNEL;
  try {
    return await chromium.launch({ headless: true, ...(channel && { channel }) });
  } catch (err) {
    // Last, as Playwright's own hint installs the browsers of its latest version, which the locked one cannot launch
    console.error(err.message);
    throw new Error(channel
      ? `Could not launch the ${channel} channel: install it, or leave E2E_CHANNEL unset`
      : 'Could not launch the headless shell: run npx playwright-core install --only-shell chromium');
  }
}

/**
 * Runs in each page before its own scripts, as `window.idleTracker`: it holds each frame, timer and fetch the page asks
 * for until it is done, and `wait(maxMs)` resolves once none is pending, nor a CSS animation with an end running, for
 * `quietFrames` frames in a row, or at `maxMs` with what kept the page busy, and with the count of frames, timers and
 * fetches the page asked for since the wait before. `requestFrame` asks for a frame it leaves out, for loops that never
 * end.
 */
function trackIdle(quietFrames) {
  if (window.idleTracker) return;

  const requestFrame = window.requestAnimationFrame.bind(window);
  const cancelFrame = window.cancelAnimationFrame.bind(window);
  const setTimer = window.setTimeout.bind(window);
  const clearTimer = window.clearTimeout.bind(window);
  const setRepeat = window.setInterval.bind(window);
  const clearRepeat = window.clearInterval.bind(window);
  const fetchResource = window.fetch.bind(window);
  const frames = new Set();
  const timers = new Set();
  let fetches = 0;
  let requested = 0;

  window.requestAnimationFrame = (callback) => {
    const id = requestFrame((time) => {
      frames.delete(id);
      callback(time);
    });
    frames.add(id);
    requested++;
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
    cancelFrame(id);
  };
  window.setTimeout = (callback, ms, ...args) => {
    if (typeof callback !== 'function') return setTimer(callback, ms, ...args);
    const id = setTimer((...callbackArgs) => {
      timers.delete(id);
      callback(...callbackArgs);
    }, ms, ...args);
    timers.add(id);
    requested++;
    return id;
  };
  window.setInterval = (callback, ms, ...args) => {
    const id = setRepeat(callback, ms, ...args);
    timers.add(id);
    requested++;
    return id;
  };
  // A timeout and an interval share their ids, so either call clears either
  window.clearTimeout = (id) => {
    timers.delete(id);
    clearTimer(id);
  };
  window.clearInterval = (id) => {
    timers.delete(id);
    clearRepeat(id);
  };

  // A fetch is pending until its response arrives, and the read of its body until the body has arrived
  const holdUntilSettled = (promise) => {
    fetches++;
    requested++;
    const release = () => fetches--;
    promise.then(release, release);
    return promise;
  };
  window.fetch = (...args) => holdUntilSettled(fetchResource(...args));
  ['json', 'text', 'arrayBuffer', 'blob'].forEach((name) => {
    const read = Response.prototype[name];
    Response.prototype[name] = function (...args) {
      return holdUntilSettled(read.apply(this, args));
    };
  });

  const describeBusy = () => {
    const animations = document.getAnimations().filter((animation) => (
      animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime)
    )).length;
    return Object.entries({ frames: frames.size, timers: timers.size, fetches, animations })
      .filter(([, count]) => count)
      .map(([name, count]) => `${name}: ${count}`)
      .join(', ');
  };

  const wait = (maxMs) => new Promise((resolve) => {
    const startedAt = performance.now();
    let quiet = 0;
    let ticks = 0;
    let isDone = false;
    let guard;
    const finish = (busy) => {
      isDone = true;
      clearTimer(guard);
      resolve({ ms: performance.now() - startedAt, busy, requested });
      requested = 0;
    };
    const tick = () => {
      if (isDone) return;
      ticks++;
      quiet = describeBusy() ? 0 : quiet + 1;
      if (quiet >= quietFrames) finish('');
      else requestFrame(tick);
    };
    // A page that draws no frames, as one in the background, still ends its wait
    guard = setTimer(() => finish(describeBusy() || (ticks ? 'quiet too briefly' : 'no frames')), maxMs);
    requestFrame(tick);
  });

  window.idleTracker = { wait, requestFrame };
}

// A page of the run, its idle tracker in place before any script of its own
async function newTestPage(owner, options) {
  const page = await owner.newPage(options);
  await page.addInitScript(trackIdle, IDLE_QUIET_FRAMES);
  return page;
}

// The waits for an idle page, the time they took, what kept the page busy in each that ran to its cap, and the
// charts built while the page asked for nothing
const idleWaits = { count: 0, ms: 0, capped: [], unseenMounts: 0 };

// Waits until the page is idle, at most `maxMs`, and returns the frames, timers and fetches it asked for since the wait
// before
async function waitForIdle(page, maxMs) {
  const { ms, busy, requested } = await page.evaluate((cap) => {
    if (!window.idleTracker) throw new Error('The page has no idle tracker: open it with newTestPage()');
    return window.idleTracker.wait(cap);
  }, maxMs);
  idleWaits.count++;
  idleWaits.ms += ms;
  if (busy) idleWaits.capped.push(busy);
  return requested;
}

// Waits until a chart just built settles, counting one that asked for no frame, timer or fetch against the tracker
async function settleMount(page) {
  if (!await waitForIdle(page, MOUNT_SETTLE_TIME)) idleWaits.unseenMounts++;
}

// The sections of the run in the order of this file, and the checks each makes, kept by the section that runs where a
// check is made
const SECTIONS = [];
const sectionChecks = new AsyncLocalStorage();

let failures = 0;
let checkCount = 0;
// The sections run, each with the time it took, which `E2E_TIMINGS` lists
const sectionTimes = [];

// Prints a check, or keeps it for the section that makes it to print in its turn
function check(name, condition, details = '') {
  const mark = condition ? 'ok' : 'FAIL';
  const line = `${mark.padEnd(4)} - ${name}${details ? ` (${details})` : ''}`;
  const checks = sectionChecks.getStore();
  if (checks) checks.push(line);
  else console.log(line);
  checkCount++;
  if (!condition) failures++;
}

// The time of the run and the browser it ran in, with `E2E_TIMINGS` or in CI the sections that took the longest too
function printTimings(browserName, startedAt) {
  const seconds = (performance.now() - startedAt) / 1000;
  console.log(`\n${checkCount} checks in ${seconds.toFixed(1)} s, in ${browserName}`);
  const cappedCounts = new Map();
  idleWaits.capped.forEach((busy) => cappedCounts.set(busy, (cappedCounts.get(busy) ?? 0) + 1));
  const capped = [...cappedCounts].sort(([, a], [, b]) => b - a).slice(0, COMMONEST_CAP_CAUSES)
    .map(([busy, count]) => `${busy} (${count}×)`).join('; ');
  console.log(`${idleWaits.count} waits for an idle page in ${(idleWaits.ms / 1000).toFixed(1)} s, `
    + `${idleWaits.capped.length} of them cut at their cap${capped ? `, the commonest causes ${capped}` : ''}`);
  if (!process.env.E2E_TIMINGS && !process.env.CI) return;

  [...sectionTimes].sort((a, b) => b.ms - a.ms).slice(0, SLOWEST_SECTIONS).forEach(({ title, ms }) => {
    console.log(`${(ms / 1000).toFixed(1).padStart(6)} s  ${title}`);
  });
}

// Counts the pixels of the plot canvas close to `rgb`, thin antialiased strokes included, and averages their height.
// `xBand` limits the count to a horizontal band of the canvas, as fractions of its width, clear of the axis labels.
function findColor(locator, [r, g, b], xBand = [0, 1], tolerance = COLOR_TOLERANCE) {
  return locator.evaluate((el, [color, [bandStart, bandEnd], tolerance]) => {
    const canvas = el.querySelector('canvas');
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let ySum = 0;
    for (let j = 0; j < d.length; j += 4) {
      const x = (j / 4) % canvas.width;
      const isMatch = d[j + 3] > 100 && Math.abs(d[j] - color[0]) < tolerance
        && Math.abs(d[j + 1] - color[1]) < tolerance && Math.abs(d[j + 2] - color[2]) < tolerance
        && x >= canvas.width * bandStart && x < canvas.width * bandEnd;
      if (isMatch) {
        count++;
        ySum += Math.floor(j / 4 / canvas.width);
      }
    }
    return { count, meanY: count ? ySum / count / (canvas.height / canvas.clientHeight) : undefined };
  }, [[r, g, b], xBand, tolerance]);
}

// Measures the dashes and gaps of a horizontal blue line on the canvas of an element, the margins and the end dashes
// left out. A column counts as painted where the line covers at least half of it, in the row it covers most, the grid
// line under it tinting the blue a little.
function readBlueLinePattern(locator) {
  return locator.evaluate((el) => {
    const canvas = el.querySelector('canvas');
    const scale = canvas.width / canvas.clientWidth;
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const readBlueAlpha = (x, y) => {
      if (y < 0 || y >= canvas.height) return 0;
      const j = (y * canvas.width + x) * 4;
      return d[j] < 64 && d[j + 1] < 64 && d[j + 2] > 200 ? d[j + 3] : 0;
    };
    let row = 0;
    let rowCount = 0;
    for (let y = 0; y < canvas.height; y++) {
      let rowBlue = 0;
      for (let x = 0; x < canvas.width; x++) if (readBlueAlpha(x, y) > 100) rowBlue++;
      if (rowBlue > rowCount) {
        row = y;
        rowCount = rowBlue;
      }
    }
    const runs = [];
    for (let x = 0; x < canvas.width; x++) {
      const isPainted = Math.max(...[-2, -1, 0, 1, 2].map((dy) => readBlueAlpha(x, row + dy))) >= 128;
      if (runs.length && runs[runs.length - 1].isPainted === isPainted) runs[runs.length - 1].length++;
      else runs.push({ isPainted, length: 1 });
    }
    const inner = runs.slice(2, -2);
    const average = (isPainted) => {
      const lengths = inner.filter((run) => run.isPainted === isPainted).map(({ length }) => length / scale);
      return lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    };
    return {
      count: inner.filter(({ isPainted }) => isPainted).length,
      dashLength: average(true),
      gapLength: average(false),
    };
  });
}

/**
 * Pans the probe chart's window a minimap pixel a step and follows the point of its patterned stroke nearest the middle
 * of the plot: how far the pattern moved there, in px, the largest shift over the pan, at how many labels the stroke
 * started meanwhile, and how far the space between two labels strays over the pan, as a share of it. With
 * `isClockSpread`, `Date.now()` reads its whole millisecond at points spread through it, each further on by the golden
 * ratio, so the millisecond turns between some reads a moment apart, as it does now and then between real ones.
 */
function readPanPhaseShift(page, isClockSpread = false) {
  return page.evaluate(async ({ steps, settleSteps, chords, isSpread }) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const context = canvas.getContext('2d');
    const strokes = [];
    let path = [];
    let isRecording = false;
    const { beginPath, moveTo, lineTo, bezierCurveTo, stroke } = CanvasRenderingContext2D.prototype;
    context.beginPath = function (...args) {
      path = [];
      return beginPath.apply(this, args);
    };
    context.moveTo = function (x, y) {
      path.push({ to: [x, y] });
      return moveTo.call(this, x, y);
    };
    context.lineTo = function (x, y) {
      path.push({ to: [x, y] });
      return lineTo.call(this, x, y);
    };
    context.bezierCurveTo = function (x1, y1, x2, y2, x, y) {
      path.push({ controls: [[x1, y1], [x2, y2]], to: [x, y] });
      return bezierCurveTo.call(this, x1, y1, x2, y2, x, y);
    };
    context.stroke = function (...args) {
      const dash = this.getLineDash();
      if (isRecording && dash.length) {
        strokes.push({ offset: this.lineDashOffset, period: dash.reduce((sum, length) => sum + length, 0), path });
      }
      return stroke.apply(this, args);
    };

    const { top, height } = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    const { left, width } = slider.getBoundingClientRect();
    const fire = (target, type, clientX) => {
      const event = new MouseEvent(type, {
        bubbles: true, cancelable: true, buttons: 1, clientX, clientY: top + height / 2,
      });
      (type === 'mousedown' ? target : document).dispatchEvent(event);
    };
    const start = left + width / 2;
    const { now } = Date;
    const spread = (Math.sqrt(5) - 1) / 2;
    let reads = 0;
    if (isSpread) Date.now = () => Math.floor(performance.timeOrigin + performance.now() + (reads++ * spread) % 1);
    fire(slider, 'mousedown', start);
    for (let step = 1; step <= steps; step++) {
      isRecording = step > settleSteps;
      fire(slider, 'mousemove', start + step);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    fire(slider, 'mouseup', start + steps);
    Date.now = now;
    ['beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'stroke'].forEach((name) => delete context[name]);

    // Each vertex of a stroke, with the place of the pattern there and the start of the stroke
    const frames = strokes.map(({ offset, period, path: strokePath }) => {
      let length = 0;
      let previous = strokePath[0].to;
      return strokePath.map(({ controls, to }) => {
        if (controls) {
          let chordStart = previous;
          for (let j = 1; j <= chords; j++) {
            const t = j / chords;
            const u = 1 - t;
            const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
            const pixel = [0, 1].map((axis) => weights[0] * previous[axis] + weights[1] * controls[0][axis]
              + weights[2] * controls[1][axis] + weights[3] * to[axis]);
            length += Math.hypot(pixel[0] - chordStart[0], pixel[1] - chordStart[1]);
            chordStart = pixel;
          }
        } else {
          length += Math.hypot(to[0] - previous[0], to[1] - previous[1]);
        }
        previous = to;
        return { x: to[0], y: to[1], startX: strokePath[0].to[0], phase: (offset + length) % period, period };
      });
    });
    const middle = canvas.clientWidth / 2;
    let point = frames[0].reduce((nearest, vertex) => (
      Math.abs(vertex.x - middle) < Math.abs(nearest.x - middle) ? vertex : nearest
    ));
    const track = frames.map((vertices) => {
      point = vertices
        .filter(({ y }) => Math.abs(y - point.y) < 0.01)
        .reduce((nearest, vertex) => (Math.abs(vertex.x - point.x) < Math.abs(nearest.x - point.x) ? vertex : nearest));
      return point;
    });
    const [{ phase: firstPhase, period }] = track;
    const shifts = track.map(({ phase }) => Math.abs(((phase - firstPhase + period * 1.5) % period) - period / 2));
    // The widest step along x between two vertices of a stroke spans a label, a step's riser and its tread included
    const spaces = frames.map((vertices) => Math.max(...vertices.slice(1).map(({ x }, j) => x - vertices[j].x)));
    return {
      shift: Math.max(...shifts),
      starts: new Set(track.map(({ x, startX }) => Math.round(x - startX))).size,
      scaleDrift: (Math.max(...spaces) - Math.min(...spaces)) / Math.min(...spaces),
    };
  }, {
    steps: PAN_PHASE_STEPS, settleSteps: PAN_PHASE_SETTLE_STEPS, chords: PHASE_CURVE_CHORDS, isSpread: isClockSpread,
  });
}

// Records what the plot canvas of a chart draws until `stopCanvasRecording()`: each text, with its font, colour,
// direction, start and width, the count of curves, and each path as the straight segments it starts with a move, each
// with the opacity and the line width it starts at
function startCanvasRecording(chart) {
  return chart.evaluate((el) => {
    const context = el.querySelector('canvas').getContext('2d');
    const recording = { texts: [], curves: 0, paths: [] };
    window.canvasRecording = { context, recording };
    context.beginPath = function () {
      recording.paths.push([]);
      return CanvasRenderingContext2D.prototype.beginPath.call(this);
    };
    context.moveTo = function (x, y) {
      recording.paths.at(-1)?.push({ from: [x, y], alpha: this.globalAlpha, width: this.lineWidth });
      return CanvasRenderingContext2D.prototype.moveTo.call(this, x, y);
    };
    context.lineTo = function (x, y) {
      const segment = recording.paths.at(-1)?.at(-1);
      if (segment && !segment.to) segment.to = [x, y];
      return CanvasRenderingContext2D.prototype.lineTo.call(this, x, y);
    };
    context.fillText = function (text, ...args) {
      recording.texts.push({
        text: String(text),
        font: this.font,
        color: this.fillStyle,
        direction: this.direction,
        x: args[0],
        width: this.measureText(text).width,
      });
      return CanvasRenderingContext2D.prototype.fillText.call(this, text, ...args);
    };
    context.bezierCurveTo = function (...args) {
      recording.curves++;
      return CanvasRenderingContext2D.prototype.bezierCurveTo.apply(this, args);
    };
  });
}

function stopCanvasRecording(page) {
  return page.evaluate(() => {
    const { context, recording } = window.canvasRecording;
    ['fillText', 'bezierCurveTo', 'beginPath', 'moveTo', 'lineTo'].forEach((method) => delete context[method]);
    delete window.canvasRecording;
    return recording;
  });
}

// Switches the skin of the page and back, each switch redrawing the charts, and runs `whileSwitched` in between
async function switchSkinAndBack(page, whileSwitched) {
  await page.evaluate(() => document.documentElement.classList.toggle('theme-dark'));
  await waitForIdle(page, 500);
  await whileSwitched?.();
  await page.evaluate(() => document.documentElement.classList.toggle('theme-dark'));
  await waitForIdle(page, 500);
}

// Whether the words of each element's text, in reading order, run from right to left on screen
function readRightToLeftWords(chart, selectors) {
  return chart.evaluate((el, textSelectors) => textSelectors.map((selector) => {
    const range = document.createRange();
    const words = [];
    el.querySelector(selector).childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      for (const match of node.data.matchAll(/\S+/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const { left, right } = range.getBoundingClientRect();
        words.push({ word: match[0], left, right });
      }
    });
    return {
      text: words.map(({ word }) => word).join(' '),
      isRightToLeft: words.length > 1 && words.every((word, i) => !i || word.right <= words[i - 1].left + 1),
    };
  }), selectors);
}

// The characters of each negative number of a tooltip balloon in the order they show, left to right
function readNegativeTooltipNumbers(chart) {
  return chart.evaluate((el) => {
    const range = document.createRange();
    const selectors = '.lovely-chart--tooltip-dataset-value, .lovely-chart--tooltip-title-total';
    return [...el.querySelectorAll(selectors)]
      .filter((element) => element.textContent.trim().startsWith('-'))
      .map((element) => {
        const node = element.firstChild;
        const characters = [];
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          if (node.data[i].trim()) characters.push([node.data[i], range.getBoundingClientRect().left]);
        }
        const shown = characters.sort((a, b) => a[1] - b[1]).map(([character]) => character).join('');
        return { text: node.data, shown };
      });
  });
}

function paintedPixels(page, chartIndex) {
  return page.evaluate((i) => {
    const canvas = document.querySelectorAll('.lovely-chart--container')[i].querySelector('canvas');
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let j = 3; j < d.length; j += 4) if (d[j] !== 0) painted++;
    return painted;
  }, chartIndex);
}

// A real hover needs movement over the chart: a single synthetic move event
// can land before the throttled handler picks up the position.
/**
 * Mounts a chart for the checks that follow. Fixtures live here rather than on
 * the demo page: they exist to make one failure unmistakable, not to be looked
 * at. `dataUrl` seeds them from a demo dataset, `config` overrides it,
 * `zoomDataSource` attaches the day-drilling `onZoom` the demo page uses, its
 * day data overridden by `zoomConfig`. `hostStyle` styles the element the
 * chart is built in, and `width` sets the chart width in px.
 */
async function mountProbe(page, {
  dataUrl, config = {}, zoomDataSource, zoomConfig = {}, hostStyle = '', width,
} = {}) {
  await page.evaluate(async (spec) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const base = spec.dataUrl ? await fetch(spec.dataUrl).then((response) => response.json()) : {};
    const params = { ...base, ...spec.config };

    if (spec.zoomDataSource) {
      params.onZoom = (timestamp) => {
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

        return fetch(`${spec.zoomDataSource}/${path}.json`)
          .then((response) => response.json())
          .then((dayData) => ({ ...dayData, ...spec.zoomConfig }));
      };
    }

    const element = document.createElement('div');
    element.id = 'probe';
    element.style.cssText = spec.hostStyle;
    if (spec.width) {
      element.style.width = `${spec.width}px`;
    }
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, params);
  }, { dataUrl, config, zoomDataSource, zoomConfig, hostStyle, width });
  await settleMount(page);

  return page.locator('#probe .lovely-chart--container');
}

// Collects the numbers the probe chart prints on its canvas, its Y-axis labels among them, with their heights, and
// every text it prints, with its position, alignment, width, direction, the animation frame that drew it and its
// pass: a pass of axis labels sets their alignment once before it prints them
async function recordProbeNumbers(page) {
  await page.evaluate(() => {
    window.probeNumbers = [];
    window.probeTexts = [];
    if (window.isFillTextRecorded) return;
    window.isFillTextRecorded = true;
    window.probeFrame = 0;
    window.probePass = 0;
    const countFrame = () => {
      window.probeFrame++;
      window.idleTracker.requestFrame(countFrame);
    };
    window.idleTracker.requestFrame(countFrame);
    const textAlign = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'textAlign');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'textAlign', {
      ...textAlign,
      set(value) {
        window.probePass++;
        textAlign.set.call(this, value);
      },
    });
    const { fillText } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
      if (this.canvas.closest('#probe')) {
        window.probeTexts.push({
          text: String(text),
          x,
          align: this.textAlign,
          width: this.measureText(text).width,
          frame: window.probeFrame,
          pass: window.probePass,
          color: typeof this.fillStyle === 'string' ? this.fillStyle : '',
          direction: this.direction,
        });
        if (/^-?\d+(\.\d+)?$/.test(String(text))) {
          window.probeNumbers.push({ value: Number(text), y, baseline: this.textBaseline });
        }
      }
      return fillText.call(this, text, x, y, ...args);
    };
  });
}

// The texts the probe chart printed since the last read, and the width of its canvas
function readProbeTexts(page) {
  return page.evaluate(() => {
    const texts = window.probeTexts;
    window.probeTexts = [];
    return { texts, canvasWidth: document.querySelector('#probe canvas').clientWidth };
  });
}

// The texts the last frame among them printed
function getLastFrameTexts({ texts }) {
  const lastFrame = Math.max(...texts.map(({ frame }) => frame));
  return texts.filter(({ frame }) => frame === lastFrame);
}

// Whether a canvas fill style is a hex colour, at any opacity
function isTextColor(fillStyle, hex) {
  return fillStyle === hex.toLowerCase() || fillStyle.startsWith(`rgba(${parseHex(hex).join(', ')}, `);
}

// The main Y-axis labels of an outward column, right-aligned left of the canvas middle, of every frame or the last
function getYLabelColumn({ texts, canvasWidth }, isLastFrame = false) {
  const labels = texts.filter(({ x, align }) => align === 'right' && x < canvasWidth / 2);
  const lastFrame = Math.max(...labels.map(({ frame }) => frame));
  const shownLabels = isLastFrame ? labels.filter(({ frame }) => frame === lastFrame) : labels;
  const ends = [...new Set(shownLabels.map(({ x }) => x))];

  return {
    ends,
    end: ends[0],
    widest: Math.max(0, ...shownLabels.map(({ width }) => width)),
    overflowing: [...new Set(shownLabels.filter(({ x, width }) => x - width < GUTTER).map(({ text }) => text))],
    texts: [...new Set(shownLabels.map(({ text }) => text))],
  };
}

// The passes of Y-axis labels among the texts that repeat a value, step unevenly or end in a 0 after the point, each
// as its texts; `affixes` are the prefixes and suffixes the chart adds around the values
function listInexactYLabelPasses({ texts }, affixes) {
  const passes = new Map();
  texts.filter(({ align }) => align !== 'center').forEach(({ text, pass }) => {
    passes.set(pass, [...(passes.get(pass) ?? []), text]);
  });

  return [...passes.values()].filter((passTexts) => passTexts.length > 1).filter((passTexts) => {
    const values = passTexts
      .map((text) => parseAxisLabel(affixes.reduce((bare, affix) => bare.replace(affix, ''), text)))
      .sort((a, b) => a - b);
    const steps = values.slice(1).map((value, i) => value - values[i]);
    return passTexts.some((text) => TRAILING_ZERO_PATTERN.test(text)) || !steps.every((step) => (
      step > 0 && Math.abs(step - steps[0]) <= steps[0] * EVEN_STEP_TOLERANCE
    ));
  });
}

// The value of an axis label, abbreviated or not
function parseAxisLabel(text) {
  const [, number, unit] = /^(-?[\d ]+(?:\.\d+)?)([KMBT]?)$/.exec(text) ?? [];
  return number === undefined ? NaN : Number(number.replace(/ /g, '')) * AXIS_UNITS[unit];
}

function readProbeNumbers(page) {
  return page.evaluate(() => [...new Set(window.probeNumbers.map(({ value }) => value))].sort((a, b) => a - b));
}

// The labels drawn by the last frame, one per number
function readProbeNumberLabels(page) {
  return page.evaluate(() => Object.values(
    Object.fromEntries(window.probeNumbers.map((label) => [label.value, label])),
  ));
}

// Selects a label of the probe chart and reads its tooltip: the rows, their swatches and colours, and the change
function readProbeTooltip(page, labelIndex) {
  return page.evaluate(async (index) => {
    window.probeChart.selectLabel(index);
    await window.idleTracker.wait(300);
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const rows = [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')];
    const swatchedRows = rows.filter((row) => row.querySelector('.lovely-chart--tooltip-swatch'));
    const textColor = getComputedStyle(balloon).color;
    const resolveColor = (variable) => {
      const element = document.createElement('span');
      element.style.color = `var(${variable})`;
      balloon.appendChild(element);
      const color = getComputedStyle(element).color;
      element.remove();
      return color;
    };
    const change = balloon.querySelector('.lovely-chart--tooltip-change');
    // A dashed or dotted swatch is an outline in its colour, a solid one a fill
    const readSwatchColor = (swatch) => getComputedStyle(swatch)[
      swatch.matches('[data-dashed], [data-dotted]') ? 'borderTopColor' : 'backgroundColor'
    ];
    return {
      names: rows.map((row) => row.dataset.name ?? row.firstElementChild.textContent),
      swatched: swatchedRows.map((row) => row.dataset.name),
      swatchColors: swatchedRows.map((row) => readSwatchColor(row.querySelector('.lovely-chart--tooltip-swatch'))),
      dashedSwatches: swatchedRows
        .filter((row) => row.querySelector('.lovely-chart--tooltip-swatch[data-dashed]'))
        .map((row) => row.dataset.name),
      dottedSwatches: swatchedRows
        .filter((row) => row.querySelector('.lovely-chart--tooltip-swatch[data-dotted]'))
        .map((row) => row.dataset.name),
      areValuesInTextColor: rows
        .filter((row) => !row.matches('.lovely-chart--tooltip-dataset-comparison'))
        .every((row) => (
          getComputedStyle(row.querySelector('.lovely-chart--tooltip-dataset-value')).color === textColor
        )),
      titleTotal: balloon.querySelector('.lovely-chart--tooltip-title-total')?.textContent,
      change: {
        text: change?.textContent,
        tone: change?.dataset.tone,
        color: change ? getComputedStyle(change).color : undefined,
        textColor,
        positiveColor: resolveColor('--tooltip-change-positive'),
        negativeColor: resolveColor('--tooltip-change-negative'),
      },
    };
  }, labelIndex);
}

// Selects a label of the probe chart and reads the family of its text and the weights of its parts, each a list of
// the computed weights of the elements of that part
function readProbeTypography(page, labelIndex) {
  return page.evaluate(async (index) => {
    window.probeChart.selectLabel(index);
    await window.idleTracker.wait(300);
    const container = document.querySelector('#probe .lovely-chart--container');
    const parts = {
      legend: '.lovely-chart--button-label',
      comparisonLegend: '.lovely-chart--comparison-legend',
      rowNames: '.lovely-chart--tooltip-dataset:not(.lovely-chart--tooltip-dataset-total) '
        + '> .lovely-chart--dataset-title',
      header: '.lovely-chart--header-title, .lovely-chart--header-caption',
      tooltipTitle: '.lovely-chart--tooltip-title',
      titleTotal: '.lovely-chart--tooltip-title-total',
      values: '.lovely-chart--tooltip-dataset:not(.lovely-chart--tooltip-dataset-comparison) '
        + '> .lovely-chart--tooltip-dataset-value',
      totalRow: '.lovely-chart--tooltip-dataset-total',
      change: '.lovely-chart--tooltip-change',
      shares: '.lovely-chart--percentage-title',
    };
    return {
      family: getComputedStyle(container).fontFamily,
      weights: Object.fromEntries(Object.entries(parts).map(([key, selector]) => [
        key,
        [...container.querySelectorAll(selector)].map((element) => getComputedStyle(element).fontWeight),
      ])),
    };
  }, labelIndex);
}

function hexToRgb(hex) {
  return `rgb(${parseHex(hex).join(', ')})`;
}

/**
 * Mounts a line chart of `overview` datasets whose `onZoom` opens a lines view of `zoomed` datasets for the day,
 * each dataset `{ name, color? }`, with the chart's `config` and the day's `zoomConfig`.
 */
async function mountLinesZoom(page, { overview, zoomed, config = {}, zoomConfig = {} }) {
  await page.evaluate(async (spec) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const buildDatasets = (datasets, length) => datasets.map((dataset, i) => ({
      ...dataset,
      values: Array.from({ length }, (_, j) => 10 + ((j + i * 2) % 5) * 10),
    }));

    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Lines zoom colours',
      withMinimap: true,
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 10, 1 + i)),
      datasets: buildDatasets(spec.overview, 10),
      onZoom: (day) => Promise.resolve({
        type: 'line',
        labels: Array.from({ length: 24 }, (_, hour) => day + hour * spec.hourMs),
        datasets: buildDatasets(spec.zoomed, 24),
        ...spec.zoomConfig,
      }),
      ...spec.config,
    });
  }, { overview, zoomed, config, zoomConfig, hourMs: HOUR_MS });
  await settleMount(page);

  return page.locator('#probe .lovely-chart--container');
}

function parseHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Counts the pixels of each colour on the plot and the minimap, and reads the outline colours of the legend buttons
async function readDatasetPaint(chart, colors) {
  const minimap = chart.locator('.lovely-chart--minimap');
  const paint = { plot: {}, minimap: {} };
  for (const color of colors) {
    paint.plot[color] = (await findColor(chart, parseHex(color))).count;
    paint.minimap[color] = (await findColor(minimap, parseHex(color))).count;
  }
  paint.legend = await chart.locator('.lovely-chart--button')
    .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderTopColor));
  paint.isMinimapShown = await minimap.evaluate((element) => getComputedStyle(element).display !== 'none');

  return paint;
}

// The plot and the legend show the colours, the minimap too unless the view hides it, and none shows the absent ones
function isPaintedWith(paint, shownColors, absentColors, isMinimapShown = true) {
  const legendColors = shownColors.map(hexToRgb);
  const isMinimapPainted = paint.isMinimapShown === isMinimapShown && (!isMinimapShown || (
    shownColors.every((color) => paint.minimap[color] > MIN_DATASET_PIXELS)
    && absentColors.every((color) => paint.minimap[color] === 0)
  ));
  return isMinimapPainted
    && shownColors.every((color) => paint.plot[color] > MIN_DATASET_PIXELS)
    && absentColors.every((color) => paint.plot[color] === 0)
    && JSON.stringify(paint.legend) === JSON.stringify(legendColors);
}

// Narrows the probe chart's window to the narrowest the minimap selects, then pans it across the data, `stepPx` a frame
async function sweepProbe(page, stepPx = 3) {
  await page.evaluate(async (step) => {
    const host = document.getElementById('probe');
    const { left, right, top, height } = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const fire = (target, type, clientX) => {
      const event = new MouseEvent(type, {
        bubbles: true, cancelable: true, buttons: type === 'mouseup' ? 0 : 1, clientX, clientY: top + height / 2,
      });
      (type === 'mousedown' ? target : document).dispatchEvent(event);
    };
    const drag = async (target, fromX, toX) => {
      fire(target, 'mousedown', fromX);
      fire(target, 'mousemove', toX);
      fire(target, 'mouseup', toX);
      await window.idleTracker.wait(500);
    };
    const center = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    const leftEar = host.querySelector('.lovely-chart--minimap-slider-handle');
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    await drag(leftEar, center(leftEar), right + 50);
    await drag(slider, center(slider), center(slider) - (right - left) - 50);
    const start = center(slider);
    fire(slider, 'mousedown', start);
    for (let dx = 0; dx <= right - left; dx += step) {
      fire(slider, 'mousemove', start + dx);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    fire(slider, 'mouseup', start + right - left);
    await window.idleTracker.wait(600);
  }, stepPx);
}

// Places an element over the probe's plot by the plot-area properties of the probe's element alone
function addPlotAreaOverlay(page) {
  return page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'probe-overlay';
    overlay.style.cssText = 'position: absolute; pointer-events: none; '
      + 'left: var(--lovely-chart-plot-area-left); top: var(--lovely-chart-plot-area-top); '
      + 'width: var(--lovely-chart-plot-area-width); height: var(--lovely-chart-plot-area-height)';
    document.getElementById('probe').appendChild(overlay);
  });
}

// The probe's overlay, the values of its plot-area properties and the box of the canvas pixels of each colour, or of
// every painted pixel for `'any'`, all in px from the top left of the canvas
function readPlotAreaFit(page, colors) {
  return page.evaluate((hexes) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const overlayBox = document.getElementById('probe-overlay').getBoundingClientRect();
    const scale = canvas.width / canvas.clientWidth;
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const boxes = hexes.map((hex) => {
      const rgb = hex === 'any' ? undefined : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, meanY: 0, count: 0 };
      for (let j = 0; j < data.length; j += 4) {
        const isMatch = data[j + 3] > 100 && (!rgb || rgb.every((channel, k) => Math.abs(data[j + k] - channel) < 24));
        if (!isMatch) continue;
        const x = (j / 4) % canvas.width / scale;
        const y = Math.floor(j / 4 / canvas.width) / scale;
        box.left = Math.min(box.left, x);
        box.top = Math.min(box.top, y);
        box.right = Math.max(box.right, x + 1 / scale);
        box.bottom = Math.max(box.bottom, y + 1 / scale);
        box.meanY += y + 0.5 / scale;
        box.count++;
      }
      box.meanY /= box.count;
      return box;
    });
    return {
      overlay: {
        left: overlayBox.left - canvasBox.left,
        top: overlayBox.top - canvasBox.top,
        right: overlayBox.right - canvasBox.left,
        bottom: overlayBox.bottom - canvasBox.top,
      },
      values: ['left', 'top', 'width', 'height']
        .map((key) => host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)),
      boxes,
    };
  }, colors);
}

// Whether each of the `sides` of the overlay stands within the tolerance of the same side of the box
function isFramedBy(overlay, box, sides = ['left', 'top', 'right', 'bottom']) {
  return box.count > 0 && sides.every((side) => Math.abs(overlay[side] - box[side]) <= PLOT_AREA_TOLERANCE);
}

function formatBox({ left, top, right, bottom }) {
  return [left, top, right, bottom].map((value) => value.toFixed(1)).join(' ');
}

// The left edge of the plot area the probe's element carries, in px from the left of the canvas
function readPlotAreaLeft(page) {
  return page.evaluate(() => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasLeft = canvas.getBoundingClientRect().left - host.getBoundingClientRect().left - host.clientLeft;
    return parseFloat(host.style.getPropertyValue('--lovely-chart-plot-area-left')) - canvasLeft;
  });
}

// The selections the probe chart reported, the x of its hover line, read from the top row of the hover canvas, which
// the line alone crosses, and the x of each of its `labelCount` labels, all in px from the left of the canvas
function readProbeHoverLine(page, labelCount) {
  return page.evaluate((count) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--tooltip canvas');
    const row = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
    let alphaSum = 0;
    let xSum = 0;
    for (let x = 0; x < canvas.width; x++) {
      alphaSum += row[x * 4 + 3];
      xSum += row[x * 4 + 3] * (x + 0.5);
    }
    const plot = host.querySelector('.lovely-chart--container > canvas');
    const plotLeft = plot.getBoundingClientRect().left - host.getBoundingClientRect().left - host.clientLeft;
    const areaLeft = parseFloat(host.style.getPropertyValue('--lovely-chart-plot-area-left')) - plotLeft;
    return {
      log: [...window.probeLog],
      lineX: alphaSum ? xSum / alphaSum / (canvas.width / canvas.clientWidth) : undefined,
      labelXs: Array.from({ length: count }, (_, i) => areaLeft + window.probeChart.getLabelX(i)),
    };
  }, labelCount);
}

// The tops of the probe's header, plot canvas, hover canvas and balloon and the bottom of its header, in px from the
// top of the chart, the line height of its title, the middles of the hover dots of `hex` and of the line of `hex` on
// the plot across them, in px from the top of the chart, and the top of the data area the chart sets on the probe, in
// px from the top of the plot canvas
function readHoverAlignment(page, hex) {
  return page.evaluate(([color, band]) => {
    const host = document.getElementById('probe');
    const chart = host.querySelector('.lovely-chart--container');
    const chartTop = chart.getBoundingClientRect().top;
    const readTop = (element) => element.getBoundingClientRect().top - chartTop;
    const header = chart.querySelector('.lovely-chart--header');
    const plot = chart.querySelector(':scope > canvas');
    const hover = chart.querySelector('.lovely-chart--tooltip canvas');
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const findMiddle = (canvas, xBand = [-Infinity, Infinity]) => {
      const scale = canvas.width / canvas.clientWidth;
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      let xSum = 0;
      let ySum = 0;
      for (let j = 0; j < data.length; j += 4) {
        const x = ((j / 4) % canvas.width + 0.5) / scale;
        const isMatch = data[j + 3] > 100 && rgb.every((channel, k) => Math.abs(data[j + k] - channel) < 24)
          && x >= xBand[0] && x <= xBand[1];
        if (!isMatch) continue;
        count++;
        xSum += x;
        ySum += (Math.floor(j / 4 / canvas.width) + 0.5) / scale;
      }
      return { count, x: xSum / count, y: ySum / count + readTop(canvas) };
    };
    const dot = findMiddle(hover);
    return {
      headerTop: readTop(header),
      headerBottom: header.getBoundingClientRect().bottom - chartTop,
      titleLineHeight: getComputedStyle(header.querySelector('.lovely-chart--header-title')).lineHeight,
      plotTop: readTop(plot),
      hoverTop: readTop(hover),
      balloonTop: readTop(chart.querySelector('.lovely-chart--tooltip-balloon')),
      dot,
      line: findMiddle(plot, [dot.x - band, dot.x + band]),
      plotAreaTop: parseFloat(host.style.getPropertyValue('--lovely-chart-plot-area-top'))
        - (plot.getBoundingClientRect().top - host.getBoundingClientRect().top - host.clientTop),
    };
  }, [hex, HOVER_DOT_BAND]);
}

// Whether the hover canvas stands on the plot canvas, and the hover dot on its line
function isHoverAligned({ plotTop, hoverTop, dot, line }) {
  return hoverTop === plotTop && dot.count > 0 && line.count > 0 && Math.abs(dot.y - line.y) <= HOVER_DOT_TOLERANCE;
}

function formatHoverAlignment({ plotTop, hoverTop, dot, line }) {
  return `plot canvas at ${plotTop}, hover canvas at ${hoverTop}, dot at ${dot.y?.toFixed(2)} of ${dot.count}px, `
    + `line at ${line.y?.toFixed(2)} of ${line.count}px`;
}

async function unmountProbe(page) {
  await page.evaluate(() => {
    window.probeChart.destroy();
    document.getElementById('probe').remove();
  });
  await waitForIdle(page, UNMOUNT_SETTLE_TIME);
}

// The pixels of the plot area of the chart in the element `hostSelector` names that `bounds` pick, counted per column
// of canvas px across the area, or on to the right edge of the canvas with `isToCanvasEnd`, with the highest alpha
// among them in each column and the area's size; a pixel counts when its alpha and each channel fall within the bounds
function readAreaColumns(page, hostSelector, bounds, isToCanvasEnd = false) {
  return page.evaluate(([selector, { red, green, blue, alpha }, toCanvasEnd]) => {
    const host = document.querySelector(selector);
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const [left, top, width, height] = ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    const scale = canvas.width / canvas.clientWidth;
    const startX = Math.round((left - (canvasBox.left - hostBox.left - host.clientLeft)) * scale);
    const startY = Math.round((top - (canvasBox.top - hostBox.top - host.clientTop)) * scale);
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const endX = toCanvasEnd ? canvas.width : startX + Math.round(width * scale);
    const columns = [];
    const peaks = [];
    for (let x = startX; x < endX; x++) {
      let count = 0;
      let peak = 0;
      for (let y = startY; y < startY + Math.round(height * scale); y++) {
        const j = (y * canvas.width + x) * 4;
        if ([red, green, blue, alpha].every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) {
          count++;
          peak = Math.max(peak, data[j + 3]);
        }
      }
      columns.push(count);
      peaks.push(peak);
    }
    return { columns, peaks, width, height, scale };
  }, [hostSelector, bounds, isToCanvasEnd]);
}

// The picked pixels of the columns from `start` to `end`, in px from the start of the area
function sumColumns({ columns, scale }, start, end) {
  return columns.slice(Math.round(start * scale), Math.round(end * scale)).reduce((sum, count) => sum + count, 0);
}

// The median over the columns from `start` to `end`, in px from the start of the area, of the highest alpha among the
// picked pixels of each, which the few columns where the antialiased edge of a line lifts that alpha leave as it is
function readPeakAlpha({ peaks, scale }, start, end) {
  const sorted = peaks.slice(Math.round(start * scale), Math.round(end * scale)).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// The runs of columns that hold at least `minCount` picked pixels, as `[start, end]` in px from the start of the area
function findColumnRuns({ columns, scale }, minCount) {
  const runs = [];
  columns.forEach((count, x) => {
    if (count < minCount) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === x) {
      last[1] = x + 1;
    } else {
      runs.push([x, x + 1]);
    }
  });
  return runs.map(([start, end]) => [start / scale, end / scale]);
}

// Whether each run starts and ends within the tolerance of the expected one, in px
function areRunsNear(runs, expected) {
  return runs.length === expected.length && runs.every((run, i) => (
    run.every((edge, k) => Math.abs(edge - expected[i][k]) <= PLOT_AREA_TOLERANCE)
  ));
}

function formatRuns(runs) {
  return JSON.stringify(runs.map((run) => run.map((edge) => Number(edge.toFixed(1)))));
}

// Counts the pixels of every canvas of an element that `bounds` pick
function countPickedPixels(locator, { red, green, blue, alpha }) {
  return locator.evaluate((el, bounds) => [...el.querySelectorAll('canvas')].reduce((total, canvas) => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let j = 0; j < data.length; j += 4) {
      if (bounds.every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) count++;
    }
    return total + count;
  }, 0), [red, green, blue, alpha]);
}

// The bounds of each channel within `tolerance` of a hex colour, at an alpha within `alpha`
function getColorBounds(hex, alpha, tolerance) {
  const [red, green, blue] = parseHex(hex).map((channel) => [channel - tolerance, channel + tolerance]);
  return { red, green, blue, alpha };
}

// Reads the spacing of the legend in the element `legendSelector` names, as `DEFAULT_SPACING` lists it, and of the
// header and the minimap of its chart when the legend sits in it, with the width of the minimap canvas in canvas px
// and the width it takes on screen
function readSpacing(page, legendSelector) {
  return page.evaluate((selector) => {
    const tools = document.querySelector(`${selector} .lovely-chart--tools`);
    const container = tools.closest('.lovely-chart--container');
    const toolsBox = tools.getBoundingClientRect();
    const entries = Array.from(tools.children).map((entry) => entry.getBoundingClientRect());
    const [first, second] = entries;
    const nextRow = entries.find(({ top }) => top >= first.bottom);
    const rowsBottom = Math.max(...entries.map(({ bottom }) => bottom));
    const button = tools.querySelector('.lovely-chart--button');
    const buttonBox = button.getBoundingClientRect();
    const checkBox = button.querySelector('.lovely-chart--button-check').getBoundingClientRect();
    const buttonStyle = getComputedStyle(button);
    const border = parseFloat(buttonStyle.borderTopWidth);
    const comparison = tools.querySelector('.lovely-chart--comparison-legend');
    const comparisonStyle = getComputedStyle(comparison);
    const frame = container?.getBoundingClientRect();
    const readInsets = ({ left, right }) => [left - frame.left, frame.right - right];

    const spacing = {
      inset: [first.left - toolsBox.left, parseFloat(getComputedStyle(tools).paddingRight)],
      rowGap: nextRow.top - first.bottom,
      columnGap: second.left - first.right,
      bottom: (frame ?? toolsBox).bottom - rowsBottom,
      buttonPadding: [
        parseFloat(buttonStyle.paddingTop),
        checkBox.top - buttonBox.top - border,
        checkBox.left - buttonBox.left - border,
        parseFloat(comparisonStyle.paddingTop),
      ],
      buttonRadius: parseFloat(buttonStyle.borderTopLeftRadius),
      fontSize: [
        parseFloat(getComputedStyle(button.querySelector('.lovely-chart--button-label')).fontSize),
        parseFloat(comparisonStyle.fontSize),
      ],
    };
    if (!container) return { spacing };

    const minimap = container.querySelector('.lovely-chart--minimap');
    const minimapBox = minimap.getBoundingClientRect();
    spacing.inset.push(
      ...readInsets(container.querySelector('.lovely-chart--header').getBoundingClientRect()),
      ...readInsets(minimapBox),
    );
    spacing.minimapGap = first.top - minimapBox.bottom;
    return {
      spacing,
      minimapCanvasWidth: minimap.querySelector('canvas').width,
      minimapWidth: Math.round(minimapBox.width * devicePixelRatio),
    };
  }, legendSelector);
}

// Whether each length `readSpacing` reads stands within a tolerance of the one `spacing` gives it
function isSpacingAt(readings, spacing) {
  return Object.entries(readings.spacing).every(([key, lengths]) => [lengths].flat()
    .every((length) => Math.abs(length - spacing[key]) <= SPACING_TOLERANCE));
}

// Reads the dataset colour of each legend button, as its `--lovely-chart-series-color` gives it, the contrast of its
// The box of the canvas pixels of the chart in the element `hostSelector` names that `bounds` pick, in the columns from
// `start` to `end`, all in px from the top left of the plot area, so the room above the area is negative
function readPickedBox(page, hostSelector, bounds, [start, end]) {
  return page.evaluate(([selector, { red, green, blue, alpha }, [from, to]]) => {
    const host = document.querySelector(selector);
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const [left, top] = ['left', 'top']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    const areaX = left - (canvasBox.left - hostBox.left - host.clientLeft);
    const areaY = top - (canvasBox.top - hostBox.top - host.clientTop);
    const scale = canvas.width / canvas.clientWidth;
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, count: 0 };
    const startX = Math.max(0, Math.round((areaX + from) * scale));
    const endX = Math.min(canvas.width, Math.round((areaX + to) * scale));
    for (let x = startX; x < endX; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const j = (y * canvas.width + x) * 4;
        if (![red, green, blue, alpha].every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) continue;
        box.left = Math.min(box.left, x / scale - areaX);
        box.right = Math.max(box.right, (x + 1) / scale - areaX);
        box.top = Math.min(box.top, y / scale - areaY);
        box.bottom = Math.max(box.bottom, (y + 1) / scale - areaY);
        box.count++;
      }
    }
    return box;
  }, [hostSelector, bounds, [start, end]]);
}

// The runs of pixels that `bounds` pick down the column of the plot canvas of the chart in the element `hostSelector`
// names at `x`, from the top of the canvas to the bottom of the plot area, as `[start, end]`, with the area's height,
// all in px from the top left of the plot area
function readColumnRuns(page, hostSelector, bounds, x) {
  return page.evaluate(([selector, { red, green, blue, alpha }, columnX]) => {
    const host = document.querySelector(selector);
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const [left, top, height] = ['left', 'top', 'height']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    const areaX = left - (canvasBox.left - hostBox.left - host.clientLeft);
    const areaY = top - (canvasBox.top - hostBox.top - host.clientTop);
    const scale = canvas.width / canvas.clientWidth;
    const rows = Math.round((areaY + height) * scale);
    const { data } = canvas.getContext('2d').getImageData(Math.floor((areaX + columnX) * scale), 0, 1, rows);
    const runs = [];
    for (let y = 0; y < rows; y++) {
      const j = y * 4;
      if (![red, green, blue, alpha].every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === y) {
        last[1] = y + 1;
      } else {
        runs.push([y, y + 1]);
      }
    }
    return { runs: runs.map((run) => run.map((edge) => edge / scale - areaY)), height };
  }, [hostSelector, bounds, x]);
}

// The pixels of the plot canvas of the chart in the element `hostSelector` names along the row at `y`, in the columns
// from `start` to `end`, as `{ left, right, rgba }`, all in px from the top left of the plot area
function readCanvasRow(page, hostSelector, y, [start, end]) {
  return page.evaluate(([selector, rowY, [from, to]]) => {
    const host = document.querySelector(selector);
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const [left, top] = ['left', 'top']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    const areaX = left - (canvasBox.left - hostBox.left - host.clientLeft);
    const areaY = top - (canvasBox.top - hostBox.top - host.clientTop);
    const scale = canvas.width / canvas.clientWidth;
    const startX = Math.max(0, Math.round((areaX + from) * scale));
    const endX = Math.min(canvas.width, Math.round((areaX + to) * scale));
    const { data } = canvas.getContext('2d').getImageData(startX, Math.floor((areaY + rowY) * scale), endX - startX, 1);
    return Array.from({ length: endX - startX }, (_, i) => ({
      left: (startX + i) / scale - areaX,
      right: (startX + i + 1) / scale - areaX,
      rgba: Array.from(data.slice(i * 4, i * 4 + 4)),
    }));
  }, [hostSelector, y, [start, end]]);
}

function isPickedPixel(rgba, { red, green, blue, alpha }) {
  return [red, green, blue, alpha].every(([min, max], k) => rgba[k] >= min && rgba[k] <= max);
}

// Reads the dataset colour of each legend button, as its `lovely-chart--color-*` class names it, the contrast of its
// label on its fill, the contrast a white label would have there and whether the label is white
function readLegendLabels(chart) {
  return chart.evaluate((el) => {
    const parseRgb = (value) => value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const toHex = (rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    const getLuminance = (rgb) => rgb
      .map((channel) => channel / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i] * value, 0);
    return Array.from(el.querySelectorAll('.lovely-chart--button')).map((button) => {
      const fill = getLuminance(parseRgb(getComputedStyle(button).backgroundColor));
      const label = getLuminance(parseRgb(getComputedStyle(button.querySelector('.lovely-chart--button-label')).color));
      const contrast = (Math.max(fill, label) + 0.05) / (Math.min(fill, label) + 0.05);
      const whiteContrast = 1.05 / (fill + 0.05);
      return {
        name: button.textContent,
        color: toHex(parseRgb(button.style.getPropertyValue('--lovely-chart-series-color'))),
        contrast: Math.round(contrast * 100) / 100,
        whiteContrast: Math.round(whiteContrast * 100) / 100,
        isLabelWhite: label > 0.99,
      };
    });
  });
}

/**
 * Mounts a zoomable stacked bar chart of `INTERRUPTED_LABELS` labels, with a minimap and callbacks that log what they
 * report, and runs `update()` to `INTERRUPTING_LABELS` labels or `destroy()` in the task that leaves it mid-interaction:
 * a legend toggle animating, a legend button pressed twice towards a long press, a minimap drag and a pointer move whose
 * frame is pending. `update()` is followed in that task by a click on the new chart, and `destroy()` follows an
 * orientation change, whose redraw is pending. The drag then carries on and ends
 * after the long press would have fired. Reads the callbacks, the errors, the `<html>` classes right after the call,
 * the caption before and after the drag carries on and the frames and timers that fired after the call, when the page
 * counts them.
 */
function interruptProbe(page, action) {
  return page.evaluate(async ({ action, labels, newLabels, colors }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const wait = (ms) => new Promise((resolve) => (window.realSetTimeout ?? window.setTimeout)(resolve, ms));
    const log = [];
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener('error', onError);
    const buildParams = (length) => ({
      type: 'bar',
      title: 'Probe — Interrupted',
      isStacked: true,
      zoomToShares: true,
      withMinimap: true,
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: colors.map((color, i) => ({
        name: `Dataset ${i}`, color, values: Array.from({ length }, (_, j) => 10 + ((i + j) % 4) * 10),
      })),
      onSelectedIndexChange: (index) => log.push(`select ${index}`),
      onHiddenSeriesChange: (names) => log.push(`hidden ${names}`),
      onZoomChange: (value) => log.push(`zoom ${value}`),
    });

    const element = document.createElement('div');
    element.id = 'probe';
    document.body.appendChild(element);
    window.probeChart = new LovelyChart(element, buildParams(labels));
    await window.idleTracker.wait(800);

    const fire = (target, type, x, y) => {
      const buttons = type === 'mouseup' || type === 'click' ? 0 : 1;
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, buttons, clientX: x, clientY: y }));
    };
    const center = (target) => {
      const { left, top, width, height } = target.getBoundingClientRect();
      return [left + width / 2, top + height / 2];
    };
    const [legendButton, longPressButton] = element.querySelectorAll('.lovely-chart--button');
    const slider = element.querySelector('.lovely-chart--minimap-slider-inner');
    const [sliderX, sliderY] = center(slider);
    const plot = element.querySelector('.lovely-chart--tooltip');
    const plotBox = plot.getBoundingClientRect();
    legendButton.click();
    await wait(50);
    fire(longPressButton, 'mousedown', ...center(longPressButton));
    fire(longPressButton, 'mousedown', ...center(longPressButton));
    fire(slider, 'mousedown', sliderX, sliderY);
    fire(document, 'mousemove', sliderX - 20, sliderY);
    fire(plot, 'mousemove', plotBox.right - 10, plotBox.top + plotBox.height / 2);
    log.length = 0;
    window.lateCallbacks = 0;
    if (action === 'update') {
      window.probeChart.update(buildParams(newLabels));
      fire(element.querySelector('.lovely-chart--tooltip'), 'click', ...center(plot));
    } else {
      window.dispatchEvent(new Event('orientationchange'));
      window.probeChart.destroy();
    }
    window.isCountingLateCallbacks = true;
    const htmlClass = document.documentElement.className;

    const readCaption = () => element.querySelector('.lovely-chart--header-caption')?.textContent;
    await wait(300);
    const captionBefore = readCaption();
    fire(document, 'mousemove', sliderX - 80, sliderY);
    await wait(700);
    const captionAfter = readCaption();
    fire(document, 'mouseup', sliderX - 80, sliderY);
    window.isCountingLateCallbacks = false;
    window.removeEventListener('error', onError);

    return { log, errors, htmlClass, captionBefore, captionAfter, lateCallbacks: window.lateCallbacks };
  }, { action, labels: INTERRUPTED_LABELS, newLabels: INTERRUPTING_LABELS, colors: INTERRUPTED_COLORS });
}

// Counts the frame and timer callbacks that fire while `window.isCountingLateCallbacks` is set
function countLateCallbacks(page) {
  return page.evaluate(() => {
    window.realSetTimeout = window.setTimeout.bind(window);
    ['setTimeout', 'setInterval', 'requestAnimationFrame'].forEach((name) => {
      const schedule = window[name].bind(window);
      window[name] = (callback, ...args) => schedule((...callbackArgs) => {
        if (window.isCountingLateCallbacks) window.lateCallbacks++;
        callback(...callbackArgs);
      }, ...args);
    });
  });
}

// Paints the whole plot canvas of the probe chart in `CLIP_PROBE_COLOR`, and returns the center and the radius, in CSS
// px, of the circle it drew before
function paintOverProbeCircle(page) {
  return page.evaluate((color) => {
    const canvas = document.querySelector('#probe .lovely-chart--container > canvas');
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / canvas.clientWidth;
    let left = Infinity;
    let right = -1;
    let top = Infinity;
    let bottom = -1;
    for (let j = 3; j < data.length; j += 4) {
      if (data[j] > 128) {
        const x = (j - 3) / 4 % canvas.width;
        const y = Math.floor((j - 3) / 4 / canvas.width);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = `rgb(${color.join(', ')})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    return {
      center: [(left + right + 1) / 2 / scale, (top + bottom + 1) / 2 / scale],
      radius: (right - left + 1) / 2 / scale,
    };
  }, CLIP_PROBE_COLOR);
}

// Replays the zoom-in or the zoom-out transition of the zoomed probe circle, painted over, and reads at each fraction
// of it how far the plot canvas shows from the circle center along its row and its column, on screen
async function measureCircleTransition(page, { isOut, fractions, box, center }) {
  await page.evaluate((shouldZoomOut) => {
    const container = document.querySelector('#probe .lovely-chart--container');
    container.classList.remove('lovely-chart--state-animating');
    if (shouldZoomOut) {
      container.classList.remove('lovely-chart--state-zoomed-in');
    }
    container.getBoundingClientRect();
    container.classList.add('lovely-chart--state-animating');
  }, isOut);

  const reaches = [];
  for (const fraction of fractions) {
    await page.evaluate((at) => {
      document.querySelector('#probe .lovely-chart--container > canvas').getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration * at;
      });
    }, fraction);
    const screenshot = await page.screenshot({ clip: box });
    reaches.push(await page.evaluate(async ({ source, origin, color, at }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${source}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
      const [cx, cy] = origin;
      const [x0, y0] = origin.map(Math.floor);
      const isShown = (x, y) => {
        const j = (y * width + x) * 4;
        return x >= 0 && x < width && y >= 0 && y < height
          && color.every((channel, k) => Math.abs(data[j + k] - channel) < 60);
      };
      const countShown = (dx, dy) => {
        let count = 0;
        while (isShown(x0 + dx * (count + 1), y0 + dy * (count + 1))) count++;
        return count;
      };
      // From the center to the outer side of the last pixel shown each way
      const distances = [
        cx - x0 + countShown(-1, 0),
        x0 + 1 + countShown(1, 0) - cx,
        cy - y0 + countShown(0, -1),
        y0 + 1 + countShown(0, 1) - cy,
      ];
      return { fraction: at, shortest: Math.min(...distances), longest: Math.max(...distances) };
    }, { source: screenshot.toString('base64'), origin: center, color: CLIP_PROBE_COLOR, at: fraction }));
  }

  return reaches;
}

async function hoverWiggle(page, box, fx, fy) {
  await page.mouse.move(box.x + box.width * (fx - 0.05), box.y + box.height * fy, { steps: 5 });
  await waitForIdle(page, 200);
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 5 });
  await waitForIdle(page, 500);
}

// Whether a console message reports a resource of another site failing to load, as a badge on the demo page can
// while its service is down
function isOtherSiteLoadFailure(message, pageUrl) {
  return message.text().startsWith('Failed to load resource')
    && new URL(message.location().url || pageUrl).origin !== new URL(pageUrl).origin;
}

async function drag(page, x, y, dx, dy, steps = 10) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
}

// Opens the demo page on a page of its own, whose errors join `errors` named by the section it runs, and waits until
// every demo chart has painted, or the longest that takes, after which the check of the painted charts tells
async function openDemoPage(browser, url, errors) {
  const page = await newTestPage(browser, { viewport: { width: 900, height: 1200 } });
  const worker = { page, charts: page.locator('.lovely-chart--container'), errors, browser, url, sectionTitle: '' };
  page.on('pageerror', (err) => errors.push(`[${worker.sectionTitle}] [pageerror] ${err.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isOtherSiteLoadFailure(m, url)) {
      errors.push(`[${worker.sectionTitle}] [console] ${m.text()}`);
    }
  });

  await page.goto(url);
  await page.waitForSelector('.lovely-chart--container', { timeout: 10000 });
  await waitForIdle(page, DEMO_SETTLE_TIME);
  await page.waitForFunction(({ count, minPainted }) => {
    const canvases = [...document.querySelectorAll('.lovely-chart--container')].map((el) => el.querySelector('canvas'));
    return canvases.length === count && canvases.every((canvas) => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      for (let j = 3; j < data.length && painted <= minPainted; j += 4) if (data[j]) painted++;
      return painted > minPainted;
    });
  }, { count: EXPECTED_CHARTS, minPainted: MIN_PAINTED_PIXELS }, { timeout: DEMO_PAINT_TIMEOUT, polling: 100 })
    .catch(() => undefined);

  return worker;
}

// Runs the sections on the pages of the workers, each taking the next section left as it ends one, from the top left
// corner of its page as a page of its own starts, and prints the checks of each section in the order of this file,
// once those of every section before it are printed
async function runSections(workers) {
  const results = [];
  let next = 0;
  let printed = 0;
  /** @type {Error | undefined} */
  let failure;
  const print = () => {
    for (; printed < SECTIONS.length && results[printed]; printed++) {
      results[printed].forEach((line) => console.log(line));
    }
  };

  await Promise.all(workers.map(async (worker) => {
    while (next < SECTIONS.length && !failure) {
      const index = next++;
      const { title, run } = SECTIONS[index];
      const checks = [];
      const sectionStartedAt = performance.now();
      worker.sectionTitle = title;
      await worker.page.mouse.move(0, 0);
      await worker.page.evaluate(() => window.scrollTo(0, 0));
      try {
        await sectionChecks.run(checks, () => run(worker));
      } catch (err) {
        failure ??= new Error(`The section "${title}" threw`, { cause: err });
      }
      sectionTimes.push({ title, ms: performance.now() - sectionStartedAt });
      results[index] = checks;
      print();
    }
  }));

  if (failure) {
    // The sections a worker ended after the one that threw print too, those that never started leaving a gap
    results.slice(printed).forEach((checks) => checks?.forEach((line) => console.log(line)));
    throw failure;
  }
}

// Adds a part of the run that relies on no other, so that any worker can run it on its page of the demo: `run` takes
// that page, its demo charts and the errors of the run, the browser and the URL of the demo page
function section(title, run) {
  SECTIONS.push({ title, run });
}

section('Rendering', async ({ page, charts }) => {
  const count = await charts.count();
  check('all demo charts created', count === EXPECTED_CHARTS, `got ${count}`);

  for (let i = 0; i < count; i++) {
    const painted = await paintedPixels(page, i);
    const title = await charts.nth(i).locator('.lovely-chart--header-title').first().textContent();
    check(`chart ${i} "${title}" canvas painted`, painted > 1000, `${painted}px`);
  }

  const chart0 = charts.nth(0);
  const caption0 = () => chart0.locator('.lovely-chart--header-caption').textContent();

  // --- Tooltip on hover ---
  const plot0 = await chart0.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, plot0, 0.45, 0.5);
  const balloon0 = chart0.locator('.lovely-chart--tooltip-balloon');
  const tooltipShown = await balloon0.evaluate((el) => el.classList.contains('lovely-chart--state-shown'));
  const tooltipText = (await balloon0.textContent()).trim();
  check('tooltip appears on hover', tooltipShown && tooltipText.length > 0, JSON.stringify(tooltipText.slice(0, 40)));

  // --- Minimap: slider drag pans the range ---
  const capBefore = await caption0();
  const slider = await chart0.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, slider.x + slider.width / 2, slider.y + slider.height / 2, -150, 0);
  await waitForIdle(page, 600);
  const capAfterSlider = await caption0();
  check('minimap slider drag changes range', capAfterSlider !== capBefore, `${capBefore} -> ${capAfterSlider}`);

  // --- Minimap: ear drag resizes the range ---
  const ear = await chart0.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await drag(page, ear.x + ear.width / 2, ear.y + ear.height / 2, -120, 0, 8);
  await waitForIdle(page, 600);
  const capAfterEar = await caption0();
  check('minimap ear drag changes range', capAfterEar !== capAfterSlider, `${capAfterSlider} -> ${capAfterEar}`);

  // --- A drag across the plot selects a range, and a double click shows the whole range ---
  const sliderBox0 = () => chart0.locator('.lovely-chart--minimap-slider').boundingBox();
  const rulerBox0 = await chart0.locator('.lovely-chart--minimap-ruler').boundingBox();
  const sliderBeforeSelection = await sliderBox0();
  const plotForSelection = await chart0.locator('.lovely-chart--tooltip').boundingBox();
  const selectionY = plotForSelection.y + plotForSelection.height * RANGE_DRAG_HEIGHT;
  await drag(page, plotForSelection.x + plotForSelection.width * 0.3, selectionY, plotForSelection.width * 0.3, 0);
  await waitForIdle(page, RANGE_SETTLE_MS);
  const capAfterSelection = await caption0();
  const sliderAfterSelection = await sliderBox0();
  check('a drag across the plot narrows the range and the minimap window',
    capAfterSelection !== capAfterEar && sliderAfterSelection.width < sliderBeforeSelection.width,
    `${capAfterEar} -> ${capAfterSelection}, slider ${sliderBeforeSelection.width} -> ${sliderAfterSelection.width}`);
  await page.mouse.dblclick(plotForSelection.x + plotForSelection.width / 2, selectionY);
  await waitForIdle(page, RANGE_SETTLE_MS);
  const capAfterReset = await caption0();
  const sliderAfterReset = await sliderBox0();
  check('a double click on the plot shows the whole range, the minimap window over all of it',
    capAfterReset !== capAfterSelection && Math.abs(sliderAfterReset.x - rulerBox0.x) < 1
    && Math.abs(sliderAfterReset.width - rulerBox0.width) < 1,
    `${capAfterSelection} -> ${capAfterReset}, slider ${JSON.stringify(sliderAfterReset)}`);
  await page.mouse.move(5, 5);

  // --- Legend toggling ---
  const btn = chart0.locator('.lovely-chart--button').first();
  const isChecked = () => btn.evaluate((el) => el.classList.contains('lovely-chart--state-checked'));
  await btn.click();
  await waitForIdle(page, 600);
  const offWorked = !(await isChecked());
  await btn.click();
  await waitForIdle(page, 400);
  check('legend toggle unchecks and re-checks', offWorked && (await isChecked()));

  // Guard: the last checked dataset must refuse to uncheck (with a shake)
  const buttons = chart0.locator('.lovely-chart--button');
  const nBtns = await buttons.count();
  for (let i = 0; i < nBtns; i++) await buttons.nth(i).click();
  await waitForIdle(page, 400);
  const checkedLeft = await chart0.locator('.lovely-chart--button.lovely-chart--state-checked').count();
  const shaken = await chart0.locator('.lovely-chart--state-shake').count();
  check('last checked dataset refuses to uncheck', checkedLeft === 1 && shaken === 1,
    `checked: ${checkedLeft}, shake: ${shaken}`);
  for (let i = 0; i < nBtns; i++) {
    const b = buttons.nth(i);
    if (!(await b.evaluate((el) => el.classList.contains('lovely-chart--state-checked')))) await b.click();
  }
  await waitForIdle(page, 400);
});

section('Zoom in/out (chart 2: zoomable bars)', async ({ page, charts }) => {
  // Day data in docs/data/zoom_bars only covers the newest dates, so move the
  // viewport to the end of the range before clicking.
  const chart2 = charts.nth(2);
  await chart2.scrollIntoViewIfNeeded();
  const slider2 = await chart2.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, slider2.x + slider2.width / 2, slider2.y + slider2.height / 2, 600, 0, 12);
  await waitForIdle(page, 800);

  const caption2 = () => chart2.locator('.lovely-chart--header-caption').textContent();
  const rangeCaption = await caption2();
  // The last column regresses easily: its hourly data window is clamped at the
  // data edge, so the clicked day is not in the window's middle
  const plot2 = await chart2.locator('.lovely-chart--tooltip').boundingBox();
  const lastColumnFx = (plot2.width - 5) / plot2.width;
  await hoverWiggle(page, plot2, lastColumnFx, 0.6);
  const clickedDay = await chart2.locator('.lovely-chart--tooltip-title').textContent();
  await page.mouse.click(plot2.x + plot2.width * lastColumnFx, plot2.y + plot2.height * 0.6);
  await waitForIdle(page, 2000);

  const zoomOutCtl = chart2.locator('.lovely-chart--header-zoom-out-control');
  const zoomedIn = (await zoomOutCtl.count()) > 0;
  const dayCaption = await caption2();
  check('zoom-in shows the clicked day', zoomedIn && dayCaption.includes(clickedDay),
    `clicked: ${JSON.stringify(clickedDay)}, caption: ${JSON.stringify(dayCaption)}`);

  if (zoomedIn) {
    await zoomOutCtl.first().click();
    await waitForIdle(page, 2000);
    // The control element lingers hidden until the next text transition, so
    // the restored caption is the reliable signal that zoom-out completed.
    check('zoom-out restores the range', (await caption2()) === rangeCaption, JSON.stringify(await caption2()));
  }
});

section('Pie/donut hover', async ({ page, charts }) => {
  const pie = charts.nth(6);
  await pie.scrollIntoViewIfNeeded();
  const piePlot = await pie.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, { ...piePlot, width: piePlot.width + 140 }, 0.5, 0.42);
  const pieBalloon = pie.locator('.lovely-chart--tooltip-balloon');
  const pieShown = await pieBalloon.evaluate((el) => el.classList.contains('lovely-chart--state-shown'));
  const pieText = (await pieBalloon.textContent()).trim();
  check('pie sector hover shows tooltip', pieShown && pieText.length > 0, JSON.stringify(pieText.slice(0, 40)));
});

section('Start-zoomed init: shares, opened already as a pie, no morph', async ({ page }) => {
  const startZoomed = await mountProbe(page, {
    dataUrl: './data/areas.json',
    config: { title: 'Probe — Start Zoomed Shares', initialZoom: 'last' },
  });
  await startZoomed.scrollIntoViewIfNeeded();
  const startedZoomed = await startZoomed.evaluate((el) =>
    el.classList.contains('lovely-chart--state-zoomed-in'));
  const startZoomOut = startZoomed.locator('.lovely-chart--header-zoom-out-control');
  const hasZoomOut = (await startZoomOut.count()) > 0;
  check('start-zoomed shares opens already zoomed', startedZoomed && hasZoomOut,
    `zoomed-in: ${startedZoomed}, zoom-out control: ${hasZoomOut}`);

  if (hasZoomOut) {
    await startZoomOut.first().click();
    await waitForIdle(page, 2000);
    const stillZoomed = await startZoomed.evaluate((el) =>
      el.classList.contains('lovely-chart--state-zoomed-in'));
    check('start-zoomed zoom-out returns to overview', !stillZoomed, `still zoomed: ${stillZoomed}`);
  }
  await unmountProbe(page);
});

section('Zoom to shares on an absolute stacked bar chart', async ({ page }) => {
  // `bars.json` has no `isPercentage`, so this only zooms because of `zoomToShares`.
  const shareBars = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: {
      title: 'Probe — Zoom to Shares',
      zoomToShares: true,
      circleLabelsAround: 0,
      zoomType: 'donut',
      initialZoom: 'last',
    },
  });
  await shareBars.scrollIntoViewIfNeeded();
  const isCircle = await shareBars.evaluate((el) =>
    Boolean(el.querySelector('.lovely-chart--container-type-circle'))
    || el.classList.contains('lovely-chart--container-type-circle'));
  const shareZoomOut = shareBars.locator('.lovely-chart--header-zoom-out-control');
  const shareHasZoomOut = (await shareZoomOut.count()) > 0;
  check('zoomToShares opens shares on a non-percentage chart', isCircle && shareHasZoomOut,
    `circle container: ${isCircle}, zoom-out control: ${shareHasZoomOut}`);

  if (shareHasZoomOut) {
    await shareZoomOut.first().click();
    await waitForIdle(page, 2000);
    const stillCircle = await shareBars.evaluate((el) =>
      el.classList.contains('lovely-chart--state-zoomed-in'));
    check('zoomToShares zoom-out returns to bars', !stillCircle, `still zoomed: ${stillCircle}`);
  }
  await unmountProbe(page);
});

section('A zoom transition clips the plot to the circle and a focused sector\'s shift, at any plot '
  + 'size', async ({ page, errors }) => {
  // A narrow column shows the whole circle on a wide page, a short plot closes the clip on its small circle, and a
  // sparkline centers it on its circle, which no axis band moves
  const circleClips = [];
  for (const { name, width, plotHeight, zoomType, isSparkline = false } of [
    { name: 'narrow donut', width: 392, zoomType: 'donut' },
    { name: 'short pie', plotHeight: 160, zoomType: 'pie' },
    { name: 'sparkline pie', plotHeight: 200, zoomType: 'pie', isSparkline: true },
  ]) {
    const circleProbe = await mountProbe(page, {
      width,
      config: {
        type: 'bar',
        isStacked: true,
        title: `Probe — Zoom transition (${name})`,
        zoomToShares: true,
        circleLabelsAround: 0,
        zoomType,
        labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
        labelType: 'month',
        datasets: [
          { name: 'Alpha', color: '#3497ED', values: [500, 400, 300, 400, 500] },
          { name: 'Beta', color: '#9ED448', values: [500, 600, 700, 600, 500] },
        ],
        plotHeight,
        isSparkline,
      },
    });
    await circleProbe.scrollIntoViewIfNeeded();
    const circlePlot = await circleProbe.locator('.lovely-chart--tooltip').boundingBox();
    await hoverWiggle(page, circlePlot, 0.5, 0.6);
    await page.mouse.click(circlePlot.x + circlePlot.width * 0.5, circlePlot.y + circlePlot.height * 0.6);
    await waitForIdle(page, 2000);
    // A pointer off the chart leaves every sector in place
    await page.mouse.move(0, 0);
    await waitForIdle(page, 600);

    const isCircleZoomed = await circleProbe.evaluate((el) => el.classList.contains('lovely-chart--state-zoomed-in'));
    const box = await circleProbe.locator('canvas').first().boundingBox();
    const { center, radius } = await paintOverProbeCircle(page);
    const zoomIn = await measureCircleTransition(page, { isOut: false, fractions: CIRCLE_IN_FRACTIONS, box, center });
    const zoomOut = await measureCircleTransition(page, { isOut: true, fractions: CIRCLE_OUT_FRACTIONS, box, center });
    const tight = [
      ...zoomIn.filter(({ fraction }) => CIRCLE_IN_TIGHT_FRACTIONS.includes(fraction)),
      ...zoomOut.filter(({ fraction }) => CIRCLE_OUT_TIGHT_FRACTIONS.includes(fraction)),
    ];
    circleClips.push({
      name,
      isCircleZoomed,
      radius,
      shortest: Math.min(...[...zoomIn, ...zoomOut].map(({ shortest }) => shortest)),
      tightest: Math.max(...tight.map(({ longest }) => longest)),
    });
    await unmountProbe(page);
  }
  const describeClips = (key) => circleClips.map((clip) => `${clip.name}: radius ${clip.radius}, reach ${clip[key]}`)
    .join('; ');
  check('a zoom transition never clips the circle or a focused sector',
    circleClips.every(({ isCircleZoomed, radius, shortest }) => (
      isCircleZoomed && shortest >= radius + CIRCLE_SHIFT - CLIP_EDGE_TOLERANCE
    )),
    describeClips('shortest'));
  check('a zoom transition closes its clip on the circle',
    circleClips.every(({ isCircleZoomed, radius, tightest }) => (
      isCircleZoomed && tightest <= radius + CIRCLE_SHIFT + CLIP_EDGE_TOLERANCE
    )),
    describeClips('tightest'));

  // A zoom out of a pie as soon as the zoom in allows it keeps its transition class to the end of the transition
  const quickZoomOut = await page.evaluate(async ({ watch }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      zoomToShares: true,
      title: 'Probe — Quick zoom out',
      labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2029, 0, 1 + i)),
      datasets: [
        { name: 'A', values: Array.from({ length: 20 }, (_, i) => 300 + (i % 4) * 100) },
        { name: 'B', values: Array.from({ length: 20 }, (_, i) => 500 + (i % 3) * 100) },
      ],
    });
    await window.idleTracker.wait(800);
    const container = element.querySelector('.lovely-chart--container');
    const plot = element.querySelector('.lovely-chart--tooltip');
    const { left, top, width, height } = plot.getBoundingClientRect();
    const pointer = { bubbles: true, clientX: left + width / 2, clientY: top + height / 2 };
    plot.dispatchEvent(new MouseEvent('mousemove', pointer));
    plot.dispatchEvent(new MouseEvent('click', pointer));
    // The zoom out control takes a click once the zoom in binds it, and the click leaves the zoomed-in state
    const zoomOutStart = await new Promise((resolve) => {
      const clickZoomOut = () => {
        if (!container.classList.contains('lovely-chart--state-zoomed-in')) {
          resolve(performance.now());
          return;
        }
        element.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)')?.click();
        requestAnimationFrame(clickZoomOut);
      };
      requestAnimationFrame(clickZoomOut);
    });
    const frames = [];
    await new Promise((resolve) => {
      const readFrame = () => {
        frames.push(container.classList.contains('lovely-chart--state-animating'));
        if (performance.now() - zoomOutStart < watch) {
          requestAnimationFrame(readFrame);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(readFrame);
    });

    return { frames: frames.length, framesWithoutTransition: frames.filter((isAnimating) => !isAnimating).length };
  }, { watch: QUICK_ZOOM_OUT_WATCH });
  await unmountProbe(page);
  check('a zoom out right after the zoom in keeps its transition to the end',
    quickZoomOut.frames > 0 && quickZoomOut.framesWithoutTransition === 0, JSON.stringify(quickZoomOut));

  // A second zoom click before the zoom of the first settles leaves the chart zoomed in, with no page error: stacked bars
  // zoomed to shares, and lines zoomed by `onZoom`
  const doubleZoomCharts = [
    {
      name: 'zoomToShares stacked bars',
      mount: () => mountProbe(page, {
        config: {
          type: 'bar',
          isStacked: true,
          zoomToShares: true,
          title: 'Probe — Double zoom click',
          labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2029, 0, 1 + i)),
          datasets: [
            { name: 'A', values: Array.from({ length: 20 }, (_, i) => 300 + (i % 4) * 100) },
            { name: 'B', values: Array.from({ length: 20 }, (_, i) => 500 + (i % 3) * 100) },
          ],
        },
      }),
    },
    {
      name: 'onZoom lines',
      mount: () => mountLinesZoom(page, {
        overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
        zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
      }),
    },
  ];
  for (const { name, mount } of doubleZoomCharts) {
    const pageErrorsBefore = errors.filter((error) => error.startsWith('[pageerror]')).length;
    const doubleZoomChart = await mount();
    await doubleZoomChart.evaluate(async (container, gap) => {
      const plot = container.querySelector('.lovely-chart--tooltip');
      const { left, top, width, height } = plot.getBoundingClientRect();
      // A pointer moves before each click, which lets the tooltip take the second one
      const clickAt = (fx) => {
        const pointer = { bubbles: true, clientX: left + width * fx, clientY: top + height / 2 };
        plot.dispatchEvent(new MouseEvent('mousemove', pointer));
        plot.dispatchEvent(new MouseEvent('click', pointer));
      };
      clickAt(0.9);
      // eslint-disable-next-line no-restricted-syntax -- the second click falls within the double-click gap
      await new Promise((resolve) => setTimeout(resolve, gap));
      clickAt(0.85);
    }, DOUBLE_ZOOM_CLICK_GAP);
    await waitForIdle(page, 2000);
    const isZoomedIn = (await doubleZoomChart
      .locator('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').count()) > 0;
    const doubleZoomErrors = errors.filter((error) => error.startsWith('[pageerror]')).slice(pageErrorsBefore);
    await unmountProbe(page);
    check(`two zoom clicks ${DOUBLE_ZOOM_CLICK_GAP}ms apart zoom ${name} in with no page error`,
      isZoomedIn && !doubleZoomErrors.length, `zoomed in: ${isZoomedIn}, ${doubleZoomErrors.join('; ').slice(0, 200)}`);
  }

  // A rebuild returns a zoomed chart to its overview, which `onZoomChange` reports
  const mountZoomedShares = () => page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/bars.json').then((response) => response.json());
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeParams = {
      ...data,
      title: 'Probe — Zoom reports',
      zoomToShares: true,
      onZoomChange: (labelValue) => window.probeLog.push(labelValue === undefined ? 'out' : 'in'),
    };
    window.probeChart = new LovelyChart(element, { ...window.probeParams, initialZoom: 'last' });
    await window.idleTracker.wait(1800);
    return [...window.probeLog];
  });
  const zoomedBeforeResize = await mountZoomedShares();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width - 20, height: viewport.height });
  await waitForIdle(page, 1200);
  await page.setViewportSize(viewport);
  await waitForIdle(page, 1200);
  const zoomAfterResize = await page.evaluate(() => window.probeLog);
  await unmountProbe(page);
  const zoomedBeforeUpdate = await mountZoomedShares();
  const zoomAfterUpdate = await page.evaluate(async () => {
    window.probeChart.update(window.probeParams);
    await window.idleTracker.wait(600);
    return window.probeLog;
  });
  await unmountProbe(page);
  check('a resize out of a zoom reports the zoom-out',
    JSON.stringify(zoomedBeforeResize) === '["in"]' && JSON.stringify(zoomAfterResize) === '["in","out"]',
    JSON.stringify(zoomAfterResize));
  check('update() out of a zoom reports the zoom-out',
    JSON.stringify(zoomedBeforeUpdate) === '["in"]' && JSON.stringify(zoomAfterUpdate) === '["in","out"]',
    JSON.stringify(zoomAfterUpdate));
});

section('update() and destroy() of a chart mid-interaction', async ({ page, browser, url }) => {
  const updated = await interruptProbe(page, 'update');
  const updatedProbe = page.locator('#probe .lovely-chart--container');
  const updatedPaint = [];
  for (const color of INTERRUPTED_COLORS) updatedPaint.push((await findColor(updatedProbe, parseHex(color))).count);
  await unmountProbe(page);
  check('update() mid-interaction throws nothing', updated.errors.length === 0, updated.errors.join('; '));
  check('update() mid-interaction reports nothing of the replaced chart', updated.log.length === 0,
    JSON.stringify(updated.log));
  check('update() ends a drag of the replaced chart',
    !updated.htmlClass.includes('cursor-') && updated.captionBefore === updated.captionAfter,
    JSON.stringify(updated));
  check('update() mid-interaction draws every dataset of the new data in full colour',
    updatedPaint.every((count) => count > MIN_DATASET_PIXELS), JSON.stringify(updatedPaint));

  // The tooltip that calls `onSelectedIndexChange` carries on after it, with the data of the chart it belongs to
  const rebuildFromCallbackErrors = await page.evaluate(async ({ labels, newLabels }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener('error', onError);
    let isUpdated = false;
    const buildParams = (length) => ({
      type: 'line',
      title: 'Probe — Rebuilt from a callback',
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length }, (_, i) => i) }],
      onSelectedIndexChange: (index) => {
        if (index === undefined || isUpdated) return;
        isUpdated = true;
        window.probeChart.update(buildParams(newLabels));
      },
    });
    const element = document.createElement('div');
    element.id = 'probe';
    document.body.appendChild(element);
    window.probeChart = new LovelyChart(element, buildParams(labels));
    await window.idleTracker.wait(800);
    const plot = element.querySelector('.lovely-chart--tooltip');
    const { right, top, height } = plot.getBoundingClientRect();
    plot.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: right - 10, clientY: top + height / 2 }));
    await window.idleTracker.wait(300);
    window.removeEventListener('error', onError);
    return isUpdated ? errors : ['onSelectedIndexChange not called'];
  }, { labels: INTERRUPTED_LABELS, newLabels: INTERRUPTING_LABELS });
  await unmountProbe(page);
  check('update() from onSelectedIndexChange to fewer labels throws nothing', rebuildFromCallbackErrors.length === 0,
    rebuildFromCallbackErrors.join('; '));

  // A page of its own counts every frame and timer, which the demo charts would add to
  const isolatedPage = await newTestPage(browser, { viewport: { width: 900, height: 1200 } });
  const isolatedErrors = [];
  isolatedPage.on('pageerror', (err) => isolatedErrors.push(err.message));
  await isolatedPage.goto(`${url}isolated`);
  await isolatedPage.addStyleTag({ url: `${url}LovelyChart.css` });
  await countLateCallbacks(isolatedPage);
  const destroyed = await interruptProbe(isolatedPage, 'destroy');
  await isolatedPage.close();
  check('destroy() mid-interaction throws nothing and reports nothing',
    destroyed.errors.length === 0 && isolatedErrors.length === 0 && destroyed.log.length === 0,
    JSON.stringify([...isolatedErrors, ...destroyed.log]));
  check('destroy() ends a drag and leaves no frame or timer running',
    !destroyed.htmlClass.includes('cursor-') && destroyed.lateCallbacks === 0,
    `html: "${destroyed.htmlClass}", callbacks after destroy(): ${destroyed.lateCallbacks}`);
});

section('update() keeps the hidden datasets, the window, the zoom and the selection its options ask it '
  + 'to', async ({ page }) => {
  const keptFilter = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const buildParams = (names) => ({
      type: 'line',
      title: 'Probe — Kept filter',
      labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
      datasets: names.map((name, i) => ({
        name, values: [1, 2, 3, 4, 5].map((value) => value * (i + 1)), isInitiallyHidden: name === 'D',
      })),
      onHiddenSeriesChange: (hiddenNames, indexes) => log.push(`${hiddenNames.join()}@${indexes.join()}`),
    });
    const hideSecond = async () => {
      element.querySelectorAll('.lovely-chart--button')[1].click();
      await window.idleTracker.wait(300);
    };
    const chart = new LovelyChart(element, buildParams(['A', 'B', 'C']));
    const readUpdate = async (names, options) => {
      chart.update(buildParams(names), options);
      await window.idleTracker.wait(300);
      const hidden = [...element.querySelectorAll('.lovely-chart--button')]
        .filter((button) => !button.classList.contains('lovely-chart--state-checked'))
        .map((button) => button.textContent);
      return { hidden: hidden.join(), log: log.join(' ') };
    };
    await window.idleTracker.wait(300);
    await hideSecond();
    const byPlace = await readUpdate(['A', 'B', 'C'], { shouldKeepFilter: true });
    // D starts hidden of its own
    const byName = await readUpdate(['C', 'B', 'D', 'A'], { shouldKeepFilter: true });
    const allHidden = await readUpdate(['B'], { shouldKeepFilter: true });
    await readUpdate(['A', 'B', 'C'], { shouldKeepFilter: true });
    await hideSecond();
    const reset = await readUpdate(['A', 'B', 'C'], {});
    chart.destroy();
    element.remove();
    return { byPlace, byName, allHidden, reset };
  });
  check('update() with shouldKeepFilter keeps the hidden datasets by place, unreported',
    keptFilter.byPlace.hidden === 'B' && keptFilter.byPlace.log === 'B@1', JSON.stringify(keptFilter.byPlace));
  check('update() with shouldKeepFilter matches the hidden datasets by name once their count changes, and reports them',
    keptFilter.byName.hidden === 'B,D' && keptFilter.byName.log === 'B@1 B,D@1,2', JSON.stringify(keptFilter.byName));
  check('update() with shouldKeepFilter shows the datasets of a match that would hide them all, and reports it',
    keptFilter.allHidden.hidden === '' && keptFilter.allHidden.log === 'B@1 B,D@1,2 @',
    JSON.stringify(keptFilter.allHidden));
  check('update() without shouldKeepFilter shows the hidden datasets again, unreported',
    keptFilter.reset.hidden === '' && keptFilter.reset.log === 'B@1 B,D@1,2 @ B@1', JSON.stringify(keptFilter.reset));

  const keptWindow = await page.evaluate(async ({ keptRange, updateRange, otherLabelsRange }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const buildParams = (firstDay, minimapRange) => ({
      type: 'line',
      title: 'Probe — Kept window',
      labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2026, 0, firstDay + i)),
      datasets: [{ name: 'A', values: Array.from({ length: 20 }, (_, i) => i % 5) }],
      withMinimap: true,
      minimapRange,
    });
    const chart = new LovelyChart(element, buildParams(1, keptRange));
    const readUpdate = async (params, options) => {
      chart.update(params, options);
      await window.idleTracker.wait(300);
      const [mask, slider] = element.querySelector('.lovely-chart--minimap-ruler').children;
      const begin = parseFloat(mask.style.width);
      return [begin, begin + parseFloat(slider.style.width)].map((edge) => Math.round(edge) / 100);
    };
    await window.idleTracker.wait(300);
    const kept = await readUpdate(buildParams(1, updateRange), { shouldKeepZoom: true });
    const otherLabels = await readUpdate(buildParams(2, otherLabelsRange), { shouldKeepZoom: true });
    const reset = await readUpdate(buildParams(2, updateRange), {});
    chart.destroy();
    element.remove();
    return { kept, otherLabels, reset };
  }, { keptRange: KEPT_RANGE, updateRange: UPDATE_RANGE, otherLabelsRange: OTHER_LABELS_RANGE });
  check('update() with shouldKeepZoom keeps the minimap window over the one of the data',
    JSON.stringify(keptWindow.kept) === JSON.stringify(KEPT_RANGE), JSON.stringify(keptWindow.kept));
  check('update() with shouldKeepZoom opens on the window of data with other labels',
    JSON.stringify(keptWindow.otherLabels) === JSON.stringify(OTHER_LABELS_RANGE),
    JSON.stringify(keptWindow.otherLabels));
  check('update() without shouldKeepZoom opens on the window of the data',
    JSON.stringify(keptWindow.reset) === JSON.stringify(UPDATE_RANGE), JSON.stringify(keptWindow.reset));

  const keptZoom = await page.evaluate(async (keptRange) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/bars.json').then((response) => response.json());
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const params = {
      ...data,
      title: 'Probe — Kept zoom',
      zoomToShares: true,
      minimapRange: keptRange,
      onZoomChange: (labelValue) => log.push(labelValue === undefined ? 'out' : 'in'),
    };
    const otherParams = {
      ...params,
      labels: data.labels.slice(1),
      datasets: data.datasets.map((dataset) => ({ ...dataset, values: dataset.values.slice(1) })),
    };
    const readView = () => {
      const [mask, slider] = element.querySelector('.lovely-chart--minimap-ruler').children;
      const begin = parseFloat(mask.style.width);
      const { classList } = element.querySelector('.lovely-chart--container');
      return {
        isZoomedIn: classList.contains('lovely-chart--state-zoomed-in'),
        window: [begin, begin + parseFloat(slider.style.width)].map((edge) => Math.round(edge) / 100),
        log: log.join(),
      };
    };
    let chart = new LovelyChart(element, { ...params, initialZoom: 'last' });
    await window.idleTracker.wait(1800);
    chart.update({ ...params, minimapRange: 'full' }, { shouldKeepZoom: true });
    await window.idleTracker.wait(1800);
    const kept = readView();
    element.querySelector('.lovely-chart--header-zoom-out-control').click();
    await window.idleTracker.wait(1800);
    const zoomedOut = readView();
    chart.destroy();
    log.length = 0;
    chart = new LovelyChart(element, { ...params, initialZoom: 'last' });
    await window.idleTracker.wait(1800);
    chart.update(otherParams, { shouldKeepZoom: true });
    await window.idleTracker.wait(1800);
    const otherLabels = readView();
    chart.destroy();
    element.remove();
    return { kept, zoomedOut, otherLabels };
  }, KEPT_RANGE);
  check('update() with shouldKeepZoom keeps a zoom, unreported',
    keptZoom.kept.isZoomedIn && keptZoom.kept.log === 'in', JSON.stringify(keptZoom.kept));
  check('a zoom out of a zoom update() kept returns to the window before the zoom',
    !keptZoom.zoomedOut.isZoomedIn && JSON.stringify(keptZoom.zoomedOut.window) === JSON.stringify(KEPT_RANGE)
    && keptZoom.zoomedOut.log === 'in,out', JSON.stringify(keptZoom.zoomedOut));
  check('update() with shouldKeepZoom ends the zoom on other labels, and reports it',
    !keptZoom.otherLabels.isZoomedIn && keptZoom.otherLabels.log === 'in,out', JSON.stringify(keptZoom.otherLabels));

  const zoomedFilter = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/bars.json').then((response) => response.json());
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const params = {
      ...data,
      title: 'Probe — Kept filter of a zoom',
      zoomToShares: true,
      onHiddenSeriesChange: (hiddenNames) => log.push(hiddenNames.join()),
    };
    const readView = () => ({
      isZoomedIn: element.querySelector('.lovely-chart--container').classList.contains('lovely-chart--state-zoomed-in'),
      hidden: [...element.querySelectorAll('.lovely-chart--button')]
        .filter((button) => !button.classList.contains('lovely-chart--state-checked'))
        .map((button) => button.textContent)
        .join(),
      log: log.join(' '),
    });
    // A chart opened zoomed, whose second dataset the reader hides in the pie
    const mountZoomed = async () => {
      log.length = 0;
      const chart = new LovelyChart(element, { ...params, initialZoom: 'last' });
      await window.idleTracker.wait(1800);
      element.querySelectorAll('.lovely-chart--button')[1].click();
      await window.idleTracker.wait(600);
      return chart;
    };
    let chart = await mountZoomed();
    chart.update({ ...params }, { shouldKeepFilter: true, shouldKeepZoom: true });
    await window.idleTracker.wait(1800);
    const zoomed = readView();
    // The zoom out on its way clears the live filter, which it carries back to the overview
    element.querySelector('.lovely-chart--header-zoom-out-control').click();
    chart.update({ ...params }, { shouldKeepFilter: true });
    await window.idleTracker.wait(1800);
    const zoomingOut = readView();
    chart.destroy();
    chart = await mountZoomed();
    chart.update({ ...params }, { shouldKeepFilter: true });
    await window.idleTracker.wait(1800);
    const overview = readView();
    chart.destroy();
    element.remove();
    return { zoomed, zoomingOut, overview };
  });
  check('update() with shouldKeepFilter and shouldKeepZoom keeps a dataset hidden in a zoomed pie, unreported',
    zoomedFilter.zoomed.isZoomedIn && zoomedFilter.zoomed.hidden === 'Oranges' && zoomedFilter.zoomed.log === 'Oranges',
    JSON.stringify(zoomedFilter.zoomed));
  check('update() with shouldKeepFilter keeps a dataset hidden in a zoomed pie through a zoom out on its way',
    !zoomedFilter.zoomingOut.isZoomedIn && zoomedFilter.zoomingOut.hidden === 'Oranges'
    && zoomedFilter.zoomingOut.log === 'Oranges', JSON.stringify(zoomedFilter.zoomingOut));
  check('update() with shouldKeepFilter keeps a dataset hidden in a zoomed pie in the overview it opens, unreported',
    !zoomedFilter.overview.isZoomedIn && zoomedFilter.overview.hidden === 'Oranges'
    && zoomedFilter.overview.log === 'Oranges', JSON.stringify(zoomedFilter.overview));

  const keptSelection = await page.evaluate(async (selectedIndex) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    // Ten days of January from `firstDay`, of which the chart first selects the day `2 + selectedIndex`
    const buildParams = (firstDay) => ({
      type: 'bar',
      isStacked: true,
      title: 'Probe — Kept selection',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, firstDay + i)),
      datasets: [
        { name: 'A', values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3)) },
        { name: 'B', values: Array.from({ length: 10 }, (_, i) => 3 - (i % 3)) },
      ],
      onSelectedIndexChange: (index) => log.push(index ?? 'none'),
    });
    const readSelection = () => ({
      isShown: element.querySelector('.lovely-chart--tooltip-balloon').classList.contains('lovely-chart--state-shown'),
      log: log.join(),
    });
    const moveOutside = async () => {
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      await window.idleTracker.wait(300);
      return readSelection();
    };
    const chart = new LovelyChart(element, buildParams(2));
    const readUpdate = async (firstDay) => {
      chart.update(buildParams(firstDay), { shouldKeepSelection: true });
      await window.idleTracker.wait(300);
      return readSelection();
    };
    await window.idleTracker.wait(300);
    chart.selectLabel(selectedIndex);
    await window.idleTracker.wait(300);
    const kept = await readUpdate(2);
    const moved = await readUpdate(1);
    const held = await moveOutside();
    const gone = await readUpdate(selectedIndex + 3);
    const plot = element.querySelector('.lovely-chart--tooltip');
    const { left, top, width, height } = plot.getBoundingClientRect();
    plot.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, clientX: left + width / 2, clientY: top + height / 2,
    }));
    await window.idleTracker.wait(300);
    const hovered = readSelection();
    const pointerKept = await readUpdate(selectedIndex + 3);
    const pointerLeft = await moveOutside();
    chart.destroy();
    element.remove();
    return { kept, moved, held, gone, hovered, pointerKept, pointerLeft };
  }, KEPT_SELECTED_INDEX);
  check('update() with shouldKeepSelection keeps a selected label, unreported',
    keptSelection.kept.isShown && keptSelection.kept.log === `${KEPT_SELECTED_INDEX}`,
    JSON.stringify(keptSelection.kept));
  check('update() with shouldKeepSelection follows the label to its new index, and reports it',
    keptSelection.moved.isShown && keptSelection.moved.log === `${KEPT_SELECTED_INDEX},${KEPT_SELECTED_INDEX + 1}`,
    JSON.stringify(keptSelection.moved));
  check('a selection of selectLabel() that update() kept holds while the pointer moves elsewhere',
    keptSelection.held.isShown && keptSelection.held.log === keptSelection.moved.log,
    JSON.stringify(keptSelection.held));
  check('update() with shouldKeepSelection ends a selection whose label is gone, and reports it',
    !keptSelection.gone.isShown && keptSelection.gone.log === `${keptSelection.moved.log},none`,
    JSON.stringify(keptSelection.gone));
  check('a selection of the pointer that update() kept stays, unreported, and clears as the pointer leaves the chart',
    keptSelection.hovered.isShown && keptSelection.pointerKept.isShown
    && keptSelection.pointerKept.log === keptSelection.hovered.log && !keptSelection.pointerLeft.isShown
    && keptSelection.pointerLeft.log === `${keptSelection.hovered.log},none`,
    JSON.stringify([keptSelection.hovered, keptSelection.pointerKept, keptSelection.pointerLeft]));

  const reassignedLabels = await page.evaluate(async (selectedIndex) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const buildLabels = (firstDay) => Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, firstDay + i));
    // The page passes `update()` the params it created the chart with, their labels reassigned three days on
    const params = {
      type: 'bar',
      title: 'Probe — Reassigned labels',
      labels: buildLabels(1),
      datasets: [{ name: 'A', values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3)) }],
      onSelectedIndexChange: (index) => log.push(index ?? 'none'),
    };
    const chart = new LovelyChart(element, params);
    await window.idleTracker.wait(300);
    chart.selectLabel(selectedIndex);
    await window.idleTracker.wait(300);
    params.labels = buildLabels(4);
    chart.update(params, { shouldKeepSelection: true });
    await window.idleTracker.wait(300);
    chart.destroy();
    element.remove();
    return log.join();
  }, KEPT_SELECTED_INDEX);
  check('update() with shouldKeepSelection follows the label to its new index in params the page reassigned',
    reassignedLabels === `${KEPT_SELECTED_INDEX},${KEPT_SELECTED_INDEX - 3}`, reassignedLabels);
});

section('update() with isAnimated cross-fades the chart into the new data', async ({ page, browser, url }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const crossFade = await page.evaluate(async ({ fromColor, toColor, midFadeMs, pastFadeMs, tolerance }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    // eslint-disable-next-line no-restricted-syntax -- its waits read the cross-fade halfway through
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const buildParams = (color, count) => ({
      type: 'line',
      title: 'Probe — Cross-fade',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: Array.from({ length: count }, (_, j) => ({
        name: `Dataset ${j}`, color, values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3) + j),
      })),
    });
    // The pixels of a colour on the plot canvas of a chart, which its own opacity leaves as they are
    const countPixels = (chartElement, color) => {
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      const canvas = chartElement.querySelector(':scope > canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let j = 0; j < data.length; j += 4) {
        if (data[j + 3] > 100 && rgb.every((channel, k) => Math.abs(data[j + k] - channel) < tolerance)) count++;
      }
      return count;
    };
    const chart = new LovelyChart(element, buildParams(fromColor, 2));
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    await window.idleTracker.wait(300);
    chart.update(buildParams(toColor, 3), { isAnimated: true });
    const [replaced, rebuilt] = element.children;
    const replacedBox = replaced.getBoundingClientRect();
    const rebuiltBox = rebuilt.getBoundingClientRect();
    const replacedStyle = getComputedStyle(replaced);
    const start = {
      count: element.children.length,
      isAside: replaced.inert && replacedStyle.position === 'absolute' && replacedStyle.pointerEvents === 'none',
      isInPlace: ['left', 'top', 'width'].every((key) => Math.abs(replacedBox[key] - rebuiltBox[key]) < 1),
      isOutOfFlow: Math.abs(element.getBoundingClientRect().height - rebuiltBox.height) < 1,
      legendButtons: replaced.querySelectorAll('.lovely-chart--button').length,
    };
    await wait(midFadeMs);
    const plotBox = rebuilt.querySelector('.lovely-chart--tooltip').getBoundingClientRect();
    const hit = document.elementFromPoint(plotBox.left + plotBox.width / 2, plotBox.top + plotBox.height / 2);
    const mid = {
      opacities: [replaced, rebuilt].map((child) => Number(getComputedStyle(child).opacity)),
      replacedPixels: countPixels(replaced, fromColor),
      rebuiltPixels: countPixels(rebuilt, toColor),
      isHitOnRebuilt: rebuilt.contains(hit),
    };
    await window.idleTracker.wait(pastFadeMs);
    const end = [...element.children].map((child) => child.className).join(' | ');
    const readOpacities = () => [...element.children].map((child) => Number(getComputedStyle(child).opacity));
    chart.update(buildParams(fromColor, 2), { isAnimated: true });
    await wait(midFadeMs);
    const restartedFrom = readOpacities();
    chart.update(buildParams(toColor, 3), { isAnimated: true });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const restarted = { from: restartedFrom, to: readOpacities() };
    chart.destroy();
    element.remove();
    return { start, mid, end, restarted };
  }, {
    fromColor: FADE_FROM_COLOR,
    toColor: FADE_TO_COLOR,
    midFadeMs: MID_FADE_MS,
    pastFadeMs: PAST_FADE_MS,
    tolerance: COLOR_TOLERANCE,
  });
  check('update() with isAnimated holds the replaced chart and its legend in the place of the new one, out of reach',
    crossFade.start.count === 2 && crossFade.start.isAside && crossFade.start.isInPlace && crossFade.start.isOutOfFlow
    && crossFade.start.legendButtons === 2, JSON.stringify(crossFade.start));
  check('the replaced chart fades out with its data as the new one fades in with the new data and takes the pointer',
    crossFade.mid.opacities.every((opacity) => opacity > 0 && opacity < 1)
    && crossFade.mid.replacedPixels > MIN_DATASET_PIXELS && crossFade.mid.rebuiltPixels > MIN_DATASET_PIXELS
    && crossFade.mid.isHitOnRebuilt, JSON.stringify(crossFade.mid));
  check('the replaced chart leaves once the cross-fade ends', crossFade.end === 'lovely-chart--container',
    crossFade.end);
  const { from: restartedFrom, to: restartedTo } = crossFade.restarted;
  check('an animated update() mid-fade fades the chart out from where it is, as the one before it goes on fading out',
    restartedFrom.length === 2 && restartedTo.length === 3 && restartedTo[0] > 0
    && restartedTo[0] <= restartedFrom[0] && restartedTo[1] > 0
    && restartedTo[1] <= restartedFrom[1] + FADE_OPACITY_TOLERANCE,
    JSON.stringify(crossFade.restarted));

  const legendCrossFade = await page.evaluate(async ({ midFadeMs, pastFadeMs }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    // eslint-disable-next-line no-restricted-syntax -- its waits read the cross-fade of the legend halfway through
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const legend = document.createElement('div');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').append(legend, element);
    const buildParams = (names) => ({
      type: 'line',
      title: 'Probe — Cross-faded legend',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: names.map((name, j) => ({ name, values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3) + j) })),
      legendContainer: legend,
    });
    const readClassNames = (parent) => [...parent.children].map((child) => child.className).join(' | ');
    const chart = new LovelyChart(element, buildParams(['A', 'B']));
    // An element of the page after the legend, which the legend keeps its place before
    const chip = document.createElement('div');
    chip.className = 'probe-chip';
    chip.style.height = '30px';
    legend.appendChild(chip);
    legend.scrollIntoView({ behavior: 'instant', block: 'center' });
    await window.idleTracker.wait(300);
    chart.update(buildParams(['C', 'D', 'E']), { isAnimated: true });
    const [replaced, rebuilt] = legend.children;
    const replacedBox = replaced.getBoundingClientRect();
    const rebuiltBox = rebuilt.getBoundingClientRect();
    const start = {
      classNames: readClassNames(legend),
      isAside: replaced.inert && getComputedStyle(replaced).pointerEvents === 'none',
      isInPlace: ['left', 'top', 'width'].every((key) => Math.abs(replacedBox[key] - rebuiltBox[key]) < 1),
      labels: [replaced, rebuilt].map((tools) => tools.textContent).join(),
    };
    await wait(midFadeMs);
    const buttonBox = rebuilt.querySelector('.lovely-chart--button').getBoundingClientRect();
    const hit = document.elementFromPoint(buttonBox.left + buttonBox.width / 2, buttonBox.top + buttonBox.height / 2);
    const isHitOnRebuilt = rebuilt.contains(hit);
    await window.idleTracker.wait(pastFadeMs);
    const end = readClassNames(legend);
    chart.update(buildParams(['A', 'B']), { isAnimated: true });
    chart.update(buildParams(['C', 'D']), { isAnimated: true });
    const restarted = [readClassNames(element), readClassNames(legend)];
    chart.update(buildParams(['A', 'B']));
    const ended = [readClassNames(element), readClassNames(legend)];
    chart.update(buildParams(['C', 'D']), { isAnimated: true });
    chart.destroy();
    const destroyed = element.children.length + legend.querySelectorAll('.lovely-chart--tools').length;
    element.remove();
    legend.remove();
    return { start, isHitOnRebuilt, end, restarted, ended, destroyed };
  }, { midFadeMs: MID_FADE_MS, pastFadeMs: PAST_FADE_MS });
  const fadingOut = (className) => `${className} lovely-chart--state-fading-out`;
  const fadingPair = (className) => `${fadingOut(className)} | ${className} lovely-chart--state-fading-in`;
  check('update() with isAnimated keeps the replaced legend of legendContainer where the new one stands, out of reach',
    legendCrossFade.start.classNames === `${fadingPair('lovely-chart--tools')} | probe-chip`
    && legendCrossFade.start.isAside && legendCrossFade.start.isInPlace && legendCrossFade.start.labels === 'AB,CDE',
    JSON.stringify(legendCrossFade.start));
  check('the new legend takes the pointer during the cross-fade, and the replaced one leaves once it ends',
    legendCrossFade.isHitOnRebuilt && legendCrossFade.end === 'lovely-chart--tools | probe-chip',
    JSON.stringify([legendCrossFade.isHitOnRebuilt, legendCrossFade.end]));
  check('an animated update() mid-fade keeps the earlier fades going, and a plain one or destroy() ends them at once',
    JSON.stringify(legendCrossFade.restarted) === JSON.stringify([
      `${fadingOut('lovely-chart--container')} | ${fadingPair('lovely-chart--container')}`,
      `${fadingOut('lovely-chart--tools')} | ${fadingPair('lovely-chart--tools')} | probe-chip`,
    ])
    && JSON.stringify(legendCrossFade.ended) === '["lovely-chart--container","lovely-chart--tools | probe-chip"]'
    && legendCrossFade.destroyed === 0,
    JSON.stringify([legendCrossFade.restarted, legendCrossFade.ended, legendCrossFade.destroyed]));

  const sharedCrossFade = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.position = 'relative';
    document.getElementById('container').appendChild(element);
    const buildParams = (names) => ({
      type: 'line',
      title: 'Probe — Legend in the element',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: names.map((name, j) => ({ name, values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3) + j) })),
      legendContainer: element,
    });
    const readOrder = () => [...element.children]
      .map((child) => child.className.replace(/lovely-chart--(state-)?/g, '')).join(' | ');
    const chart = new LovelyChart(element, buildParams(['A', 'B']));
    const overlay = document.createElement('div');
    overlay.className = 'probe-overlay';
    overlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none';
    element.appendChild(overlay);
    await window.idleTracker.wait(300);
    chart.update(buildParams(['C', 'D']), { isAnimated: true });
    chart.update(buildParams(['A', 'B']), { isAnimated: true });
    const [rebuiltChart, rebuiltLegend] = ['container', 'tools'].map((kind) => (
      element.querySelector(`:scope > .lovely-chart--${kind}.lovely-chart--state-fading-in`)
    ));
    const isInPlace = [...element.querySelectorAll(':scope > .lovely-chart--state-fading-out')].every((child) => {
      const rebuilt = child.classList.contains('lovely-chart--tools') ? rebuiltLegend : rebuiltChart;
      return Math.abs(child.getBoundingClientRect().top - rebuilt.getBoundingClientRect().top) < 1;
    });
    const fading = { order: readOrder(), isInPlace };
    chart.update(buildParams(['C', 'D']));
    const ended = readOrder();
    chart.destroy();
    element.remove();
    return { fading, ended };
  });
  const sharedFadingOrder = ['container', 'tools']
    .map((kind) => `${kind} fading-out | ${kind} fading-out | ${kind} fading-in`).join(' | ');
  check('with legendContainer as element, fading charts and legends stand where the new ones do, ahead of an overlay',
    sharedCrossFade.fading.order === `${sharedFadingOrder} | probe-overlay` && sharedCrossFade.fading.isInPlace,
    JSON.stringify(sharedCrossFade.fading));
  check('update() keeps the chart and the legend of legendContainer as element before the page overlay',
    sharedCrossFade.ended === 'container | tools | probe-overlay', sharedCrossFade.ended);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionUpdate = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const params = {
      type: 'line',
      title: 'Probe — Reduced motion',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3)) }],
    };
    const chart = new LovelyChart(element, params);
    await window.idleTracker.wait(300);
    chart.update({ ...params }, { isAnimated: true });
    const classNames = [...element.children].map((child) => child.className).join(' | ');
    chart.destroy();
    element.remove();
    return classNames;
  });
  // Playwright restores the system preference on `null` alone
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ reducedMotion: null });
  check('update() with isAnimated swaps the chart at once while the system asks for reduced motion',
    reducedMotionUpdate === 'lovely-chart--container', reducedMotionUpdate);

  // A page of its own counts every frame and timer, which the demo charts would add to
  const fadePage = await newTestPage(browser, { viewport: { width: 900, height: 1200 } });
  await fadePage.goto(`${url}isolated`);
  await fadePage.addStyleTag({ url: `${url}LovelyChart.css` });
  await countLateCallbacks(fadePage);
  const destroyedMidFade = await fadePage.evaluate(async (pastFadeMs) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const wait = (ms) => new Promise((resolve) => window.realSetTimeout(resolve, ms));
    const element = document.createElement('div');
    document.body.appendChild(element);
    const params = {
      type: 'line',
      title: 'Probe — Destroyed mid-fade',
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length: 10 }, (_, i) => 1 + (i % 3)) }],
    };
    const chart = new LovelyChart(element, params);
    await window.idleTracker.wait(300);
    chart.update({ ...params }, { isAnimated: true });
    const fadingCount = element.children.length;
    chart.destroy();
    window.lateCallbacks = 0;
    window.isCountingLateCallbacks = true;
    await wait(pastFadeMs);
    window.isCountingLateCallbacks = false;
    return { fadingCount, count: element.children.length, lateCallbacks: window.lateCallbacks };
  }, PAST_FADE_MS);
  await fadePage.close();
  check('destroy() mid-fade removes both charts and leaves no frame or timer running',
    destroyedMidFade.fadingCount === 2 && destroyedMidFade.count === 0 && destroyedMidFade.lateCallbacks === 0,
    JSON.stringify(destroyedMidFade));
});

section('Minimap: a drag holds its cursor over the page until the release', async ({ page }) => {
  const cursorConfig = {
    title: 'Probe — Drag cursor',
    type: 'line',
    withMinimap: true,
    labels: Array.from({ length: INTERRUPTED_LABELS }, (_, i) => Date.UTC(2026, 0, 1 + i)),
    datasets: [{ name: 'A', values: Array.from({ length: INTERRUPTED_LABELS }, (_, i) => 10 + (i % 4) * 10) }],
  };
  const cursorProbe = await mountProbe(page, { config: cursorConfig });
  await cursorProbe.scrollIntoViewIfNeeded();
  // The cursor classes on `<html>`, and the cursor of the page under them
  const readDragCursor = () => page.evaluate(() => ({
    classes: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
    cursor: getComputedStyle(document.body).cursor,
  }));
  const cursorSlider = await cursorProbe.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const offHandle = { x: cursorSlider.x + cursorSlider.width / 2, y: cursorSlider.y - 200 };
  const dragCursor = {};
  await page.mouse.move(cursorSlider.x + cursorSlider.width / 2, cursorSlider.y + cursorSlider.height / 2);
  await page.mouse.down();
  await page.mouse.move(offHandle.x, offHandle.y, { steps: 5 });
  dragCursor.slider = await readDragCursor();
  await page.mouse.move(-20, -20, { steps: 5 });
  await page.mouse.up();
  dragCursor.releasedOutsideWindow = await readDragCursor();
  const cursorEar = await cursorProbe.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await page.mouse.move(cursorEar.x + cursorEar.width / 2, cursorEar.y + cursorEar.height / 2);
  await page.mouse.down();
  await page.mouse.move(offHandle.x, offHandle.y, { steps: 5 });
  dragCursor.ear = await readDragCursor();
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
  dragCursor.contextMenu = await readDragCursor();
  await page.mouse.up();
  dragCursor.touchCancelled = await page.evaluate(() => {
    const ear = document.querySelector('#probe .lovely-chart--minimap-slider-handle');
    const { left, top } = ear.getBoundingClientRect();
    const touch = new Touch({ identifier: 1, target: ear, clientX: left + 4, clientY: top + 4, pageX: left + 4 });
    const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
    ear.dispatchEvent(new TouchEvent('touchstart', init));
    const classes = [...document.documentElement.classList].filter((name) => name.includes('cursor-'));
    document.dispatchEvent(new TouchEvent('touchcancel', { ...init, touches: [], targetTouches: [] }));
    return {
      during: classes,
      after: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
    };
  });
  await unmountProbe(page);
  check('a slider drag holds the grabbing cursor over the page through a prefixed class',
    JSON.stringify(dragCursor.slider) === '{"classes":["lovely-chart--cursor-grabbing"],"cursor":"grabbing"}',
    JSON.stringify(dragCursor.slider));
  check('an ear drag holds the resize cursor over the page through a prefixed class',
    JSON.stringify(dragCursor.ear) === '{"classes":["lovely-chart--cursor-ew-resize"],"cursor":"ew-resize"}',
    JSON.stringify(dragCursor.ear));
  check('a drag lets the cursor go on a release outside the window, a context menu and a cancelled touch',
    [dragCursor.releasedOutsideWindow, dragCursor.contextMenu].every(({ classes, cursor }) => (
      classes.length === 0 && cursor === 'auto'
    ))
    && JSON.stringify(dragCursor.touchCancelled) === '{"during":["lovely-chart--cursor-ew-resize"],"after":[]}',
    JSON.stringify(dragCursor));

  const stopperProbe = await mountProbe(page, { config: { ...cursorConfig, title: 'Probe — Drag released unseen' } });
  await stopperProbe.scrollIntoViewIfNeeded();
  // A release the document never sees in the bubbling phase, over an element of the page that stops it
  const stoppedSlider = await stopperProbe.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const stopperCenter = { x: stoppedSlider.x + stoppedSlider.width / 2, y: stoppedSlider.y - 200 };
  await page.evaluate(({ x, y }) => {
    const stopper = document.createElement('div');
    stopper.id = 'probe-stopper';
    stopper.style.cssText = `position: fixed; left: ${x - 50}px; top: ${y - 50}px; width: 100px; height: 100px`;
    stopper.addEventListener('mouseup', (e) => e.stopPropagation());
    document.body.appendChild(stopper);
  }, stopperCenter);
  await page.mouse.move(stoppedSlider.x + stoppedSlider.width / 2, stoppedSlider.y + stoppedSlider.height / 2);
  await page.mouse.down();
  await page.mouse.move(stopperCenter.x, stopperCenter.y, { steps: 5 });
  dragCursor.overStopper = await readDragCursor();
  await page.mouse.up();
  dragCursor.releasedOverStopper = await readDragCursor();
  await page.evaluate(() => document.getElementById('probe-stopper').remove());
  await waitForIdle(page, 600);
  // A release over a frame reaches neither the document nor the chart, whose next move comes with no button pressed
  dragCursor.movedWithoutButton = await page.evaluate(async () => {
    const slider = document.querySelector('#probe .lovely-chart--minimap-slider-inner');
    const { left, top, width, height } = slider.getBoundingClientRect();
    const fire = (target, type, clientX, buttons) => target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, buttons, clientX, clientY: top + height / 2,
    }));
    fire(slider, 'mousedown', left + width / 2, 1);
    fire(document, 'mousemove', left + width / 2 + 40, 0);
    await window.idleTracker.wait(300);
    return {
      classes: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
      sliderShift: slider.getBoundingClientRect().left - left,
    };
  });
  await unmountProbe(page);
  check('a drag ends on a release over an element that stops it, and on a move with no button pressed',
    dragCursor.overStopper.classes.length === 1
    && dragCursor.releasedOverStopper.classes.length === 0 && dragCursor.releasedOverStopper.cursor === 'auto'
    && dragCursor.movedWithoutButton.classes.length === 0 && dragCursor.movedWithoutButton.sliderShift === 0,
    JSON.stringify({
      over: dragCursor.overStopper, stopped: dragCursor.releasedOverStopper, moved: dragCursor.movedWithoutButton,
    }));

  // A month-granularity chart must not caption its zoom with a single day.
  const monthZoomCaption = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    document.body.appendChild(element);

    const labels = [Date.UTC(2029, 0, 1), Date.UTC(2029, 1, 1), Date.UTC(2029, 2, 1)];
    const chart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      zoomToShares: true,
      circleLabelsAround: 0,
      zoomType: 'donut',
      labels,
      labelType: 'month',
      datasets: [
        { name: 'A', color: '#3497ED', values: [3, 5, 7] },
        { name: 'B', color: '#9ED448', values: [7, 5, 3] },
      ],
      initialZoom: 'last',
    });
    await window.idleTracker.wait(1500);
    const caption = element.querySelector('.lovely-chart--header-caption').textContent;

    chart.destroy();
    element.remove();
    return caption;
  });
  // A zoomed shares chart must aggregate the selected label only. Line and bar
  // charts extend the range by one label per side to draw edge segments; doing
  // that for a circle silently sums the neighbours into the sectors.
  const singleLabel = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (single label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      // Only the middle label is lopsided, so leaking a neighbour in is obvious
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 1, 500, 500] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 999, 500, 500] },
      ],
      withMinimap: true,
      initialZoom: 2,
    },
  });
  await singleLabel.scrollIntoViewIfNeeded();
  const singlePlot = await singleLabel.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, { ...singlePlot, width: singlePlot.width + 140 }, 0.5, 0.42);
  const singleText = (await singleLabel.locator('.lovely-chart--tooltip-balloon')
    .textContent()).replace(/\s+/g, ' ').trim();
  check('zoomed shares aggregate the selected label only',
    singleText.includes('999') && !singleText.includes('1 999'),
    JSON.stringify(singleText.slice(0, 60)));

  // Dragging the zoomed minimap must step whole labels. Snapping that ignores
  // the half-label offset makes a one-label window straddle two, so the caption
  // flips between a single month and a range on every step.
  const singleCaption = () => singleLabel.locator('.lovely-chart--header-caption').textContent();
  const capZoomed = (await singleCaption()).trim();
  const singleSlider = await singleLabel.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const labelWidth = (await singleLabel.locator('.lovely-chart--minimap').boundingBox()).width / 5;
  await drag(page, singleSlider.x + singleSlider.width / 2, singleSlider.y + singleSlider.height / 2,
    -labelWidth, 0);
  await waitForIdle(page, 700);
  const capDragged = (await singleCaption()).trim();
  check('zoomed minimap drag steps whole labels',
    capZoomed === 'March 2029'
    && (capDragged === 'February 2029' || capDragged === 'February — March 2029'),
    `${JSON.stringify(capZoomed)} -> ${JSON.stringify(capDragged)}`);

  // The sectors animate towards a new range: their values are what a circle
  // draws, so those are what transition. Without it the pie snaps between
  // aggregations, which is how it behaved when the range applied instantly.
  const donutSignature = () => singleLabel.evaluate((el) => {
    const cv = el.querySelector('canvas');
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 997) hash = (hash * 31 + data[i]) % 1000003;
    return hash;
  });
  const dragged = await singleLabel.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await page.mouse.move(dragged.x + dragged.width / 2, dragged.y + dragged.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragged.x + dragged.width / 2 + labelWidth, dragged.y + dragged.height / 2, { steps: 8 });
  await page.mouse.up();
  const donutFrames = [];
  for (let i = 0; i < 10; i++) {
    donutFrames.push(await donutSignature());
    // eslint-disable-next-line no-restricted-syntax -- samples the frames of the donut over time
    await sleep(30);
  }
  check('zoomed circle animates towards a new range',
    new Set(donutFrames).size > 3, `${new Set(donutFrames).size} distinct frames`);

  // At the first and last label the half-label margin falls outside the axis.
  // Truncating it there halves the window, which both looks wrong and halves the
  // drag step, since `minimapDelta` is taken from that width.
  await unmountProbe(page);
  const edgeZoom = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (last label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 500, 500, 1] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 500, 500, 999] },
      ],
      withMinimap: true,
      initialZoom: 'last',
    },
  });
  await edgeZoom.scrollIntoViewIfNeeded();
  const edgeCaption = (await edgeZoom.locator('.lovely-chart--header-caption').textContent()).trim();
  const edgeMinimap = await edgeZoom.locator('.lovely-chart--minimap').boundingBox();
  const edgeSlider = await edgeZoom.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  // A column chart draws 5 columns, so the selection must sit on the 5th of them
  const column = edgeMinimap.width / 5;
  const startsAt = (edgeSlider.x - edgeMinimap.x) / column;
  const spans = edgeSlider.width / column;
  check('zoom selects exactly its own column',
    edgeCaption === 'May 2029' && Math.abs(startsAt - 4) < 0.12 && spans > 0.75 && spans < 1.05,
    `${JSON.stringify(edgeCaption)}, starts at column ${startsAt.toFixed(2)}, spans ${spans.toFixed(2)}`);

  // --- Discrete dragging follows the pointer, not the slider (chart 13) ---
  // A discrete range moves whole labels, so it must step when the pointer
  // crosses a label boundary. Stepping by how far the slider has travelled
  // instead makes the range change at the same distance whatever part of the
  // slider was grabbed, so a grab near one edge changes it while the pointer is
  // still inside the label it started in.
  await unmountProbe(page);
  const clickZoom = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (click to drill in)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'donut',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 400, 300, 400, 500] },
        { name: 'Beta', color: '#9ED448', values: [500, 600, 700, 600, 500] },
      ],
      withMinimap: true,
    },
  });
  await clickZoom.scrollIntoViewIfNeeded();

  const dragFromPointer = async (grabFraction) => {
    const plotBox = await clickZoom.locator('.lovely-chart--tooltip').boundingBox();
    await page.mouse.move(plotBox.x + plotBox.width * 0.5, plotBox.y + plotBox.height * 0.6);
    await waitForIdle(page, 250);
    await page.mouse.click(plotBox.x + plotBox.width * 0.5, plotBox.y + plotBox.height * 0.6);
    await waitForIdle(page, 2200);

    const caption = async () => (await clickZoom.locator('.lovely-chart--header-caption').textContent()).trim();
    const canvasBox = await clickZoom.locator('.lovely-chart--minimap canvas').boundingBox();
    const bodyBox = await clickZoom.locator('.lovely-chart--minimap-slider-inner').boundingBox();
    const labelWidth = canvasBox.width / 5;
    const labelAt = (x) => Math.floor((x - canvasBox.x) / labelWidth);
    const startX = bodyBox.x + bodyBox.width * grabFraction;
    const startY = bodyBox.y + bodyBox.height / 2;
    const before = await caption();

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    let labelWhenChanged;
    for (let travelled = 0.05; travelled <= 1.4; travelled += 0.05) {
      const x = startX - labelWidth * travelled;
      await page.mouse.move(x, startY, { steps: 2 });
      // eslint-disable-next-line no-restricted-syntax -- paces the drag against the caption throttle
      await sleep(80);
      if ((await caption()) !== before) {
        labelWhenChanged = labelAt(x);
        break;
      }
    }
    await page.mouse.up();
    await waitForIdle(page, 300);
    const zoomOut = clickZoom.locator('.lovely-chart--header-zoom-out-control');
    if (await zoomOut.count()) {
      await zoomOut.first().click();
      await waitForIdle(page, 2000);
    }

    return { start: labelAt(startX), changed: labelWhenChanged };
  };

  const grabbedNearLeft = await dragFromPointer(0.25);
  const grabbedNearRight = await dragFromPointer(0.75);
  check('discrete drag steps when the pointer crosses a label',
    grabbedNearLeft.changed === grabbedNearLeft.start - 1
    && grabbedNearRight.changed === grabbedNearRight.start - 1,
    `near left: label ${grabbedNearLeft.start} -> changed at ${grabbedNearLeft.changed}; `
    + `near right: label ${grabbedNearRight.start} -> changed at ${grabbedNearRight.changed}`);

  await unmountProbe(page);

  check('month chart captions its zoom by month, not day',
    monthZoomCaption.trim() === 'March 2029', JSON.stringify(monthZoomCaption));
});

section('Minimap: a swipe down or up its window or an ear scrolls the page, and one across drags the window or '
  + 'resizes it', async ({
  browser, url, errors,
}) => {
  const swipePage = await newTestPage(browser, { viewport: SWIPE_VIEWPORT, hasTouch: true, isMobile: true });
  swipePage.on('pageerror', (err) => errors.push(`[swipe pageerror] ${err.message}`));
  await swipePage.goto(`${url}isolated`);
  await swipePage.addStyleTag({ url: `${url}LovelyChart.css` });
  // A chart at the top of a page laid out at the width of the phone, as a page for phones is, with room after it to
  // scroll the page through
  await swipePage.evaluate(async ({ count, width, room }) => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width">');
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.width = `${width}px`;
    const after = document.createElement('div');
    after.style.height = `${room}px`;
    document.body.prepend(element, after);
    const labels = Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, i + 1));
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Swipes on the minimap',
      labels,
      withMinimap: true,
      minimapRange: [0.3, 0.7],
      datasets: [{ name: 'Values', values: labels.map((_, i) => (i * 7) % 11) }],
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }, { count: SWIPE_LABEL_COUNT, width: SWIPE_CHART_WIDTH, room: SWIPE_PAGE_ROOM });
  const cdp = await swipePage.context().newCDPSession(swipePage);
  // The scroll of the page and the edges of the minimap window, in px of the ruler
  const readSwipe = () => swipePage.evaluate(() => {
    const ruler = document.querySelector('#probe .lovely-chart--minimap-ruler').getBoundingClientRect();
    const slider = document.querySelector('#probe .lovely-chart--minimap-slider').getBoundingClientRect();
    return { scrollY: window.scrollY, edges: [slider.left - ruler.left, slider.right - ruler.left] };
  });
  // Swipes by a touch from the middle of a part of the window, the page scrolled to `startScrollY`, and reads what the
  // swipe moved
  const swipe = async (partIndex, xDistance, yDistance, startScrollY = 0) => {
    await swipePage.evaluate((scrollY) => window.scrollTo(0, scrollY), startScrollY);
    await sleep(200);
    const box = await swipePage.locator('#probe .lovely-chart--minimap-slider > *').nth(partIndex).boundingBox();
    const before = await readSwipe();
    await cdp.send('Input.synthesizeScrollGesture', {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      xDistance,
      yDistance,
      gestureSourceType: 'touch',
      speed: SWIPE_SPEED,
      repeatCount: 0,
    });
    await sleep(500);
    return { before, after: await readSwipe() };
  };
  const isSameEdge = (first, second) => Math.abs(first - second) <= SWIPE_EDGE_TOLERANCE;
  const isScrolledOnly = ({ before, after }) => Math.abs(after.scrollY - before.scrollY) >= SWIPE_MIN_SCROLL
    && isSameEdge(before.edges[0], after.edges[0]) && isSameEdge(before.edges[1], after.edges[1]);
  const [leftEar, windowMiddle, rightEar] = [0, 1, 2];
  const swipes = {
    downWindow: await swipe(windowMiddle, 0, -SWIPE_DISTANCE),
    downWindowDrifting: await swipe(windowMiddle, SWIPE_DRIFT, -SWIPE_DISTANCE),
    upWindow: await swipe(windowMiddle, 0, SWIPE_DISTANCE, SWIPE_DISTANCE),
    downLeftEar: await swipe(leftEar, SWIPE_DRIFT, -SWIPE_DISTANCE),
    downRightEar: await swipe(rightEar, -SWIPE_DRIFT, -SWIPE_DISTANCE),
    acrossWindow: await swipe(windowMiddle, -SWIPE_ACROSS, 0),
    acrossWindowDrifting: await swipe(windowMiddle, SWIPE_ACROSS, -SWIPE_DRIFT),
    acrossEar: await swipe(rightEar, SWIPE_ACROSS, -SWIPE_DRIFT),
  };
  const verticalSwipes = ['downWindow', 'downWindowDrifting', 'upWindow', 'downLeftEar', 'downRightEar']
    .map((name) => swipes[name]);
  await swipePage.close();
  const { acrossWindow, acrossWindowDrifting, acrossEar } = swipes;
  const isPannedBy = ({ before, after }, sign) => after.scrollY === before.scrollY
    && Math.sign(after.edges[0] - before.edges[0]) === sign
    && isSameEdge(after.edges[1] - after.edges[0], before.edges[1] - before.edges[0]);
  check('a swipe down or up the minimap window or an ear scrolls the page and leaves the window, a drift across too',
    verticalSwipes.every(isScrolledOnly), JSON.stringify(verticalSwipes));
  check('a swipe across the minimap window pans it, a drift down too, and one across an ear resizes it, with no scroll',
    isPannedBy(acrossWindow, -1) && isPannedBy(acrossWindowDrifting, 1)
    && acrossEar.after.scrollY === 0 && isSameEdge(acrossEar.after.edges[0], acrossEar.before.edges[0])
    && acrossEar.after.edges[1] > acrossEar.before.edges[1],
    JSON.stringify([acrossWindow, acrossWindowDrifting, acrossEar]));
});

section('Start-zoomed init: async `onZoom`, opened already on the zoomed day', async ({ page }) => {
  const startZoomedAsync = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { title: 'Probe — Start Zoomed onZoom', initialZoom: 'last' },
    zoomDataSource: 'data/zoom_bars',
  });
  await startZoomedAsync.scrollIntoViewIfNeeded();
  const asyncZoomOut = startZoomedAsync.locator('.lovely-chart--header-zoom-out-control');
  const asyncHasZoomOut = (await asyncZoomOut.count()) > 0;
  const asyncCaption = await startZoomedAsync.locator('.lovely-chart--header-caption').textContent();
  // A zoomed day caption is a single date; the overview caption is a "start — end" range
  check('start-zoomed onZoom opens already zoomed', asyncHasZoomOut && !asyncCaption.includes('—'),
    `zoom-out: ${asyncHasZoomOut}, caption: ${JSON.stringify(asyncCaption)}`);

  if (asyncHasZoomOut) {
    await asyncZoomOut.first().click();
    await waitForIdle(page, 2000);
    const backCaption = await startZoomedAsync.locator('.lovely-chart--header-caption').textContent();
    check('start-zoomed onZoom zoom-out returns to overview', backCaption.includes('—'), JSON.stringify(backCaption));
  }
  await unmountProbe(page);
});

section('A zoom paints the zoomed datasets in their own colours, names them, and a zoom out restores the '
  + 'overview', async ({ page, errors }) => {
  const linesZoomCases = [
    {
      name: 'more',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }, { name: 'Palette' }],
      config: { axisTextColor: ZOOM_AXIS_TEXT_COLOR },
    },
    {
      name: 'fewer',
      overview: [
        { name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }, { name: 'Blue', color: '#0000FF' },
      ],
      zoomed: [{ name: 'Magenta', color: '#FF00FF' }, { name: 'Uncoloured' }],
      config: { initialZoom: 'last' },
    },
    {
      name: 'as many',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
      config: { initialZoom: 'last' },
    },
    {
      name: 'as many, of no colours,',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue' }, { name: 'Magenta' }],
    },
    {
      name: 'as many, with a comparison,',
      overview: [{ name: 'Red', color: '#FF0000' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }],
      zoomConfig: { comparison: { name: 'Day before', values: [Array(24).fill(35)] } },
    },
  ];
  const countPageErrors = () => errors.filter((error) => error.startsWith('[pageerror]')).length;
  const readTooltipNames = async (labelIndex) => (await readProbeTooltip(page, labelIndex)).names
    .filter((name) => name !== 'Day before').sort();
  const toSortedNames = (datasets) => datasets.map(({ name }) => name).sort();
  for (const { name, overview, zoomed, config = {}, zoomConfig } of linesZoomCases) {
    const pageErrorsBefore = countPageErrors();
    const overviewColors = overview.map(({ color }) => color ?? DEFAULT_PALETTE_COLOR);
    // A zoomed dataset with no colour keeps the colour of the overview's dataset at its place, past which it takes one
    // of the palette
    const zoomedColors = zoomed.map(({ color }, i) => color ?? overview[i]?.color ?? DEFAULT_PALETTE_COLOR);
    const overviewOnlyColors = overviewColors.filter((color) => !zoomedColors.includes(color));
    const zoomedOnlyColors = zoomedColors.filter((color) => !overviewColors.includes(color));
    const allColors = [...new Set([...overviewColors, ...zoomedColors, DEFAULT_COMPARISON_COLOR])];
    const isLinesView = zoomed.length !== overview.length;
    await recordProbeNumbers(page);
    const linesZoom = await mountLinesZoom(page, { overview, zoomed, config, zoomConfig });
    await linesZoom.scrollIntoViewIfNeeded();
    if (!config.initialZoom) {
      const linesZoomPlot = await linesZoom.locator('.lovely-chart--tooltip').boundingBox();
      await hoverWiggle(page, linesZoomPlot, 0.5, 0.5);
      await page.mouse.click(linesZoomPlot.x + linesZoomPlot.width / 2, linesZoomPlot.y + linesZoomPlot.height / 2);
      await waitForIdle(page, 2000);
    }
    const zoomedTexts = getLastFrameTexts(await readProbeTexts(page));
    const zoomedPaint = await readDatasetPaint(linesZoom, allColors);
    const zoomedNames = await readTooltipNames(1);
    // Rows the tooltip makes while zoomed take the overview's names after a zoom out
    await linesZoom.locator('.lovely-chart--button').first().click();
    await waitForIdle(page, 500);
    await linesZoom.locator('.lovely-chart--button').first().click();
    await waitForIdle(page, 500);
    const reshownNames = await readTooltipNames(1);
    await page.evaluate(() => window.probeChart.selectLabel(undefined));
    check(`a zoom into ${name} datasets ${isLinesView ? 'than' : 'as'} the overview paints and names them as their own`,
      countPageErrors() === pageErrorsBefore
      && isPaintedWith(zoomedPaint, zoomedColors, overviewOnlyColors, !isLinesView)
      && (!zoomConfig?.comparison || zoomedPaint.plot[DEFAULT_COMPARISON_COLOR] > MIN_DATASET_PIXELS)
      && JSON.stringify(zoomedNames) === JSON.stringify(toSortedNames(zoomed))
      && JSON.stringify(reshownNames) === JSON.stringify(toSortedNames(zoomed))
      && (!config.axisTextColor || zoomedTexts.every(({ color }) => isTextColor(color, config.axisTextColor))),
      `${JSON.stringify(zoomedPaint)}, tooltip ${zoomedNames} then ${reshownNames}, `
      + `text colours ${JSON.stringify([...new Set(zoomedTexts.map(({ color }) => color))])}`);

    await linesZoom.locator('.lovely-chart--header-zoom-out-control').first().click();
    await waitForIdle(page, 2000);
    const overviewPaint = await readDatasetPaint(linesZoom, allColors);
    const overviewNames = await readTooltipNames(LINES_ZOOM_LAST_LABEL_INDEX);
    check(`a zoom out of ${name} datasets paints and names the overview's as before`,
      countPageErrors() === pageErrorsBefore
      && isPaintedWith(overviewPaint, overviewColors, [...zoomedOnlyColors, DEFAULT_COMPARISON_COLOR])
      && JSON.stringify(overviewNames) === JSON.stringify(toSortedNames(overview)),
      `${JSON.stringify(overviewPaint)}, tooltip ${overviewNames}`);
    await unmountProbe(page);
  }
});

section('A lines zoom draws its datasets in the `colors` its data gives them, over their own', async ({ page }) => {
  const keyedColors = ['#00FFFF', '#FF00FF', '#FFFF00'];
  const unkeyedColors = ['#0000FF', DEFAULT_PALETTE_COLOR];
  const keyedOverviewColors = ['#FF0000', '#00FF00'];
  const keyedPaintColors = [...keyedColors, ...unkeyedColors, ...keyedOverviewColors];
  const keyedZoom = await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }, { name: 'Palette' }],
    zoomConfig: { colors: { y0: '#00FFFF', y2: '#FFFF00' } },
  });
  await keyedZoom.scrollIntoViewIfNeeded();
  const keyedZoomPlot = await keyedZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, keyedZoomPlot, 0.5, 0.5);
  await page.mouse.click(keyedZoomPlot.x + keyedZoomPlot.width / 2, keyedZoomPlot.y + keyedZoomPlot.height / 2);
  await waitForIdle(page, 2000);
  const keyedPaint = await readDatasetPaint(keyedZoom, keyedPaintColors);
  const keyedSwatches = (await readProbeTooltip(page, 1)).swatchColors.sort();
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  check('a lines zoom draws its datasets in the colors its data gives them, over their own',
    isPaintedWith(keyedPaint, keyedColors, [...unkeyedColors, ...keyedOverviewColors], false)
    && JSON.stringify(keyedSwatches) === JSON.stringify(keyedColors.map(hexToRgb).sort()),
    `${JSON.stringify(keyedPaint)}, tooltip swatches ${JSON.stringify(keyedSwatches)}`);

  await keyedZoom.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2000);
  const keyedOverviewPaint = await readDatasetPaint(keyedZoom, keyedPaintColors);
  await unmountProbe(page);
  check('a zoom out of a lines view of colors paints the overview in its own colours',
    isPaintedWith(keyedOverviewPaint, keyedOverviewColors, [...keyedColors, ...unkeyedColors]),
    JSON.stringify(keyedOverviewPaint));
});

section('A resize returns a chart zoomed into datasets of other colours to the overview, in the overview\'s '
  + 'colours', async ({ page }) => {
  const resizedOverviewColors = ['#FF0000', '#00FF00'];
  const resizedZoomColors = ['#0000FF', '#FF00FF'];
  const resizedZoom = await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
  });
  await resizedZoom.scrollIntoViewIfNeeded();
  const resizedZoomPlot = await resizedZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, resizedZoomPlot, 0.5, 0.5);
  await page.mouse.click(resizedZoomPlot.x + resizedZoomPlot.width / 2, resizedZoomPlot.y + resizedZoomPlot.height / 2);
  await waitForIdle(page, 2000);
  await page.mouse.move(0, 0);
  const resizeViewport = page.viewportSize();
  await page.setViewportSize({ width: resizeViewport.width - 20, height: resizeViewport.height });
  await waitForIdle(page, 1200);
  await page.setViewportSize(resizeViewport);
  await waitForIdle(page, 1200);
  const resizedPaint = await readDatasetPaint(resizedZoom, [...resizedOverviewColors, ...resizedZoomColors]);
  await unmountProbe(page);
  check('a resize while zoomed into datasets of other colours paints the overview in its own colours',
    isPaintedWith(resizedPaint, resizedOverviewColors, resizedZoomColors), JSON.stringify(resizedPaint));
});

section('Localized captions (own chart, so the demo page stays English)', async ({ page }) => {
  const localizedCaption = await page.evaluate(async (locale) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/areas.json').then((response) => response.json());
    const element = document.createElement('div');
    document.body.appendChild(element);

    const chart = new LovelyChart(element, { ...data, initialZoom: 'last', dateLocale: locale });
    await window.idleTracker.wait(1500);
    const caption = element.querySelector('.lovely-chart--header-caption').textContent;

    chart.destroy();
    element.remove();
    return caption;
  }, SPANISH_DATE_LOCALE);
  check('caption honours dateLocale',
    SPANISH_DATE_LOCALE.weekDays.some((day) => localizedCaption.startsWith(day)),
    JSON.stringify(localizedCaption));
});

section('Reference lines', async ({ page }) => {
  // A rule three times the tallest stack lands above the canvas unless the stacked range reaches it
  const referenceStack = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Reference above the stack',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', color: '#3497ED', values: [10, 20, 30, 20] }, { name: 'B', values: [5, 5, 5, 5] }],
      referenceLines: [{ value: 105, color: '#FF00FF' }],
    },
  });
  const magenta = await findColor(referenceStack, [255, 0, 255]);
  check('a reference line widens a stacked range to reach it', magenta.count > 50, `${magenta.count}px`);
  await unmountProbe(page);

  // A target-met chart is constant at zero; a transparent pin keeps it on the baseline
  const pinnedZero = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Pinned zero',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Red cases', color: '#00AA00', values: [0, 0, 0, 0] }],
      referenceLines: [{ value: 1, label: '', color: 'transparent' }],
    },
  });
  const pinnedLine = await findColor(pinnedZero, [0, 170, 0]);
  const plotBottom = await pinnedZero.evaluate((el) => el.querySelector('canvas').clientHeight - 30);
  check('a transparent pin keeps a zero line on the baseline',
    pinnedLine.count > 50 && Math.abs(pinnedLine.meanY - plotBottom) < 4,
    `line at ${pinnedLine.meanY?.toFixed(1)}, plot bottom ${plotBottom}`);
  await unmountProbe(page);
});

section('A constant series sits at the middle height, its one Y label on it, on both axes', async ({ page }) => {
  const plotCenterY = (PLOT_TOP + PLOT_BOTTOM) / 2;
  for (const [mainValue, secondValue] of [[0.3, 12.1], [1.2, 0.3], [12.1, 1.2]]) {
    await recordProbeNumbers(page);
    const constantChart = await mountProbe(page, {
      config: {
        type: 'line',
        title: 'Probe — Constant series',
        labels: [1, 2, 3, 4, 5, 6, 7].map((day) => Date.UTC(2026, 10, day)),
        datasets: [
          { name: 'Main', color: '#FF0000', values: Array(7).fill(mainValue) },
          // Dashed, so the main line shows through where both run at the middle
          { name: 'Second', color: '#0000FF', values: Array(7).fill(secondValue), isDashed: true },
        ],
        hasSecondYAxis: true,
      },
    });
    // The grid line of their label runs over both lines, and a canvas drawn without a GPU, as on CI, blends the
    // antialiased edges of the dashes into the main line under them, so a dash may only show under the grid line
    const mainLine = await findColor(constantChart, [255, 0, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE);
    const secondLine = await findColor(constantChart, [0, 0, 255], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE);
    const labels = await readProbeNumberLabels(page);
    await unmountProbe(page);
    // A standard Y label sits half a gutter above its tick
    const isLabelOnLine = (value) => labels.some((label) => label.value === value
      && Math.abs(label.y + 5 - plotCenterY) < 1);
    check(`a constant ${mainValue} and a constant ${secondValue} on the second axis sit at the middle, labelled`,
      Math.abs(mainLine.meanY - plotCenterY) < 2 && Math.abs(secondLine.meanY - plotCenterY) < 2
      && labels.length === 2 && isLabelOnLine(mainValue) && isLabelOnLine(secondValue),
      `lines at ${mainLine.meanY?.toFixed(1)} and ${secondLine.meanY?.toFixed(1)} of ${plotCenterY}, `
      + `labels ${JSON.stringify(labels)}`);
  }

  // --- A bar or an area of a constant range spans from zero at a plot edge to its value at the middle height ---
  // A positive fill rises from the bottom edge and a negative one hangs from the top edge, in the minimap too, on
  // either Y axis
  const minimapCenterY = (MINIMAP_PLOT_TOP + MINIMAP_PLOT_BOTTOM) / 2;
  const constantFills = [
    ...[[342], [-342], [342, 342, 342], [-342, -342, -342], [0, 0, 0]].map((values) => ({ type: 'bar', values })),
    ...[[342, 342, 342], [-342, -342, -342]].map((values) => ({ type: 'area', values })),
    ...[[50, 50, 50, 50, 50], [-50, -50, -50, -50, -50]].map((values) => ({
      type: 'bar', values, isOnSecondAxis: true,
    })),
  ];
  for (const { type, values, isOnSecondAxis } of constantFills) {
    const constantDataset = { name: 'Constant', color: '#FF0000', values };
    const constantChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Constant ${type}`,
        labels: values.map((_, i) => Date.UTC(2026, 10, 1 + i)),
        datasets: isOnSecondAxis
          ? [{ name: 'Main', color: '#00FF00', values: values.map((_, i) => 100 * (i + 1)) }, constantDataset]
          : [constantDataset],
        hasSecondYAxis: isOnSecondAxis,
        withMinimap: true,
      },
    });
    const plotFill = await findColor(constantChart, [255, 0, 0], CONSTANT_LINE_BAND);
    const minimapFill = await findColor(constantChart.locator('.lovely-chart--minimap'), [255, 0, 0]);
    await unmountProbe(page);
    const axisNote = isOnSecondAxis ? ' on the second axis' : '';
    const subject = values.length === 1
      ? `a single label of ${values[0]}${axisNote} draws`
      : `equal values of ${values[0]}${axisNote} draw`;
    const fill = `${type === 'area' ? 'an' : 'a'} ${type}`;
    const details = `${plotFill.count}px at ${plotFill.meanY?.toFixed(1)}, `
      + `${minimapFill.count}px at ${minimapFill.meanY?.toFixed(1)} in the minimap`;
    if (values[0] === 0) {
      check(`${subject} no ${type}`, plotFill.count === 0 && minimapFill.count === 0, details);
    } else {
      const isPositive = values[0] > 0;
      const plotFillMeanY = ((isPositive ? PLOT_BOTTOM : PLOT_TOP) + plotCenterY) / 2;
      const minimapFillMeanY = ((isPositive ? MINIMAP_PLOT_BOTTOM : MINIMAP_PLOT_TOP) + minimapCenterY) / 2;
      check(`${subject} ${fill} from the plot ${isPositive ? 'bottom' : 'top'} to the middle`,
        plotFill.count > 1000 && Math.abs(plotFill.meanY - plotFillMeanY) < 2
        && minimapFill.count > 100 && Math.abs(minimapFill.meanY - minimapFillMeanY) < 2,
        `${details}, expected at ${plotFillMeanY} and ${minimapFillMeanY}`);
    }
  }
});

section('A stacked chart keeps the dataset on its own Y axis out of the stack', async ({ page }) => {
  // The stack of 10 and 20 spans the main axis alone, its top line at the top of the plot and its lower line a third
  // of the way up, while the constant dataset on its own axis sits at the middle height, on the plot and the minimap
  const ownAxisStack = [
    { name: 'Low', color: '#0000FF', values: Array(7).fill(10) },
    { name: 'High', color: '#00AA00', values: Array(7).fill(20) },
  ];
  const ownAxisConfig = {
    isStacked: true,
    hasSecondYAxis: true,
    labels: Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 10, 1 + i)),
    datasets: [...ownAxisStack, { name: 'Own', color: '#FF0000', values: Array(7).fill(30_000) }],
  };
  await recordProbeNumbers(page);
  const ownAxisLines = await mountProbe(page, {
    config: {
      ...ownAxisConfig, type: 'line', title: 'Probe — Stack beside its own axis', withMinimap: true,
      minimapRange: 'full',
    },
  });
  const ownAxisTexts = getLastFrameTexts(await readProbeTexts(page));
  const ownAxisMinimap = ownAxisLines.locator('.lovely-chart--minimap');
  const ownAxisPaint = {
    high: await findColor(ownAxisLines, [0, 170, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE),
    low: await findColor(ownAxisLines, [0, 0, 255], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE),
    own: await findColor(ownAxisLines, [255, 0, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE),
    minimapHigh: await findColor(ownAxisMinimap, [0, 170, 0]),
    minimapOwn: await findColor(ownAxisMinimap, [255, 0, 0]),
  };
  await unmountProbe(page);
  const isPaintAt = ({ count, meanY }, y) => count > 50 && Math.abs(meanY - y) < 3;
  check('a stacked chart draws the dataset on its own Y axis apart from the stack, on the plot and the minimap',
    isPaintAt(ownAxisPaint.high, PLOT_TOP)
    && isPaintAt(ownAxisPaint.low, PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * 2 / 3)
    && isPaintAt(ownAxisPaint.own, (PLOT_TOP + PLOT_BOTTOM) / 2)
    && isPaintAt(ownAxisPaint.minimapHigh, MINIMAP_PLOT_TOP)
    && isPaintAt(ownAxisPaint.minimapOwn, (MINIMAP_PLOT_TOP + MINIMAP_PLOT_BOTTOM) / 2),
    Object.entries(ownAxisPaint).map(([part, { count, meanY }]) => `${part} ${count}px at ${meanY?.toFixed(1)}`)
      .join(', '));
  // The main Y-axis labels stand at the left, the second axis's at the right
  const listOwnAxisLabels = (align) => ownAxisTexts.filter((text) => text.align === align);
  const ownAxisMainValues = listOwnAxisLabels('left').map(({ text }) => parseAxisLabel(text));
  const ownAxisSecondValues = listOwnAxisLabels('right').map(({ text }) => parseAxisLabel(text));
  check('the main Y axis of a stacked chart labels the stack alone, the second axis the dataset on it',
    Math.max(...ownAxisMainValues) === 30 && JSON.stringify(ownAxisSecondValues) === '[30000]',
    `main ${JSON.stringify(ownAxisMainValues)}, second ${JSON.stringify(ownAxisSecondValues)}`);
  const ownAxisMainColors = [...new Set(listOwnAxisLabels('left').map(({ color }) => color))];
  const ownAxisSecondColors = [...new Set(listOwnAxisLabels('right').map(({ color }) => color))];
  check('the main Y-axis labels of a stacked chart keep the axis text colour, the second axis takes its dataset\'s',
    ownAxisMainColors.length > 0 && ownAxisMainColors.every((color) => !isTextColor(color, '#0000FF'))
    && ownAxisSecondColors.length > 0 && ownAxisSecondColors.every((color) => isTextColor(color, '#FF0000')),
    `main ${ownAxisMainColors.join(' ')}, second ${ownAxisSecondColors.join(' ')}`);

  await mountProbe(page, {
    config: { ...ownAxisConfig, type: 'bar', title: 'Probe — Stacked bars beside their own axis' },
  });
  const ownAxisTooltip = await readProbeTooltip(page, 3);
  const ownAxisTotal = await page.evaluate(() => (
    document.querySelector('#probe [data-total="true"] .lovely-chart--tooltip-dataset-value')?.textContent
  ));
  await unmountProbe(page);
  check('the Total row of a stacked chart leaves out the dataset on its own Y axis',
    ownAxisTooltip.names.includes('Own') && ownAxisTotal === '30',
    `rows ${JSON.stringify(ownAxisTooltip.names)}, total ${ownAxisTotal}`);

  // A percentage chart takes the shares of the stack alone, so the row of the dataset on its own axis has none, in a
  // share column as wide as the others
  await mountProbe(page, {
    config: {
      ...ownAxisConfig, type: 'area', isStacked: false, isPercentage: true,
      title: 'Probe — Shares beside their own axis',
    },
  });
  await readProbeTooltip(page, 3);
  const ownAxisShares = await page.evaluate(() => (
    [...document.querySelectorAll('#probe .lovely-chart--tooltip-dataset[data-key]')].map((row) => {
      const share = row.querySelector('.lovely-chart--percentage-title');
      return { name: row.dataset.name, text: share?.textContent, width: share?.getBoundingClientRect().width };
    })
  ));
  await unmountProbe(page);
  const ownAxisShareTexts = Object.fromEntries(ownAxisShares.map(({ name, text }) => [name, text]));
  check('a percentage chart prints no share on the row of the dataset on its own Y axis, its column kept',
    ownAxisShareTexts.Own === '' && ownAxisShareTexts.Low === '33%' && ownAxisShareTexts.High === '67%'
    && new Set(ownAxisShares.map(({ width }) => width)).size === 1,
    ownAxisShares.map(({ name, text, width }) => `${name} "${text}" ${width}px`).join(', '));

  // The outward column of a stacked chart is as wide with the dataset on its own axis as without it
  const ownAxisColumnEnds = [];
  for (const datasets of [ownAxisConfig.datasets, ownAxisStack]) {
    await recordProbeNumbers(page);
    await mountProbe(page, {
      config: {
        ...ownAxisConfig, datasets, hasSecondYAxis: datasets !== ownAxisStack, type: 'bar', isYAxisOutward: true,
        title: 'Probe — Outward stack beside its own axis',
      },
    });
    ownAxisColumnEnds.push(getYLabelColumn(await readProbeTexts(page)).end);
    await unmountProbe(page);
  }
  check('the outward column of a stacked chart fits the stack alone, not the dataset on its own Y axis',
    ownAxisColumnEnds[0] === ownAxisColumnEnds[1], `column ends at ${ownAxisColumnEnds.join(' and ')}`);
});

section('A dataset of another type than the chart\'s: a line over bars from 0, out of the stack, total and '
  + 'shares', async ({ page }) => {
  // Bars alone start the main axis near their lowest value, while bars beside a line start it at 0. The line comes
  // first in the datasets and runs inside every bar, so it shows only drawn over them.
  const mixedLabels = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 10, 1 + i));
  const mixedBars = { name: 'Daily', color: '#0000FF', values: [990, 1000, 985, 995, 980, 1000, 990] };
  const mixedLine = { name: 'Average', color: '#FF0000', type: 'line', values: [940, 930, 950, 945, 935, 950, 940] };
  const mixedConfig = { type: 'bar', labels: mixedLabels, datasets: [mixedLine, mixedBars] };
  const readMainYLabels = async () => getLastFrameTexts(await readProbeTexts(page))
    .filter(({ align }) => align === 'left')
    .map(({ text }) => parseAxisLabel(text));
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...mixedConfig, title: 'Probe — Bars alone', datasets: [mixedBars] } });
  const barsAloneLabels = await readMainYLabels();
  await unmountProbe(page);
  await recordProbeNumbers(page);
  const mixedChart = await mountProbe(page, { config: { ...mixedConfig, title: 'Probe — A line over bars' } });
  const mixedLabelValues = await readMainYLabels();
  const mixedLinePaint = await findColor(mixedChart, [255, 0, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE);
  const mixedBarsPaint = await findColor(mixedChart, [0, 0, 255]);
  const mixedTooltip = await readProbeTooltip(page, 3);
  const mixedFocusedBarsPaint = await findColor(mixedChart, [0, 0, 255]);
  const mixedDots = {
    line: await findColor(mixedChart.locator('.lovely-chart--tooltip'), [255, 0, 0]),
    bars: await findColor(mixedChart.locator('.lovely-chart--tooltip'), [0, 0, 255]),
  };
  await unmountProbe(page);
  check('bars beside a line start the main Y axis at 0, bars alone near their lowest value',
    Math.min(...mixedLabelValues) === 0 && Math.min(...barsAloneLabels) > 0,
    `beside a line ${JSON.stringify(mixedLabelValues)}, alone ${JSON.stringify(barsAloneLabels)}`);
  check('a line of another type than the chart\'s draws over the bars, though it comes first in the datasets',
    mixedLinePaint.count > 300, `${mixedLinePaint.count}px of the line`);
  check('a line over bars takes the dot of a selected label, and the bars the mask around its column',
    mixedTooltip.names.includes('Average') && mixedDots.line.count > 10 && mixedDots.bars.count === 0
    && mixedFocusedBarsPaint.count < mixedBarsPaint.count / 2,
    `dots: line ${mixedDots.line.count}px, bars ${mixedDots.bars.count}px; `
    + `bars ${mixedBarsPaint.count}px, ${mixedFocusedBarsPaint.count}px focused`);

  // The same values below 0 end the main axis at 0, from which the bars hang
  const negateValues = (dataset) => ({ ...dataset, values: dataset.values.map((value) => -value) });
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: { ...mixedConfig, title: 'Probe — Bars below 0', datasets: mixedConfig.datasets.map(negateValues) },
  });
  const negativeLabelValues = await readMainYLabels();
  await unmountProbe(page);
  check('bars below 0 beside a line end the main Y axis at 0',
    Math.max(...negativeLabelValues) === 0 && Math.min(...negativeLabelValues) <= -Math.max(...mixedLabelValues),
    `labels ${JSON.stringify(negativeLabelValues)}, above 0 ${JSON.stringify(mixedLabelValues)}`);

  // A hatch goes over the bars and under the line, which keeps every pixel it has without the hatch
  const mixedHatchedRanges = [{ from: 0, to: mixedLabels.length - 1, color: PROBE_MAGENTA }];
  const mixedHatched = await mountProbe(page, {
    config: { ...mixedConfig, title: 'Probe — A hatch between bars and a line', hatchedRanges: mixedHatchedRanges },
  });
  const hatchedLinePaint = await findColor(mixedHatched, [255, 0, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE);
  const hatchedBarPixels = await countPickedPixels(mixedHatched, BAR_HATCH_PIXEL);
  await unmountProbe(page);
  check('a hatch goes over bars and under a line of another type',
    hatchedBarPixels > 1000 && hatchedLinePaint.count >= mixedLinePaint.count * MIN_LINE_SHARE_OVER_HATCH,
    `${hatchedBarPixels}px of the hatch over the bars, ${hatchedLinePaint.count}px of the line under it, `
    + `${mixedLinePaint.count}px without it`);

  // A stack of 10 and 20 under a target of 60 drawn as a line, which the main axis reaches with the stack hidden too
  const targetConfig = {
    type: 'bar',
    isStacked: true,
    labels: mixedLabels,
    datasets: [
      { name: 'Low', color: '#0000FF', values: Array(7).fill(10) },
      { name: 'High', color: '#00AA00', values: Array(7).fill(20) },
      { name: 'Target', color: '#FF0000', type: 'line', values: Array(7).fill(60) },
    ],
  };
  await recordProbeNumbers(page);
  const targetChart = await mountProbe(page, { config: { ...targetConfig, title: 'Probe — Stack under a target' } });
  const targetLabels = await readMainYLabels();
  const targetPaint = await findColor(targetChart, [255, 0, 0], CONSTANT_LINE_BAND, GRID_TINTED_COLOR_TOLERANCE);
  const targetTooltip = await readProbeTooltip(page, 3);
  const targetTotal = await page.evaluate(() => (
    document.querySelector('#probe [data-total="true"] .lovely-chart--tooltip-dataset-value')?.textContent
  ));
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  await targetChart.locator('.lovely-chart--button').nth(0).click();
  await targetChart.locator('.lovely-chart--button').nth(1).click();
  await waitForIdle(page, 1000);
  const targetAloneLabels = await readMainYLabels();
  await unmountProbe(page);
  check('a line of another type than a stacked chart\'s draws its own value beside the stack, on the main Y axis',
    Math.max(...targetLabels) === 60 && targetPaint.count > 50 && Math.abs(targetPaint.meanY - PLOT_TOP) < 3,
    `labels ${JSON.stringify(targetLabels)}, line ${targetPaint.count}px at ${targetPaint.meanY?.toFixed(1)}`);
  check('the Total row of a stacked chart leaves out a dataset of another type',
    targetTooltip.names.includes('Target') && targetTotal === '30',
    `rows ${JSON.stringify(targetTooltip.names)}, total ${targetTotal}`);
  check('a stacked chart spans 0 to the dataset of another type with the stack hidden',
    Math.min(...targetAloneLabels) === 0 && Math.max(...targetAloneLabels) === 60,
    `labels ${JSON.stringify(targetAloneLabels)}`);

  // A zoom into shares leaves the target out of the pie
  const targetShares = await mountProbe(page, {
    config: { ...targetConfig, title: 'Probe — Shares under a target', zoomToShares: true, initialZoom: 3 },
  });
  const targetSharesPaint = {
    target: await findColor(targetShares, [255, 0, 0]),
    low: await findColor(targetShares, [0, 0, 255]),
    high: await findColor(targetShares, [0, 170, 0]),
  };
  await unmountProbe(page);
  check('a zoom into shares leaves a dataset of another type out of the pie',
    targetSharesPaint.target.count === 0 && targetSharesPaint.low.count > 1000 && targetSharesPaint.high.count > 1000,
    Object.entries(targetSharesPaint).map(([part, { count }]) => `${part} ${count}px`).join(', '));

  // The comparison line and its change follow the dataset of the chart's type alone: 110 against 100
  await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Comparison beside bars',
      labels: mixedLabels,
      datasets: [
        { name: 'Visits', color: '#FF0000', values: Array(7).fill(110) },
        { name: 'Orders', color: '#0000FF', type: 'bar', values: Array(7).fill(1000) },
      ],
      comparison: { name: 'Week before', values: [Array(7).fill(100), Array(7).fill(500)] },
    },
  });
  const comparedTooltip = await readProbeTooltip(page, 3);
  await unmountProbe(page);
  check('the comparison and its change leave out a dataset of another type',
    comparedTooltip.names.includes('Orders') && comparedTooltip.change.text === '+10%',
    `rows ${JSON.stringify(comparedTooltip.names)}, change ${comparedTooltip.change.text}`);

  // A percentage chart draws every dataset as a share of one whole, the one of another type included
  await mountProbe(page, {
    config: {
      ...targetConfig,
      type: 'area',
      isStacked: false,
      isPercentage: true,
      title: 'Probe — Shares of every type',
      datasets: targetConfig.datasets.slice(0, 2).map((dataset) => ({ ...dataset, type: 'line' })),
    },
  });
  await readProbeTooltip(page, 3);
  const typedShares = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#probe .lovely-chart--tooltip-dataset[data-key]')].map((row) => (
      [row.dataset.name, row.querySelector('.lovely-chart--percentage-title')?.textContent]
    )),
  ));
  await unmountProbe(page);
  check('a percentage chart ignores the type of a dataset', typedShares.Low === '33%' && typedShares.High === '67%',
    JSON.stringify(typedShares));

  // The outward column of bars and a line on one axis fits every label of windows from 0, and no wider, on either side
  const mixedColumnLabels = Array.from({ length: 30 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const mixedColumnBars = mixedColumnLabels.map((_, i) => 6100 + (i % 4) * 100);
  const mixedColumnLine = mixedColumnLabels.map((_, i) => 6200 + i * 5);
  for (const [side, sign] of [['above', 1], ['below', -1]]) {
    await recordProbeNumbers(page);
    const mixedColumnChart = await mountProbe(page, {
      config: {
        type: 'bar',
        title: `Probe — Column, a line over bars ${side} 0`,
        withMinimap: true,
        isYAxisOutward: true,
        labels: mixedColumnLabels,
        datasets: [
          { name: 'Daily', color: '#0000FF', values: mixedColumnBars.map((value) => sign * value) },
          { name: 'Average', color: '#FF0000', type: 'line', values: mixedColumnLine.map((value) => sign * value) },
        ],
      },
    });
    await mixedColumnChart.scrollIntoViewIfNeeded();
    await sweepProbe(page);
    const mixedColumn = getYLabelColumn(await readProbeTexts(page));
    await unmountProbe(page);
    check(`an outward column of bars and a line ${side} 0 fits every label of its windows from 0, and no wider`,
      mixedColumn.ends.length === 1 && mixedColumn.overflowing.length === 0
      && mixedColumn.end - GUTTER - mixedColumn.widest < 1,
      `ends at ${JSON.stringify(mixedColumn.ends)}, widest ${mixedColumn.widest.toFixed(2)}px, `
      + `labels ${mixedColumn.texts.join(' ')}`);
  }
});

section('A single label draws in a column centered in the plot, its X-axis label under it, whatever window the minimap '
  + 'opens on, which spans the whole minimap', async ({ page }) => {
  for (const type of ['line', 'area', 'bar']) {
    await recordProbeNumbers(page);
    const singleChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Single ${type} with the minimap`,
        labels: [Date.UTC(2026, 10, 1)],
        datasets: [{ name: 'Single', color: '#FF0000', values: [342] }],
        withMinimap: true,
      },
    });
    const plotFill = await findColor(singleChart, [255, 0, 0]);
    const middleFill = await findColor(singleChart, [255, 0, 0], SINGLE_LABEL_BAND);
    const singleTexts = await readProbeTexts(page);
    const xLabelXs = getLastFrameTexts(singleTexts).filter(({ align }) => align === 'center').map(({ x }) => x);
    const maskWidths = await singleChart.locator('.lovely-chart--minimap-mask')
      .evaluateAll((masks) => masks.map((mask) => mask.style.width));
    await unmountProbe(page);
    // A bar fills its column across the plot; a line or an area draws a dot in its middle
    const isDrawn = type === 'bar' ? plotFill.count > 1000 : plotFill.count > 10 && middleFill.count === plotFill.count;
    check(`a single-label ${type} with the minimap draws in a centered column, its window over the whole minimap`,
      isDrawn && xLabelXs.length === 1 && Math.abs(xLabelXs[0] - singleTexts.canvasWidth / 2) < 1
      && maskWidths.every((width) => width === '0%'),
      `${plotFill.count}px, ${middleFill.count}px of them mid-plot, X-axis labels at ${JSON.stringify(xLabelXs)} `
      + `of ${singleTexts.canvasWidth}px, minimap masks ${JSON.stringify(maskWidths)}`);
  }
});

section('A Y-axis tick at 0 reads 0, never float noise', async ({ page }) => {
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Ticks through 0',
      labels: [1, 2, 3, 4, 5, 6].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'P&L', values: [-0.9, -0.5, 0.05, -0.3, -0.7, 0.02] }],
    },
  });
  const tickValues = await readProbeNumbers(page);
  await unmountProbe(page);
  check('a Y-axis tick at 0 reads 0', tickValues.includes(0) && tickValues.every((value) => value === 0
    || Math.abs(value) >= FINEST_Y_STEP), JSON.stringify(tickValues));
});

section('A single label in the trillions labels its value instead of freezing the page', async ({ browser, url }) => {
  // A page of its own, so a freeze holds up none of the checks after it
  const trillionPage = await newTestPage(browser, { viewport: { width: 900, height: 1200 } });
  await trillionPage.goto(`${url}isolated`);
  const trillionTexts = await Promise.race([
    trillionPage.evaluate(async ({ types, value }) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const texts = [];
      const { fillText } = CanvasRenderingContext2D.prototype;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        texts.push(String(text));
        return fillText.call(this, text, ...args);
      };
      const textsByType = {};
      for (const type of types) {
        texts.length = 0;
        const element = document.createElement('div');
        document.body.appendChild(element);
        const chart = new LovelyChart(element, {
          type, labels: [Date.UTC(2026, 10, 1)], datasets: [{ name: 'Huge', values: [value] }],
        });
        await window.idleTracker.wait(800);
        textsByType[type] = [...new Set(texts)];
        chart.destroy();
        element.remove();
      }
      return textsByType;
    }, { types: ['line', 'bar'], value: TRILLION_VALUE }),
    // eslint-disable-next-line no-restricted-syntax -- bounds the race that tells a frozen page, and waits for nothing
    sleep(FREEZE_TIMEOUT_MS).then(() => undefined),
  ]);
  await trillionPage.close();
  check('a single label in the trillions labels its value',
    trillionTexts !== undefined && Object.values(trillionTexts).every((texts) => texts.some((text) => (
      text.endsWith('T')
      && Math.abs(parseFloat(text) * TRILLION - TRILLION_VALUE) <= TRILLION_VALUE * TRILLION_LABEL_TOLERANCE
    ))),
    trillionTexts ? JSON.stringify(trillionTexts) : `no frame in ${FREEZE_TIMEOUT_MS}ms`);
});

section('Panning the narrowest window across single labels keeps the Y axis to a few labels a '
  + 'frame', async ({ page }) => {
  await recordProbeNumbers(page);
  const panLabels = Array.from({ length: 40 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  await mountProbe(page, {
    config: {
      type: 'line',
      withMinimap: true,
      title: 'Probe — Narrow pan',
      labels: panLabels,
      datasets: [{ name: 'Visitors', values: panLabels.map((_, i) => Math.round(3000 + 1400 * Math.cos(i / 3))) }],
    },
  });
  await sweepProbe(page, NARROW_PAN_STEP);
  const panTexts = (await readProbeTexts(page)).texts;
  await unmountProbe(page);
  const textsPerFrame = panTexts.reduce((counts, { frame }) => (
    counts.set(frame, (counts.get(frame) ?? 0) + 1)
  ), new Map());
  const mostTextsInFrame = Math.max(...textsPerFrame.values());
  check('panning the narrowest window keeps the Y axis to a few labels a frame',
    mostTextsInFrame <= MAX_PAN_TEXTS_PER_FRAME, `at most ${mostTextsInFrame} texts in a frame`);
});

section('The Y-axis labels of narrow windows read every digit of their step, so neighbours differ, on both '
  + 'axes', async ({ page }) => {
  const preciseLabels = Array.from({ length: 60 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const preciseSweeps = [{
    name: 'the main axis, its column and the second axis',
    affixes: ['$', '/d'],
    config: {
      hasSecondYAxis: true,
      isYAxisOutward: true,
      valuePrefix: '$',
      valueSuffix: '/d',
      datasets: [
        { name: 'Sales', values: preciseLabels.map((_, i) => Math.round(6100 + 120 * Math.sin(i / 3))) },
        { name: 'Revenue', values: preciseLabels.map((_, i) => Math.round(6.1e6 + 1.2e5 * Math.cos(i / 4))) },
      ],
    },
  }, {
    name: 'a secondary axis of a multiplier',
    affixes: ['€'],
    config: {
      secondaryYAxis: { label: 'EUR', multiplier: 0.92, prefix: '€' },
      datasets: [{ name: 'Sales', values: preciseLabels.map((_, i) => Math.round(6100 + 120 * Math.sin(i / 3))) }],
    },
  }];
  for (const { name, affixes, config } of preciseSweeps) {
    await recordProbeNumbers(page);
    const preciseChart = await mountProbe(page, {
      config: {
        type: 'line', withMinimap: true, title: `Probe — Precise labels, ${name}`, labels: preciseLabels, ...config,
      },
    });
    await preciseChart.scrollIntoViewIfNeeded();
    await sweepProbe(page);
    const preciseTexts = await readProbeTexts(page);
    await unmountProbe(page);
    const inexactPasses = listInexactYLabelPasses(preciseTexts, affixes);
    const yLabelTexts = preciseTexts.texts.filter(({ align }) => align !== 'center');
    const passCount = new Set(yLabelTexts.map(({ pass }) => pass)).size;
    check(`narrow windows label each Y-axis step in full, apart from its neighbours, on ${name}`,
      passCount > 100 && inexactPasses.length === 0,
      `${inexactPasses.length} of ${passCount} passes, such as ${JSON.stringify(inexactPasses.slice(0, 3))}`);
    if (config.isYAxisOutward) {
      const preciseColumn = getYLabelColumn(preciseTexts);
      check('an outward column fits every label of a narrow window read in full',
        preciseColumn.ends.length === 1 && preciseColumn.overflowing.length === 0
        && preciseColumn.texts.some((text) => /\.\d{3}K/.test(text)),
        `ends at ${JSON.stringify(preciseColumn.ends)}, widest ${preciseColumn.widest.toFixed(2)}px, `
        + `overflowing: ${JSON.stringify(preciseColumn.overflowing)}`);
    }
  }
});

section('A constant window labels its one value in full, on the main axis, its column, the second axis and a secondary '
  + 'axis', async ({ page }) => {
  const constantLabelDays = [1, 2, 3, 4, 5, 6, 7].map((day) => Date.UTC(2026, 10, day));
  const constantLabelCases = [{
    name: 'equal values on an outward column and the second axis',
    texts: ['6.25K', '1.234567M'],
    config: {
      type: 'line',
      isYAxisOutward: true,
      hasSecondYAxis: true,
      labels: constantLabelDays,
      datasets: [
        { name: 'Main', values: constantLabelDays.map(() => 6250) },
        { name: 'Second', values: constantLabelDays.map(() => 1234567) },
      ],
    },
  }, {
    name: 'a single bar and its secondary axis',
    texts: ['6.125K', '€12.25K'],
    config: {
      type: 'bar',
      labels: constantLabelDays.slice(0, 1),
      datasets: [{ name: 'Single', values: [6125] }],
      secondaryYAxis: { label: 'EUR', multiplier: 2, prefix: '€' },
    },
  }];
  for (const { name, texts, config } of constantLabelCases) {
    await recordProbeNumbers(page);
    await mountProbe(page, { config: { ...config, title: `Probe — Constant labels, ${name}` } });
    const constantTexts = await readProbeTexts(page);
    await unmountProbe(page);
    const yLabels = [...new Set(getLastFrameTexts(constantTexts)
      .filter(({ align }) => align !== 'center').map(({ text }) => text))].sort();
    const constantColumn = getYLabelColumn(constantTexts, true);
    check(`a constant window labels its value in full: ${name}`,
      JSON.stringify(yLabels) === JSON.stringify([...texts].sort())
      && (!config.isYAxisOutward || constantColumn.overflowing.length === 0),
      `labels ${JSON.stringify(yLabels)}, overflowing the column: ${JSON.stringify(constantColumn.overflowing)}`);
  }
});

section('A dashed or dotted line or step draws its pattern, on the plot and the minimap, and outlines its legend '
  + 'button and tooltip swatch in it; a dataset both dashed and dotted draws dots, and an area or bars draw '
  + 'neither', async ({ page }) => {
  const linePatterns = [
    { flags: { isDashed: true }, pattern: 'dashed', dash: 6, gap: 4, units: 'dashes' },
    { flags: { isDotted: true }, pattern: 'dotted', dash: 2, gap: 3, units: 'dots' },
    { flags: { isDashed: true, isDotted: true }, pattern: 'dotted', dash: 2, gap: 3, units: 'dots' },
  ];
  const isPatternMeasured = ({ count, dashLength, gapLength }, { dash, gap }) => count > 20
    && Math.abs(dashLength - dash) <= 1 && Math.abs(gapLength - gap) <= 1
    && Math.abs(dashLength + gapLength - dash - gap) < 0.5;
  for (const { flags, pattern, dash, gap, units } of linePatterns) {
    const flagNames = Object.keys(flags).join(' + ');
    for (const type of ['line', 'step']) {
      const patternChart = await mountProbe(page, {
        config: {
          type,
          title: `Probe — ${flagNames} ${type}`,
          withMinimap: true,
          minimapRange: 'full',
          labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
          datasets: [{ name: 'Patterned', color: '#0000FF', values: [5, 5, 5, 5], ...flags }],
        },
      });
      const plotPattern = await readBlueLinePattern(patternChart);
      const minimapPattern = await readBlueLinePattern(patternChart.locator('.lovely-chart--minimap'));
      const button = await patternChart.locator('.lovely-chart--button').evaluate((el) => ({
        attributes: ['data-dashed', 'data-dotted'].filter((attribute) => el.hasAttribute(attribute)),
        outline: getComputedStyle(el).borderTopStyle,
      }));
      const patternTooltip = await readProbeTooltip(page, 1);
      await unmountProbe(page);
      const swatches = { dashed: patternTooltip.dashedSwatches, dotted: patternTooltip.dottedSwatches };
      check(`${flagNames} draws a ${type} in ${dash}px ${units} ${gap}px apart, its button and swatch ${pattern}`,
        isPatternMeasured(plotPattern, { dash, gap }) && isPatternMeasured(minimapPattern, { dash, gap })
        && JSON.stringify(button) === JSON.stringify({ attributes: [`data-${pattern}`], outline: pattern })
        && JSON.stringify(swatches) === JSON.stringify({ dashed: [], dotted: [], [pattern]: ['Patterned'] }),
        `plot ${JSON.stringify(plotPattern)}, minimap ${JSON.stringify(minimapPattern)}, `
        + `button ${JSON.stringify(button)}, swatches ${JSON.stringify(swatches)}`);
    }
  }

  for (const type of ['area', 'bar']) {
    const patternedChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Dashed and dotted ${type}`,
        labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
        datasets: [
          { name: 'Dashed', color: '#0000FF', values: [5, 6, 5, 6], isDashed: true },
          { name: 'Dotted', color: '#00FF00', values: [4, 5, 4, 5], isDotted: true },
          { name: 'Solid', color: '#FF0000', values: [2, 3, 2, 3] },
        ],
      },
    });
    const patternedButtons = await patternedChart
      .locator('.lovely-chart--button[data-dashed], .lovely-chart--button[data-dotted]').count();
    const patternedTooltip = await readProbeTooltip(page, 1);
    await unmountProbe(page);
    const patternedSwatches = [...patternedTooltip.dashedSwatches, ...patternedTooltip.dottedSwatches];
    check(`isDashed and isDotted leave ${type === 'area' ? 'an area' : 'bars'} solid, legend buttons and swatches too`,
      patternedButtons === 0 && patternedTooltip.swatched.length === 3 && !patternedSwatches.length,
      `${patternedButtons} patterned buttons, patterned swatches ${JSON.stringify(patternedSwatches)}`);
  }
});

section('Panning leaves the dashes and dots of a sloped line, steps and a smooth line in place, at one scale a '
  + 'frame', async ({ page }) => {
  const panPhaseLabels = Array.from({ length: PAN_PHASE_LABELS }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const panPhaseCases = [
    { name: 'a dotted line', type: 'line', flags: { isDotted: true } },
    { name: 'a dashed line', type: 'line', flags: { isDashed: true } },
    { name: 'dotted steps', type: 'step', flags: { isDotted: true } },
    { name: 'a dotted smooth line', type: 'line', flags: { isDotted: true }, areLinesSmooth: true },
    // The two ends of the window keep in step through each frame of their transitions, though the millisecond turns
    // between two reads of the clock
    {
      name: 'dotted steps on a clock whose millisecond turns between reads a moment apart',
      type: 'step',
      flags: { isDotted: true },
      isClockSpread: true,
    },
  ];
  for (const { name, type, flags, areLinesSmooth = false, isClockSpread } of panPhaseCases) {
    await mountProbe(page, {
      config: {
        type,
        title: 'Probe — Panned pattern',
        withMinimap: true,
        minimapRange: [0.3, 0.5],
        areLinesSmooth,
        labels: panPhaseLabels,
        datasets: [{
          name: 'Patterned',
          color: '#0000FF',
          values: panPhaseLabels.map((_, i) => PAN_PHASE_VALUES[i % PAN_PHASE_VALUES.length]),
          ...flags,
        }],
      },
    });
    const panPhase = await readPanPhaseShift(page, isClockSpread);
    await unmountProbe(page);
    check(`panning ${name} leaves its pattern in place, at one scale a frame`,
      panPhase.starts > 1 && panPhase.shift <= MAX_PAN_PHASE_SHIFT && panPhase.scaleDrift <= MAX_PAN_SCALE_DRIFT,
      JSON.stringify(panPhase));
  }
});

section('Smooth lines curve through their values', async ({ page }) => {
  const zigzag = {
    type: 'line',
    labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'Zigzag', color: '#FF0000', values: [0, 10, 0, 10, 0] }],
  };
  // A band of 2px a quarter of the way from the peak at label 1 down to label 2, as fractions of the canvas width
  const quarterBand = (chart) => chart.evaluate((el) => {
    const width = el.querySelector('canvas').clientWidth;
    const x = 10 + (1.25 / 4) * (width - 20);
    return [(x - 1) / width, (x + 1) / width];
  });
  const straightChart = await mountProbe(page, { config: { ...zigzag, title: 'Probe — Straight lines' } });
  const straightQuarter = await findColor(straightChart, [255, 0, 0], await quarterBand(straightChart));
  await unmountProbe(page);
  const smoothChart = await mountProbe(page, {
    config: { ...zigzag, title: 'Probe — Smooth lines', areLinesSmooth: true },
  });
  const smoothQuarter = await findColor(smoothChart, [255, 0, 0], await quarterBand(smoothChart));
  await unmountProbe(page);
  // A monotone curve leaves a peak flat, so a quarter of the way down it runs well above the straight line
  check('areLinesSmooth curves a line through its values',
    straightQuarter.count > 0 && smoothQuarter.count > 0 && straightQuarter.meanY - smoothQuarter.meanY > 10,
    `straight at ${straightQuarter.meanY?.toFixed(1)}, smooth at ${smoothQuarter.meanY?.toFixed(1)}`);
});

section('A missing value in a stacked area', async ({ page }) => {
  // An absolute stack has no base above a missing value, so the areas above it break there. A percentage
  // chart has one, the shares of the values the label has, so only the missing dataset's own wedge empties.
  const gapLabels = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, 10, 1 + i));
  for (const isPercentage of [false, true]) {
    const gapChart = await mountProbe(page, {
      config: {
        type: 'area',
        isStacked: true,
        isPercentage,
        title: 'Probe — Stack gap',
        labels: gapLabels,
        datasets: [
          { name: 'Low', color: '#0000FF', values: Array(12).fill(30) },
          // `values` marks a missing value with `null`
          // eslint-disable-next-line no-null/no-null
          { name: 'Middle', color: '#00AA00', values: gapLabels.map((_, i) => (i === 5 ? null : 30)) },
          { name: 'Top', color: '#FF0000', values: Array(12).fill(40) },
        ],
      },
    });
    // A band of 6px around a label's column, as fractions of the canvas width
    const columnBand = (labelIndex) => gapChart.evaluate((el, index) => {
      const width = el.querySelector('canvas').clientWidth;
      const x = 10 + (index / 11) * (width - 20);
      return [(x - 3) / width, (x + 3) / width];
    }, labelIndex);
    const topAtGap = await findColor(gapChart, [255, 0, 0], await columnBand(5));
    const topElsewhere = await findColor(gapChart, [255, 0, 0], await columnBand(2));
    await unmountProbe(page);
    const details = `${topAtGap.count}px of the top area at the missing value, ${topElsewhere.count}px at a full one`;
    if (isPercentage) {
      check('a percentage area keeps the areas above a missing value filled',
        topElsewhere.count > 100 && topAtGap.count > topElsewhere.count / 2, details);
    } else {
      check('a stacked area leaves the areas above a missing value unfilled',
        topElsewhere.count > 100 && topAtGap.count === 0, details);
    }
  }
});

section('An area outline runs along every edge of each run of an area split at a gap', async ({ page }) => {
  const outlineChart = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Area outline',
      labels: Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 10, 1 + i)),
      // `values` marks a missing value with `null`
      // eslint-disable-next-line no-null/no-null
      datasets: [{ name: 'Split', color: '#0000FF', values: [20, 30, 20, null, 20, 30, 20] }],
      areaOpacity: 0.25,
      areaBorderColor: '#FF0000',
    },
  });
  // A band of 4px around a label's column, as fractions of the canvas width
  const outlineBand = (labelIndex) => outlineChart.evaluate((el, index) => {
    const width = el.querySelector('canvas').clientWidth;
    const x = 10 + (index / 6) * (width - 20);
    return [(x - 2) / width, (x + 2) / width];
  }, labelIndex);
  // The left and the right edge of the run before the gap, then of the run after it
  const outlineEdges = [];
  for (const labelIndex of [0, 2, 4, 6]) {
    outlineEdges.push((await findColor(outlineChart, [255, 0, 0], await outlineBand(labelIndex))).count);
  }
  await unmountProbe(page);
  const [firstLeft, firstRight, secondLeft, secondRight] = outlineEdges;
  check('areaBorderColor outlines both sides of each run of a split area',
    firstRight > 100 && secondRight > 100 && firstLeft > firstRight / 2 && secondLeft > secondRight / 2,
    `${JSON.stringify(outlineEdges)}px at the left and right edges of either run`);
});

section('A themed area outline takes the colour of the theme, and follows a change of the theme', async ({ page }) => {
  const wasOutlineThemeDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  await page.evaluate(() => document.documentElement.classList.remove('theme-dark'));
  const themedOutlineChart = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Themed area outline',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Outlined', color: '#0000FF', values: [20, 30, 25, 35] }],
      areaOpacity: 0.25,
      areaBorderColor: { light: '#FF0000', dark: '#00FFFF' },
    },
  });
  const readOutlinePixels = async () => [
    (await findColor(themedOutlineChart, [255, 0, 0])).count,
    (await findColor(themedOutlineChart, [0, 255, 255])).count,
  ];
  const lightOutline = await readOutlinePixels();
  await page.evaluate(() => document.documentElement.classList.add('theme-dark'));
  await waitForIdle(page, 300);
  const darkOutline = await readOutlinePixels();
  await unmountProbe(page);
  await page.evaluate((isDark) => document.documentElement.classList.toggle('theme-dark', isDark), wasOutlineThemeDark);
  check('a themed areaBorderColor outlines an area in the colour of the theme as the theme changes',
    lightOutline[0] > 100 && lightOutline[1] === 0 && darkOutline[0] === 0 && darkOutline[1] > 100,
    `red and cyan px: ${JSON.stringify(lightOutline)} in the light theme, ${JSON.stringify(darkOutline)} in the dark`);
});

const columnLabels = Array.from({ length: 120 }, (_, i) => Date.UTC(2026, 0, 1 + i));
const columnConfig = {
  type: 'line',
  title: 'Probe — Label column',
  withMinimap: true,
  isYAxisOutward: true,
  labels: columnLabels,
  // Whole tens, each high value 30 or more from the one before, so the narrowest window the minimap selects brings
  // up labels with as many digits after the point as any window of two labels
  datasets: [
    {
      name: 'High',
      color: '#FF0000',
      values: columnLabels.map((_, i) => 6000 + Math.round(3 * Math.sin(i / 7)) * 100 + i * 30),
    },
    {
      name: 'Low',
      color: '#0000FF',
      values: columnLabels.map((_, i) => 2000 + Math.round(9 * Math.cos(i / 5)) * 100),
    },
  ],
};
section('The outward Y-label column fits the widest label the data can show, and holds still', async ({ page }) => {
  await recordProbeNumbers(page);
  const columnChart = await mountProbe(page, { config: columnConfig });
  await columnChart.scrollIntoViewIfNeeded();
  const initialColumn = getYLabelColumn(await readProbeTexts(page));
  // The narrowest window, panned, then with the low dataset hidden, so the window starts above 0
  const columnEar = await columnChart.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await drag(page, columnEar.x + columnEar.width / 2, columnEar.y + columnEar.height / 2, 600, 0, 20);
  await waitForIdle(page, 700);
  const columnSlider = await columnChart.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, columnSlider.x + columnSlider.width / 2, columnSlider.y + columnSlider.height / 2, -300, 0, 30);
  await waitForIdle(page, 700);
  await columnChart.locator('.lovely-chart--button').nth(1).click();
  await waitForIdle(page, 1000);
  const pannedColumn = getYLabelColumn(await readProbeTexts(page));
  const pannedEnds = [...new Set([...initialColumn.ends, ...pannedColumn.ends])];
  check('an outward Y-label column holds still while the reader narrows, pans and hides datasets',
    pannedEnds.length === 1 && pannedColumn.texts.some((text) => !initialColumn.texts.includes(text)),
    `ends at ${JSON.stringify(pannedEnds)}, labels ${initialColumn.texts.join(' ')} `
    + `then ${pannedColumn.texts.join(' ')}`);
  check('the outward column fits its widest label, and no wider',
    pannedColumn.overflowing.length === 0 && pannedColumn.end - GUTTER - pannedColumn.widest < 1,
    `ends at ${pannedColumn.end}, widest label ${pannedColumn.widest.toFixed(2)}px, `
    + `overflowing: ${JSON.stringify(pannedColumn.overflowing)}`);
  // The plot is clipped from the pixel where the column ends, so the band stops half a pixel short of it
  const columnFraction = await columnChart.evaluate(
    (el, end) => (end - 0.5) / el.querySelector('canvas').clientWidth,
    pannedColumn.end,
  );
  const inColumn = await findColor(columnChart, [255, 0, 0], [0, columnFraction]);
  const inPlot = await findColor(columnChart, [255, 0, 0], [columnFraction, 1]);
  check('a panned plot stays out of the Y-label column', inColumn.count === 0 && inPlot.count > 100,
    `${inColumn.count}px in the column, ${inPlot.count}px in the plot`);

  await page.evaluate(() => window.probeChart.update({
    type: 'line',
    isYAxisOutward: true,
    labels: [1, 2, 3].map((day) => Date.UTC(2026, 0, day)),
    datasets: [{ name: 'Small', values: [0.5, 1.25, 0.75] }],
  }));
  await waitForIdle(page, 1500);
  const updatedColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('update() measures the outward column for the new data',
    updatedColumn.end < pannedColumn.end && updatedColumn.overflowing.length === 0,
    `ends at ${updatedColumn.end} after ${pannedColumn.end}, labels ${updatedColumn.texts.join(' ')}`);

  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...columnConfig, title: 'Probe — Label column, 14px', axisFontSize: 14 } });
  const largeFontColumn = getYLabelColumn(await readProbeTexts(page));
  await unmountProbe(page);
  check('a larger axis font widens the outward column to fit',
    largeFontColumn.ends.length === 1 && largeFontColumn.end > pannedColumn.end
    && largeFontColumn.overflowing.length === 0,
    `ends at ${JSON.stringify(largeFontColumn.ends)} at 14px, ${pannedColumn.end} at 10px`);

  // A zoom swaps in the day's data, which brings a column of its own for its labels in US dollars, and a zoom out
  // brings back the overview's
  const zoomColumnConfig = { title: 'Probe — Label column zoom', isYAxisOutward: true };
  await recordProbeNumbers(page);
  await mountProbe(page, { dataUrl: './data/bars.json', config: zoomColumnConfig });
  const overviewColumn = getYLabelColumn(await readProbeTexts(page), true);
  const overviewAreaLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  const zoomColumnChart = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { ...zoomColumnConfig, initialZoom: 'last' },
    zoomDataSource: 'data/zoom_bars',
    zoomConfig: { isYAxisOutward: true, valuePrefix: 'US$' },
  });
  await waitForIdle(page, 1000);
  const dayColumn = getYLabelColumn(await readProbeTexts(page), true);
  const dayAreaLeft = await readPlotAreaLeft(page);
  await zoomColumnChart.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2500);
  const zoomedOutColumn = getYLabelColumn(await readProbeTexts(page), true);
  const zoomedOutAreaLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  check('a zoom into a day measures an outward column of its own, and a zoom out the overview\'s',
    dayColumn.ends.length === 1 && dayColumn.end !== overviewColumn.end && dayColumn.overflowing.length === 0
    && zoomedOutColumn.end === overviewColumn.end,
    `overview ${overviewColumn.end} (${overviewColumn.texts.join(' ')}), day ${JSON.stringify(dayColumn.ends)} `
    + `(${dayColumn.texts.join(' ')}), zoomed out ${zoomedOutColumn.end}`);
  check('a zoom into a day and out of it moves the plot area to the column on screen',
    overviewAreaLeft === overviewColumn.end + Y_AXIS_LABEL_GAP && dayAreaLeft === dayColumn.end + Y_AXIS_LABEL_GAP
    && zoomedOutAreaLeft === overviewAreaLeft,
    `left ${overviewAreaLeft}, ${dayAreaLeft} zoomed in, ${zoomedOutAreaLeft} zoomed out, `
    + `after labels ending at ${overviewColumn.end}, ${dayColumn.end} and ${zoomedOutColumn.end}`);
});

section('The outward column fits the labels a previous period, a gap, a reference line or a hidden dataset '
  + 'bring', async ({ page }) => {
  const sweepLabels = (count) => Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, 1 + i));
  // The window of the last week opens on finer steps than its values alone take, its previous values being lower
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'line',
      withMinimap: true,
      isYAxisOutward: true,
      title: 'Probe — Column, small counts',
      labels: sweepLabels(7),
      datasets: [{ name: 'Signups', values: [3, 2, 3, 2, 3, 3, 3] }],
      comparison: { name: 'Week before', values: [[4, 2, 2, 2, 4, 2, 3]] },
    },
  });
  const smallCountsColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('an outward column fits the first labels of small counts against a previous period',
    smallCountsColumn.texts.includes('2.2') && smallCountsColumn.overflowing.length === 0,
    `ends at ${JSON.stringify(smallCountsColumn.ends)}, labels ${smallCountsColumn.texts.join(' ')}, `
    + `overflowing: ${JSON.stringify(smallCountsColumn.overflowing)}`);

  const columnSweeps = [{
    name: 'small counts against a previous period',
    config: {
      labels: sweepLabels(7),
      datasets: [{ name: 'Signups', values: [3, 2, 3, 2, 3, 3, 3] }],
      comparison: { name: 'Week before', values: [[4, 2, 2, 2, 4, 2, 3]] },
    },
  }, {
    name: 'a dataset missing a previous value',
    config: {
      labels: sweepLabels(6),
      datasets: [
        { name: 'Web', values: [309.92, 300.5, 310.25, 305.75, 312.5, 308.25] },
        // `values` marks a missing value with `null`
        // eslint-disable-next-line no-null/no-null
        { name: 'App', values: [null, 1500, 1520, 1510, 1490, 1530] },
      ],
      comparison: {
        name: 'Week before',
        // eslint-disable-next-line no-null/no-null
        values: [[299.68, 295, 305, 300, 310, 300], [null, 1480, 1500, 1490, 1470, 1500]],
      },
    },
  }, {
    name: 'mixed signs against a previous period, the positive dataset hidden',
    hiddenIndexes: [1],
    config: {
      labels: sweepLabels(5),
      datasets: [
        { name: 'Refunds', values: [-4.6e6, -4.9e6, -5.2e6, -5.9e6, -5e6] },
        { name: 'Sales', values: [8.9e6, 9e6, 10.5e6, 11.3e6, 11.6e6] },
        { name: 'Fees', values: [-3e6, -4.1e6, -4.3e6, -5.1e6, -3.8e6] },
      ],
      comparison: {
        name: 'Last year',
        values: [
          [-3.8e6, -6.2e6, -3.4e6, -8.1e6, -6.1e6],
          [9.9e6, 12.3e6, 9.1e6, 15.8e6, 7.3e6],
          [-2.1e6, -2.3e6, -2.3e6, -2.8e6, -2.2e6],
        ],
      },
    },
  }, {
    name: 'stacked bars with a gap under a reference line',
    config: {
      type: 'bar',
      isStacked: true,
      labels: sweepLabels(8),
      // eslint-disable-next-line no-null/no-null
      datasets: [{ name: 'A', values: [4.3e9, 4.3e9, 4e9, 4.7e9, 4.9e9, 5.8e9, null, 7.3e9] }],
      referenceLines: [{ value: 1.26e9, label: 'Floor' }],
    },
  }, {
    name: 'whole steps of rates under a target',
    config: {
      noFloatSteps: true,
      labels: sweepLabels(6),
      datasets: [{ name: 'Rate', values: [0.12, 0.3, 0.25, 0.4, 0.33, 0.2] }],
      referenceLines: [{ value: 0.5 }],
    },
  }];
  for (const { name, hiddenIndexes = [], config } of columnSweeps) {
    await recordProbeNumbers(page);
    const sweptChart = await mountProbe(page, {
      config: { type: 'line', withMinimap: true, isYAxisOutward: true, title: `Probe — Column, ${name}`, ...config },
    });
    await sweptChart.scrollIntoViewIfNeeded();
    for (const index of hiddenIndexes) {
      await sweptChart.locator('.lovely-chart--button').nth(index).click();
    }
    await sweepProbe(page);
    const sweptColumn = getYLabelColumn(await readProbeTexts(page));
    await unmountProbe(page);
    check(`an outward column fits every label of ${name}`,
      sweptColumn.ends.length === 1 && sweptColumn.overflowing.length === 0,
      `ends at ${JSON.stringify(sweptColumn.ends)}, widest ${sweptColumn.widest.toFixed(2)}px, `
      + `overflowing: ${JSON.stringify(sweptColumn.overflowing)}`);
  }
});

section('Contrast labels stand in from either side of the chart, the second axis\'s too', async ({ page }) => {
  const twoAxesLabels = Array.from({ length: 30 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const twoAxesConfig = {
    type: 'line',
    hasSecondYAxis: true,
    labels: twoAxesLabels,
    datasets: [
      { name: 'Views', values: twoAxesLabels.map((_, i) => 4000 + Math.round(1500 * Math.sin(i / 6))) },
      { name: 'Rate', values: twoAxesLabels.map((_, i) => Math.round(30 + 12 * Math.cos(i / 5))) },
    ],
  };
  // How far in from its side of the canvas each axis prints its labels: left-aligned for the main one inside the
  // plot, right-aligned right of the middle for the second one
  const readYLabelInsets = async () => {
    const { texts, canvasWidth } = await readProbeTexts(page);
    const secondTexts = texts.filter(({ align, x }) => align === 'right' && x > canvasWidth / 2);
    return {
      main: [...new Set(texts.filter(({ align }) => align === 'left').map(({ x }) => x))],
      second: [...new Set(secondTexts.map(({ x }) => canvasWidth - x))],
    };
  };
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Default labels' } });
  const defaultInsets = await readYLabelInsets();
  const defaultNumbers = await readProbeNumberLabels(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Contrast labels', areLabelsContrast: true } });
  const contrastInsets = await readYLabelInsets();
  const contrastNumbers = await readProbeNumberLabels(page);
  await unmountProbe(page);
  // A standard label stands half a gutter above its tick, its bottom on the line, and a contrast one on the tick
  const isCenteredOnTick = defaultNumbers.length > 1 && defaultNumbers.every(({ value, y, baseline }) => {
    const contrastLabel = contrastNumbers.find((label) => label.value === value);
    return baseline === 'bottom' && contrastLabel?.baseline === 'middle'
      && Math.abs(contrastLabel.y - (y + GUTTER / 2)) < 0.01;
  });
  check('areLabelsContrast centers each label on its grid line', isCenteredOnTick,
    `default ${JSON.stringify(defaultNumbers)}, contrast ${JSON.stringify(contrastNumbers)}`);
  const contrastInset = GUTTER + CONTRAST_LABEL_PADDING;
  check('areLabelsContrast moves the labels of either axis 2px in from their side',
    JSON.stringify(defaultInsets) === JSON.stringify({ main: [GUTTER], second: [GUTTER] })
    && JSON.stringify(contrastInsets) === JSON.stringify({ main: [contrastInset], second: [contrastInset] }),
    `default ${JSON.stringify(defaultInsets)}, contrast ${JSON.stringify(contrastInsets)}`);

  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Outward labels', isYAxisOutward: true } });
  const outwardColumn = getYLabelColumn(await readProbeTexts(page));
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      ...twoAxesConfig, title: 'Probe — Outward contrast labels', isYAxisOutward: true, areLabelsContrast: true,
    },
  });
  const outwardContrastTexts = await readProbeTexts(page);
  const outwardContrastColumn = getYLabelColumn(outwardContrastTexts);
  const outwardSecondInsets = [...new Set(outwardContrastTexts.texts
    .filter(({ align, x }) => align === 'right' && x > outwardContrastTexts.canvasWidth / 2)
    .map(({ x }) => outwardContrastTexts.canvasWidth - x))];
  await unmountProbe(page);
  check('an outward contrast column ends 2px further in, the second axis staying inside the plot',
    outwardContrastColumn.end === outwardColumn.end + CONTRAST_LABEL_PADDING
    && JSON.stringify(outwardSecondInsets) === JSON.stringify([contrastInset]),
    `column ends at ${outwardContrastColumn.end} after ${outwardColumn.end}, `
    + `second axis ${JSON.stringify(outwardSecondInsets)} in from the right`);
});

section('The X-axis grid counts from the newest label and steps coarser where labels would crowd, and the X-axis band '
  + 'clears around a contrast zero label', async ({ page }) => {
  // The X-axis labels the last frame of the probe printed, left to right, whether each stays inside the plot area, and
  // whether each stands clear of the one before it
  const readXAxisLabels = async () => {
    const labels = getLastFrameTexts(await readProbeTexts(page)).filter(({ align }) => align === 'center');
    const plotStart = await readPlotAreaLeft(page);
    const plotEnd = plotStart + await page.evaluate(() => parseFloat(
      document.getElementById('probe').style.getPropertyValue('--lovely-chart-plot-area-width'),
    ));
    const ends = labels.map(({ x, width }) => [x - width / 2, x + width / 2]);
    return {
      texts: labels.map(({ text }) => text),
      isInPlot: ends.every(([start, end]) => (
        start >= plotStart - X_LABEL_EDGE_TOLERANCE && end <= plotEnd + X_LABEL_EDGE_TOLERANCE
      )),
      isClear: ends.every(([start], i) => !i || start - ends[i - 1][1] >= X_LABEL_GAP),
    };
  };
  const weekDates = Array.from({ length: WEEK_DATE_COUNT }, (_, i) => Date.UTC(2026, 7, 5 + i * 7));
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Weekly dates on the X axis',
      isStacked: true,
      labelType: 'day',
      isUtc: true,
      isYAxisOutward: true,
      areLabelsContrast: true,
      labels: weekDates,
      datasets: [{ name: 'Sessions', values: weekDates.map((_, i) => i + 1) }],
    },
    width: WEEKS_PROBE_WIDTH,
  });
  const weekAxis = await readXAxisLabels();
  await unmountProbe(page);
  check('the X axis of dates ends on the newest, its labels inside the plot and clear of each other',
    weekAxis.texts.length >= 3 && weekAxis.texts.at(-1) === NEWEST_WEEK_TEXT && weekAxis.isInPlot && weekAxis.isClear,
    JSON.stringify(weekAxis));

  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'bar',
      title: 'Probe — A label for each month',
      labels: MONTH_LABELS,
      datasets: [{ name: 'MAU', values: [270, 310, 400, 280] }],
    },
    width: MONTHS_PROBE_WIDTH,
  });
  const monthAxis = await readXAxisLabels();
  await unmountProbe(page);
  check('a column chart with room for every label shows each one, the oldest included',
    JSON.stringify(monthAxis.texts) === JSON.stringify(MONTH_LABELS) && monthAxis.isInPlot && monthAxis.isClear,
    JSON.stringify(monthAxis));

  const gridFontFamily = `${WIDE_FONT_FAMILY}Grid`;
  await page.evaluate(async ({ family, bytes }) => {
    window.probeGridFont = new FontFace(family, Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0)));
    await window.probeGridFont.load();
    document.fonts.add(window.probeGridFont);
  }, { family: gridFontFamily, bytes: buildWideFont().toString('base64') });
  const weekNumberAxes = [];
  for (const axisFontSize of [FITTING_DIGITS_FONT_SIZE, CROWDING_DIGITS_FONT_SIZE]) {
    await recordProbeNumbers(page);
    await mountProbe(page, {
      config: {
        type: 'bar',
        title: `Probe — Week numbers at ${axisFontSize}px`,
        axisFontSize,
        labels: WEEK_NUMBER_LABELS,
        datasets: [{ name: 'WAU', values: WEEK_NUMBER_LABELS.map((_, i) => 90 + i * 5) }],
      },
      hostStyle: `--lovely-chart-font-family: ${gridFontFamily}`,
      width: WEEK_NUMBERS_PROBE_WIDTH,
    });
    weekNumberAxes.push(await readXAxisLabels());
    await unmountProbe(page);
  }
  await page.evaluate(() => document.fonts.delete(window.probeGridFont));
  const [fittingWeekAxis, crowdingWeekAxis] = weekNumberAxes;
  const pickWeekNumbers = (step) => WEEK_NUMBER_LABELS.filter((_, i) => (
    (WEEK_NUMBER_LABELS.length - 1 - i) % step === 0
  ));
  check('the X-axis grid steps evenly back from the newest label, coarser where the edge labels would crowd',
    JSON.stringify(fittingWeekAxis.texts) === JSON.stringify(pickWeekNumbers(2))
    && JSON.stringify(crowdingWeekAxis.texts) === JSON.stringify(pickWeekNumbers(4))
    && [fittingWeekAxis, crowdingWeekAxis].every(({ isInPlot, isClear }) => isInPlot && isClear),
    JSON.stringify({ fittingWeekAxis, crowdingWeekAxis }));

  // A compact chart of percentages, its range pinned from 0 to 100 by transparent reference lines, its axis labels in
  // the probe colour
  const compactDays = [8, 15, 22].map((day) => Date.UTC(2026, 9, day));
  const readCompactAxis = async (areLabelsContrast) => {
    await mountProbe(page, {
      config: {
        type: 'line',
        title: `Probe — Compact axis${areLabelsContrast ? ', contrast labels' : ''}`,
        labels: compactDays,
        labelType: 'day',
        isUtc: true,
        plotHeight: COMPACT_PLOT_HEIGHT,
        axisFontSize: COMPACT_AXIS_FONT_SIZE,
        valueSuffix: '%',
        areLabelsContrast,
        axisTextColor: PROBE_MAGENTA,
        backgroundColor: { light: '#FFFFFF', dark: '#242F3E' },
        referenceLines: [{ value: 0, color: 'transparent' }, { value: 100, color: 'transparent' }],
        datasets: [
          { name: 'Current period', color: '#3497ED', values: [0, 55, 100] },
          { name: 'Previous period', color: '#F79E39', values: [100, 55, 0] },
        ],
      },
      width: COMPACT_PROBE_WIDTH,
    });
    // What a redraw of the plot draws after it clears the canvas: the points of each path it strokes, each text with
    // its place, baseline, font, colour and depth under its baseline, each halo and each clear of a part of the canvas,
    // in order. Then the pixels of the zero label from under its grid line to the clear of the X-axis band.
    const redraw = await page.evaluate(async ({ bounds, lineReach }) => {
      const canvas = document.querySelector('#probe .lovely-chart--container > canvas');
      const context = canvas.getContext('2d');
      const calls = [];
      let points = [];
      const methods = {
        beginPath() {
          points = [];
        },
        moveTo(x, y) {
          points.push([x, y]);
        },
        lineTo(x, y) {
          points.push([x, y]);
        },
        stroke() {
          calls.push({ kind: 'path', points });
        },
        fillText(text, x, y) {
          const { width, actualBoundingBoxDescent: descent } = this.measureText(text);
          const { textBaseline: baseline, font, fillStyle: color } = this;
          calls.push({ kind: 'text', text, x, y, baseline, font, color, width, descent });
        },
        strokeText(text, x, y) {
          calls.push({ kind: 'halo', text, x, y });
        },
        clearRect(x, y, width, height) {
          calls.push({ kind: 'clear', x, y, width, height });
        },
      };
      Object.entries(methods).forEach(([name, record]) => {
        context[name] = function (...args) {
          record.apply(this, args);
          return CanvasRenderingContext2D.prototype[name].apply(this, args);
        };
      });
      window.probeChart.refreshColors();
      await window.idleTracker.wait(300);
      Object.keys(methods).forEach((name) => delete context[name]);

      const frame = calls.slice(calls.findLastIndex(({ kind, y }) => kind === 'clear' && y === 0) + 1);
      const zeroLabel = frame.find(({ kind, text }) => kind === 'text' && text === '0%');
      const band = frame.find(({ kind, y }) => kind === 'clear' && y > 0);
      const zeroLineY = frame.filter(({ kind }) => kind === 'path').at(-1).points[0][1];
      const scale = canvas.width / canvas.clientWidth;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let zeroLabelPixelsBelow = 0;
      for (let y = Math.ceil((zeroLineY + lineReach) * scale); y < band.y * scale; y++) {
        for (let x = Math.floor(zeroLabel.x * scale); x < (zeroLabel.x + zeroLabel.width) * scale; x++) {
          const j = (y * canvas.width + x) * 4;
          if (bounds.every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) zeroLabelPixelsBelow++;
        }
      }
      return { frame, canvasWidth: canvas.clientWidth, canvasHeight: canvas.clientHeight, zeroLabelPixelsBelow };
    }, {
      bounds: ['red', 'green', 'blue', 'alpha'].map((channel) => MAGENTA_TEXT_PIXEL[channel]),
      lineReach: GRID_LINE_REACH,
    });
    await unmountProbe(page);

    const { frame } = redraw;
    const labels = frame.filter(({ kind, text }) => kind === 'text' && text.endsWith('%'));
    const firstLabelIndex = frame.indexOf(labels[0]);
    // The Y-axis pass strokes the grid in one path, before the labels and after the datasets
    const paths = frame.filter(({ kind }, i) => kind === 'path' && i < firstLabelIndex);
    const gridYs = paths.at(-1).points.map(([, y]) => y);
    const [datasetPath] = paths;
    const topLabel = labels.find(({ text }) => text === '100%');
    const zeroLabel = labels.find(({ text }) => text === '0%');
    const band = frame.find(({ kind, y }) => kind === 'clear' && y > 0);
    return {
      areOnGridLines: labels.length > 1 && labels.every(({ y, baseline }) => (
        areLabelsContrast
          ? baseline === 'middle' && gridYs.includes(y)
          : baseline === 'bottom' && gridYs.includes(y + GUTTER / 2)
      )),
      areHaloed: labels.every((label) => {
        const halo = frame[frame.indexOf(label) - 1];
        return halo.kind === 'halo' && halo.text === label.text && halo.x === label.x && halo.y === label.y;
      }),
      isInAxisFont: labels.every(({ font }) => font.includes(`${COMPACT_AXIS_FONT_SIZE}px`)),
      // The first dataset runs from 0 to 100
      areValuesOnLabels: datasetPath.points[0][1] === gridYs[0] && datasetPath.points.at(-1)[1] === gridYs.at(-1)
        && gridYs[0] === zeroLabel.y + (areLabelsContrast ? 0 : GUTTER / 2)
        && gridYs.at(-1) === topLabel.y + (areLabelsContrast ? 0 : GUTTER / 2),
      topLabel: { y: topLabel.y, color: topLabel.color },
      zeroLabelBottom: zeroLabel.y + zeroLabel.descent + HALO_REACH,
      zeroLineY: gridYs[0],
      band,
      isBandToCanvasEnd: band.x === 0 && band.width >= redraw.canvasWidth
        && band.y + band.height >= redraw.canvasHeight,
      zeroLabelPixelsBelow: redraw.zeroLabelPixelsBelow,
    };
  };
  const contrastCompactAxis = await readCompactAxis(true);
  const standardCompactAxis = await readCompactAxis(false);
  const compactAxes = [contrastCompactAxis, standardCompactAxis];
  check('a compact axis prints its labels after the grid, in the axis font and halos, a contrast one on its line',
    compactAxes.every(({ areOnGridLines, areHaloed, isInAxisFont }) => areOnGridLines && areHaloed && isInAxisFont),
    JSON.stringify(compactAxes));
  check('a compact axis plots 0 and 100 on the lines of their labels, the top contrast label whole at the plot top',
    compactAxes.every(({ areValuesOnLabels }) => areValuesOnLabels) && contrastCompactAxis.topLabel.y === PLOT_TOP
    && contrastCompactAxis.topLabel.color === PROBE_MAGENTA.toLowerCase(),
    JSON.stringify(compactAxes));
  check('the X-axis band clears below the zero label, its halo and its line, a contrast one showing under the line',
    compactAxes.every(({ zeroLabelBottom, zeroLineY, band, isBandToCanvasEnd }) => (
      band.y >= zeroLabelBottom && band.y >= zeroLineY + GRID_LINE_REACH && isBandToCanvasEnd
    ))
    && contrastCompactAxis.zeroLabelPixelsBelow >= MIN_ZERO_LABEL_HALF_PIXELS,
    JSON.stringify(compactAxes));
});

section('A sparkline has no axes, so no column either', async ({ page }) => {
  await recordProbeNumbers(page);
  const outwardSparkline = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Outward sparkline', withMinimap: false, isSparkline: true },
  });
  const { texts: sparklineTexts } = await readProbeTexts(page);
  const sparklineEdge = await findColor(outwardSparkline, [255, 0, 0], [0, 0.02]);
  await unmountProbe(page);
  check('an outward sparkline draws no labels and runs to its edge',
    sparklineTexts.length === 0 && sparklineEdge.count > 0,
    `${sparklineTexts.length} texts, ${sparklineEdge.count}px of the line at the left edge`);
});

// The first label at the top of the range and the last at its bottom, so the line runs corner to corner
const areaConfig = {
  type: 'line',
  title: 'Probe — Plot area',
  labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 0, day)),
  datasets: [{ name: 'Corners', color: '#FF0000', values: [100, 20, 80, 0] }],
  referenceLines: [{ value: 50, color: '#0000FF' }],
};
section('The plot-area properties place an overlay over the data area, inside a padded and bordered '
  + 'element', async ({ page }) => {
  await recordProbeNumbers(page);
  await mountProbe(page, { config: areaConfig, hostStyle: PADDED_HOST_STYLE });
  await addPlotAreaOverlay(page);
  const areaFit = await readPlotAreaFit(page, ['#FF0000', '#0000FF']);
  const [areaLine, areaReference] = areaFit.boxes;
  const areaMiddle = (areaFit.overlay.top + areaFit.overlay.bottom) / 2;
  check('the plot-area properties are px lengths',
    areaFit.values.every((value) => PLOT_AREA_PATTERN.test(value)), JSON.stringify(areaFit.values));
  check('a plot-area overlay frames the first and the last point of a full-range line',
    isFramedBy(areaFit.overlay, areaLine),
    `overlay ${formatBox(areaFit.overlay)}, line ${formatBox(areaLine)}`);
  check('a plot-area overlay puts the middle of the Y range on a reference line there',
    Math.abs(areaReference.meanY - areaMiddle) <= PLOT_AREA_TOLERANCE
    && isFramedBy(areaFit.overlay, areaReference, ['left']),
    `overlay middle ${areaMiddle.toFixed(1)}, reference line at ${areaReference.meanY.toFixed(1)} `
    + `from ${areaReference.left.toFixed(1)}`);

  // An update to an outward column and a shorter plot moves the area, and the overlay follows. The reference line
  // stands off the grid lines at the quarters of the range, which would tint it.
  const updatedReferenceFraction = 0.4;
  await page.evaluate(({ config, fraction }) => window.probeChart.update({
    ...config,
    datasets: [{ ...config.datasets[0], values: config.datasets[0].values.map((value) => value * 1000) }],
    referenceLines: [{ value: fraction * 100000, color: '#0000FF' }],
    isYAxisOutward: true,
    plotHeight: 240,
  }), { config: areaConfig, fraction: updatedReferenceFraction });
  await waitForIdle(page, 1200);
  const updatedFit = await readPlotAreaFit(page, ['#FF0000', '#0000FF']);
  const [updatedLine, updatedReference] = updatedFit.boxes;
  const updatedChildren = await page.evaluate(() => [...document.getElementById('probe').children]
    .map((child) => child.id || child.className));
  check('update() rebuilds the chart under the overlay added after it',
    JSON.stringify(updatedChildren) === JSON.stringify(['lovely-chart--container', 'probe-overlay']),
    JSON.stringify(updatedChildren));
  const areaColumn = getYLabelColumn(await readProbeTexts(page), true);
  check('update() moves the plot area to an outward column and a shorter plot',
    isFramedBy(updatedFit.overlay, updatedLine)
    && Math.abs(updatedFit.overlay.left - (areaColumn.end + Y_AXIS_LABEL_GAP)) <= PLOT_AREA_TOLERANCE
    && updatedFit.overlay.bottom < areaFit.overlay.bottom - 50
    && Math.abs(updatedReference.meanY - updatedFit.overlay.bottom
      + updatedReferenceFraction * (updatedFit.overlay.bottom - updatedFit.overlay.top)) <= PLOT_AREA_TOLERANCE,
    `overlay ${formatBox(updatedFit.overlay)} after ${formatBox(areaFit.overlay)}, line ${formatBox(updatedLine)}, `
    + `labels end at ${areaColumn.end}, reference line at ${updatedReference.meanY.toFixed(1)}`);

  const destroyedValues = await page.evaluate(() => {
    const host = document.getElementById('probe');
    window.probeChart.destroy();
    const values = ['left', 'top', 'width', 'height']
      .map((key) => host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`));
    host.remove();
    return values;
  });
  check('destroy() removes the plot-area properties', destroyedValues.every((value) => value === ''),
    JSON.stringify(destroyedValues));

  // A page that folds the header while its caption is empty shows it as the first caption arrives, and folding it for
  // good moves the plot up, with the overlay following it each time
  // The scroll anchoring of the page holds the canvas in the viewport, so its top counts from the element
  const readCanvasTop = () => page.evaluate(() => {
    const host = document.getElementById('probe');
    return host.querySelector('.lovely-chart--container > canvas').getBoundingClientRect().top
      - host.getBoundingClientRect().top;
  });
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'probe-header-fold';
    style.textContent = '#probe .lovely-chart--header:has(.lovely-chart--header-caption:empty) { display: none; }';
    document.head.appendChild(style);
  });
  await mountProbe(page, {
    config: { ...areaConfig, title: 'Probe — Plot area under a folding header' }, hostStyle: PADDED_HOST_STYLE,
  });
  await addPlotAreaOverlay(page);
  const captionedFit = await readPlotAreaFit(page, ['#FF0000']);
  const captionedCanvasTop = await readCanvasTop();
  await page.evaluate(() => {
    document.getElementById('probe-header-fold').textContent = '#probe .lovely-chart--header { display: none; }';
  });
  await waitForIdle(page, 200);
  const foldedFit = await readPlotAreaFit(page, ['#FF0000']);
  const foldedCanvasTop = await readCanvasTop();
  await page.evaluate(() => document.getElementById('probe-header-fold').remove());
  await unmountProbe(page);
  check('a plot-area overlay frames the plot under a header the page shows once its caption arrives',
    isFramedBy(captionedFit.overlay, captionedFit.boxes[0]),
    `overlay ${formatBox(captionedFit.overlay)}, line ${formatBox(captionedFit.boxes[0])}`);
  check('a plot-area overlay follows the plot up when the page folds the header',
    foldedCanvasTop < captionedCanvasTop && isFramedBy(foldedFit.overlay, foldedFit.boxes[0]),
    `canvas at ${foldedCanvasTop} after ${captionedCanvasTop}, overlay ${formatBox(foldedFit.overlay)}, `
    + `line ${formatBox(foldedFit.boxes[0])}`);

  // A pie fills the square around its circle, and a sparkline its plot inset from every edge
  await mountProbe(page, {
    config: {
      type: 'pie',
      title: 'Probe — Plot area pie',
      labels: areaConfig.labels,
      datasets: [{ name: 'A', values: [5, 3, 6, 2] }, { name: 'B', values: [2, 4, 1, 3] }],
    },
    hostStyle: PADDED_HOST_STYLE,
  });
  await addPlotAreaOverlay(page);
  const pieFit = await readPlotAreaFit(page, ['any']);
  await unmountProbe(page);
  check('a pie\'s plot area is the square around its circle',
    isFramedBy(pieFit.overlay, pieFit.boxes[0])
    && Math.abs(pieFit.overlay.right - pieFit.overlay.left - (pieFit.overlay.bottom - pieFit.overlay.top)) < 0.01,
    `overlay ${formatBox(pieFit.overlay)}, pie ${formatBox(pieFit.boxes[0])}`);

  await mountProbe(page, {
    config: { ...areaConfig, title: 'Probe — Plot area sparkline', isSparkline: true, plotHeight: 64 },
    hostStyle: PADDED_HOST_STYLE,
  });
  await addPlotAreaOverlay(page);
  const sparklineFit = await readPlotAreaFit(page, ['#FF0000']);
  await unmountProbe(page);
  check('a sparkline\'s plot area is its plot inset by 2px',
    isFramedBy(sparklineFit.overlay, sparklineFit.boxes[0])
    && sparklineFit.overlay.left === SPARKLINE_INSET && sparklineFit.overlay.top === SPARKLINE_INSET,
    `overlay ${formatBox(sparklineFit.overlay)}, line ${formatBox(sparklineFit.boxes[0])}`);

  // A flat sparkline fills from its bottom edge to the middle of its 2px inset
  const flatSparkline = await mountProbe(page, {
    config: {
      type: 'area',
      isSparkline: true,
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Flat', color: '#FF0000', values: [7, 7, 7, 7] }],
    },
  });
  const sparklineFill = await findColor(flatSparkline, [255, 0, 0]);
  const sparklineHeight = await flatSparkline.evaluate((el) => el.querySelector('canvas').clientHeight);
  await unmountProbe(page);
  const sparklineFillMeanY = (sparklineHeight / 2 + sparklineHeight - SPARKLINE_INSET) / 2;
  check('a flat sparkline area fills from its bottom to the middle',
    sparklineFill.count > 1000 && Math.abs(sparklineFill.meanY - sparklineFillMeanY) < 2,
    `${sparklineFill.count}px at ${sparklineFill.meanY?.toFixed(1)}, expected at ${sparklineFillMeanY}`);

  // A scaled element, as in a dashboard scaled to fit, takes the plot area in px of its own
  const readPlotAreaValues = () => page.evaluate(() => {
    const { style } = document.getElementById('probe');
    return ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
  });
  await mountProbe(page, { config: areaConfig, hostStyle: PADDED_HOST_STYLE, width: SCALED_HOST_WIDTH });
  const unscaledArea = await readPlotAreaValues();
  await unmountProbe(page);
  await mountProbe(page, {
    config: areaConfig,
    hostStyle: `${PADDED_HOST_STYLE}; transform: scale(${HOST_SCALE}); transform-origin: 0 0`,
    width: SCALED_HOST_WIDTH,
  });
  const scaledArea = await readPlotAreaValues();
  await unmountProbe(page);
  check('a scaled element takes the plot area of its own px',
    scaledArea.every((value, i) => Math.abs(value - unscaledArea[i]) < PLOT_AREA_SCALE_TOLERANCE),
    `${JSON.stringify(scaledArea)} scaled, ${JSON.stringify(unscaledArea)} at full size`);

  // Panning and narrowing the window repaints every frame, and leaves the area as it is
  await page.evaluate(() => {
    window.plotAreaWrites = 0;
    const { setProperty } = CSSStyleDeclaration.prototype;
    CSSStyleDeclaration.prototype.setProperty = function (property, ...args) {
      if (property.startsWith('--lovely-chart-plot-area-') && this === document.getElementById('probe')?.style) {
        window.plotAreaWrites++;
      }
      return setProperty.call(this, property, ...args);
    };
  });
  await recordProbeNumbers(page);
  const pannedAreaChart = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Plot area while panning' },
  });
  await pannedAreaChart.scrollIntoViewIfNeeded();
  await addPlotAreaOverlay(page);
  const builtWrites = await page.evaluate(() => window.plotAreaWrites);
  const builtLeft = await readPlotAreaLeft(page);
  await sweepProbe(page);
  const pannedWrites = await page.evaluate(() => window.plotAreaWrites) - builtWrites;
  const pannedAreaColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('a pan writes no plot-area property, and the area starts after the outward column',
    builtWrites === 4 && pannedWrites === 0 && builtLeft === pannedAreaColumn.end + Y_AXIS_LABEL_GAP,
    `${builtWrites} writes on the build, ${pannedWrites} while panning, left ${builtLeft} `
    + `after labels ending at ${pannedAreaColumn.end}`);
});

section('`getLabelX()` places labels in the plot area, `onPlotAreaChange` reports it, and the room above the Y '
  + 'range', async ({ page, errors }) => {
  // Mounts the probe in a padded host with `onPlotAreaChange`, `onRangeChange` and `onZoomChange` recording each call,
  // with what `getLabelX()` gives for each of `xArgs` then, the range reports before a zoom report and what
  // `probeRangeExtras` adds to a range report, and what `getLabelX()` gives for the first of `xArgs` before the first
  // paint. An `onZoom` of `isZoomable` probes opens 24 hours of the day.
  const mountGeometryProbe = async (config, xArgs = [[0]], isZoomable = false) => {
    await page.evaluate(async (spec) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const element = document.createElement('div');
      element.id = 'probe';
      element.style.cssText = spec.hostStyle;
      document.getElementById('container').appendChild(element);
      const readXs = () => spec.xArgs.map((args) => window.probeChart.getLabelX(...args));
      window.probeAreaReports = [];
      window.probeRangeReports = [];
      window.probeZoomReports = [];
      window.probeRangeExtras = undefined;
      window.probeParams = {
        ...spec.config,
        onZoom: spec.isZoomable
          ? (day) => Promise.resolve({
            type: 'line',
            labels: Array.from({ length: 24 }, (_, hour) => day + hour * spec.hourMs),
            datasets: [{ name: 'Hours', color: '#FF0000', values: Array.from({ length: 24 }, (_, hour) => hour % 5) }],
          })
          : undefined,
        onPlotAreaChange: (area) => window.probeAreaReports.push({ area, xs: readXs() }),
        onRangeChange: (range) => window.probeRangeReports.push({
          range, xs: readXs(), ...window.probeRangeExtras?.(range),
        }),
        onZoomChange: (value) => window.probeZoomReports.push({
          value, xs: readXs(), rangeCount: window.probeRangeReports.length,
        }),
      };
      window.probeChart = new LovelyChart(element, window.probeParams);
      window.probeEarlyX = window.probeChart.getLabelX(...spec.xArgs[0]);
    }, { config, xArgs, isZoomable, hostStyle: PADDED_HOST_STYLE, hourMs: HOUR_MS });
    await settleMount(page);

    return page.locator('#probe .lovely-chart--container');
  };
  // What `getLabelX()` gives for each of `xArgs`, the plot-area properties, the room above the Y range, the top of the
  // canvas in the padding box of the host, and the reports so far
  const readGeometry = (xArgs) => page.evaluate((labelArgs) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    return {
      xs: labelArgs.map((args) => window.probeChart.getLabelX(...args)),
      area: ['left', 'top', 'width', 'height']
        .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`))),
      paddingTop: host.style.getPropertyValue('--lovely-chart-plot-padding-top'),
      canvasTop: canvas.getBoundingClientRect().top - host.getBoundingClientRect().top - host.clientTop,
      areaReports: window.probeAreaReports,
      rangeReports: window.probeRangeReports,
      zoomReports: window.probeZoomReports,
    };
  }, xArgs);
  const isSameReportedArea = (report, area) => report.area !== undefined
    && ['left', 'top', 'width', 'height'].every((key, i) => Math.abs(report.area[key] - area[i]) < 0.01);
  const isNearX = (x, expected) => x !== undefined && Math.abs(x - expected) < 0.01;
  // The ranges of `onRangeChange` reports, `none` for `undefined`
  const formatRangeReports = (reports) => reports
    .map(({ range }) => (range ? `${range.from}-${range.to}` : 'none')).join(' ');
  // Hovers and clicks the probe's plot at the label, where `getLabelX()` places it
  const clickProbeLabel = async (labelIndex) => {
    const point = await page.evaluate((index) => {
      const host = document.getElementById('probe');
      const box = host.getBoundingClientRect();
      const [left, top, , height] = ['left', 'top', 'width', 'height']
        .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
      return {
        x: box.left + host.clientLeft + left + window.probeChart.getLabelX(index),
        y: box.top + host.clientTop + top + height / 2,
      };
    }, labelIndex);
    await page.mouse.move(point.x, point.y);
    await waitForIdle(page, 100);
    await page.mouse.click(point.x, point.y);
  };
  const geometryLabels = Array.from({ length: 11 }, (_, i) => Date.UTC(2026, 0, i + 1));

  const lineGeometryConfig = {
    type: 'line',
    title: 'Probe — Label x',
    labels: geometryLabels.slice(0, 5),
    datasets: [{ name: 'Line', color: '#FF0000', values: [3, 9, 4, 8, 5] }],
  };
  await page.mouse.move(5, 5);
  await mountGeometryProbe(lineGeometryConfig);
  const lineGeometry = await readGeometry([[0], [4], [1], [2], [1, 0.5], [1, 0], [1.5], [5], [-1]]);
  const earlyX = await page.evaluate(() => window.probeEarlyX);
  const [lineFirst, lineLast, lineSecond, lineThird, lineHalfway, lineStart, ...lineMissing] = lineGeometry.xs;
  const [, lineAreaTop, lineAreaWidth] = lineGeometry.area;
  const [lineReport] = lineGeometry.areaReports;
  check('getLabelX() is undefined before the first paint, and onPlotAreaChange reports the area the paint writes',
    earlyX === undefined && lineGeometry.areaReports.length === 1 && isSameReportedArea(lineReport, lineGeometry.area)
    && lineReport.xs[0] === 0,
    `${earlyX} before the paint, reports ${JSON.stringify(lineGeometry.areaReports)} of ${lineGeometry.area.join()}`);
  check('getLabelX() puts the points of a full-range line from edge to edge of the plot area, an offset between them',
    lineFirst === 0 && isNearX(lineLast, lineAreaWidth) && isNearX(lineHalfway, (lineSecond + lineThird) / 2)
    && lineStart === lineSecond,
    `${JSON.stringify(lineGeometry.xs)} across ${lineAreaWidth}`);
  check('getLabelX() is undefined for an index that is no label of the visible range',
    lineMissing.every((x) => x === undefined), JSON.stringify(lineMissing));
  check('the room above the Y range is 15px, from the top of the plot to that of the plot area',
    lineGeometry.paddingTop === `${PLOT_TOP}px` && Math.abs(lineAreaTop - PLOT_TOP - lineGeometry.canvasTop) < 0.5,
    `${lineGeometry.paddingTop}, area at ${lineAreaTop}, canvas at ${lineGeometry.canvasTop}`);

  await page.evaluate(() => window.probeChart.update({
    ...window.probeParams,
    datasets: [{ name: 'Line', color: '#FF0000', values: [5, 8, 4, 9, 3] }],
  }));
  await waitForIdle(page, 1200);
  const updatedReports = await page.evaluate(() => window.probeAreaReports);
  const destroyedGeometry = await page.evaluate(() => {
    const host = document.getElementById('probe');
    window.probeChart.destroy();
    const result = {
      reports: window.probeAreaReports,
      rangeReports: window.probeRangeReports,
      x: window.probeChart.getLabelX(0),
      paddingTop: host.style.getPropertyValue('--lovely-chart-plot-padding-top'),
    };
    host.remove();
    return result;
  });
  check('update() reports the area it writes again, and destroy() reports undefined as it removes the variables',
    updatedReports.length === 2 && isSameReportedArea(updatedReports[1], lineGeometry.area)
    && destroyedGeometry.reports.length === 3 && destroyedGeometry.reports[2].area === undefined
    && destroyedGeometry.x === undefined && destroyedGeometry.paddingTop === '',
    `${JSON.stringify(updatedReports)}, then ${JSON.stringify(destroyedGeometry)}`);
  check('onRangeChange reports the labels of the first paint and again of update(), and undefined on destroy()',
    formatRangeReports(destroyedGeometry.rangeReports) === '0-4 0-4 none'
    && destroyedGeometry.rangeReports.slice(0, 2).every(({ xs }) => xs[0] === 0),
    JSON.stringify(destroyedGeometry.rangeReports));

  // Columns between gaps, each where `getLabelX()` puts its start and end, and its centre between them
  for (const type of ['bar', 'step']) {
    await mountGeometryProbe({
      type,
      title: `Probe — Label x of a ${type} column`,
      labels: geometryLabels.slice(0, 6),
      // `values` marks a missing value with `null`
      // eslint-disable-next-line no-null/no-null
      datasets: [{ name: 'Columns', color: '#FF0000', values: [6, null, 6, null, 6, null] }],
    });
    const columnGeometry = await readGeometry([0, 2, 4, 5].flatMap((i) => [[i], [i, 0], [i, 1]]));
    // A step's 2px line covers some rows in part
    const columnPixels = await readAreaColumns(page, '#probe', getColorBounds('#FF0000', [40, 255], COLOR_TOLERANCE));
    const columnRuns = findColumnRuns(columnPixels, 1);
    await unmountProbe(page);
    const columnXs = [0, 1, 2, 3].map((i) => columnGeometry.xs.slice(i * 3, i * 3 + 3));
    const expectedColumnRuns = columnXs.slice(0, 3).map(([, start, end]) => [start, end]);
    check(`getLabelX() spans each ${type} column from offset 0 to 1, its centre without an offset`,
      areRunsNear(columnRuns, expectedColumnRuns) && columnXs[0][1] === 0
      && isNearX(columnXs[3][2], columnGeometry.area[2])
      && columnXs.every(([centre, start, end]) => isNearX(centre, (start + end) / 2)),
      `${formatRuns(columnRuns)} for ${formatRuns(expectedColumnRuns)}, ${JSON.stringify(columnXs)}`);
  }

  // A window over the second half of the labels, which a drag of the minimap slider pans back by a label and a half
  await mountGeometryProbe({
    type: 'line',
    title: 'Probe — Label x of a panned window',
    labels: geometryLabels,
    datasets: [{ name: 'Line', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8, 5] }],
    withMinimap: true,
    minimapRange: [0.5, 1],
  });
  const pannedGeometry = await readGeometry([[4], [5], [10]]);
  const panXs = await page.evaluate(async () => {
    const host = document.getElementById('probe');
    const minimap = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    const { left, width } = slider.getBoundingClientRect();
    const fire = (target, type, clientX) => target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, buttons: 1, clientX, clientY: minimap.top + minimap.height / 2,
    }));
    const readXs = () => [3, 4, 5].map((i) => window.probeChart.getLabelX(i));
    const start = left + width / 2;
    const end = start - minimap.width * 0.15;
    fire(slider, 'mousedown', start);
    fire(document, 'mousemove', end);
    fire(document, 'mouseup', end);
    const moving = readXs();
    await window.idleTracker.wait(1000);
    return { moving, settled: readXs() };
  });
  await unmountProbe(page);
  check('getLabelX() maps the first label of a panned window before the plot area, as the plot runs past it there',
    pannedGeometry.xs[0] === undefined && isNearX(pannedGeometry.xs[1], -GUTTER)
    && isNearX(pannedGeometry.xs[2], pannedGeometry.area[2]),
    `${JSON.stringify(pannedGeometry.xs)} across ${pannedGeometry.area[2]}`);
  check('getLabelX() keeps each label where the last frame drew it until the frames of a pan of the minimap move it',
    panXs.moving[0] === undefined && panXs.moving[1] === undefined && panXs.moving[2] === pannedGeometry.xs[1]
    && panXs.settled[0] === undefined && panXs.settled[1] !== undefined && panXs.settled[2] > pannedGeometry.xs[1],
    JSON.stringify(panXs));

  // A zoom into shares from a column the click finds where `getLabelX()` puts it, and back out
  const sharesGeometry = await mountGeometryProbe({
    type: 'bar',
    title: 'Probe — Label x through a zoom into shares',
    isStacked: true,
    labels: geometryLabels.slice(0, 6),
    datasets: [
      { name: 'Blue', color: '#0000FF', values: [3, 4, 5, 4, 3, 4] },
      { name: 'Green', color: '#00FF00', values: [2, 3, 2, 3, 2, 3] },
    ],
    zoomToShares: true,
    circleLabelsAround: 0,
  }, [[3]]);
  await sharesGeometry.scrollIntoViewIfNeeded();
  const sharesArea = (await readGeometry([])).area;
  await clickProbeLabel(3);
  const zoomStartX = await page.evaluate(() => window.probeChart.getLabelX(3));
  await waitForIdle(page, 2000);
  await page.mouse.move(5, 5);
  await sharesGeometry.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2000);
  const sharesReports = await readGeometry([]);
  await unmountProbe(page);
  const [sharesFirst] = sharesReports.areaReports;
  const sharesLast = sharesReports.areaReports[sharesReports.areaReports.length - 1];
  const zoomedReports = sharesReports.areaReports.slice(1, -1);
  const [sharesZoomIn, sharesZoomOut] = sharesReports.zoomReports;
  const [sharesRangeFirst, , sharesRangeLast] = sharesReports.rangeReports;
  check('onRangeChange reports undefined from the first frame of a zoom into shares, and the labels as the bars return',
    zoomStartX === undefined && formatRangeReports(sharesReports.rangeReports) === '0-5 none 0-5'
    && sharesRangeFirst.xs[0] !== undefined && sharesRangeLast.xs[0] === sharesRangeFirst.xs[0]
    && sharesZoomIn?.value === geometryLabels[3] && sharesZoomIn.rangeCount === 2 && sharesZoomOut?.rangeCount === 2,
    `${zoomStartX} as the zoom starts, then ${JSON.stringify(sharesReports.rangeReports)}, `
    + `zoom reports ${JSON.stringify(sharesReports.zoomReports)}`);
  check('getLabelX() stays undefined over the pie and the start of the zoom out, and maps the bars on their return',
    zoomedReports.every(({ xs }) => xs[0] === undefined)
    && zoomedReports.some(({ area }) => Math.abs(area.width - area.height) < 0.01)
    && isSameReportedArea(sharesLast, sharesArea) && sharesLast.xs[0] === sharesFirst.xs[0]
    && sharesZoomOut?.value === undefined && sharesZoomOut?.xs[0] === undefined,
    `${JSON.stringify(sharesReports.areaReports)}, zoom reports ${JSON.stringify(sharesReports.zoomReports)}`);

  // A zoom into the hours of a day from `onZoom` narrows the days on the day, and widens the hours from the first frame
  // that draws them on
  const hoursXArgs = [[0], [4], [5], [6], [12], [23]];
  const hoursGeometry = await mountGeometryProbe({
    type: 'line',
    title: 'Probe — Label x of a zoom into data',
    labels: geometryLabels.slice(0, 10),
    datasets: [{ name: 'Days', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8] }],
  }, hoursXArgs, true);
  await hoursGeometry.scrollIntoViewIfNeeded();
  await clickProbeLabel(5);
  await waitForIdle(page, 2000);
  await page.mouse.move(5, 5);
  const hoursReports = await readGeometry(hoursXArgs);
  await unmountProbe(page);
  const [hoursZoom] = hoursReports.zoomReports;
  const hoursWidth = hoursReports.area[2];
  const [hourFirst, , , , hourMiddle, hourLast] = hoursReports.xs;
  const daysReports = hoursReports.rangeReports.slice(0, hoursZoom?.rangeCount);
  const hourReports = hoursReports.rangeReports.slice(hoursZoom?.rangeCount);
  // Whether each range of the reports holds the next, or the next holds it with `isWidening`
  const isNarrowing = (reports, isWidening = false) => reports.every(({ range }, i) => {
    const next = reports[i + 1]?.range ?? range;
    const [outer, inner] = isWidening ? [next, range] : [range, next];
    return outer.from <= inner.from && inner.to <= outer.to;
  });
  const daysLast = daysReports[daysReports.length - 1];
  check('onRangeChange follows a zoom into data as the range narrows on the day, frame by frame, to the day alone',
    daysReports.length > 3 && formatRangeReports(daysReports.slice(0, 1)) === '0-9' && isNarrowing(daysReports)
    && formatRangeReports([daysLast]) === '5-5'
    && daysLast.xs.every((x, i) => (i === 2 ? isNearX(x, hoursWidth / 2) : x === undefined)),
    `${JSON.stringify(daysReports)} across ${hoursWidth}`);
  check('getLabelX() is undefined as onZoomChange reports the hours onZoom returns, reported from their first frame',
    hoursZoom?.value === geometryLabels[5] && hoursZoom.xs.every((x) => x === undefined)
    && hourReports.length > 3 && isNarrowing(hourReports, true)
    && formatRangeReports(hourReports.slice(-1)) === '0-23' && hourReports[0].range.from > 0
    && hourReports[hourReports.length - 1].xs.every((x, i) => x === hoursReports.xs[i])
    && hourFirst === 0 && isNearX(hourMiddle, hoursWidth * 12 / 23) && isNearX(hourLast, hoursWidth),
    `${JSON.stringify(hoursReports.zoomReports)}, then ${JSON.stringify(hourReports)}, settled at `
    + `${JSON.stringify(hoursReports.xs)} across ${hoursWidth}`);

  // A sparkline keeps 2px above its Y range, and a pie maps no label
  await mountGeometryProbe({ ...lineGeometryConfig, title: 'Probe — Label x of a sparkline', isSparkline: true });
  const sparklineGeometry = await readGeometry([[0]]);
  await unmountProbe(page);
  await mountGeometryProbe({
    type: 'pie',
    title: 'Probe — Label x of a pie',
    labels: lineGeometryConfig.labels,
    datasets: [{ name: 'A', values: [5, 3, 6, 2, 4] }, { name: 'B', values: [2, 4, 1, 3, 5] }],
  });
  const pieGeometry = await readGeometry([[0]]);
  await unmountProbe(page);
  check('a sparkline keeps 2px above its Y range and maps its first point to the start of the plot area',
    sparklineGeometry.paddingTop === `${SPARKLINE_INSET}px` && sparklineGeometry.xs[0] === 0,
    `${sparklineGeometry.paddingTop}, ${JSON.stringify(sparklineGeometry.xs)}`);
  check('a pie reports its plot area and no range of labels, and maps no label',
    pieGeometry.areaReports.length === 1 && isSameReportedArea(pieGeometry.areaReports[0], pieGeometry.area)
    && formatRangeReports(pieGeometry.rangeReports) === 'none'
    && pieGeometry.xs[0] === undefined && pieGeometry.areaReports[0].xs[0] === undefined,
    `${JSON.stringify(pieGeometry.areaReports)}, ${JSON.stringify(pieGeometry.rangeReports)}, `
    + `${JSON.stringify(pieGeometry.xs)}`);

  // --- `onRangeChange` reports the labels of each frame that moves them, where `getLabelX()` places them ---
  // Runs of three points between gaps, each a red rule from the x of its first label to that of its last, on a Y range
  // the transparent reference lines hold clear of the Y-axis labels, in a window off either end of the labels
  const rangeRuns = [[0, 2], [4, 6], [8, 10]];
  await mountGeometryProbe({
    type: 'line',
    title: 'Probe — Labels of each frame of a drag',
    labels: geometryLabels,
    // `values` marks a missing value with `null`
    // eslint-disable-next-line no-null/no-null
    datasets: [{ name: 'Runs', color: '#FF0000', values: [3.5, 3.5, 3.5, null, 3.5, 3.5, 3.5, null, 3.5, 3.5, 3.5] }],
    referenceLines: [{ value: 0, color: 'transparent' }, { value: 10, color: 'transparent' }],
    withMinimap: true,
    minimapRange: [0.33, 0.73],
  });
  // Drags the minimap slider back by `shift` of the minimap in `steps` moves two frames apart, each range report taking
  // the frame's time, what `getLabelX()` gives for the labels of the range and either one past it, the edges of the
  // canvas and the runs of red columns the canvas holds across the plot area, all in px from its start, and records
  // the x where each frame of the plot starts the red runs
  const rangeDrag = await page.evaluate(async ({ bounds, steps, shift }) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const context = canvas.getContext('2d');
    const minimap = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    const fire = (target, type, clientX) => target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, buttons: 1, clientX, clientY: minimap.top + minimap.height / 2,
    }));
    const readCanvas = () => {
      const [left, top, width, height] = ['left', 'top', 'width', 'height']
        .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
      const canvasBox = canvas.getBoundingClientRect();
      const hostBox = host.getBoundingClientRect();
      const canvasStart = canvasBox.left - hostBox.left - host.clientLeft - left;
      const canvasTop = canvasBox.top - hostBox.top - host.clientTop - top;
      const scale = canvas.width / canvas.clientWidth;
      const { data } = context.getImageData(
        Math.round(-canvasStart * scale), Math.round(-canvasTop * scale),
        Math.round(width * scale), Math.round(height * scale),
      );
      const columnCount = Math.round(width * scale);
      const runs = [];
      for (let x = 0; x < columnCount; x++) {
        let isPicked = false;
        for (let j = x * 4; j < data.length && !isPicked; j += columnCount * 4) {
          isPicked = Object.values(bounds).every(([min, max], k) => data[j + k] >= min && data[j + k] <= max);
        }
        if (!isPicked) continue;
        const last = runs[runs.length - 1];
        if (last && last[1] === x) {
          last[1] = x + 1;
        } else {
          runs.push([x, x + 1]);
        }
      }
      return {
        width,
        canvasEdges: [canvasStart, canvasStart + canvas.clientWidth],
        drawnRuns: runs.map((run) => run.map((edge) => edge / scale)),
      };
    };
    window.probeRangeExtras = ({ from, to }) => ({
      frame: document.timeline.currentTime,
      pointXs: Array.from({ length: to - from + 1 }, (_, i) => window.probeChart.getLabelX(from + i)),
      outerXs: [window.probeChart.getLabelX(from - 1), window.probeChart.getLabelX(to + 1)],
      ...readCanvas(),
    });
    const frameXs = new Map();
    context.moveTo = function (x, y) {
      if (this.strokeStyle === '#ff0000') {
        const time = document.timeline.currentTime;
        frameXs.set(time, [...(frameXs.get(time) ?? []), x]);
      }
      return CanvasRenderingContext2D.prototype.moveTo.call(this, x, y);
    };
    window.probeRangeReports = [];
    const { left, width } = slider.getBoundingClientRect();
    const start = left + width / 2;
    fire(slider, 'mousedown', start);
    for (let step = 1; step <= steps; step++) {
      fire(document, 'mousemove', start - minimap.width * shift * step / steps);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    fire(document, 'mouseup', start - minimap.width * shift);
    await window.idleTracker.wait(600);
    delete context.moveTo;
    window.probeRangeExtras = undefined;
    return { reports: window.probeRangeReports, frames: [...frameXs] };
  }, { bounds: getColorBounds('#FF0000', [40, 255], COLOR_TOLERANCE), steps: 10, shift: 0.06 });
  // The range of the window the drag leaves, passed back as `minimapRange`
  const draggedRange = rangeDrag.reports[rangeDrag.reports.length - 1]?.range;
  await page.evaluate(
    (range) => window.probeChart.update({ ...window.probeParams, minimapRange: range }), draggedRange,
  );
  await waitForIdle(page, 600);
  const reopenedLine = await page.evaluate(() => {
    const range = window.probeRangeReports[window.probeRangeReports.length - 1]?.range;
    return { range, xs: range ? [-1, 0, 1].map((i) => window.probeChart.getLabelX(range.from + i)) : [] };
  });
  await unmountProbe(page);
  const rangeReportFrames = rangeDrag.reports.map(({ frame }) => frame);
  const movedFrames = rangeDrag.frames
    .filter(([, xs], i) => i === 0 || JSON.stringify(xs) !== JSON.stringify(rangeDrag.frames[i - 1][1]))
    .map(([frame]) => frame);
  check('onRangeChange reports each frame of a drag of the minimap window that moves the points, once, and no other',
    rangeReportFrames.length > 5 && new Set(rangeReportFrames).size === rangeReportFrames.length
    && JSON.stringify(rangeReportFrames) === JSON.stringify(movedFrames),
    `reports at ${rangeReportFrames.join()}, the points moved at ${movedFrames.join()} of ${rangeDrag.frames.length} `
    + 'frames');
  // Whether the range of a report holds the labels whose points stand on the canvas, and `getLabelX()` maps them alone
  const isRangeOnCanvas = ({ pointXs, outerXs, canvasEdges: [canvasStart, canvasEnd] }) => {
    const step = pointXs[1] - pointXs[0];
    const [first, last] = [pointXs[0], pointXs[pointXs.length - 1]];
    return pointXs.every((x) => x !== undefined) && outerXs.every((x) => x === undefined)
      && first >= canvasStart - PLOT_AREA_TOLERANCE && first - step < canvasStart
      && last <= canvasEnd + PLOT_AREA_TOLERANCE && last + step > canvasEnd;
  };
  check('each range onRangeChange reports runs from the first to the last label whose point the canvas holds',
    formatRangeReports([...rangeDrag.reports.slice(0, 1), ...rangeDrag.reports.slice(-1)]) === '4-7 3-6'
    && rangeDrag.reports.every(isRangeOnCanvas),
    JSON.stringify(rangeDrag.reports.map(({ range, pointXs, canvasEdges }) => ({ range, pointXs, canvasEdges }))));
  // Whether each run of points between gaps that a report maps clear of either edge of the plot area stands where the
  // frame drew it on the canvas, and each run drawn there where the report maps one
  const isDrawnAtLabelX = ({ range: { from, to }, pointXs, drawnRuns, width }) => {
    const isInner = ([start, end]) => start >= INNER_RUN_MARGIN && end <= width - INNER_RUN_MARGIN;
    const isNear = (run) => (other) => run.every((edge, k) => Math.abs(edge - other[k]) <= PLOT_AREA_TOLERANCE);
    const mappedRuns = rangeRuns
      .filter(([first, last]) => first >= from && last <= to)
      .map(([first, last]) => [pointXs[first - from], pointXs[last - from]]);
    const innerRuns = mappedRuns.filter(isInner);
    return innerRuns.length > 0 && innerRuns.every((run) => drawnRuns.some(isNear(run)))
      && drawnRuns.filter(isInner).every((run) => mappedRuns.some(isNear(run)));
  };
  check('getLabelX() in each onRangeChange report puts the points where the frame of the report drew them',
    rangeDrag.reports.length > 0 && rangeDrag.reports.every(isDrawnAtLabelX),
    JSON.stringify(rangeDrag.reports.map(({ range, pointXs, drawnRuns }) => ({
      range, pointXs, drawnRuns: formatRuns(drawnRuns),
    }))));
  // A window over points takes half an interval past either end label
  const reopenedStep = reopenedLine.xs[2] - reopenedLine.xs[1];
  check('a dragged range passed back as minimapRange reopens a line on the same labels, half an interval past each end',
    draggedRange !== undefined && formatRangeReports([reopenedLine]) === formatRangeReports([{ range: draggedRange }])
    && reopenedLine.xs[0] === undefined && Math.abs(reopenedLine.xs[1] + GUTTER - reopenedStep / 2) < 0.01,
    `${JSON.stringify(draggedRange)} reopens as ${JSON.stringify(reopenedLine)}`);

  // Bars between gaps, in a window whose ends cut columns, as a drag leaves them
  const rangeBars = await mountGeometryProbe({
    type: 'bar',
    title: 'Probe — Labels of a window that cuts columns',
    labels: geometryLabels,
    // `values` marks a missing value with `null`
    // eslint-disable-next-line no-null/no-null
    datasets: [{ name: 'Bars', color: '#FF0000', values: [6, null, 6, null, 6, null, 6, null, 6, null, 6] }],
    withMinimap: true,
    minimapRange: [0.33, 0.76],
  });
  await rangeBars.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const context = document.querySelector('#probe .lovely-chart--container > canvas').getContext('2d');
    window.probeFrames = 0;
    context.clearRect = function (...args) {
      window.probeFrames++;
      return CanvasRenderingContext2D.prototype.clearRect.apply(this, args);
    };
  });
  const plotBox = await rangeBars.locator('canvas').first().boundingBox();
  for (const fraction of [0.3, 0.5, 0.7]) {
    await page.mouse.move(plotBox.x + plotBox.width * fraction, plotBox.y + plotBox.height / 2);
    await waitForIdle(page, 300);
  }
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.probeChart.selectLabel(6));
  await waitForIdle(page, 300);
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  await waitForIdle(page, 300);
  await switchSkinAndBack(page);
  const stillBars = await page.evaluate(() => ({
    frames: window.probeFrames,
    reports: window.probeRangeReports.map(({ range }) => ({ range })),
  }));
  await page.evaluate(
    (range) => window.probeChart.update({ ...window.probeParams, minimapRange: range }), stillBars.reports[0]?.range,
  );
  await waitForIdle(page, 600);
  const reopenedBars = await page.evaluate(() => {
    const range = window.probeRangeReports[window.probeRangeReports.length - 1]?.range;
    return {
      reports: window.probeRangeReports.map((report) => ({ range: report.range })),
      start: range && window.probeChart.getLabelX(range.from, 0),
    };
  });
  await unmountProbe(page);
  check('onRangeChange stays uncalled through the frames of a hover, a selection and a change of the skin',
    stillBars.frames > 10 && formatRangeReports(stillBars.reports) === '4-7',
    `${stillBars.frames} frames, reports ${formatRangeReports(stillBars.reports)}`);
  check('a range of bars passed back as minimapRange reopens on the columns of the same labels',
    formatRangeReports(reopenedBars.reports) === '4-7 4-7' && Math.abs(reopenedBars.start + GUTTER) < 0.01,
    `${formatRangeReports(reopenedBars.reports)}, the first column from ${reopenedBars.start}`);

  // A line whose `limitDate` locks the first three labels, in a window the minimap moves off them whole
  await mountGeometryProbe({
    ...lineGeometryConfig,
    title: 'Probe — Labels of a window at the locked labels',
    labels: geometryLabels,
    datasets: [{ name: 'Line', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8, 5] }],
    withMinimap: true,
    minimapRange: [0, 0.5],
    limitDate: geometryLabels[3],
  });
  await page.evaluate(() => window.probeChart.update({
    ...window.probeParams,
    minimapRange: window.probeRangeReports[0]?.range,
  }));
  await waitForIdle(page, 600);
  const lockedReports = await page.evaluate(() => window.probeRangeReports);
  await unmountProbe(page);
  check('a range of a line from the first label limitDate leaves open reopens one label wider at its end',
    formatRangeReports(lockedReports) === '3-8 3-9', formatRangeReports(lockedReports));

  // Ranges from the first label `limitDate` leaves open as `minimapRange`, at label counts where the limit and the edges
  // of the window fall off the labels by float error: a line ends a label later short of the last label, bars do not.
  // Bars locked up to a label past their middle open on the same columns, and a range before the limit on as many from
  // the limit.
  const limitCases = [
    { type: 'line', count: 26, limit: 7, range: { from: 7, to: 15 }, expected: '7-16' },
    { type: 'line', count: 11, limit: 1, range: { from: 1, to: 7 }, expected: '1-8' },
    { type: 'line', count: 11, limit: 3, range: { from: 3, to: 10 }, expected: '3-10' },
    { type: 'bar', count: 26, limit: 7, range: { from: 7, to: 15 }, expected: '7-15' },
    { type: 'bar', count: 11, limit: BAR_LIMIT_INDEX, range: { from: BAR_LIMIT_INDEX, to: 9 }, expected: '6-9' },
    { type: 'bar', count: 11, limit: BAR_LIMIT_INDEX, range: { from: 2, to: 5 }, expected: '6-9' },
  ];
  const limitResults = [];
  for (const { type, count, limit, range, expected } of limitCases) {
    const labels = Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, i + 1));
    await mountGeometryProbe({
      type,
      title: `Probe — ${type} labels from the limit at ${limit} of ${count}`,
      labels,
      datasets: [{ name: 'Series', color: '#FF0000', values: labels.map((_, i) => 3 + (i % 4)) }],
      withMinimap: true,
      minimapRange: range,
      limitDate: labels[limit],
    }, [[limit]]);
    const reports = await page.evaluate(() => window.probeRangeReports);
    await unmountProbe(page);
    limitResults.push({ type, count, limit, expected, reported: formatRangeReports(reports), x: reports[0]?.xs[0] });
  }
  check('a range from the first label limitDate leaves open reopens on it whatever the float error of the window',
    limitResults.every(({ expected, reported, x }) => reported === expected && x !== undefined),
    JSON.stringify(limitResults));

  // A zoom into the hours `onZoom` returns and out again, each way swapping its data in after the transitions the zoom
  // started have ended, as a busy main thread can leave it, each report taking the time of its frame
  const lateSwapZoom = await mountGeometryProbe({
    type: 'line',
    title: 'Probe — Frames of a zoom whose data swaps in late',
    labels: geometryLabels.slice(0, 10),
    datasets: [{ name: 'Days', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8] }],
  }, [[0]], true);
  await lateSwapZoom.scrollIntoViewIfNeeded();
  await page.evaluate(({ swapTimeout, delay }) => {
    window.probeRangeExtras = () => ({ frame: document.timeline.currentTime });
    window.nativeSetTimeout = window.setTimeout;
    window.setTimeout = (callback, ms, ...args) => window.nativeSetTimeout(
      callback, ms === swapTimeout ? ms + delay : ms, ...args,
    );
  }, { swapTimeout: ZOOM_SWAP_TIMEOUT, delay: LATE_SWAP_DELAY });
  await clickProbeLabel(5);
  await waitForIdle(page, 2000);
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, 2000);
  const lateSwapReports = await page.evaluate(() => {
    window.setTimeout = window.nativeSetTimeout;
    delete window.nativeSetTimeout;
    return { ranges: window.probeRangeReports, zooms: window.probeZoomReports };
  });
  await unmountProbe(page);
  const lateSwapFrames = lateSwapReports.ranges.flatMap(({ frame }) => (frame !== undefined ? [frame] : []));
  const [lateZoomIn, lateZoomOut] = lateSwapReports.zooms;
  const lateHours = formatRangeReports(lateSwapReports.ranges.slice(lateZoomIn?.rangeCount, lateZoomOut?.rangeCount));
  check('onRangeChange reports each frame once as a zoom in or out swaps its data in after the transitions of the zoom',
    lateSwapReports.zooms.length === 2 && lateSwapFrames.length > 10
    && new Set(lateSwapFrames).size === lateSwapFrames.length && lateHours.split(' ').includes('0-23')
    && formatRangeReports(lateSwapReports.ranges.slice(-1)) === '0-9',
    `${formatRangeReports(lateSwapReports.ranges)} at frames ${lateSwapFrames.join()}, zoom reports after `
    + `${lateSwapReports.zooms.map(({ rangeCount }) => rangeCount).join()}`);

  // A chart that opens zoomed into hours `onZoom` returns late, rebuilt by `update()` keeping the zoom, and again into
  // an `onZoom` that fails, recording the reports in order and what `getLabelX()` gives while the zoom waits for data
  const openedZoomed = await page.evaluate(async ({ config, hourMs, dataMs }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    // eslint-disable-next-line no-restricted-syntax -- its waits hold the zoom data back and read before it arrives
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const events = [];
    const waitingXs = [];
    let shouldFail = false;
    const params = {
      ...config,
      initialZoom: 5,
      onZoom: async (day) => {
        await wait(dataMs);
        if (shouldFail) throw new Error('No hours');
        return {
          type: 'line',
          labels: Array.from({ length: 24 }, (_, hour) => day + hour * hourMs),
          datasets: [{ name: 'Hours', color: '#FF0000', values: Array.from({ length: 24 }, (_, hour) => hour % 5) }],
        };
      },
      onRangeChange: (range) => events.push(range ? `${range.from}-${range.to}` : 'none'),
      onZoomChange: (value) => events.push(value === undefined ? 'overview' : 'zoom'),
    };
    window.probeChart = new LovelyChart(element, params);
    await wait(dataMs / 2);
    waitingXs.push(window.probeChart.getLabelX(5));
    await window.idleTracker.wait(dataMs * 3);
    events.push('|');
    window.probeChart.update(params, { shouldKeepZoom: true });
    await wait(dataMs / 2);
    waitingXs.push(window.probeChart.getLabelX(0));
    await window.idleTracker.wait(dataMs * 3);
    events.push('|');
    shouldFail = true;
    window.probeChart.update(params, { shouldKeepZoom: true });
    await window.idleTracker.wait(dataMs * 3);
    return { events: events.join(' '), waitingXs };
  }, {
    config: {
      type: 'line',
      title: 'Probe — Labels of a chart that opens zoomed',
      labels: geometryLabels.slice(0, 10),
      datasets: [{ name: 'Days', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8] }],
    },
    hourMs: HOUR_MS,
    dataMs: LATE_ZOOM_DATA_MS,
  });
  await unmountProbe(page);
  check('a chart that opens zoomed reports no labels of the overview it hides, and those a failed zoom shows',
    openedZoomed.events === 'zoom 0-23 | 0-23 | overview 0-9' && openedZoomed.waitingXs.every((x) => x === undefined),
    JSON.stringify(openedZoomed));

  // A chart that rebuilds itself from its first report and tears itself down from the next
  const reentrantRanges = await page.evaluate(async (config) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    document.getElementById('container').appendChild(element);
    const reports = [];
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener('error', onError);
    const params = {
      ...config,
      onRangeChange: (range) => {
        reports.push({ range });
        if (reports.length === 1) {
          window.probeChart.update(params);
        } else if (reports.length === 2) {
          window.probeChart.destroy();
        }
      },
    };
    window.probeChart = new LovelyChart(element, params);
    await window.idleTracker.wait(1000);
    window.removeEventListener('error', onError);
    const childCount = element.childElementCount;
    element.remove();
    return { reports, errors, childCount };
  }, lineGeometryConfig);
  check('an onRangeChange that calls update() or destroy() breaks no frame, and the rebuilt chart reports its labels',
    formatRangeReports(reentrantRanges.reports) === '0-4 0-4 none' && reentrantRanges.errors.length === 0
    && reentrantRanges.childCount === 0,
    `${formatRangeReports(reentrantRanges.reports)}, errors ${JSON.stringify(reentrantRanges.errors)}, `
    + `${reentrantRanges.childCount} elements left`);

  // --- The visible range of columns: the labels whose column centre the window holds, at the edges and by a limit ---
  // Mounts bars of the days of `geometryLabels`, unless `config` gives other labels, that record each range
  // `onRangeChange` reports and each selection
  const mountColumnProbe = (config) => page.evaluate(async ([probeConfig, labels]) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeRanges = [];
    window.probeSelections = [];
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      labels,
      isUtc: true,
      withMinimap: true,
      isKeyboardSelectable: true,
      onRangeChange: (range) => window.probeRanges.push(range),
      onSelectedIndexChange: (index) => window.probeSelections.push(index),
      ...probeConfig,
    });
    element.scrollIntoView({ block: 'center' });
    await window.idleTracker.wait(1200);
  }, [config, geometryLabels]);
  // The range the last frame reported, the caption, the labels Home and End select and whether `selectLabel()` selects
  // the label of `labelIndex`, each from no selection
  const readColumnWindow = (labelIndex) => page.evaluate((index) => {
    const host = document.getElementById('probe');
    const plot = host.querySelector('.lovely-chart--tooltip');
    const readSelection = (select) => {
      window.probeChart.selectLabel(undefined);
      window.probeSelections.length = 0;
      select();
      return window.probeSelections.at(-1);
    };
    const pressKey = (key) => readSelection(() => (
      plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    ));
    const [home, end] = [pressKey('Home'), pressKey('End')];
    const isTaken = readSelection(() => window.probeChart.selectLabel(index)) === index;
    window.probeChart.selectLabel(undefined);
    const range = window.probeRanges.at(-1);
    return {
      range: range ? `${range.from}-${range.to}` : 'none',
      caption: host.querySelector('.lovely-chart--header-caption').textContent,
      home,
      end,
      isTaken,
    };
  }, labelIndex);
  // Drags an ear of the minimap so that the edge of the window it moves stands `nudge` px right of the centre of the
  // column of `labelIndex` among `count`, and reads the window
  const readColumnEdge = async (edge, labelIndex, nudge, count = geometryLabels.length) => {
    await page.evaluate(async ({ isBegin, centre, offset }) => {
      const host = document.getElementById('probe');
      const minimap = host.querySelector('.lovely-chart--minimap');
      const [leftEar, , rightEar] = host.querySelector('.lovely-chart--minimap-slider').children;
      const ear = isBegin ? leftEar : rightEar;
      // An ear moves the edge from where it stands as it is pressed, the right one from its outer side
      const edgeX = ear.offsetLeft + (isBegin ? 0 : ear.offsetWidth);
      const earBox = ear.getBoundingClientRect();
      const startX = earBox.left + earBox.width / 2;
      const shift = centre * minimap.clientWidth + offset - edgeX;
      const fire = (target, type, clientX) => target.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, buttons: 1, clientX, clientY: earBox.top + earBox.height / 2,
      }));
      fire(ear, 'mousedown', startX);
      fire(document, 'mousemove', startX + shift);
      fire(document, 'mouseup', startX + shift);
      await window.idleTracker.wait(600);
    }, { isBegin: edge === 'begin', centre: (labelIndex + 0.5) / count, offset: nudge });
    return readColumnWindow(labelIndex);
  };
  // Whether a window reads the labels from `from` to `to` of `geometryLabels` in each way, and takes the label it moved
  const isColumnWindow = ({ range, caption, home, end, isTaken }, from, to, isLabelTaken) => (
    range === `${from}-${to}` && new RegExp(`^${from + 1} Jan( 2026)? — ${to + 1} Jan( 2026)?$`).test(caption)
    && home === from && end === to && isTaken === isLabelTaken
  );

  // Columns of 11 days in a window of the labels 3 to 7, whose minimap ears move the start of the window either side of
  // the centre of the column of label 3, and the end either side of that of label 7
  await mountColumnProbe({
    title: 'Probe — Columns whose centre the window holds',
    datasets: [{ name: 'Bars', color: '#FF0000', values: geometryLabels.map((_, i) => 3 + (i % 4)) }],
    minimapRange: { from: 3, to: 7 },
  });
  const columnEdges = {
    beginAfter: await readColumnEdge('begin', 3, COLUMN_CENTRE_NUDGE),
    beginBefore: await readColumnEdge('begin', 3, -COLUMN_CENTRE_NUDGE),
    endAfter: await readColumnEdge('end', 7, COLUMN_CENTRE_NUDGE),
    endBefore: await readColumnEdge('end', 7, -COLUMN_CENTRE_NUDGE),
  };
  await unmountProbe(page);
  check('a window of bars holds the label of the column at its start until its edge passes the centre of the column',
    isColumnWindow(columnEdges.beginBefore, 3, 7, true) && isColumnWindow(columnEdges.beginAfter, 4, 7, false),
    JSON.stringify(columnEdges));
  check('a window of bars holds the label of the column at its end once its edge passes the centre of the column',
    isColumnWindow(columnEdges.endAfter, 3, 7, true) && isColumnWindow(columnEdges.endBefore, 3, 6, false),
    JSON.stringify(columnEdges));

  // Steps of 11 days in a window of the labels 3 to 7, whose start moves either side of the centre of the column of 3
  await mountColumnProbe({
    title: 'Probe — Steps whose centre the window holds',
    type: 'step',
    datasets: [{ name: 'Steps', color: '#FF0000', values: geometryLabels.map((_, i) => 3 + (i % 4)) }],
    minimapRange: { from: 3, to: 7 },
  });
  const stepEdges = {
    beginAfter: await readColumnEdge('begin', 3, COLUMN_CENTRE_NUDGE),
    beginBefore: await readColumnEdge('begin', 3, -COLUMN_CENTRE_NUDGE),
  };
  await unmountProbe(page);
  check('a window of steps holds the label of the column at its start until its edge passes the centre of the column',
    isColumnWindow(stepEdges.beginBefore, 3, 7, true) && isColumnWindow(stepEdges.beginAfter, 4, 7, false),
    JSON.stringify(stepEdges));

  // Columns of 12 months in a window from right of the centre of May to left of that of June, which holds neither
  const monthLabels = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, i, 1));
  await mountColumnProbe({
    title: 'Probe — A window between the centres of two columns',
    labels: monthLabels,
    datasets: [{ name: 'Bars', color: '#FF0000', values: monthLabels.map((_, i) => 3 + (i % 4)) }],
    minimapRange: 'full',
  });
  await readColumnEdge('begin', 4, COLUMN_CENTRE_NUDGE, monthLabels.length);
  const columnGap = await readColumnEdge('end', 5, -COLUMN_CENTRE_NUDGE, monthLabels.length);
  await unmountProbe(page);
  check('a window of bars between the centres of two columns takes the labels of both',
    columnGap.range === '4-5' && columnGap.caption === 'May — June 2026' && columnGap.home === 4
    && columnGap.end === 5 && columnGap.isTaken,
    JSON.stringify(columnGap));

  // Columns of 6 months, wide enough on the minimap for a window inside half a column, in a window narrowed to the left
  // half of the column of May, then moved to its right half
  const halfColumnLabels = monthLabels.slice(0, 6);
  await mountColumnProbe({
    title: 'Probe — A window inside half a column',
    labels: halfColumnLabels,
    datasets: [{ name: 'Bars', color: '#FF0000', values: halfColumnLabels.map((_, i) => 3 + (i % 4)) }],
    minimapRange: 'full',
  });
  const halfColumnWidth = await page.evaluate(() => (
    document.querySelector('#probe .lovely-chart--minimap').clientWidth
  )) / halfColumnLabels.length;
  const readMayEdge = (edge, offset) => readColumnEdge(edge, 4, offset * halfColumnWidth, halfColumnLabels.length);
  await readMayEdge('begin', -HALF_COLUMN_OUTER_EDGE);
  const leftHalf = await readMayEdge('end', -HALF_COLUMN_INNER_EDGE);
  await readMayEdge('end', HALF_COLUMN_OUTER_EDGE);
  const rightHalf = await readMayEdge('begin', HALF_COLUMN_INNER_EDGE);
  await unmountProbe(page);
  const isMayAlone = ({ range, caption, home, end, isTaken }) => (
    range === '4-4' && caption === 'May 2026' && home === 4 && end === 4 && isTaken
  );
  check('a window of bars inside half a column takes the label of that column alone',
    isMayAlone(leftHalf) && isMayAlone(rightHalf), JSON.stringify({ leftHalf, rightHalf }));

  // Two columns in the default window, the last 20% of the minimap, short of the centre of the last column
  await mountColumnProbe({
    title: 'Probe — Two columns in the default window',
    labels: geometryLabels.slice(0, 2),
    datasets: [{ name: 'Bars', color: '#FF0000', values: [3, 6] }],
  });
  const twoColumns = {
    ...await readColumnWindow(1),
    plot: await findColor(page.locator('#probe .lovely-chart--container'), [255, 0, 0]),
  };
  await unmountProbe(page);
  check('a window of bars at the end of the axis short of the centre of the last column takes its label and its bar',
    twoColumns.range === '1-1' && twoColumns.home === 1 && twoColumns.end === 1 && twoColumns.isTaken
    && twoColumns.plot.count > MIN_DATASET_PIXELS,
    JSON.stringify({ ...twoColumns, plot: twoColumns.plot.count }));

  // Columns of 11 days, every other one drawn, which `limitDate` locks up to the column of a label past their middle
  // in a window that `minimapRange: 'full'` asks to start before it
  await mountColumnProbe({
    title: 'Probe — Columns a limit locks',
    // `values` marks a missing value with `null`
    // eslint-disable-next-line no-null/no-null
    datasets: [{ name: 'Bars', color: '#FF0000', values: [6, null, 6, null, 6, null, 6, null, 6, null, 6] }],
    minimapRange: 'full',
    limitDate: geometryLabels[BAR_LIMIT_INDEX],
  });
  const limitedColumns = await page.evaluate(({ red, green, blue, alpha }) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--minimap canvas');
    const canvasLeft = canvas.getBoundingClientRect().left;
    const scale = canvas.width / canvas.clientWidth;
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const columns = Array.from({ length: canvas.width }, (_, x) => {
      let count = 0;
      for (let y = 0; y < canvas.height; y++) {
        const j = (y * canvas.width + x) * 4;
        count += [red, green, blue, alpha].every(([min, max], k) => data[j + k] >= min && data[j + k] <= max) ? 1 : 0;
      }
      return count;
    });
    const mask = host.querySelector('.lovely-chart--minimap-limit-mask');
    return {
      columns,
      scale,
      // The dashed edge of the mask stands right of the labels it locks
      maskEnd: mask.getBoundingClientRect().right - parseFloat(getComputedStyle(mask).borderRightWidth) - canvasLeft,
      windowStart: host.querySelector('.lovely-chart--minimap-slider').getBoundingClientRect().left - canvasLeft,
    };
  }, getColorBounds('#FF0000', [40, 255], COLOR_TOLERANCE));
  const limitedWindow = await readColumnWindow(BAR_LIMIT_INDEX);
  await unmountProbe(page);
  const limitedRuns = findColumnRuns(limitedColumns, 1);
  const { maskEnd, windowStart } = limitedColumns;
  check('limitDate on bars masks the minimap up to the column of the first open label, where the window starts',
    limitedRuns.length === 6 && Math.abs(limitedRuns[BAR_LIMIT_INDEX / 2][0] - maskEnd) <= 1
    && Math.abs(windowStart - maskEnd) <= 1,
    `mask to ${maskEnd}, window from ${windowStart}, columns ${formatRuns(limitedRuns)}`);
  check('a window of bars from the first label limitDate leaves open holds that label',
    isColumnWindow(limitedWindow, BAR_LIMIT_INDEX, 10, true), JSON.stringify(limitedWindow));

  // --- `minimapRange` in labels: the window by chart kind, the minimap slider over it, clamping, a pie and a zoom ---
  // The edges of the minimap slider, as fractions of the minimap
  const readSliderEdges = () => page.evaluate(() => {
    const ruler = document.querySelector('#probe .lovely-chart--minimap-ruler').getBoundingClientRect();
    const slider = document.querySelector('#probe .lovely-chart--minimap-slider').getBoundingClientRect();
    return [slider.left, slider.right].map((x) => (x - ruler.left) / ruler.width);
  });
  const areSliderEdgesAt = (edges, expected) => edges.every((edge, i) => (
    Math.abs(edge - expected[i]) < MINIMAP_SLIDER_TOLERANCE
  ));
  const windowConfig = {
    title: 'Probe — A window of labels',
    labels: geometryLabels,
    datasets: [{ name: 'Values', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8, 5] }],
    withMinimap: true,
  };

  await mountGeometryProbe({ ...windowConfig, type: 'line', minimapRange: { from: 3, to: 6 } });
  const lineWindow = await readGeometry([[2], [3], [4], [6], [7]]);
  const lineSliderEdges = await readSliderEdges();
  await unmountProbe(page);
  const [lineBefore, lineFrom, lineNext, lineTo, lineAfter] = lineWindow.xs;
  // Four intervals, from halfway before the first label to halfway after the last, span the canvas, its gutters too
  const lineInterval = (lineWindow.area[2] + GUTTER * 2) / 4;
  check('a line opens on the labels minimapRange names, from halfway before the first to halfway after the last',
    lineBefore === undefined && lineAfter === undefined && isNearX(lineFrom, lineInterval / 2 - GUTTER)
    && isNearX(lineNext - lineFrom, lineInterval) && isNearX(lineTo, lineWindow.area[2] + GUTTER - lineInterval / 2),
    `${JSON.stringify(lineWindow.xs)} across ${lineWindow.area[2]}`);
  check('the minimap slider of a line spans the same labels and the halves of the intervals beside them',
    areSliderEdgesAt(lineSliderEdges, [2.5 / 10, 6.5 / 10]), JSON.stringify(lineSliderEdges));

  for (const type of ['bar', 'step']) {
    await mountGeometryProbe({ ...windowConfig, type, minimapRange: { from: 3, to: 6 } });
    const columnWindow = await readGeometry([[2], [3, 0], [6, 1], [7]]);
    const columnSlider = await readSliderEdges();
    await unmountProbe(page);
    const [columnBefore, columnStart, columnEnd, columnAfter] = columnWindow.xs;
    check(`a ${type} chart opens on the columns of the labels minimapRange names, the minimap slider over them`,
      columnBefore === undefined && columnAfter === undefined && isNearX(columnStart, -GUTTER)
      && isNearX(columnEnd, columnWindow.area[2] + GUTTER) && areSliderEdgesAt(columnSlider, [3 / 11, 7 / 11]),
      `${JSON.stringify(columnWindow.xs)} across ${columnWindow.area[2]}, slider ${JSON.stringify(columnSlider)}`);
  }

  // Indexes rounded and clamped to the labels at either end, and ranges of no labels, which take the last 20%. A line
  // also keeps the half intervals past its ends within the axis, so only columns show an index that runs off the
  // labels. Each window reads labels 0, 3, 4, 7, 8 and 10.
  const clampedRanges = [{ from: -2, to: 3.4 }, { from: 7.6, to: 50 }, { from: 7, to: 3 }, { from: 20, to: 30 }];
  const readClampedWindows = async (type, xArgs) => {
    const windows = [];
    for (const minimapRange of clampedRanges) {
      await mountGeometryProbe({ ...windowConfig, type, minimapRange });
      windows.push({ ...await readGeometry(xArgs), slider: await readSliderEdges() });
      await unmountProbe(page);
    }
    return windows;
  };
  const formatClampedWindow = ({ xs, area, slider }) => `${JSON.stringify(xs)} across ${area[2]}, slider ${slider}`;
  const [clampedLineStart, clampedLineEnd, ...emptyLines] = await readClampedWindows(
    'line', [[0], [3], [4], [7], [8], [10]],
  );
  check('minimapRange clamps its indexes to the labels of a line, from the first label and to the last',
    isNearX(clampedLineStart.xs[0], 0) && clampedLineStart.xs[1] !== undefined && clampedLineStart.xs[2] === undefined
    && clampedLineEnd.xs[3] === undefined && clampedLineEnd.xs[4] > -GUTTER
    && isNearX(clampedLineEnd.xs[5], clampedLineEnd.area[2])
    && areSliderEdgesAt(clampedLineStart.slider, [0, 3.5 / 10])
    && areSliderEdgesAt(clampedLineEnd.slider, [7.5 / 10, 1]),
    `${formatClampedWindow(clampedLineStart)}; ${formatClampedWindow(clampedLineEnd)}`);
  const [clampedBarStart, clampedBarEnd, ...emptyBars] = await readClampedWindows(
    'bar', [[0, 0], [3, 1], [4], [7], [8, 0], [10, 1]],
  );
  check('minimapRange clamps its indexes to the columns of a bar chart, from the first column and to the last',
    clampedBarStart.xs[0] === 0 && isNearX(clampedBarStart.xs[1], clampedBarStart.area[2] + GUTTER)
    && clampedBarStart.xs[2] === undefined && clampedBarEnd.xs[3] === undefined
    && isNearX(clampedBarEnd.xs[4], -GUTTER) && isNearX(clampedBarEnd.xs[5], clampedBarEnd.area[2])
    && areSliderEdgesAt(clampedBarStart.slider, [0, 4 / 11]) && areSliderEdgesAt(clampedBarEnd.slider, [8 / 11, 1]),
    `${formatClampedWindow(clampedBarStart)}; ${formatClampedWindow(clampedBarEnd)}`);
  const emptyWindows = [...emptyLines, ...emptyBars];
  check('a minimapRange of no labels, reversed or past the last, opens a line or bar chart on the default last 20%',
    emptyWindows.every(({ xs, area, slider }) => (
      xs[3] === undefined && isNearX(xs[5], area[2]) && areSliderEdgesAt(slider, [0.8, 1])
    )),
    emptyWindows.map(formatClampedWindow).join('; '));

  // A pie sums the months of its window alone, the first of which, far larger, the window leaves out
  const windowPie = await mountGeometryProbe({
    type: 'pie',
    title: 'Probe — A pie of a window of months',
    labels: Array.from({ length: 6 }, (_, month) => Date.UTC(2026, month, 1)),
    datasets: [
      { name: 'Large', color: '#3497ED', values: [500, 111, 111, 111, 500, 500] },
      { name: 'Small', color: '#9ED448', values: [1, 1, 1, 1, 1, 1] },
    ],
    minimapRange: { from: 1, to: 3 },
  });
  await windowPie.scrollIntoViewIfNeeded();
  const pieCaption = (await windowPie.locator('.lovely-chart--header-caption').textContent()).trim();
  const pieCenter = await page.evaluate(() => {
    const host = document.getElementById('probe');
    const box = host.getBoundingClientRect();
    const [left, top, width, height] = ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    return { x: box.left + host.clientLeft + left + width / 2, y: box.top + host.clientTop + top + height / 2 };
  });
  await page.mouse.move(pieCenter.x, pieCenter.y + 30, { steps: 5 });
  await waitForIdle(page, 200);
  await page.mouse.move(pieCenter.x + 20, pieCenter.y + 40, { steps: 5 });
  await waitForIdle(page, 500);
  const pieWindowText = (await windowPie.locator('.lovely-chart--tooltip-balloon').textContent())
    .replace(/\s+/g, ' ').trim();
  await page.mouse.move(5, 5);
  await unmountProbe(page);
  check('a pie opens on the months minimapRange names and sums them alone',
    pieCaption === 'February — April 2026' && pieWindowText.includes('333'),
    `${JSON.stringify(pieCaption)}, ${JSON.stringify(pieWindowText.slice(0, 60))}`);

  // A zoom into data from `onZoom` opens on the hours its own `minimapRange` names
  const zoomWindowArgs = [[5], [6], [11], [12]];
  const zoomWindow = await mountGeometryProbe({
    type: 'line',
    title: 'Probe — A zoom into a window of hours',
    labels: geometryLabels.slice(0, 10),
    datasets: [{ name: 'Days', color: '#FF0000', values: [3, 9, 4, 8, 5, 7, 4, 9, 3, 8] }],
  }, zoomWindowArgs, true);
  await page.evaluate((hourMs) => window.probeChart.update({
    ...window.probeParams,
    onZoom: (day) => Promise.resolve({
      type: 'line',
      labels: Array.from({ length: 24 }, (_, hour) => day + hour * hourMs),
      datasets: [{ name: 'Hours', color: '#FF0000', values: Array.from({ length: 24 }, (_, hour) => hour % 5) }],
      minimapRange: { from: 6, to: 11 },
    }),
  }), HOUR_MS);
  await waitForIdle(page, 1200);
  await zoomWindow.scrollIntoViewIfNeeded();
  await clickProbeLabel(5);
  await waitForIdle(page, 2000);
  await page.mouse.move(5, 5);
  const zoomedWindow = await readGeometry(zoomWindowArgs);
  await unmountProbe(page);
  const [hourBefore, hourFrom, hourTo, hourAfter] = zoomedWindow.xs;
  const [hourZoom] = zoomedWindow.zoomReports;
  const hourWidth = zoomedWindow.area[2];
  // Six intervals, from halfway before the first hour to halfway after the last, span the canvas, its gutters too
  const hourInterval = (hourWidth + GUTTER * 2) / 6;
  check('a zoom into data from onZoom opens on the labels of its own minimapRange',
    hourZoom?.value === geometryLabels[5] && hourBefore === undefined && hourAfter === undefined
    && isNearX(hourFrom, hourInterval / 2 - GUTTER) && isNearX(hourTo, hourWidth + GUTTER - hourInterval / 2),
    `zoomed into ${hourZoom?.value}, ${JSON.stringify(zoomedWindow.xs)} across ${hourWidth}`);

  // --- `isRangeSelectable`: a mouse drag across the plot selects the labels under it, a double click the whole range ---
  // Where `getLabelX()` places each of `labelArgs` in the page, and the height of the plot a drag runs at
  const readProbePlotPoints = (labelArgs) => page.evaluate(([args, heightFraction]) => {
    const host = document.getElementById('probe');
    const box = host.getBoundingClientRect();
    const [left, top, width, height] = ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    return {
      xs: args.map((labelArg) => box.left + host.clientLeft + left + window.probeChart.getLabelX(...labelArg)),
      y: box.top + host.clientTop + top + height * heightFraction,
      area: { left, top, width, height },
    };
  }, [labelArgs, RANGE_DRAG_HEIGHT]);
  // The band of a drag across the plot in the padding box of the probe's host, and whether it shows
  const readRangeBand = () => page.evaluate(() => {
    const host = document.getElementById('probe');
    const band = host.querySelector('.lovely-chart--range-selection');
    const box = band.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const style = getComputedStyle(band);
    return {
      isShown: style.display !== 'none',
      left: box.left - hostBox.left - host.clientLeft,
      top: box.top - hostBox.top - host.clientTop,
      width: box.width,
      height: box.height,
      color: style.borderLeftColor,
    };
  });
  // Presses the probe's plot at the first of `labelArgs`, the arguments of `getLabelX()`, drags to the second and,
  // unless `shouldHold`, releases there; reads the band before the release
  const dragAcrossProbe = async (labelArgs, shouldHold = false) => {
    const { xs: [fromX, toX], y, area } = await readProbePlotPoints(labelArgs);
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y, { steps: RANGE_DRAG_STEPS });
    const band = await readRangeBand();
    if (!shouldHold) {
      await page.mouse.up();
      await waitForIdle(page, RANGE_SETTLE_MS);
    }
    return { fromX, toX, y, area, band };
  };
  // Double-clicks the middle of the probe's plot area
  const doubleClickProbe = async () => {
    const { y, area } = await readProbePlotPoints([]);
    const hostLeft = await page.evaluate(() => {
      const host = document.getElementById('probe');
      return host.getBoundingClientRect().left + host.clientLeft;
    });
    await page.mouse.dblclick(hostLeft + area.left + area.width / 2, y);
    await waitForIdle(page, RANGE_SETTLE_MS);
  };
  const readLastRange = () => page.evaluate(() => {
    const range = window.probeRangeReports.at(-1)?.range;
    return range ? `${range.from}-${range.to}` : 'none';
  });
  const isNearPx = (value, expected) => Math.abs(value - expected) <= RANGE_BAND_TOLERANCE;
  const selectableLines = { ...windowConfig, type: 'line', minimapRange: 'full', isRangeSelectable: true };

  // A line of 11 points over the whole axis, dragged from halfway after label 2 to halfway after label 6
  await page.mouse.move(5, 5);
  const selectionHost = await mountGeometryProbe(selectableLines);
  await selectionHost.scrollIntoViewIfNeeded();
  const lineDrag = await dragAcrossProbe([[2, 0.5], [6, 0.5]]);
  const hostLeft = await page.evaluate(() => {
    const host = document.getElementById('probe');
    return host.getBoundingClientRect().left + host.clientLeft;
  });
  const lineSelection = { range: await readLastRange(), slider: await readSliderEdges(), band: await readRangeBand() };
  const lineSelectionZooms = await page.evaluate(() => window.probeZoomReports.length);
  check('a drag across the plot draws a band in --range-selection-color from the press to the pointer over the Y range',
    lineDrag.band.isShown && isNearPx(lineDrag.band.left, lineDrag.fromX - hostLeft)
    && isNearPx(lineDrag.band.width, lineDrag.toX - lineDrag.fromX) && isNearPx(lineDrag.band.top, lineDrag.area.top)
    && isNearPx(lineDrag.band.height, lineDrag.area.height) && RANGE_SELECTION_COLORS.includes(lineDrag.band.color),
    `${JSON.stringify(lineDrag.band)} for ${lineDrag.fromX - hostLeft}-${lineDrag.toX - hostLeft} in `
    + JSON.stringify(lineDrag.area));
  check('the release opens the window on the points the band holds, the minimap slider over them, with no zoom',
    lineSelection.range === '3-6' && areSliderEdgesAt(lineSelection.slider, [2.5 / 10, 6.5 / 10])
    && !lineSelection.band.isShown && lineSelectionZooms === 0,
    `${JSON.stringify(lineSelection)}, ${lineSelectionZooms} zoom reports`);

  // `update()` keeps the selected window with `shouldKeepZoom` alone
  await page.evaluate(() => window.probeChart.update(window.probeParams, { shouldKeepZoom: true }));
  await waitForIdle(page, RANGE_SETTLE_MS);
  const keptRangeSelection = await readLastRange();
  await doubleClickProbe();
  const resetSelection = { range: await readLastRange(), slider: await readSliderEdges() };
  check('update() with shouldKeepZoom keeps a selected window, and a double click shows the whole range',
    keptRangeSelection === '3-6' && resetSelection.range === '0-10' && areSliderEdgesAt(resetSelection.slider, [0, 1]),
    `kept ${keptRangeSelection}, then ${JSON.stringify(resetSelection)}`);

  // A band over one point of a line and a drag Escape ends select nothing
  const reportCountBefore = await page.evaluate(() => window.probeRangeReports.length);
  await dragAcrossProbe([[2, 0.5], [3, 0.5]]);
  await dragAcrossProbe([[2, 0.5], [6, 0.5]], true);
  await page.keyboard.press('Escape');
  const escapedBand = await readRangeBand();
  await page.mouse.up();
  await waitForIdle(page, RANGE_SETTLE_MS);
  const unselected = await page.evaluate(() => window.probeRangeReports.length);
  check('a band over a single point of a line and a drag Escape ends select no range',
    unselected === reportCountBefore && !escapedBand.isShown, `${reportCountBefore} -> ${unselected} range reports`);

  // A selected window keeps its edge points, drawn in the gutters of the plot, through a drag across the whole plot,
  // and keeps its labels through a touch drag and a double tap, and a press whose release the page never hears
  await dragAcrossProbe([[2, 0.5], [6, 0.5]]);
  const plotEdges = await page.evaluate(() => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--tooltip canvas').getBoundingClientRect();
    return [canvas.left, canvas.right];
  });
  const { y: edgeDragY } = await readProbePlotPoints([]);
  await page.mouse.move(plotEdges[0] + 1, edgeDragY);
  await page.mouse.down();
  await page.mouse.move(plotEdges[1] - 1, edgeDragY, { steps: RANGE_DRAG_STEPS });
  await page.mouse.up();
  await waitForIdle(page, RANGE_SETTLE_MS);
  const wholePlotSelection = await readLastRange();
  const { xs: [touchDragFromX, touchDragToX], y: touchDragY } = await readProbePlotPoints([[3], [6]]);
  const lostReleaseBands = await page.evaluate(async ({ fromX, toX, y, pointerId }) => {
    const plot = document.querySelector('#probe .lovely-chart--tooltip');
    const band = plot.querySelector('.lovely-chart--range-selection');
    const fire = (target, type, clientX, init) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, isPrimary: true, clientX, clientY: y, ...init,
    }));
    const touch = { pointerType: 'touch', pointerId };
    fire(plot, 'pointerdown', fromX, touch);
    fire(document, 'pointermove', (fromX + toX) / 2, touch);
    fire(document, 'pointermove', toX, touch);
    fire(document, 'pointerup', toX, touch);
    plot.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: toX, clientY: y, detail: 2 }));
    await window.idleTracker.wait(700);
    // A press whose release a context menu takes, and one whose next move comes with the main button up
    const mouse = { pointerType: 'mouse', pointerId: 1, button: 0 };
    fire(plot, 'pointerdown', fromX, { ...mouse, buttons: 1 });
    const menu = { bubbles: true, cancelable: true, clientX: fromX, clientY: y };
    document.dispatchEvent(new MouseEvent('contextmenu', menu));
    fire(document, 'pointermove', toX, { ...mouse, buttons: 1 });
    const afterMenu = getComputedStyle(band).display;
    fire(plot, 'pointerdown', fromX, { ...mouse, buttons: 1 });
    fire(document, 'pointermove', toX, { ...mouse, buttons: 0 });
    const afterRelease = getComputedStyle(band).display;
    fire(document, 'pointerup', toX, { ...mouse, buttons: 0 });
    await window.idleTracker.wait(700);
    return [afterMenu, afterRelease];
  }, { fromX: touchDragFromX, toX: touchDragToX, y: touchDragY, pointerId: TOUCH_POINTER_ID });
  const keptLabels = await readLastRange();
  await unmountProbe(page);
  check('a drag across the whole plot keeps the edge points of a selected window, drawn in its gutters',
    wholePlotSelection === '3-6', wholePlotSelection);
  check('a touch drag, a double tap and a press whose release the page never hears leave a selected window',
    keptLabels === '3-6' && lostReleaseBands.every((display) => display === 'none'),
    `${keptLabels}, band ${JSON.stringify(lostReleaseBands)}`);

  // Bars over the whole axis, dragged from past the centre of column 2 to past that of column 7
  await mountColumnProbe({
    title: 'Probe — Columns a drag selects',
    datasets: [{ name: 'Bars', color: '#FF0000', values: geometryLabels.map((_, i) => 3 + (i % 4)) }],
    minimapRange: 'full',
    isRangeSelectable: true,
  });
  const { xs: [barFromX, barToX, barCentreX], y: barY } = await readProbePlotPoints([[2, 0.75], [7, 0.75], [5]]);
  await page.mouse.move(barCentreX - RANGE_CLICK_MOVE / 2, barY);
  await page.mouse.down();
  await page.mouse.move(barCentreX + RANGE_CLICK_MOVE / 2, barY);
  await page.mouse.up();
  await waitForIdle(page, RANGE_SETTLE_MS);
  const rangeAfterPress = await page.evaluate(() => window.probeRanges.at(-1));
  await page.mouse.move(barFromX, barY);
  await page.mouse.down();
  await page.mouse.move(barToX, barY, { steps: RANGE_DRAG_STEPS });
  await page.mouse.up();
  await waitForIdle(page, RANGE_SETTLE_MS);
  const barSelection = await readColumnWindow(3);
  await unmountProbe(page);
  check('a short press across a column centre is a click, and a drag selects the columns whose centres it holds',
    rangeAfterPress?.from === 0 && rangeAfterPress?.to === 10 && isColumnWindow(barSelection, 3, 7, true),
    `${JSON.stringify(rangeAfterPress)}, then ${JSON.stringify(barSelection)}`);

  // A line without a minimap takes the selected window alike
  await (await mountGeometryProbe({ ...selectableLines, withMinimap: false })).scrollIntoViewIfNeeded();
  await dragAcrossProbe([[2, 0.5], [6, 0.5]]);
  const plainSelection = await readLastRange();
  await doubleClickProbe();
  const plainReset = await readLastRange();
  await unmountProbe(page);
  check('a line without a minimap opens a selected window, and a double click shows the whole range',
    plainSelection === '3-6' && plainReset === '0-10', `${plainSelection}, then ${plainReset}`);

  // A `limitDate` from label 4 keeps a double click on the open labels
  await (await mountGeometryProbe({ ...selectableLines, limitDate: geometryLabels[LINE_LIMIT_INDEX] }))
    .scrollIntoViewIfNeeded();
  await dragAcrossProbe([[5, 0.5], [8, 0.5]]);
  const limitedSelection = await readLastRange();
  await doubleClickProbe();
  const limitedReset = { range: await readLastRange(), slider: await readSliderEdges() };
  await dragAcrossProbe([[LINE_LIMIT_INDEX], [6, 0.5]]);
  const limitedStart = { range: await readLastRange(), slider: await readSliderEdges() };
  await unmountProbe(page);
  const isLimitedStart = limitedStart.range === `${LINE_LIMIT_INDEX}-6`
    && areSliderEdgesAt(limitedStart.slider, [LINE_LIMIT_INDEX / 10, 6.5 / 10]);
  check('a selection and a double click keep to the labels limitDate leaves open, from the first of them on',
    limitedSelection === '6-8' && limitedReset.range === `${LINE_LIMIT_INDEX}-10`
    && areSliderEdgesAt(limitedReset.slider, [LINE_LIMIT_INDEX / 10, 1]) && isLimitedStart,
    `${limitedSelection}, then ${JSON.stringify(limitedReset)}, then ${JSON.stringify(limitedStart)}`);

  // Two adjacent points of 200 open a window as wide as the minimap ears leave one, over both points
  const denseProbe = await mountGeometryProbe({
    type: 'line',
    title: 'Probe — A narrow selection',
    labels: Array.from({ length: DENSE_LABEL_COUNT }, (_, i) => Date.UTC(2026, 0, i + 1)),
    datasets: [{
      name: 'Values', color: '#FF0000', values: Array.from({ length: DENSE_LABEL_COUNT }, (_, i) => i % 7),
    }],
    withMinimap: true,
    minimapRange: 'full',
    isRangeSelectable: true,
  });
  await denseProbe.scrollIntoViewIfNeeded();
  await dragAcrossProbe([[DENSE_SELECTED_INDEX - 1, 0.5], [DENSE_SELECTED_INDEX + 1, 0.5]]);
  const denseSelection = await page.evaluate(() => {
    const range = window.probeRangeReports.at(-1)?.range;
    const slider = document.querySelector('#probe .lovely-chart--minimap-slider').getBoundingClientRect();
    return { from: range?.from, to: range?.to, sliderWidth: slider.width };
  });
  await unmountProbe(page);
  check('a selection narrower than the minimap ears leave a window widens to them around both its points',
    denseSelection.from <= DENSE_SELECTED_INDEX && denseSelection.to >= DENSE_SELECTED_INDEX + 1
    && isNearPx(denseSelection.sliderWidth, MINIMAP_EARS_WIDTH), JSON.stringify(denseSelection));

  // A chart that zooms in on a click selects a range by a drag without zooming, and a still click still zooms
  await (await mountGeometryProbe({ ...selectableLines, withMinimap: false }, [[0]], true)).scrollIntoViewIfNeeded();
  await dragAcrossProbe([[2, 0.5], [6, 0.5]]);
  const zoomableSelection = {
    range: await readLastRange(),
    zooms: await page.evaluate(() => window.probeZoomReports.length),
  };
  await clickProbeLabel(4);
  await waitForIdle(page, 2000);
  const zoomAfterClick = await page.evaluate(() => window.probeZoomReports.at(-1)?.value);
  await page.mouse.move(5, 5);
  await unmountProbe(page);
  check('a drag across a zoomable chart selects a range and zooms into nothing, while a click still zooms',
    zoomableSelection.range === '3-6' && zoomableSelection.zooms === 0 && zoomAfterClick === geometryLabels[4],
    `${JSON.stringify(zoomableSelection)}, zoomed into ${zoomAfterClick}`);

  // A pie with a minimap takes neither a drag nor a double click on its plot
  const pageErrorsBeforePie = errors.filter((error) => error.startsWith('[pageerror]')).length;
  const selectablePie = await mountGeometryProbe({
    type: 'pie',
    title: 'Probe — A pie a drag leaves as it is',
    labels: Array.from({ length: 6 }, (_, month) => Date.UTC(2026, month, 1)),
    datasets: [
      { name: 'Large', color: '#3497ED', values: [500, 111, 111, 111, 500, 500] },
      { name: 'Small', color: '#9ED448', values: [1, 1, 1, 1, 1, 1] },
    ],
    withMinimap: true,
    minimapRange: { from: 1, to: 3 },
    isRangeSelectable: true,
  });
  await selectablePie.scrollIntoViewIfNeeded();
  const pieCaptionBefore = (await selectablePie.locator('.lovely-chart--header-caption').textContent()).trim();
  const pieBox = await selectablePie.locator('.lovely-chart--tooltip').boundingBox();
  const pieMiddleY = pieBox.y + pieBox.height / 2;
  await drag(page, pieBox.x + pieBox.width * 0.2, pieMiddleY, pieBox.width * 0.5, 0);
  await page.mouse.dblclick(pieBox.x + pieBox.width / 2, pieMiddleY);
  await waitForIdle(page, RANGE_SETTLE_MS);
  const pieCaptionAfter = (await selectablePie.locator('.lovely-chart--header-caption').textContent()).trim();
  const pieSelectionErrors = errors.filter((error) => error.startsWith('[pageerror]')).slice(pageErrorsBeforePie);
  await page.mouse.move(5, 5);
  await unmountProbe(page);
  check('a pie keeps its window through a drag and a double click on its plot, with no page error',
    pieCaptionAfter === pieCaptionBefore && !pieSelectionErrors.length,
    `${pieCaptionBefore} -> ${pieCaptionAfter}, ${pieSelectionErrors.join('; ').slice(0, 200)}`);
});

section('The hover line and dots stay on the plot wherever the header variables or a style of the page put '
  + 'it', async ({ page }) => {
  // A flat line, whose middle across the hover dot is the dot's own height
  const hoverConfig = {
    type: 'line',
    title: 'Probe — Hover layer',
    labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 0, day)),
    datasets: [{ name: 'Flat', color: '#FF0000', values: [40, 40, 40, 40] }],
  };
  const selectHoverLabel = async () => {
    await page.evaluate(() => window.probeChart.selectLabel(1));
    await waitForIdle(page, 300);
  };
  await mountProbe(page, { config: hoverConfig });
  await selectHoverLabel();
  const defaultHover = await readHoverAlignment(page, '#FF0000');
  await unmountProbe(page);
  check('the hover dots sit on the line, the hover canvas on the plot canvas',
    isHoverAligned(defaultHover) && defaultHover.plotTop === HEADER_HEIGHT + PLOT_MARGIN_TOP,
    formatHoverAlignment(defaultHover));
  check('the balloon opens 5px under the header',
    defaultHover.balloonTop === defaultHover.headerBottom + BALLOON_HEADER_GAP,
    `header ends at ${defaultHover.headerBottom}, balloon at ${defaultHover.balloonTop}`);

  await mountProbe(page, { config: hoverConfig, hostStyle: COMPACT_HEADER_STYLE });
  await selectHoverLabel();
  const compactHover = await readHoverAlignment(page, '#FF0000');
  await unmountProbe(page);
  const compactPlotTop = COMPACT_HEADER.marginTop + COMPACT_HEADER.height + COMPACT_HEADER.plotMarginTop;
  check('the header variables size and space the header and move the plot',
    compactHover.headerTop === COMPACT_HEADER.marginTop
    && compactHover.headerBottom === COMPACT_HEADER.marginTop + COMPACT_HEADER.height
    && compactHover.titleLineHeight === `${COMPACT_HEADER.height}px` && compactHover.plotTop === compactPlotTop,
    `header from ${compactHover.headerTop} to ${compactHover.headerBottom}, title line height `
    + `${compactHover.titleLineHeight}, plot canvas at ${compactHover.plotTop}`);
  check('under the header variables the hover dots sit on the line, and the balloon opens 5px under the header',
    isHoverAligned(compactHover) && compactHover.balloonTop === compactHover.headerBottom + BALLOON_HEADER_GAP,
    `${formatHoverAlignment(compactHover)}, balloon at ${compactHover.balloonTop}`);

  // Sets a stylesheet of the page for the probe, added on the first call
  const setProbeStyle = (css) => page.evaluate((text) => {
    let style = document.getElementById('probe-hover-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'probe-hover-style';
      document.head.appendChild(style);
    }
    style.textContent = text;
  }, css);
  const removeProbeStyle = () => page.evaluate(() => document.getElementById('probe-hover-style').remove());

  // A style of the page that restyles the header and sets a place of its own for the hover layer, then folds the
  // header, after the chart is built
  await mountProbe(page, { config: hoverConfig });
  await setProbeStyle(`#probe .lovely-chart--header { height: ${RESTYLED_HEADER.height}px; `
    + `margin-top: ${RESTYLED_HEADER.marginTop}px; } #probe .lovely-chart--tooltip { top: 0; }`);
  await waitForIdle(page, 200);
  await selectHoverLabel();
  const restyledHover = await readHoverAlignment(page, '#FF0000');
  await setProbeStyle('#probe .lovely-chart--header { display: none; }');
  await waitForIdle(page, 200);
  await selectHoverLabel();
  const foldedHover = await readHoverAlignment(page, '#FF0000');
  await removeProbeStyle();
  await unmountProbe(page);
  check('the hover dots follow the plot down a header a style of the page makes taller, over its place for them',
    isHoverAligned(restyledHover)
    && restyledHover.plotTop === RESTYLED_HEADER.marginTop + RESTYLED_HEADER.height + PLOT_MARGIN_TOP,
    formatHoverAlignment(restyledHover));
  check('the hover dots follow the plot up when a style of the page folds the header',
    isHoverAligned(foldedHover) && foldedHover.plotTop === PLOT_MARGIN_TOP, formatHoverAlignment(foldedHover));

  // A style of the page, there before the build, that sets one margin on both canvases
  await setProbeStyle('#probe .lovely-chart--container > canvas, #probe .lovely-chart--tooltip canvas '
    + `{ margin-top: ${PAGE_CANVAS_MARGIN_TOP}px; }`);
  await mountProbe(page, { config: hoverConfig });
  await selectHoverLabel();
  const marginHover = await readHoverAlignment(page, '#FF0000');
  await removeProbeStyle();
  await unmountProbe(page);
  check('a margin a style of the page sets on both canvases moves the plot, and the hover dots with it alone',
    isHoverAligned(marginHover) && marginHover.plotTop === HEADER_HEIGHT + PAGE_CANVAS_MARGIN_TOP,
    formatHoverAlignment(marginHover));

  // A chart element of fixed height, whose size a style of the page that folds the header, then makes it taller,
  // leaves unchanged
  await mountProbe(page, { config: hoverConfig });
  await setProbeStyle(`#probe .lovely-chart--container { height: ${FIXED_CHART_HEIGHT}px; }`);
  await waitForIdle(page, 200);
  await selectHoverLabel();
  const fixedHover = await readHoverAlignment(page, '#FF0000');
  await setProbeStyle(`#probe .lovely-chart--container { height: ${FIXED_CHART_HEIGHT}px; }
    #probe .lovely-chart--header { display: none; }`);
  await waitForIdle(page, 200);
  await selectHoverLabel();
  const fixedFoldedHover = await readHoverAlignment(page, '#FF0000');
  await setProbeStyle(`#probe .lovely-chart--container { height: ${FIXED_CHART_HEIGHT}px; }
    #probe .lovely-chart--header { height: ${RESTYLED_HEADER.height}px; }`);
  await waitForIdle(page, 200);
  await selectHoverLabel();
  const fixedTallHover = await readHoverAlignment(page, '#FF0000');
  await removeProbeStyle();
  await unmountProbe(page);
  check('in a chart of fixed height the hover dots and the data area follow the plot up a folded header',
    isHoverAligned(fixedFoldedHover) && fixedFoldedHover.plotTop === PLOT_MARGIN_TOP
    && fixedFoldedHover.plotAreaTop === fixedHover.plotAreaTop,
    `${formatHoverAlignment(fixedFoldedHover)}, data area ${fixedFoldedHover.plotAreaTop} under the plot top, `
    + `${fixedHover.plotAreaTop} before the fold`);
  check('in a chart of fixed height the hover dots and the data area follow the plot down a taller header',
    isHoverAligned(fixedTallHover) && fixedTallHover.plotTop === RESTYLED_HEADER.height + PLOT_MARGIN_TOP
    && fixedTallHover.plotAreaTop === fixedHover.plotAreaTop,
    `${formatHoverAlignment(fixedTallHover)}, data area ${fixedTallHover.plotAreaTop} under the plot top, `
    + `${fixedHover.plotAreaTop} before`);

  await mountProbe(page, { config: { ...hoverConfig, isSparkline: true, plotHeight: 64 } });
  await selectHoverLabel();
  const sparklineHover = await readHoverAlignment(page, '#FF0000');
  await unmountProbe(page);
  check('a sparkline\'s hover dots sit on its line, at the top of the chart',
    isHoverAligned(sparklineHover) && sparklineHover.plotTop === 0, formatHoverAlignment(sparklineHover));
});

section('A web font that loads after the build widens the outward column to fit, and moves the plot '
  + 'area', async ({ page }) => {
  await page.evaluate(({ family, fontPath }) => {
    const style = document.createElement('style');
    style.id = 'probe-font';
    style.textContent = `@font-face { font-family: ${family}; src: url(${fontPath}) format('truetype'); }
      #probe .lovely-chart--container { font-family: ${family}, sans-serif; }`;
    document.head.appendChild(style);
  }, { family: WIDE_FONT_FAMILY, fontPath: WIDE_FONT_PATH });
  await recordProbeNumbers(page);
  const lateFontChart = await mountProbe(page, { config: { ...columnConfig, title: 'Probe — Late web font' } });
  await lateFontChart.scrollIntoViewIfNeeded();
  const fallbackFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const fallbackFontLeft = await readPlotAreaLeft(page);
  const writesBeforeFont = await page.evaluate(() => window.plotAreaWrites);
  releaseWideFont();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // eslint-disable-next-line no-restricted-syntax -- the tracker cannot see the held web font load
  await sleep(500);
  const fontWrites = await page.evaluate(() => window.plotAreaWrites) - writesBeforeFont;
  // A redraw, as a legend toggle brings, prints the labels in the loaded font
  await lateFontChart.locator('.lovely-chart--button').nth(1).click();
  await waitForIdle(page, 1000);
  const wideFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const wideFontLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await page.evaluate(() => document.getElementById('probe-font').remove());
  check('a web font that loads after the build widens the outward column to fit its labels',
    wideFontColumn.end > fallbackFontColumn.end && wideFontColumn.overflowing.length === 0,
    `ends at ${fallbackFontColumn.end} in the fallback font, then at ${wideFontColumn.end}, widest label `
    + `${wideFontColumn.widest.toFixed(2)}px, overflowing: ${JSON.stringify(wideFontColumn.overflowing)}`);
  check('a web font that loads after the build moves the plot area once, after the widened column',
    fallbackFontLeft === fallbackFontColumn.end + Y_AXIS_LABEL_GAP
    && wideFontLeft === wideFontColumn.end + Y_AXIS_LABEL_GAP && fontWrites === 4,
    `left ${fallbackFontLeft}, then ${wideFontLeft} in ${fontWrites} writes`);
});

section('A `FontFace` the page adds already loaded fires no `loadingdone`, and the next frame fits the column to '
  + 'it', async ({ page }) => {
  const loadedFontFamily = `${WIDE_FONT_FAMILY}Loaded`;
  await page.evaluate((family) => {
    const style = document.createElement('style');
    style.id = 'probe-font';
    style.textContent = `#probe .lovely-chart--container { font-family: ${family}, sans-serif; }`;
    document.head.appendChild(style);
  }, loadedFontFamily);
  await recordProbeNumbers(page);
  const loadedFontChart = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Font face added loaded' },
  });
  await loadedFontChart.scrollIntoViewIfNeeded();
  const unloadedFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  await page.evaluate(async ({ family, bytes }) => {
    window.probeFontFace = new FontFace(family, Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0)));
    await window.probeFontFace.load();
    document.fonts.add(window.probeFontFace);
  }, { family: loadedFontFamily, bytes: buildWideFont().toString('base64') });
  // eslint-disable-next-line no-restricted-syntax -- the tracker cannot see the font face the page adds
  await sleep(500);
  await loadedFontChart.locator('.lovely-chart--button').nth(1).click();
  await waitForIdle(page, 1000);
  const loadedFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const loadedFontLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await page.evaluate(() => {
    document.fonts.delete(window.probeFontFace);
    document.getElementById('probe-font').remove();
  });
  check('a font face added already loaded widens the outward column and moves the plot area on the next frame',
    loadedFontColumn.end > unloadedFontColumn.end && loadedFontColumn.overflowing.length === 0
    && loadedFontLeft === loadedFontColumn.end + Y_AXIS_LABEL_GAP,
    `ends at ${unloadedFontColumn.end} before the font, then at ${loadedFontColumn.end}, widest label `
    + `${loadedFontColumn.widest.toFixed(2)}px, overflowing: ${JSON.stringify(loadedFontColumn.overflowing)}, `
    + `left ${loadedFontLeft}`);
});

section('The typography variables set the family and the weights of the chart\'s text, of its canvas labels '
  + 'too', async ({ page }) => {
  // The regular weight runs through the legend, the names in the tooltip and the axis labels, and the bold one through
  // the header, the tooltip title and its total, the values, the Total row, the change and the shares
  const typographyLabels = [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day));
  const typographyDatasets = [{ name: 'Paid', values: [3, 4, 5, 4, 6] }, { name: 'Free', values: [2, 1, 2, 3, 2] }];
  const typographyComparison = { name: 'Previous period', values: [[2, 3, 4, 4, 5], [1, 1, 2, 2, 2]] };
  const typographyVariables = {
    '--lovely-chart-font-family': 'ProbeSerif, serif',
    '--lovely-chart-font-weight': '200',
    '--lovely-chart-font-weight-bold': '800',
  };
  const typographyHostStyle = Object.entries(typographyVariables)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
  const typographyChart = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      labels: typographyLabels,
      datasets: typographyDatasets,
      comparison: typographyComparison,
      referenceLines: [{ value: 9, label: 'Target' }],
      title: 'Probe — Typography',
    },
  });
  await typographyChart.scrollIntoViewIfNeeded();
  // A legend toggle there and back redraws the axis labels and the reference label
  const recordTypographyCanvas = async () => {
    await startCanvasRecording(typographyChart);
    for (let i = 0; i < 2; i++) {
      await typographyChart.locator('.lovely-chart--button').nth(1).click();
      await waitForIdle(page, 600);
    }
    const { texts } = await stopCanvasRecording(page);
    return {
      axisFonts: [...new Set(texts.filter(({ text }) => text !== 'Target').map(({ font }) => font))],
      referenceFonts: [...new Set(texts.filter(({ text }) => text === 'Target').map(({ font }) => font))],
    };
  };
  const defaultCanvasFonts = await recordTypographyCanvas();
  const defaultTypography = await readProbeTypography(page, typographyLabels.length - 1);
  await page.evaluate((variables) => {
    const element = document.getElementById('probe');
    Object.entries(variables).forEach(([name, value]) => element.style.setProperty(name, value));
  }, typographyVariables);
  const variableCanvasFonts = await recordTypographyCanvas();
  const variableTypography = await readProbeTypography(page, typographyLabels.length - 1);
  await unmountProbe(page);
  await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      isPercentage: true,
      isTooltipTotalInTitle: true,
      labels: typographyLabels,
      datasets: typographyDatasets,
      title: 'Probe — Typography of shares',
    },
    hostStyle: typographyHostStyle,
  });
  const sharesTypography = await readProbeTypography(page, typographyLabels.length - 1);
  await unmountProbe(page);
  const isTypographyWeighted = ({ weights }, keys, weight) => keys.every((key) => (
    weights[key].length > 0 && weights[key].every((value) => value === weight)
  ));
  const regularTextKeys = ['legend', 'comparisonLegend', 'rowNames'];
  const boldTextKeys = ['header', 'tooltipTitle', 'values', 'totalRow', 'change'];
  const isCanvasFont = (fonts, prefix, family) => fonts.length > 0 && fonts.every((font) => (
    font.startsWith(prefix) && font.includes(family)
  ));
  check('the chart text takes its own family, a weight of 300 and a bold one of 700 by default, the axis labels 300',
    defaultTypography.family.includes('Helvetica')
    && isTypographyWeighted(defaultTypography, regularTextKeys, '300')
    && isTypographyWeighted(defaultTypography, boldTextKeys, '700')
    && isCanvasFont(defaultCanvasFonts.axisFonts, '300 10px ', 'Helvetica')
    && isCanvasFont(defaultCanvasFonts.referenceFonts, '500 11px ', 'Helvetica'),
    JSON.stringify({ defaultTypography, defaultCanvasFonts }));
  check('the typography variables set the family and the weights of the chart text, the canvas labels included',
    variableTypography.family.startsWith('ProbeSerif')
    && isTypographyWeighted(variableTypography, regularTextKeys, '200')
    && isTypographyWeighted(variableTypography, boldTextKeys, '800')
    && isCanvasFont(variableCanvasFonts.axisFonts, '200 10px ', 'ProbeSerif')
    && isCanvasFont(variableCanvasFonts.referenceFonts, '500 11px ', 'ProbeSerif'),
    JSON.stringify({ variableTypography, variableCanvasFonts }));
  check('the bold weight of the typography variables reaches the total beside the tooltip title and the shares',
    isTypographyWeighted(sharesTypography, ['titleTotal', 'shares'], '800'),
    JSON.stringify(sharesTypography));

  // A legend in `legendContainer` keeps the family of its own element until the variables reach it from a shared
  // ancestor, and a weight invalid for its property leaves the chart text its size and the family of the variables
  const externalTypography = await page.evaluate(async ({ labels, datasets, comparison, variables }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const host = document.createElement('div');
    host.style.font = '400 16px Georgia, serif';
    const element = document.createElement('div');
    const legend = document.createElement('div');
    host.append(element, legend);
    document.getElementById('container').append(host);
    const chart = new LovelyChart(element, {
      type: 'line',
      labels,
      datasets,
      comparison,
      legendContainer: legend,
    });
    await window.idleTracker.wait(600);
    const readFont = (selector) => {
      const { fontWeight, fontSize, fontFamily } = getComputedStyle(host.querySelector(selector));
      return `${fontWeight} ${fontSize} ${fontFamily}`;
    };
    const readFonts = () => ({
      container: readFont('.lovely-chart--container'),
      label: readFont('.lovely-chart--button-label'),
      comparisonLegend: readFont('.lovely-chart--comparison-legend'),
    });
    const unset = readFonts();
    Object.entries(variables).forEach(([name, value]) => host.style.setProperty(name, value));
    const shared = readFonts();
    element.style.setProperty('--lovely-chart-font-weight', 'medium');
    const invalidWeight = readFonts();
    chart.destroy();
    host.remove();
    return { unset, shared, invalidWeight };
  }, {
    labels: typographyLabels,
    datasets: typographyDatasets,
    comparison: typographyComparison,
    variables: typographyVariables,
  });
  const { unset: unsetExternal, shared: sharedExternal, invalidWeight } = externalTypography;
  check('a legend in `legendContainer` keeps the family of its own element while the typography variables are unset',
    unsetExternal.label === '300 16px Georgia, serif'
    && unsetExternal.comparisonLegend === '400 16px Georgia, serif'
    && unsetExternal.container.startsWith('300 13px ') && unsetExternal.container.includes('Helvetica'),
    JSON.stringify(unsetExternal));
  check('the typography variables reach a legend in `legendContainer` from an ancestor it shares with the chart',
    sharedExternal.label === '200 16px ProbeSerif, serif'
    && sharedExternal.comparisonLegend === '200 16px ProbeSerif, serif'
    && sharedExternal.container === '200 13px ProbeSerif, serif',
    JSON.stringify(sharedExternal));
  check('a weight invalid for its property leaves the chart text its size and the family of the typography variables',
    invalidWeight.container === '400 13px ProbeSerif, serif',
    JSON.stringify(invalidWeight));
});

section('Whole Y steps for counts, on both axes', async ({ page }) => {
  const countsConfig = {
    type: 'line',
    labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'Red cases', values: [0, 1, 2, 1, 0] }, { name: 'Runs', values: [2, 0, 1, 2, 1] }],
    hasSecondYAxis: true,
  };
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...countsConfig, title: 'Probe — Fractional steps' } });
  const fractionalSteps = await readProbeNumbers(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...countsConfig, title: 'Probe — Whole steps', noFloatSteps: true } });
  const wholeSteps = await readProbeNumbers(page);
  await unmountProbe(page);
  check('noFloatSteps labels a count of 0 to 2 in steps of 1',
    fractionalSteps.includes(0.5) && JSON.stringify(wholeSteps) === '[0,1,2]',
    `default: ${JSON.stringify(fractionalSteps)}, whole: ${JSON.stringify(wholeSteps)}`);
});

section('Legend labels contrast with their fills', async ({ page }) => {
  const legendFills = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Legend fills',
      labels: [1, 2].map((day) => Date.UTC(2026, 10, day)),
      datasets: Object.entries(LEGEND_FILLS).map(([name, color]) => ({ name, color, values: [1, 2] })),
    },
  });
  const legendContrasts = await readLegendLabels(legendFills);
  const illegibleLabels = legendContrasts.filter(({ contrast }) => contrast < MIN_LEGEND_LABEL_CONTRAST);
  check('legend labels contrast with their fills',
    legendContrasts.length === Object.keys(LEGEND_FILLS).length && !illegibleLabels.length,
    JSON.stringify(illegibleLabels.length ? illegibleLabels : legendContrasts.map(({ contrast }) => contrast)));
  const needlesslyDarkLabels = legendContrasts
    .filter(({ whiteContrast, isLabelWhite }) => whiteContrast >= MIN_LEGEND_LABEL_CONTRAST && !isLabelWhite);
  check('legend labels stay white where white reads',
    !needlesslyDarkLabels.length, JSON.stringify(needlesslyDarkLabels));
  await unmountProbe(page);

  const defaultPaletteLegend = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Default palette legend',
      labels: [1, 2].map((day) => Date.UTC(2026, 10, day)),
      datasets: DEFAULT_PALETTE.map((_, i) => ({ name: `Dataset ${i + 1}`, values: [1, 2] })),
    },
  });
  const defaultPaletteLabels = await readLegendLabels(defaultPaletteLegend);
  const darkLabelColors = defaultPaletteLabels.filter(({ isLabelWhite }) => !isLabelWhite).map(({ color }) => color);
  check('of the default colours, the light green and the amber alone take dark legend labels',
    JSON.stringify(defaultPaletteLabels.map(({ color }) => color)) === JSON.stringify(DEFAULT_PALETTE)
    && JSON.stringify(darkLabelColors) === JSON.stringify(DARK_LABEL_DEFAULT_COLORS),
    JSON.stringify(defaultPaletteLabels
      .map(({ color, isLabelWhite }) => `${color} ${isLabelWhite ? 'white' : 'dark'}`)));
  await unmountProbe(page);
});

section('The default colours the package exports are those a chart gives the datasets with no colour of their '
  + 'own', async ({ page }) => {
  const exportedPalette = await page.evaluate(async ({ datasetCounts, ownColor }) => {
    const {
      default: LovelyChart, DEFAULT_COLORS, DEFAULT_COMPARISON_COLOR, getDefaultColors,
    } = await import('./LovelyChart.js');
    const toHex = (value) => `#${value.match(/\d+/g).slice(0, 3)
      .map((channel) => Number(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    // The colours of the legend buttons and of the comparison entry of a chart, which sets them as it is built
    const readLegendColors = (datasets, comparison) => {
      const element = document.createElement('div');
      document.getElementById('container').appendChild(element);
      const chart = new LovelyChart(element, {
        type: 'line', labels: [1, 2].map((day) => Date.UTC(2026, 10, day)), datasets, comparison,
      });
      const readColor = (entry) => toHex(entry.style.getPropertyValue('--lovely-chart-series-color'));
      const colors = Array.from(element.querySelectorAll('.lovely-chart--button')).map(readColor);
      const comparisonEntry = element.querySelector('.lovely-chart--comparison-legend');
      const comparisonColor = comparisonEntry ? readColor(comparisonEntry) : undefined;
      chart.destroy();
      element.remove();
      return { colors, comparisonColor };
    };
    const createDatasets = (count) => Array.from({ length: count }, (_, i) => ({
      name: `Dataset ${i + 1}`,
      values: [1, 2],
    }));

    const countMismatches = datasetCounts
      .map((count) => ({
        count,
        exported: getDefaultColors(count),
        drawn: readLegendColors(createDatasets(count)).colors,
      }))
      .filter(({ exported, drawn }) => JSON.stringify(exported) !== JSON.stringify(drawn));
    const [ownDataset, ...otherDatasets] = createDatasets(3);
    const mixedColors = readLegendColors([{ ...ownDataset, color: ownColor }, ...otherDatasets]).colors;
    const changedColors = getDefaultColors(DEFAULT_COLORS.length);
    changedColors.fill(ownColor);
    const comparison = { name: 'Previous period', values: [[1, 2], [2, 1]] };

    return {
      palette: [...DEFAULT_COLORS],
      isPaletteFrozen: Object.isFrozen(DEFAULT_COLORS),
      comparisonColor: DEFAULT_COMPARISON_COLOR,
      drawnComparisonColor: readLegendColors(createDatasets(2), comparison).comparisonColor,
      countMismatches,
      mixedColors,
      expectedMixedColors: [ownColor, ...getDefaultColors(3).slice(0, otherDatasets.length)],
      colorsAfterChange: getDefaultColors(DEFAULT_COLORS.length),
      drawnAfterChange: readLegendColors(createDatasets(DEFAULT_COLORS.length)).colors,
    };
  }, { datasetCounts: PALETTE_DATASET_COUNTS, ownColor: OWN_DATASET_COLOR });
  check('the package exports the eight default colours in order, frozen, and the default comparison colour',
    JSON.stringify(exportedPalette.palette) === JSON.stringify(DEFAULT_PALETTE) && exportedPalette.isPaletteFrozen
    && exportedPalette.comparisonColor === DEFAULT_COMPARISON_COLOR
    && exportedPalette.drawnComparisonColor === DEFAULT_COMPARISON_COLOR,
    JSON.stringify([
      exportedPalette.palette, exportedPalette.isPaletteFrozen,
      exportedPalette.comparisonColor, exportedPalette.drawnComparisonColor,
    ]));
  check(`getDefaultColors() gives the colours a chart of ${PALETTE_DATASET_COUNTS.join(', ')} datasets takes, one each`,
    !exportedPalette.countMismatches.length, JSON.stringify(exportedPalette.countMismatches));
  check('datasets with no colour of their own take the default colours in order, past one with a colour',
    JSON.stringify(exportedPalette.mixedColors) === JSON.stringify(exportedPalette.expectedMixedColors),
    JSON.stringify(exportedPalette.mixedColors));
  check('getDefaultColors() returns a new array, whose change reaches neither the next call nor a chart',
    JSON.stringify(exportedPalette.colorsAfterChange) === JSON.stringify(DEFAULT_PALETTE)
    && JSON.stringify(exportedPalette.drawnAfterChange) === JSON.stringify(DEFAULT_PALETTE),
    JSON.stringify([exportedPalette.colorsAfterChange, exportedPalette.drawnAfterChange]));
});

section('The spacing variables of a page inset the header, the minimap and the legend, space the legend and size its '
  + 'buttons, read from an ancestor of the chart or of a `legendContainer`', async ({ page }) => {
  const spacingConfig = {
    type: 'line',
    title: 'Probe — Spacing',
    labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 10, i + 1)),
    datasets: Array.from({ length: 5 }, (_, i) => ({
      name: `Dataset ${i + 1}`,
      values: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3],
    })),
    comparison: { name: 'Previous period', values: [[2, 7, 1, 8, 2, 8, 1, 8, 2, 8]] },
    withMinimap: true,
  };
  await mountProbe(page, { config: spacingConfig, width: SPACING_PROBE_WIDTH });
  const defaultSpacing = await readSpacing(page, '#probe');
  await unmountProbe(page);
  check('the header, the minimap and the legend stand 10px in, and the legend takes its default gaps and buttons',
    isSpacingAt(defaultSpacing, DEFAULT_SPACING)
    && defaultSpacing.minimapCanvasWidth === defaultSpacing.minimapWidth, JSON.stringify(defaultSpacing));

  await mountProbe(page, { config: spacingConfig, width: SPACING_PROBE_WIDTH, hostStyle: PAGE_SPACING_STYLE });
  const pageSpacing = await readSpacing(page, '#probe');
  await unmountProbe(page);
  check('the spacing variables of an ancestor set the insets, the gaps, the space under the legend and its buttons',
    isSpacingAt(pageSpacing, PAGE_SPACING), JSON.stringify(pageSpacing.spacing));
  check('a minimap the inset widens takes a canvas as wide as it',
    pageSpacing.minimapCanvasWidth === pageSpacing.minimapWidth,
    `${pageSpacing.minimapCanvasWidth} of ${pageSpacing.minimapWidth}`);

  await page.evaluate(({ config, width, style }) => import('./LovelyChart.js').then(({ default: LovelyChart }) => {
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.width = `${width}px`;
    const legend = document.createElement('div');
    legend.id = 'probe-legend';
    legend.style.cssText = `width: ${width}px; ${style}`;
    document.getElementById('container').append(element, legend);
    window.probeChart = new LovelyChart(element, { ...config, legendContainer: legend });
  }), { config: spacingConfig, width: SPACING_PROBE_WIDTH, style: PAGE_SPACING_STYLE });
  const externalSpacing = await readSpacing(page, '#probe-legend');
  await unmountProbe(page);
  await page.evaluate(() => document.getElementById('probe-legend').remove());
  check('a legend in a `legendContainer` takes the spacing variables of that element',
    isSpacingAt(externalSpacing, PAGE_SPACING), JSON.stringify(externalSpacing.spacing));

  // --- `setLegendContainer()` moves the live legend in and out of the chart, its buttons in their state, through a
  // rebuild of the layout, a zoom and `update()` ---
  const movedLegend = await page.evaluate(async ({ config, width, style }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.width = `${width}px`;
    const slot = document.createElement('div');
    slot.id = 'probe-legend';
    slot.style.cssText = `width: ${width}px; ${style}`;
    document.getElementById('container').append(element, slot);
    window.probeLegendLog = [];
    window.probeChart = new LovelyChart(element, {
      ...config,
      onHiddenSeriesChange: (names) => window.probeLegendLog.push(names.join()),
    });
    await window.idleTracker.wait(800);
    const legend = element.querySelector('.lovely-chart--tools');
    const plot = element.querySelector('canvas');
    legend.querySelector('.lovely-chart--button').click();
    window.probeChart.setLegendContainer(slot);
    const firstButton = slot.querySelector('.lovely-chart--button');
    return {
      isSameLegend: slot.firstElementChild === legend && slot.childElementCount === 1,
      isLeftByLegend: !element.querySelector('.lovely-chart--tools'),
      isSamePlot: element.querySelector('canvas') === plot,
      isFirstHidden: !firstButton.classList.contains('lovely-chart--state-checked')
        && firstButton.getAttribute('aria-pressed') === 'false',
      log: [...window.probeLegendLog],
    };
  }, { config: spacingConfig, width: SPACING_PROBE_WIDTH, style: PAGE_SPACING_STYLE });
  const movedSpacing = await readSpacing(page, '#probe-legend');
  check('setLegendContainer() moves the legend itself into the page, its buttons as they were, without a rebuild',
    movedLegend.isSameLegend && movedLegend.isLeftByLegend && movedLegend.isSamePlot && movedLegend.isFirstHidden
    && JSON.stringify(movedLegend.log) === '["Dataset 1"]', JSON.stringify(movedLegend));
  check('a moved legend takes the spacing variables of its new element',
    isSpacingAt(movedSpacing, PAGE_SPACING), JSON.stringify(movedSpacing.spacing));

  const rebuiltLegend = await page.evaluate(async () => {
    const element = document.getElementById('probe');
    const slot = document.getElementById('probe-legend');
    const legend = slot.querySelector('.lovely-chart--tools');
    legend.querySelectorAll('.lovely-chart--button')[1].click();
    const pageItem = document.createElement('span');
    slot.append(pageItem);
    window.probeChart.setLegendContainer(slot);
    const isPageItemLast = slot.lastElementChild === pageItem;
    window.dispatchEvent(new Event('orientationchange'));
    await window.idleTracker.wait(1200);
    const rebuilt = slot.querySelector('.lovely-chart--tools');
    return {
      log: [...window.probeLegendLog],
      isPageItemLast,
      isRebuiltInSlot: Boolean(rebuilt) && rebuilt !== legend
        && slot.querySelectorAll('.lovely-chart--tools').length === 1,
      isLeftByLegend: !element.querySelector('.lovely-chart--tools'),
      checked: rebuilt ? Array.from(rebuilt.querySelectorAll('.lovely-chart--button'))
        .map((button) => button.classList.contains('lovely-chart--state-checked')) : [],
    };
  });
  check('a button of a moved legend toggles its dataset and reports it',
    JSON.stringify(rebuiltLegend.log) === '["Dataset 1","Dataset 1,Dataset 2"]', JSON.stringify(rebuiltLegend.log));
  check('setLegendContainer() with the element that holds the legend leaves it among the elements of the page',
    rebuiltLegend.isPageItemLast);
  check('a rebuild of the layout builds the legend in the element it moved to, its datasets still hidden',
    rebuiltLegend.isRebuiltInSlot && rebuiltLegend.isLeftByLegend
    && JSON.stringify(rebuiltLegend.checked) === '[false,false,true,true,true]', JSON.stringify(rebuiltLegend));

  const returnedLegend = await page.evaluate(() => {
    const element = document.getElementById('probe');
    const slot = document.getElementById('probe-legend');
    const legend = slot.querySelector('.lovely-chart--tools');
    window.probeChart.setLegendContainer(undefined);
    return {
      isAtChartEnd: element.querySelector('.lovely-chart--container').lastElementChild === legend,
      slotChildren: slot.childElementCount,
    };
  });
  const returnedSpacing = await readSpacing(page, '#probe');
  check('setLegendContainer(undefined) moves the legend back to the end of the chart, in its own spacing',
    returnedLegend.isAtChartEnd && returnedLegend.slotChildren === 1 && isSpacingAt(returnedSpacing, DEFAULT_SPACING),
    `${JSON.stringify(returnedLegend)}, ${JSON.stringify(returnedSpacing.spacing)}`);

  const placedLegend = await page.evaluate(async (config) => {
    const element = document.getElementById('probe');
    const slot = document.getElementById('probe-legend');
    const countLegends = () => [
      element.querySelectorAll('.lovely-chart--tools').length, slot.querySelectorAll('.lovely-chart--tools').length,
    ];
    window.probeChart.setLegendContainer(slot);
    window.probeChart.update(config);
    await window.idleTracker.wait(300);
    const afterUpdate = countLegends();
    window.probeChart.update({ ...config, legendContainer: slot });
    await window.idleTracker.wait(300);
    const afterSlotUpdate = countLegends();
    window.probeChart.destroy();
    const afterDestroy = countLegends();
    let error = 'none';
    try {
      window.probeChart.setLegendContainer(slot);
      window.probeChart.setLegendContainer(undefined);
    } catch (err) {
      error = err.message;
    }
    return {
      afterUpdate, afterSlotUpdate, afterDestroy, afterLateMove: countLegends(), slotChildren: slot.childElementCount,
      error,
    };
  }, spacingConfig);
  await page.evaluate(() => {
    document.getElementById('probe').remove();
    document.getElementById('probe-legend').remove();
  });
  check('update() places the legend by the `legendContainer` of its data',
    JSON.stringify(placedLegend.afterUpdate) === '[1,0]' && JSON.stringify(placedLegend.afterSlotUpdate) === '[0,1]',
    JSON.stringify(placedLegend));
  check('destroy() takes a moved legend out of the page, and setLegendContainer() after it does nothing',
    JSON.stringify(placedLegend.afterDestroy) === '[0,0]' && JSON.stringify(placedLegend.afterLateMove) === '[0,0]'
    && placedLegend.slotChildren === 1 && placedLegend.error === 'none', JSON.stringify(placedLegend));

  // A zoom out rebuilds a legend moved while zoomed in the element it moved to, and a move from there takes out at once
  // the legend the rebuild replaced, which fades out. A zoom into lines fixes the size of the chart, and a move of the
  // legend out after the zoom in, or in after the zoom out, resizes it.
  await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }, { name: 'Palette' }],
    config: { initialZoom: 'last' },
  });
  const zoomedLegend = await page.evaluate(async () => {
    const element = document.getElementById('probe');
    const chart = element.querySelector('.lovely-chart--container');
    const slot = document.createElement('div');
    slot.id = 'probe-legend';
    document.getElementById('container').append(slot);
    const readNames = (container) => Array.from(container.querySelectorAll('.lovely-chart--button-label'))
      .map((label) => label.textContent);
    const readHeight = (node) => node.getBoundingClientRect().height;
    const zoomedHeight = readHeight(chart);
    const zoomedLegendHeight = readHeight(chart.querySelector('.lovely-chart--tools'));
    window.probeChart.setLegendContainer(slot);
    const zoomedNames = readNames(slot);
    const movedOutShrink = zoomedHeight - readHeight(chart);
    element.querySelector('.lovely-chart--header-zoom-out-control').click();
    const startedAt = performance.now();
    while (slot.querySelectorAll('.lovely-chart--tools').length < 2 && performance.now() - startedAt < 3000) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const slotLegends = slot.querySelectorAll('.lovely-chart--tools').length;
    const overviewHeight = readHeight(chart);
    window.probeChart.setLegendContainer(undefined);
    const legend = chart.querySelector('.lovely-chart--tools');
    return {
      zoomedNames,
      slotLegends,
      slotChildren: slot.childElementCount,
      chartLegends: element.querySelectorAll('.lovely-chart--tools').length,
      overviewNames: readNames(element),
      movedOutShrink,
      zoomedLegendHeight,
      movedInGrowth: readHeight(chart) - overviewHeight,
      legendHeight: readHeight(legend),
      legendOverhang: legend.getBoundingClientRect().bottom - chart.getBoundingClientRect().bottom,
    };
  });
  await unmountProbe(page);
  await page.evaluate(() => document.getElementById('probe-legend').remove());
  check('a zoom out rebuilds a legend moved while zoomed in its new element, and a move back leaves nothing there',
    JSON.stringify(zoomedLegend.zoomedNames) === '["Blue","Magenta","Palette"]' && zoomedLegend.slotLegends === 2
    && zoomedLegend.slotChildren === 0 && zoomedLegend.chartLegends === 1
    && JSON.stringify(zoomedLegend.overviewNames) === '["Red","Green"]', JSON.stringify(zoomedLegend));
  check('a zoomed chart shrinks by the legend that moves out of it and grows by the legend that moves in, in view',
    Math.abs(zoomedLegend.movedOutShrink - zoomedLegend.zoomedLegendHeight) <= SPACING_TOLERANCE
    && Math.abs(zoomedLegend.movedInGrowth - zoomedLegend.legendHeight) <= SPACING_TOLERANCE
    && zoomedLegend.legendOverhang <= SPACING_TOLERANCE, JSON.stringify(zoomedLegend));
});

section('The accessible name of the plot, and the legend left exposed', async ({ page }) => {
  // The role and the name of the plot canvas, whether the chart's element or its host carries a role or a name, and
  // the images and the buttons a role query finds in the host
  const readPlotNaming = async (chart) => ({
    ...await chart.evaluate((container) => {
      const plot = container.querySelector(':scope > canvas');
      return {
        role: plot.getAttribute('role') ?? '',
        label: plot.getAttribute('aria-label') ?? '',
        isHidden: plot.getAttribute('aria-hidden') === 'true',
        isElementNamed: [container, container.parentElement]
          .some((element) => element.hasAttribute('role') || element.hasAttribute('aria-label')),
      };
    }),
    images: await page.locator('#probe').getByRole('img')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label'))),
    buttons: await page.locator('#probe').getByRole('button').allTextContents(),
  });
  const namedDays = {
    type: 'line',
    title: 'Probe — Accessible name',
    labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2025, 10, day)),
    datasets: [{ name: 'Desktop', values: [1, 2, 3, 2, 1] }, { name: 'Mobile', values: [2, 1, 2, 3, 2] }],
  };
  const namedChart = await mountProbe(page, { config: namedDays });
  const summarized = await readPlotNaming(namedChart);
  const summary = 'Line chart, 1 Nov 2025 — 5 Nov 2025: Desktop, Mobile';
  check('the plot is an image named by the type, the span of the dates and the datasets, the element takes no role',
    summarized.role === 'img' && summarized.label === summary && !summarized.isHidden && !summarized.isElementNamed
    && JSON.stringify(summarized.images) === JSON.stringify([summary])
    && JSON.stringify(summarized.buttons) === '["Desktop","Mobile"]',
    JSON.stringify(summarized));

  // Each step updates the chart, which names its plot from the data of the step
  const namingSteps = [
    {
      params: {
        ...namedDays, type: 'bar', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Sun'], datasets: [namedDays.datasets[0]],
      },
      label: 'Bar chart, Mon — Sun: Desktop',
    },
    {
      params: {
        ...namedDays,
        type: 'area',
        labels: [0, 1, 2].map((month) => Date.UTC(2025, month, 1)),
        datasets: [{ name: 'Ventas', values: [1, 2, 3] }, { name: 'Devoluciones', values: [3, 2, 1] }],
        dateLocale: { monthsFull: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
          'septiembre', 'octubre', 'noviembre', 'diciembre'] },
      },
      label: 'Area chart, enero — marzo 2025: Ventas, Devoluciones',
    },
    {
      params: { ...namedDays, labels: [namedDays.labels[4]], datasets: [{ name: 'Desktop', values: [1] }] },
      label: 'Line chart, Wednesday, 5 Nov 2025: Desktop',
    },
    {
      params: { ...namedDays, type: 'pie', ariaLabel: 'Visits by platform' },
      label: 'Visits by platform',
    },
  ];
  const namings = [];
  for (const { params } of namingSteps) {
    await page.evaluate((stepParams) => window.probeChart.update(stepParams), params);
    namings.push(await readPlotNaming(namedChart));
  }
  check('the summary spans text labels and months in `dateLocale`, names a single day, and `ariaLabel` replaces it',
    namings.every(({ role, label, images }, i) => role === 'img' && label === namingSteps[i].label
      && JSON.stringify(images) === JSON.stringify([label])),
    JSON.stringify(namings.map(({ label }) => label)));

  await page.evaluate((params) => window.probeChart.update({ ...params, ariaLabel: '' }), namedDays);
  const unnamed = await readPlotNaming(namedChart);
  check('an empty `ariaLabel` leaves the plot out of the accessibility tree and the legend in it',
    unnamed.isHidden && !unnamed.role && !unnamed.label && !unnamed.images.length
    && JSON.stringify(unnamed.buttons) === '["Desktop","Mobile"]',
    JSON.stringify(unnamed));

  // The current year is left out of a span only when both of its ends are in it
  const thisYear = new Date().getUTCFullYear();
  await page.evaluate((params) => window.probeChart.update(params), {
    ...namedDays,
    labels: [[thisYear, 11, 30], [thisYear, 11, 31], [thisYear + 1, 0, 1], [thisYear + 1, 0, 2]]
      .map(([year, month, day]) => Date.UTC(year, month, day)),
    datasets: [{ name: 'Desktop', values: [1, 2, 3, 2] }],
  });
  await waitForIdle(page, 600);
  const yearSpan = `30 Dec ${thisYear} — 2 Jan ${thisYear + 1}`;
  const crossYear = {
    ...await readPlotNaming(namedChart),
    caption: (await namedChart.locator('.lovely-chart--header-caption').textContent()).trim(),
  };
  check('a span from the current year into the next gives each end its year, in the name and the header caption',
    crossYear.label === `Line chart, ${yearSpan}: Desktop` && crossYear.caption === yearSpan,
    JSON.stringify(crossYear));
  await unmountProbe(page);

  // A zoom in or out names the plot from the data it brings, and leaves out an `ariaLabel` of the zoomed data
  const zoomOverview = [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }];
  const zoomDatasets = [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }];
  const summaryZoom = await mountLinesZoom(page, {
    overview: zoomOverview, zoomed: zoomDatasets, config: { initialZoom: 'last' }, zoomConfig: { ariaLabel: 'Zoomed' },
  });
  const zoomedSummary = await readPlotNaming(summaryZoom);
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const overviewSummary = await readPlotNaming(summaryZoom);
  await unmountProbe(page);
  const sharesZoom = await mountProbe(page, {
    config: { ...namedDays, type: 'area', isStacked: true, isPercentage: true, initialZoom: 'last' },
  });
  const sharesSummary = await readPlotNaming(sharesZoom);
  await unmountProbe(page);
  check('a zoom names the plot from the zoomed data, a pie of shares included, and a zoom out from the chart\'s own',
    /^Line chart, Tuesday, 10 Nov( 2026)?: Blue, Magenta$/.test(zoomedSummary.label)
    && JSON.stringify(zoomedSummary.buttons) === '["Blue","Magenta"]'
    && /^Line chart, 1 Nov( 2026)? — 10 Nov( 2026)?: Red, Green$/.test(overviewSummary.label)
    && JSON.stringify(overviewSummary.buttons) === '["Red","Green"]'
    && sharesSummary.label === 'Pie chart, 2 Nov 2025 — 5 Nov 2025: Desktop, Mobile',
    JSON.stringify({ zoomedSummary, overviewSummary, sharesSummary }));

  const namedZoom = await mountLinesZoom(page, {
    overview: zoomOverview,
    zoomed: zoomDatasets,
    config: { initialZoom: 'last', ariaLabel: 'Visits by day' },
    zoomConfig: { ariaLabel: 'Zoomed' },
  });
  const zoomedNaming = await readPlotNaming(namedZoom);
  check('a zoom keeps the chart\'s `ariaLabel`, over an `ariaLabel` of the zoomed data',
    zoomedNaming.label === 'Visits by day' && JSON.stringify(zoomedNaming.buttons) === '["Blue","Magenta"]',
    JSON.stringify(zoomedNaming));
  await unmountProbe(page);
});

section('Dashed and dotted datasets, comparison and its tooltip (demo charts)', async ({ page, charts }) => {
  const limitChart = charts.nth(LIMIT_CHART);
  const legendOutlines = await limitChart.locator('.lovely-chart--button')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).borderTopStyle));
  check('dashed and dotted datasets outline their legend buttons with a dash and with dots',
    JSON.stringify(legendOutlines) === '["solid","dashed","dotted"]', JSON.stringify(legendOutlines));

  const comparisonChart = charts.nth(COMPARISON_CHART);
  await comparisonChart.scrollIntoViewIfNeeded();
  const comparisonLegend = await comparisonChart.locator('.lovely-chart--comparison-legend').textContent();
  const comparisonPlot = await comparisonChart.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, comparisonPlot, 0.7, 0.5);
  const comparisonTooltip = await comparisonChart.locator('.lovely-chart--tooltip-balloon').evaluate((el) => ({
    firstRow: el.querySelector('.lovely-chart--tooltip-legend').firstElementChild.className,
    swatches: el.querySelectorAll('.lovely-chart--tooltip-swatch').length,
    titleTotal: el.querySelector('.lovely-chart--tooltip-title-total')?.textContent ?? '',
    hasTotalRow: Boolean(el.querySelector('.lovely-chart--tooltip-dataset-total')),
    change: el.querySelector('.lovely-chart--tooltip-change')?.dataset.tone,
  }));
  check('comparison names its line in the legend', comparisonLegend === 'Week before',
    JSON.stringify(comparisonLegend));
  check('the demo tooltip lists the comparison first, swatches and the total by the title',
    comparisonTooltip.firstRow.includes('lovely-chart--tooltip-dataset-comparison')
    && comparisonTooltip.swatches > 1 && /^\d{1,3}(,\d{3})+$/.test(comparisonTooltip.titleTotal)
    && !comparisonTooltip.hasTotalRow && ['positive', 'negative', 'neutral'].includes(comparisonTooltip.change),
    JSON.stringify(comparisonTooltip));
});

section('Tooltip rows: their look, their order and the total', async ({ page, charts }) => {
  const rowsConfig = {
    type: 'bar',
    isStacked: true,
    labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
    datasets: TOOLTIP_ROW_VALUES.map((value, i) => ({
      name: `D${i}`, color: TOOLTIP_ROW_COLORS[i], values: [value, value, value],
    })),
    noZoom: true,
  };
  // The 11 largest of the 13 rows fit beside the comparison row
  const largestRows = TOOLTIP_ROW_VALUES.map((value, i) => ({ value, name: `D${i}` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 11);
  const rowsByValue = largestRows.map(({ name }) => name);
  const rowsInLegendOrder = [...rowsByValue].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const rowsTotal = String(TOOLTIP_ROW_VALUES.reduce((sum, value) => sum + value, 0));

  await mountProbe(page, {
    config: {
      ...rowsConfig,
      title: 'Probe — Tooltip rows',
      comparison: { name: 'Before', values: TOOLTIP_ROW_VALUES.map((value) => [value, value * 0.8, value]) },
    },
  });
  const defaultRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('tooltip rows list the comparison, then the largest values down, then the Total row',
    JSON.stringify(defaultRows.names) === JSON.stringify(['Before', ...rowsByValue, 'Total'])
    && defaultRows.titleTotal === undefined,
    JSON.stringify(defaultRows.names));
  check('tooltip rows carry swatches of their datasets, the comparison a dashed one, and values in the text colour',
    JSON.stringify(defaultRows.swatched) === JSON.stringify(['Before', ...rowsByValue])
    && JSON.stringify(defaultRows.dashedSwatches) === JSON.stringify(['Before'])
    && defaultRows.swatchColors[0] === hexToRgb(DEFAULT_COMPARISON_COLOR)
    && defaultRows.swatchColors.slice(1).every((color, i) => (
      color === hexToRgb(TOOLTIP_ROW_COLORS[Number(rowsByValue[i].slice(1))])
    ))
    && defaultRows.areValuesInTextColor,
    JSON.stringify(defaultRows));
  check('a rise of the comparison change takes --tooltip-change-positive',
    defaultRows.change.text === '+25%' && defaultRows.change.tone === 'positive'
    && defaultRows.change.color === defaultRows.change.positiveColor
    && defaultRows.change.color !== defaultRows.change.textColor,
    JSON.stringify(defaultRows.change));

  await mountProbe(page, {
    config: {
      ...rowsConfig,
      title: 'Probe — Tooltip rows, fixed order, total in the title',
      comparison: { name: 'Before', values: TOOLTIP_ROW_VALUES.map((value) => [value, value * 1.25, value]) },
      isTooltipOrderFixed: true,
      isTooltipTotalInTitle: true,
    },
  });
  const fixedRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('isTooltipOrderFixed lists the largest values in the order of the legend',
    JSON.stringify(fixedRows.names) === JSON.stringify(['Before', ...rowsInLegendOrder]),
    JSON.stringify(fixedRows.names));
  check('isTooltipTotalInTitle puts the total by the title, with no Total row',
    fixedRows.titleTotal === rowsTotal && !fixedRows.names.includes('Total'),
    `title total: ${fixedRows.titleTotal}, rows: ${JSON.stringify(fixedRows.names)}`);
  await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Percentage total in the title',
      isPercentage: true,
      isStacked: true,
      isTooltipTotalInTitle: true,
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
      datasets: [
        { name: 'A', values: [10, 20, 30] },
        { name: 'B', values: [30, 40, 50] },
      ],
      noZoom: true,
    },
  });
  const percentageRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('isTooltipTotalInTitle puts the total of a percentage chart by the title',
    percentageRows.titleTotal === '60' && !percentageRows.names.includes('Total'),
    `title total: ${percentageRows.titleTotal}, rows: ${JSON.stringify(percentageRows.names)}`);
  check('a fall of the comparison change takes --tooltip-change-negative',
    fixedRows.change.text === '-20%' && fixedRows.change.tone === 'negative'
    && fixedRows.change.color === fixedRows.change.negativeColor
    && fixedRows.change.color !== fixedRows.change.textColor,
    JSON.stringify(fixedRows.change));

  // A zoom swaps in data of its own, which keeps its total in a row
  const zoomTotal = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { title: 'Probe — Title total through a zoom', isTooltipTotalInTitle: true },
    zoomDataSource: 'data/zoom_bars',
  });
  await zoomTotal.scrollIntoViewIfNeeded();
  const readTotals = () => zoomTotal.locator('.lovely-chart--tooltip-balloon').evaluate((el) => {
    const title = el.querySelector('.lovely-chart--tooltip-title');
    const total = el.querySelector('.lovely-chart--tooltip-title-total');
    const chevron = getComputedStyle(title, '::after');

    return {
      titleTotal: total?.textContent,
      hasTotalRow: Boolean(el.querySelector('.lovely-chart--tooltip-dataset-total')),
      totalEnd: total?.getBoundingClientRect().right,
      chevronStart: chevron.display === 'none'
        ? undefined
        : title.getBoundingClientRect().right - parseFloat(chevron.width),
    };
  });
  const zoomTotalPlot = await zoomTotal.locator('.lovely-chart--tooltip').boundingBox();
  // The day data covers the newest dates alone
  const zoomTotalFx = (zoomTotalPlot.width - 5) / zoomTotalPlot.width;
  await hoverWiggle(page, zoomTotalPlot, zoomTotalFx, 0.6);
  const overviewTotals = await readTotals();
  await page.mouse.click(
    zoomTotalPlot.x + zoomTotalPlot.width * zoomTotalFx,
    zoomTotalPlot.y + zoomTotalPlot.height * 0.6,
  );
  await waitForIdle(page, 2000);
  await hoverWiggle(page, zoomTotalPlot, 0.5, 0.6);
  const zoomedTotals = await readTotals();
  await unmountProbe(page);
  check('a zoom into data with its total in a row takes the total off the title',
    Boolean(overviewTotals.titleTotal) && !overviewTotals.hasTotalRow
    && zoomedTotals.titleTotal === undefined && zoomedTotals.hasTotalRow,
    JSON.stringify({ overviewTotals, zoomedTotals }));
  check('the title total of a zoomable balloon stops short of the zoom chevron',
    overviewTotals.chevronStart !== undefined && overviewTotals.totalEnd <= overviewTotals.chevronStart,
    JSON.stringify(overviewTotals));

  // A zoom that never resolves holds the balloon on its spinner
  await page.evaluate(async (labels) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Long tooltip title',
      labelType: 'text',
      labels,
      datasets: [{ name: 'A', values: labels.map((_, i) => i + 1) }],
      onZoom: () => new Promise(() => {}),
    });
  }, LONG_TITLE_LABELS);
  await settleMount(page);
  const readLongTitle = () => page.evaluate(() => {
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const title = balloon.querySelector('.lovely-chart--tooltip-title');
    const text = document.createRange();
    text.selectNodeContents(title);
    const chevron = getComputedStyle(title, '::after');
    const spinner = balloon.querySelector('.lovely-chart--spinner');

    return {
      textEnd: Math.max(...[...text.getClientRects()].map(({ right }) => right)),
      chevronStart: chevron.display === 'none'
        ? undefined
        : title.getBoundingClientRect().right - parseFloat(chevron.width),
      spinnerStart: getComputedStyle(spinner).display === 'none' ? undefined : spinner.getBoundingClientRect().left,
    };
  });
  await page.evaluate(() => window.probeChart.selectLabel(3));
  await waitForIdle(page, 300);
  const zoomableTitle = await readLongTitle();
  await page.locator('#probe .lovely-chart--tooltip-balloon').click();
  await waitForIdle(page, 300);
  const loadingTitle = await readLongTitle();
  await unmountProbe(page);
  check('a long tooltip title stops short of the zoom chevron and the loading spinner',
    zoomableTitle.chevronStart !== undefined && zoomableTitle.textEnd <= zoomableTitle.chevronStart
    && loadingTitle.spinnerStart !== undefined && loadingTitle.textEnd <= loadingTitle.spinnerStart,
    JSON.stringify({ zoomableTitle, loadingTitle }));

  // The total on the scale of `secondaryYAxis` scales the total `resolveTooltipTotal` gives. A function cannot cross
  // into the page, so the page builds the chart with the total it is given.
  const readResolvedSecondaryRows = (config, resolvedTotal) => page.evaluate(async ({ spec, total }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      ...spec,
      title: 'Probe — Resolved secondary total',
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', values: [100, 200, 300] }, { name: 'B', values: [10, 20, 30] }],
      secondaryYAxis: { label: 'USD ≈', multiplier: 2.5, prefix: '$' },
      resolveTooltipTotal: () => total,
    });
    await window.idleTracker.wait(800);
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    const rows = [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
      row.dataset.name ?? row.firstElementChild.textContent,
      row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
    ].join(' '));
    window.probeChart.destroy();
    element.remove();
    return rows;
  }, { spec: config, total: resolvedTotal });
  const resolvedSecondaryRows = {
    resolved: await readResolvedSecondaryRows({ type: 'line' }, 500),
    // `resolveTooltipTotal` marks a missing total with `null`
    // eslint-disable-next-line no-null/no-null
    missing: await readResolvedSecondaryRows({ type: 'line' }, null),
  };
  check('the total on the secondaryYAxis scale scales the total resolveTooltipTotal gives',
    JSON.stringify(resolvedSecondaryRows.resolved) === '["A 200","B 20","USD ≈ $1 250"]'
    && JSON.stringify(resolvedSecondaryRows.missing) === '["A 200","B 20","USD ≈ —"]',
    JSON.stringify(resolvedSecondaryRows));

  // The total on the scale of `secondaryYAxis` takes a row of its own under the Total row, or under the datasets
  const readSecondaryTotals = async (config) => {
    await mountProbe(page, {
      config: {
        isStacked: true,
        labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
        datasets: [{ name: 'A', values: [100, 200, 300] }, { name: 'B', values: [10, 20, 30] }],
        secondaryYAxis: { label: 'USD ≈', multiplier: 2.5, prefix: '$' },
        ...config,
      },
    });
    const totals = await page.evaluate(async () => {
      window.probeChart.selectLabel(1);
      await window.idleTracker.wait(300);
      const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
      return {
        rows: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
          row.dataset.name ?? row.firstElementChild.textContent,
          row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
        ].join(' ')),
        titleTotal: balloon.querySelector('.lovely-chart--tooltip-title-total')?.textContent,
      };
    });
    await unmountProbe(page);
    return totals;
  };
  const secondaryTotals = {
    bar: await readSecondaryTotals({ type: 'bar' }),
    step: await readSecondaryTotals({ type: 'step' }),
    area: await readSecondaryTotals({ type: 'area' }),
    inTitle: await readSecondaryTotals({ type: 'bar', isTooltipTotalInTitle: true }),
    percentage: await readSecondaryTotals({ type: 'area', isPercentage: true }),
    resolved: await readResolvedSecondaryRows({ type: 'bar', isStacked: true }, 500),
    // `resolveTooltipTotal` marks a missing total with `null`
    // eslint-disable-next-line no-null/no-null
    missing: await readResolvedSecondaryRows({ type: 'bar', isStacked: true }, null),
  };
  const rowsWithTotal = '["A 200","B 20","Total 220","USD ≈ $550"]';
  check('a stacked chart with secondaryYAxis shows its total and the scaled total on rows of their own',
    JSON.stringify(secondaryTotals.bar.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.step.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.area.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.percentage.rows) === rowsWithTotal
    && secondaryTotals.inTitle.titleTotal === '220'
    && JSON.stringify(secondaryTotals.inTitle.rows) === '["A 200","B 20","USD ≈ $550"]'
    && JSON.stringify(secondaryTotals.resolved) === '["A 200","B 20","Total 500","USD ≈ $1 250"]'
    && JSON.stringify(secondaryTotals.missing) === '["A 200","B 20","Total —","USD ≈ —"]',
    JSON.stringify(secondaryTotals));

  const sparkline = charts.nth(SPARKLINE_CHART);
  const sparklineLayout = await sparkline.evaluate((el) => ({
    header: getComputedStyle(el.querySelector('.lovely-chart--header')).display,
    tools: getComputedStyle(el.querySelector('.lovely-chart--tools')).display,
    height: el.querySelector('canvas').clientHeight,
  }));
  check('a sparkline draws the plot alone at its height',
    sparklineLayout.header === 'none' && sparklineLayout.tools === 'none' && sparklineLayout.height === 64,
    JSON.stringify(sparklineLayout));
});

section('The tooltip look: the muted comparison row, the rule under it, a neutral change and the balloon '
  + 'border', async ({ page }) => {
  await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Tooltip look',
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', values: [10, 20, 30] }, { name: 'B', values: [5, 10, 15] }],
      // The second label holds the previous total, and the third rises a quarter over it
      comparison: { name: 'Before', values: [[10, 20, 24], [5, 10, 12]] },
      noZoom: true,
    },
  });
  const readTooltipLook = (labelIndex) => page.evaluate(async (index) => {
    window.probeChart.selectLabel(index);
    await window.idleTracker.wait(300);
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const comparisonRow = balloon.querySelector('.lovely-chart--tooltip-dataset-comparison');
    const change = comparisonRow.querySelector('.lovely-chart--tooltip-change');
    const resolveColor = (variable) => {
      const element = document.createElement('span');
      element.style.color = `var(${variable})`;
      balloon.appendChild(element);
      const color = getComputedStyle(element).color;
      element.remove();
      return color;
    };
    // A `color-mix()` serializes as `color(srgb r g b)`, with channels from 0 to 1
    const getLuminance = (color) => color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
      .map((channel) => (color.startsWith('color(') ? channel : channel / 255))
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i] * value, 0);
    const rowStyle = getComputedStyle(comparisonRow);
    const balloonStyle = getComputedStyle(balloon);
    const background = getLuminance(balloonStyle.backgroundColor);
    const text = getLuminance(rowStyle.color);
    return {
      rowColor: rowStyle.color,
      rowOpacity: rowStyle.opacity,
      mutedColor: resolveColor('--tooltip-muted-text-color'),
      contrast: Math.round(((Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05)) * 100) / 100,
      datasetRowColor: getComputedStyle(balloon.querySelector('.lovely-chart--tooltip-dataset[data-name="A"]')).color,
      textColor: balloonStyle.color,
      ruleColor: rowStyle.borderBottomColor,
      gridColor: resolveColor('--grid-lines'),
      changeTone: change.dataset.tone,
      changeWeight: getComputedStyle(change).fontWeight,
      valueWeight: getComputedStyle(change.parentElement).fontWeight,
      border: `${balloonStyle.borderTopWidth} ${balloonStyle.borderTopStyle} ${balloonStyle.borderTopColor}`,
    };
  }, labelIndex);
  const setLookDark = (isDark) => page.evaluate((value) => {
    document.documentElement.classList.toggle('theme-dark', value);
  }, isDark);
  const wasLookDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  await setLookDark(false);
  const dayLook = await readTooltipLook(1);
  const risingLook = await readTooltipLook(2);
  await setLookDark(true);
  const nightLook = await readTooltipLook(1);
  await setLookDark(wasLookDark);
  const lookStyle = await page.evaluateHandle(() => {
    const style = document.createElement('style');
    style.textContent = '#probe .lovely-chart--container { --tooltip-muted-text-color: rgb(7, 8, 9);'
      + ' --tooltip-separator-color: rgb(1, 2, 3); --tooltip-border: 2px solid rgb(4, 5, 6); }';
    document.head.appendChild(style);
    return style;
  });
  const customLook = await readTooltipLook(1);
  await lookStyle.evaluate((style) => style.remove());
  // A page's own skin, a dark balloon by day, without a muted colour of its own
  const skinStyle = await page.evaluateHandle(() => {
    const style = document.createElement('style');
    style.textContent = '#probe .lovely-chart--container { --text-color: rgb(249, 250, 251);'
      + ' --tooltip-background: rgb(31, 41, 55); }';
    document.head.appendChild(style);
    return style;
  });
  const reskinnedLook = await readTooltipLook(1);
  await skinStyle.evaluate((style) => style.remove());
  await unmountProbe(page);
  check('the comparison row of the tooltip takes --tooltip-muted-text-color at full opacity, a page\'s own one too',
    [dayLook, nightLook].every((look) => (
      look.rowOpacity === '1' && look.rowColor === look.mutedColor && look.datasetRowColor === look.textColor
    ))
    && dayLook.mutedColor !== nightLook.mutedColor && customLook.rowColor === 'rgb(7, 8, 9)',
    JSON.stringify({ dayLook, nightLook, customLook }));
  check('the muted tooltip text reaches 4.5:1 on the tooltip background in both skins and in a page\'s own skin',
    [dayLook, nightLook, reskinnedLook].every((look) => look.contrast >= MIN_MUTED_TOOLTIP_CONTRAST)
    && reskinnedLook.rowColor !== dayLook.rowColor,
    JSON.stringify([dayLook, nightLook, reskinnedLook].map(({ rowColor, contrast }) => ({ rowColor, contrast }))));
  check('the rule under the comparison row takes --tooltip-separator-color, --grid-lines by default',
    dayLook.ruleColor === dayLook.gridColor && nightLook.ruleColor === nightLook.gridColor
    && dayLook.ruleColor !== nightLook.ruleColor && customLook.ruleColor === 'rgb(1, 2, 3)',
    JSON.stringify([dayLook.ruleColor, nightLook.ruleColor, customLook.ruleColor]));
  check('a neutral comparison change keeps the weight of its value, and a rise is bold',
    dayLook.changeTone === 'neutral' && dayLook.changeWeight === dayLook.valueWeight
    && risingLook.changeTone === 'positive' && Number(risingLook.changeWeight) >= 700
    && Number(risingLook.valueWeight) < 700,
    JSON.stringify([dayLook, risingLook].map(({ changeTone, changeWeight, valueWeight }) => (
      { changeTone, changeWeight, valueWeight }
    ))));
  check('the tooltip balloon takes --tooltip-border, none by default',
    dayLook.border.startsWith('0px none') && customLook.border === '2px solid rgb(4, 5, 6)',
    JSON.stringify([dayLook.border, customLook.border]));
});

section('The tooltip balloon over an overlay added after the chart with no z-index, which paints over the hover line, '
  + 'and under the page around the element that holds the chart', async ({ page }) => {
  // Lists the layers `selectors` pick, topmost first, under the middle of the overlap of the first two. An overlay
  // takes the pointer, as a label with a tip does, so that the point hits it.
  const readOverlapLayers = (selectors) => page.evaluate((layerSelectors) => {
    const layers = Object.entries(layerSelectors).map(([name, selector]) => [name, document.querySelector(selector)]);
    const [first, second] = layers.map(([, layer]) => layer?.getBoundingClientRect());
    if (!first || !second) return [];
    const stack = document.elementsFromPoint(
      (Math.max(first.left, second.left) + Math.min(first.right, second.right)) / 2,
      (Math.max(first.top, second.top) + Math.min(first.bottom, second.bottom)) / 2,
    );
    return layers
      .map(([name, layer]) => [name, layer ? stack.findIndex((hit) => layer.contains(hit)) : -1])
      .filter(([, depth]) => depth !== -1)
      .sort(([, depth], [, otherDepth]) => depth - otherDepth)
      .map(([name]) => name);
  }, selectors);
  // Shows the balloon of the middle label over the overlay, at a `z-index` of the overlay's own or none, with the
  // overlay added after the chart or inserted before it
  const selectOverOverlay = (zIndex, isBeforeChart = false) => page.evaluate(async ({ overlayZIndex, isBefore }) => {
    const host = document.getElementById('probe');
    const overlay = document.getElementById('probe-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = overlayZIndex;
    host.insertBefore(overlay, isBefore ? host.firstChild : undefined);
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
  }, { overlayZIndex: zIndex, isBefore: isBeforeChart });
  // Scrolls the page until the balloon stands under the page header, in the probe's element or the one `selector` names
  const scrollBalloonUnderHeader = (selector = BALLOON_LAYER_SELECTORS.balloon) => page.evaluate(async (spec) => {
    const balloon = document.querySelector(spec.selector);
    window.scrollBy(0, balloon.getBoundingClientRect().top - spec.balloonTop);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, { selector, balloonTop: BALLOON_UNDER_HEADER_TOP });
  const readHostIsolation = () => page.evaluate(() => {
    const host = document.getElementById('probe');
    return { computed: getComputedStyle(host).isolation, inline: host.style.isolation };
  });
  const layeringConfig = {
    type: 'line',
    title: 'Probe — Balloon layering',
    labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'A', values: [10, 20, 30] }],
    noZoom: true,
  };
  const layeringChart = await mountProbe(page, { config: layeringConfig, hostStyle: 'position: relative' });
  await layeringChart.scrollIntoViewIfNeeded();
  await addPlotAreaOverlay(page);
  await selectOverOverlay('');
  const defaultLayers = await readOverlapLayers(BALLOON_LAYER_SELECTORS);
  const hostIsolation = await readHostIsolation();
  await selectOverOverlay(OVER_BALLOON_Z_INDEX);
  const raisedAfterLayers = await readOverlapLayers(BALLOON_LAYER_SELECTORS);
  await selectOverOverlay(OVER_BALLOON_Z_INDEX, true);
  const raisedBeforeLayers = await readOverlapLayers(BALLOON_LAYER_SELECTORS);
  await selectOverOverlay('');
  // A sticky header of the page before the element that holds the chart, scrolled over the balloon, and an element of
  // the page after that element, placed over the balloon with no z-index
  await page.mouse.move(0, 0);
  await page.evaluate(({ headerHeight, scrollRoom }) => {
    const container = document.getElementById('container');
    const header = document.createElement('div');
    header.id = 'page-header';
    header.style.cssText = `position: sticky; top: 0; z-index: 1; height: ${headerHeight}px; background: #808080`;
    container.prepend(header);
    const spacer = document.createElement('div');
    spacer.id = 'page-spacer';
    spacer.style.height = `${scrollRoom}px`;
    container.append(spacer);
  }, { headerHeight: PAGE_HEADER_HEIGHT, scrollRoom: PAGE_SCROLL_ROOM });
  await scrollBalloonUnderHeader();
  await page.evaluate(async () => {
    const box = document.querySelector('#probe .lovely-chart--tooltip-balloon').getBoundingClientRect();
    const after = document.createElement('div');
    after.id = 'page-after';
    after.style.cssText = `position: absolute; left: ${box.left + window.scrollX}px; `
      + `top: ${box.top + window.scrollY}px; width: ${box.width / 2}px; height: ${box.height / 2}px`;
    document.getElementById('container').append(after);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  const pageLayers = {
    header: await readOverlapLayers({ header: '#page-header', balloon: BALLOON_LAYER_SELECTORS.balloon }),
    after: await readOverlapLayers({ after: '#page-after', balloon: BALLOON_LAYER_SELECTORS.balloon }),
  };
  // The page builds the next chart in the element before it destroys the one there
  await page.evaluate(async (config) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const next = new LovelyChart(document.getElementById('probe'), config);
    window.probeChart.destroy();
    window.probeChart = next;
  }, layeringConfig);
  await settleMount(page);
  await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
  });
  await scrollBalloonUnderHeader();
  pageLayers.nextChart = await readOverlapLayers({ header: '#page-header', balloon: BALLOON_LAYER_SELECTORS.balloon });
  const nextChartIsolation = await readHostIsolation();
  await page.evaluate(() => {
    ['page-header', 'page-spacer', 'page-after'].forEach((id) => document.getElementById(id).remove());
    window.probeChart.destroy();
  });
  const destroyedIsolation = await readHostIsolation();
  await unmountProbe(page);
  // A chart whose header floats, and a sparkline, keep the balloon over the overlay, and the zoom-out control of the
  // first paints over an overlay of the whole element
  const floatingLayers = {};
  for (const [name, config] of Object.entries({ noHeader: { noHeader: true }, sparkline: { isSparkline: true } })) {
    await mountProbe(page, { config: { ...layeringConfig, ...config }, hostStyle: 'position: relative' });
    await addPlotAreaOverlay(page);
    await selectOverOverlay('');
    floatingLayers[name] = await readOverlapLayers(BALLOON_LAYER_SELECTORS);
    await unmountProbe(page);
  }
  const zoomedFloatingChart = await mountProbe(page, {
    dataUrl: './data/areas.json',
    config: { title: 'Probe — Zoom-out control over an overlay', noHeader: true, initialZoom: 'last' },
    hostStyle: 'position: relative',
  });
  await zoomedFloatingChart.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'probe-overlay';
    overlay.style.cssText = 'position: absolute; inset: 0';
    document.getElementById('probe').appendChild(overlay);
  });
  const controlLayers = await readOverlapLayers({
    control: '#probe .lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)',
    overlay: BALLOON_LAYER_SELECTORS.overlay,
  });
  await unmountProbe(page);
  // A balloon of more rows than a short plot holds runs over the legend
  await mountProbe(page, {
    config: {
      ...layeringConfig,
      title: 'Probe — Tall balloon',
      datasets: Array.from({ length: TALL_BALLOON_DATASETS }, (_, i) => (
        { name: `Series ${i}`, values: [10 + i, 20 + i, 30 + i] }
      )),
      plotHeight: SHORT_PLOT_HEIGHT,
    },
  });
  await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
    const balloonBox = document.querySelector('#probe .lovely-chart--tooltip-balloon').getBoundingClientRect();
    const button = [...document.querySelectorAll('#probe .lovely-chart--button')].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return box.top < balloonBox.bottom && box.bottom > balloonBox.top
        && box.left < balloonBox.right && box.right > balloonBox.left;
    });
    if (button) button.id = 'probe-legend-button';
  });
  const legendLayers = await readOverlapLayers({
    balloon: BALLOON_LAYER_SELECTORS.balloon, button: '#probe-legend-button',
  });
  await unmountProbe(page);
  const balloonOverOverlay = ['balloon', 'overlay', 'hover line'].join();
  const overlayOverBalloon = ['overlay', 'balloon', 'hover line'].join();
  check('an overlay added after the chart with no z-index paints over the hover line and under the balloon',
    defaultLayers.join() === balloonOverOverlay
    && Object.values(floatingLayers).every((layers) => layers.join() === balloonOverOverlay),
    JSON.stringify({ defaultLayers, floatingLayers }));
  check('an overlay with a z-index above the balloon\'s paints over it, inserted before the chart or added after it',
    [raisedAfterLayers, raisedBeforeLayers].every((layers) => layers.join() === overlayOverBalloon),
    JSON.stringify({ raisedAfterLayers, raisedBeforeLayers }));
  check('the element holding a chart, or the next one built there, stacks its balloon under the page around it',
    hostIsolation.computed === 'isolate' && hostIsolation.inline === ''
    && nextChartIsolation.computed === 'isolate' && destroyedIsolation.computed === 'auto'
    && Object.values(pageLayers).every(([top, under]) => top !== 'balloon' && under === 'balloon'),
    JSON.stringify({ hostIsolation, nextChartIsolation, destroyedIsolation, pageLayers }));
  check('the floating zoom-out control paints over an overlay added after the chart with no z-index',
    controlLayers.join() === ['control', 'overlay'].join(), JSON.stringify(controlLayers));
  check('a balloon tall enough to reach the legend paints over its buttons',
    legendLayers.join() === ['balloon', 'button'].join(), JSON.stringify(legendLayers));
});

// A function cannot cross into the page, so the page builds the resolver from the notes it is given, and logs its calls
const mountNotesProbe = (page, config, notesByLabel) => page.evaluate(async ({ spec, resolved }) => {
  const { default: LovelyChart } = await import('./LovelyChart.js');
  const element = document.createElement('div');
  element.id = 'probe';
  document.getElementById('container').appendChild(element);
  window.noteCalls = [];
  window.probeChart = new LovelyChart(element, {
    ...spec,
    resolveTooltipNotes: (labelValue, datasetIndexes, labelIndex) => {
      window.noteCalls.push([labelValue, datasetIndexes, labelIndex]);
      return resolved[labelIndex];
    },
  });
  await window.idleTracker.wait(800);
}, { spec: config, resolved: notesByLabel });
section('Tooltip notes: those of hatched ranges and `resolveTooltipNotes`, beside the title and under the '
  + 'rows', async ({ page, charts }) => {
  const notesLabels = [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day));
  await mountNotesProbe(page, {
    type: 'bar',
    isStacked: true,
    title: 'Probe — Tooltip notes',
    labels: notesLabels,
    datasets: [
      { name: 'A', values: [10, 20, 30, 40, 50] },
      { name: 'B', values: [5, 10, 15, 20, 25] },
      { name: 'C', values: [1, 2, 3, 4, 5], isInitiallyHidden: true },
    ],
    comparison: { name: 'Before', values: [[10, 20, 30, 40, 50], [5, 10, 15, 20, 25], [1, 2, 3, 4, 5]] },
    hatchedRanges: NOTE_RANGES,
    isTooltipTotalInTitle: true,
    noZoom: true,
  }, RESOLVED_NOTES);
  await page.locator('#probe').scrollIntoViewIfNeeded();
  const readTooltipNotes = (labelIndex) => page.evaluate(async (index) => {
    if (index !== undefined) {
      window.probeChart.selectLabel(index);
      await window.idleTracker.wait(300);
    }
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const title = balloon.querySelector('.lovely-chart--tooltip-title');
    const date = title.firstElementChild;
    const titleNote = date.querySelector('.lovely-chart--tooltip-title-note');
    const total = title.querySelector('.lovely-chart--tooltip-title-total');
    const notes = balloon.querySelector('.lovely-chart--tooltip-notes');
    const lines = [...notes.children];
    const dateText = document.createRange();
    dateText.selectNode(date.firstChild);
    const resolveColor = (variable) => {
      const element = document.createElement('span');
      element.style.color = `var(${variable})`;
      balloon.appendChild(element);
      const color = getComputedStyle(element).color;
      element.remove();
      return color;
    };
    const notesStyle = getComputedStyle(notes);
    const longLine = lines.find((line) => line.textContent.includes('no price source'));
    const noteBox = titleNote?.getBoundingClientRect();
    const totalBox = total?.getBoundingClientRect();
    return {
      isShown: balloon.classList.contains('lovely-chart--state-shown'),
      date: date.firstChild.data,
      titleNote: titleNote?.textContent,
      // The note sits in the flex item of the date, after it, and the total stays at the far end of the title
      isTitleNoteInPlace: !titleNote || (
        titleNote.parentElement === date && date.nextElementSibling === total
        && noteBox.left >= dateText.getBoundingClientRect().right && totalBox.left > noteBox.right
        && Math.abs(totalBox.right - title.getBoundingClientRect().right) <= 1
      ),
      notes: lines.map((line) => line.textContent),
      hasMarkup: Boolean(notes.querySelector('b')),
      isLastChild: balloon.lastElementChild === notes,
      display: notesStyle.display,
      color: notesStyle.color,
      titleNoteColor: titleNote ? getComputedStyle(titleNote).color : undefined,
      mutedColor: resolveColor('--tooltip-muted-text-color'),
      rule: `${notesStyle.borderTopWidth} ${notesStyle.borderTopStyle} ${notesStyle.borderTopColor}`,
      separatorColor: resolveColor('--tooltip-separator-color'),
      whiteSpace: notesStyle.whiteSpace,
      width: notes.getBoundingClientRect().width,
      rowsWidth: balloon.querySelector('.lovely-chart--tooltip-legend').getBoundingClientRect().width,
      longLineHeight: longLine?.getBoundingClientRect().height,
      lineHeight: parseFloat(notesStyle.lineHeight),
      call: window.noteCalls.at(-1),
    };
  }, labelIndex);
  // From the last label down, so a label without notes or a title note follows one with them
  const labelNotes = [];
  for (let i = notesLabels.length - 1; i >= 0; i--) {
    labelNotes[i] = await readTooltipNotes(i);
  }
  // A selection held through a content update the throttle defers shows the notes of the label it shows the rows of
  const notesStep = await page.evaluate(async () => {
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const readStep = () => ({
      date: balloon.querySelector('.lovely-chart--tooltip-title').firstElementChild.firstChild.data,
      titleNote: balloon.querySelector('.lovely-chart--tooltip-title-note')?.textContent,
      rows: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset-value')].map((value) => value.textContent),
      notes: [...balloon.querySelector('.lovely-chart--tooltip-notes').children].map((line) => line.textContent),
    });
    window.probeChart.selectLabel(1);
    const first = readStep();
    window.probeChart.selectLabel(3);
    const held = readStep();
    await window.idleTracker.wait(300);
    return { first, held, settled: readStep() };
  });
  const notesPlot = await page.locator('#probe .lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, notesPlot, 0.9, 0.6);
  const hoveredNotes = await readTooltipNotes();
  await page.mouse.move(5, 5);
  await unmountProbe(page);
  check('tooltip notes list those of the hatched ranges in range order, then those of resolveTooltipNotes, by line',
    labelNotes.every(({ notes }, i) => JSON.stringify(notes) === JSON.stringify(LABEL_NOTES[i]))
    && !labelNotes[4].hasMarkup && labelNotes.every(({ isLastChild }) => isLastChild),
    JSON.stringify(labelNotes.map(({ notes, hasMarkup }) => ({ notes, hasMarkup }))));
  check('the title note of resolveTooltipNotes wins over those of the ranges, of which the first wins',
    labelNotes.every(({ titleNote }, i) => titleNote === LABEL_TITLE_NOTES[i]),
    JSON.stringify(labelNotes.map(({ titleNote }) => titleNote)));
  check('a tooltip title note follows the date in its flex item, and the title total keeps the far end',
    labelNotes.every(({ isTitleNoteInPlace }) => isTitleNoteInPlace),
    JSON.stringify(labelNotes.map(({ date, titleNote, isTitleNoteInPlace }) => (
      { date, titleNote, isTitleNoteInPlace }
    ))));
  check('resolveTooltipNotes takes the label value, the indexes of the datasets on screen and the label index',
    JSON.stringify(labelNotes[4].call) === JSON.stringify([notesLabels[4], [0, 1], 4]),
    JSON.stringify(labelNotes[4].call));
  const notesLook = labelNotes[4];
  check('tooltip notes take --tooltip-muted-text-color under a rule in --tooltip-separator-color',
    notesLook.color === notesLook.mutedColor && notesLook.titleNoteColor === notesLook.mutedColor
    && notesLook.rule === `1px solid ${notesLook.separatorColor}`,
    JSON.stringify(notesLook));
  check('tooltip notes are as wide as the rows, and a long line wraps to them',
    notesLook.whiteSpace === 'normal' && Math.abs(notesLook.width - notesLook.rowsWidth) <= 1
    && notesLook.longLineHeight >= notesLook.lineHeight * 2,
    JSON.stringify(notesLook));
  check('a label without notes hides the notes and the title note',
    labelNotes[0].isShown && labelNotes[0].display === 'none' && labelNotes[0].titleNote === undefined
    && labelNotes[1].display !== 'none' && labelNotes[1].titleNote === undefined,
    JSON.stringify(labelNotes.slice(0, 2)));
  check('tooltip notes change with the rows, in one throttled step',
    notesStep.first.date === labelNotes[1].date
    && JSON.stringify(notesStep.first.notes) === JSON.stringify(LABEL_NOTES[1])
    && JSON.stringify(notesStep.held) === JSON.stringify(notesStep.first)
    && notesStep.settled.date === labelNotes[3].date && notesStep.settled.titleNote === LABEL_TITLE_NOTES[3]
    && JSON.stringify(notesStep.settled.notes) === JSON.stringify(LABEL_NOTES[3]),
    JSON.stringify(notesStep));
  check('a pointer over a label shows its notes',
    hoveredNotes.isShown && JSON.stringify(hoveredNotes.notes) === JSON.stringify(LABEL_NOTES[4]),
    JSON.stringify(hoveredNotes.notes));

  // A zoom into shares takes the notes of the bars off the balloon, and a pie asks for none
  await mountNotesProbe(page, {
    type: 'bar',
    isStacked: true,
    isPercentage: true,
    title: 'Probe — Tooltip notes through a zoom into shares',
    labels: notesLabels,
    datasets: [{ name: 'A', values: [10, 20, 30, 40, 50] }, { name: 'B', values: [5, 10, 15, 20, 25] }],
    hatchedRanges: [{ from: 0, to: 4, note: 'Estimated' }],
    circleLabelsAround: 0,
  }, { 2: { notes: ['Resolved'] } });
  await page.locator('#probe').scrollIntoViewIfNeeded();
  const sharesPlot = await page.locator('#probe .lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, sharesPlot, 0.5, 0.6);
  const barNotes = await readTooltipNotes();
  await page.mouse.click(sharesPlot.x + sharesPlot.width * 0.5, sharesPlot.y + sharesPlot.height * 0.6);
  await waitForIdle(page, 2000);
  await page.evaluate(() => window.noteCalls.splice(0));
  await hoverWiggle(page, sharesPlot, 0.5, 0.45);
  const pieNotes = await page.evaluate(() => {
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    return {
      isShown: balloon.classList.contains('lovely-chart--state-shown'),
      isCircle: document.querySelector('#probe .lovely-chart--container')
        .classList.contains('lovely-chart--state-zoomed-in'),
      notes: [...balloon.querySelector('.lovely-chart--tooltip-notes').children].map((line) => line.textContent),
      titleNotes: balloon.querySelectorAll('.lovely-chart--tooltip-title-note').length,
      calls: window.noteCalls.length,
    };
  });
  await page.mouse.move(5, 5);
  await unmountProbe(page);
  check('a pie of shares shows no tooltip notes, and asks resolveTooltipNotes for none',
    JSON.stringify(barNotes.notes) === '["Estimated","Resolved"]'
    && pieNotes.isShown && pieNotes.isCircle && pieNotes.notes.length === 0 && pieNotes.titleNotes === 0
    && pieNotes.calls === 0,
    JSON.stringify({ barNotes: barNotes.notes, pieNotes }));

  // The forecast demo chart notes its forecast days under the rows
  const notesForecastChart = charts.nth(FORECAST_CHART);
  await notesForecastChart.scrollIntoViewIfNeeded();
  const notesForecastPlot = await notesForecastChart.locator('.lovely-chart--tooltip').boundingBox();
  const readForecastNotes = () => notesForecastChart.locator('.lovely-chart--tooltip-notes')
    .evaluate((el) => [...el.children].map((line) => line.textContent));
  await hoverWiggle(page, notesForecastPlot, 0.95, 0.5);
  const forecastDayNotes = await readForecastNotes();
  await hoverWiggle(page, notesForecastPlot, 0.3, 0.5);
  const actualDayNotes = await readForecastNotes();
  await page.mouse.move(5, 5);
  check('the demo forecast notes its forecast days in the tooltip, and an actual day away from the promotion not',
    JSON.stringify(forecastDayNotes) === '["Forecast"]' && actualDayNotes.length === 0,
    JSON.stringify({ forecastDayNotes, actualDayNotes }));
});

section('The total on the `secondaryYAxis` scale takes the format of the dataset values, and `isCurrencyPrefix` puts '
  + 'the minus sign of that total and of the labels of that scale in front of its prefix', async ({ page }) => {
  // A function cannot cross into the page, so the page formats the tooltip numbers in `locale` when it is given
  const readSecondaryFormat = async (config, locale) => {
    await recordProbeNumbers(page);
    return page.evaluate(async ({ spec, formatLocale }) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const element = document.createElement('div');
      element.id = 'probe';
      document.getElementById('container').appendChild(element);
      window.probeChart = new LovelyChart(element, {
        type: 'bar',
        isStacked: true,
        title: 'Probe — Secondary total format',
        labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
        datasets: [{ name: 'A', values: [-900, -1000, -1100] }, { name: 'B', values: [-95, -105, -115] }],
        secondaryYAxis: { label: 'EUR', multiplier: 0.92, prefix: '€' },
        ...spec,
        ...(formatLocale && { formatTooltipValue: (value) => value.toLocaleString(formatLocale) }),
      });
      await window.idleTracker.wait(800);
      window.probeChart.selectLabel(1);
      await window.idleTracker.wait(300);
      const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
      const rows = [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
        row.dataset.name ?? row.firstElementChild.textContent,
        row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
      ].join(' '));
      const axisLabels = [...new Set(window.probeTexts.map(({ text }) => text).filter((text) => text.includes('€')))];
      window.probeChart.destroy();
      element.remove();
      return { rows, axisLabels };
    }, { spec: config, formatLocale: locale });
  };
  const currencyConfig = { valuePrefix: '$', isCurrencyPrefix: true };
  const secondaryFormats = {
    plain: await readSecondaryFormat({}),
    currency: await readSecondaryFormat(currencyConfig),
    formatted: await readSecondaryFormat(currencyConfig, 'en-US'),
  };
  check('the total on the secondaryYAxis scale takes the format of the dataset values, formatTooltipValue included',
    JSON.stringify(secondaryFormats.plain.rows) === '["B -105","A -1 000","Total -1 105","EUR €-1 016.6"]'
    && JSON.stringify(secondaryFormats.currency.rows) === '["B -$105","A -$1 000","Total -$1 105","EUR -€1 016.6"]'
    && JSON.stringify(secondaryFormats.formatted.rows) === '["B -$105","A -$1,000","Total -$1,105","EUR -€1,016.6"]',
    JSON.stringify(secondaryFormats));
  check('isCurrencyPrefix puts the minus sign of a secondaryYAxis label in front of its prefix',
    secondaryFormats.plain.axisLabels.some((text) => /^€-\d/.test(text))
    && !secondaryFormats.plain.axisLabels.some((text) => text.startsWith('-€'))
    && secondaryFormats.currency.axisLabels.some((text) => /^-€\d/.test(text))
    && !secondaryFormats.currency.axisLabels.some((text) => text.startsWith('€-')),
    JSON.stringify({ plain: secondaryFormats.plain.axisLabels, currency: secondaryFormats.currency.axisLabels }));
});

section('Smooth lines, a dataset that starts hidden and the axis font (demo chart)', async ({ page, charts }) => {
  const smoothDemoChart = charts.nth(SMOOTH_CHART);
  await smoothDemoChart.scrollIntoViewIfNeeded();
  const smoothDemoButtons = smoothDemoChart.locator('.lovely-chart--button');
  const readSmoothPaint = async () => {
    const pixels = [];
    for (const color of SMOOTH_COLORS) pixels.push((await findColor(smoothDemoChart, parseHex(color))).count);
    const legend = await smoothDemoButtons
      .evaluateAll((buttons) => buttons.map((button) => button.classList.contains('lovely-chart--state-checked')));
    return { legend, pixels };
  };
  const hiddenPaint = await readSmoothPaint();
  await startCanvasRecording(smoothDemoChart);
  await smoothDemoButtons.nth(2).click();
  await waitForIdle(page, 800);
  const nightAxisDrawing = await stopCanvasRecording(page);
  const shownPaint = await readSmoothPaint();
  // The day skin, while the dataset hides again
  await page.evaluate(() => document.documentElement.classList.remove('theme-dark'));
  await waitForIdle(page, 800);
  await startCanvasRecording(smoothDemoChart);
  await smoothDemoButtons.nth(2).click();
  await waitForIdle(page, 800);
  const dayAxisDrawing = await stopCanvasRecording(page);
  await page.evaluate(() => document.documentElement.classList.add('theme-dark'));
  await waitForIdle(page, 800);
  check('a demo dataset that starts hidden leaves its legend button unchecked and its line out until it is checked',
    JSON.stringify(hiddenPaint.legend) === '[true,true,false]'
    && JSON.stringify(shownPaint.legend) === '[true,true,true]'
    && hiddenPaint.pixels.slice(0, 2).every((count) => count > MIN_DATASET_PIXELS) && hiddenPaint.pixels[2] === 0
    && shownPaint.pixels[2] > MIN_DATASET_PIXELS,
    JSON.stringify({ hiddenPaint, shownPaint }));
  check('the smooth demo chart draws its lines as curves', nightAxisDrawing.curves > 0,
    `${nightAxisDrawing.curves} curves`);
  const isSmoothAxisText = ({ texts }, hex) => texts.length > 0 && texts.every(({ font, color }) => (
    font.split(' ').includes(`${SMOOTH_AXIS_FONT_SIZE}px`) && isTextColor(color, hex)
  ));
  check('the demo axis labels take axisFontSize and the axisTextColor of each skin',
    isSmoothAxisText(nightAxisDrawing, SMOOTH_AXIS_COLORS.night)
    && isSmoothAxisText(dayAxisDrawing, SMOOTH_AXIS_COLORS.day),
    JSON.stringify([nightAxisDrawing.texts[0], dayAxisDrawing.texts[0]]));
});

section('Hatched ranges: their span by chart kind, merging, edges, labels, the minimap, the focus mask and '
  + 'shares', async ({ page }) => {
  // A range from the point before it, an accruing one from halfway, a third that touches it, and one at the first label,
  // too narrow for its label and with nothing before it for an edge
  const hatchLabels = Array.from({ length: 11 }, (_, i) => Date.UTC(2026, 0, i + 1));
  await recordProbeNumbers(page);
  const hatchLine = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Hatched line',
      labels: hatchLabels,
      isUtc: true,
      datasets: [{ name: 'Line', color: '#0000FF', values: [5, 6, 5, 7, 6, 8, 7, 6, 7, 8, 7] }],
      withMinimap: true,
      minimapRange: 'full',
      hatchedRanges: [
        { from: 0, to: 0, label: 'Too long for a sliver', hasEdge: true, color: PROBE_CYAN },
        { from: 3, to: 4, color: PROBE_MAGENTA },
        { from: 8, to: 8, isAccruing: true, color: PROBE_MAGENTA },
        { from: 9, to: 10, label: 'Estimated', hasEdge: true, color: PROBE_MAGENTA },
      ],
    },
  });
  const lineHatch = await readAreaColumns(page, '#probe', CLEAR_HATCH_PIXEL, true);
  const lineStep = lineHatch.width / (hatchLabels.length - 1);
  const lineRuns = findColumnRuns(lineHatch, MIN_HATCH_COLUMN_PIXELS);
  const expectedLineRuns = [[2 * lineStep, 4.5 * lineStep], [7.5 * lineStep, 10 * lineStep]];
  check('a line hatches a range from the point before it, an accruing one from halfway, ranges that touch as one',
    areRunsNear(lineRuns, expectedLineRuns), `${formatRuns(lineRuns)} for ${formatRuns(expectedLineRuns)}`);
  // The last band would run half a step past the last point, where the plot area ends, but for the clamp; the column the
  // antialiased edge of the area may tint is left out
  const pastLastPoint = sumColumns(lineHatch, lineHatch.width + 1, Infinity);
  check('a line hatches nothing past its last point', pastLastPoint === 0, `${pastLastPoint}px of hatch`);
  // Where the accruing range and the next overlap, a band of each would stroke the stripes twice over; the dashed edge at
  // the start of the next is left out
  const overlapAlpha = readPeakAlpha(lineHatch, 8.1 * lineStep, 8.4 * lineStep);
  const singleAlpha = readPeakAlpha(lineHatch, 9.1 * lineStep, 9.9 * lineStep);
  check('ranges of one colour that overlap hatch once, as one band',
    Math.abs(overlapAlpha - singleAlpha) <= MAX_HATCH_ALPHA_GAP,
    `alpha ${overlapAlpha} where they overlap, ${singleAlpha} past it`);
  // The dashed edge goes under the line too, where it gives the antialiased pixels of the line the tint, so its column
  // is left out
  const edgeX = 8 * lineStep;
  const lineTint = await readAreaColumns(page, '#probe', TINTED_LINE_PIXEL);
  const tintedLine = sumColumns(lineTint, 2 * lineStep, 4.5 * lineStep)
    + sumColumns(lineTint, 7.5 * lineStep, edgeX - 2) + sumColumns(lineTint, edgeX + 2, 10 * lineStep);
  check('a line runs over its hatch, the opaque core of the line untinted', tintedLine === 0, `${tintedLine}px tinted`);
  const lineEdges = await readAreaColumns(page, '#probe', OPAQUE_MAGENTA_PIXEL);
  const minEdgePixels = lineEdges.height * lineEdges.scale * MIN_EDGE_COVER;
  const edgeCover = Math.max(...lineEdges.columns) / (lineEdges.height * lineEdges.scale);
  const edgeRuns = findColumnRuns(lineEdges, minEdgePixels);
  const firstLabelEdges = findColumnRuns(await readAreaColumns(page, '#probe', OPAQUE_CYAN_PIXEL), minEdgePixels);
  check('a range with an edge draws a dashed rule at the start of its band, and one at the first label draws none',
    edgeRuns.length === 1 && Math.abs((edgeRuns[0][0] + edgeRuns[0][1]) / 2 - edgeX) <= PLOT_AREA_TOLERANCE
    && edgeCover <= MAX_EDGE_COVER && firstLabelEdges.length === 0,
    `edges ${formatRuns(edgeRuns)} for ${edgeX.toFixed(1)}, covering ${edgeCover.toFixed(2)} of the height, `
    + `at the first label ${formatRuns(firstLabelEdges)}`);
  const hatchAreaLeft = await readPlotAreaLeft(page);
  const { texts: hatchTexts } = await readProbeTexts(page);
  const estimatedTexts = hatchTexts.filter(({ text }) => text === 'Estimated');
  const estimatedX = hatchAreaLeft + edgeX + HATCH_LABEL_INSET;
  check('a range label stands at the start of its band in the range colour, and one wider than its band is dropped',
    estimatedTexts.length > 0 && estimatedTexts.every(({ x, width, color }) => (
      Math.abs(x - estimatedX) <= 1 && x + width <= hatchAreaLeft + 10 * lineStep && isTextColor(color, PROBE_MAGENTA)
    )) && !hatchTexts.some(({ text }) => text === 'Too long for a sliver'),
    `${JSON.stringify(estimatedTexts.slice(-1))} for x ${estimatedX.toFixed(1)}`);
  const hatchMinimap = hatchLine.locator('.lovely-chart--minimap');
  const minimapHatch = await countPickedPixels(hatchMinimap, CLEAR_HATCH_PIXEL);
  const minimapEdge = await countPickedPixels(hatchMinimap, OPAQUE_MAGENTA_PIXEL);
  check('the minimap hatches the ranges without their edges', minimapHatch > 0 && minimapEdge === 0,
    `${minimapHatch}px of hatch, ${minimapEdge}px of edges`);
  // The stripes of a narrowed window, then of one panned by a fraction of a step, each read over the redraws of a skin
  // switch: every stripe of a band rises from the bottom of the plot to its top a stripe step after the one before, on
  // the grid of the first label as the X-axis labels place it
  const readStripes = async () => {
    await startCanvasRecording(hatchLine);
    await switchSkinAndBack(page);
    const { paths, texts } = await stopCanvasRecording(page);
    const labelXs = texts.flatMap(({ text, x }) => {
      const [, day] = /^(\d+) Jan$/.exec(text) ?? [];
      return day ? [[Number(day) - 1, x]] : [];
    }).sort(([a], [b]) => a - b);
    const [firstIndex, firstX] = labelXs[0];
    const [lastIndex, lastX] = labelXs[labelXs.length - 1];
    const firstLabelX = firstX - firstIndex * (lastX - firstX) / (lastIndex - firstIndex);
    const bands = paths.filter((path) => path.length && path.every(({ alpha }) => alpha < 1));
    const segments = bands.flat();
    const isOnStripe = (a, b) => Math.abs(a - b) <= HATCH_STRIPE_TOLERANCE;
    const getPhase = (x) => {
      const phase = (((x - firstLabelX) % HATCH_STRIPE_STEP) + HATCH_STRIPE_STEP) % HATCH_STRIPE_STEP;
      return Math.min(phase, HATCH_STRIPE_STEP - phase);
    };
    return {
      bands: bands.length,
      isRising: segments.every(({ from, to }) => to && isOnStripe(from[1], PLOT_BOTTOM) && isOnStripe(to[1], PLOT_TOP)
        && isOnStripe(to[0] - from[0], PLOT_BOTTOM - PLOT_TOP)),
      isEven: bands.every((band) => band.every(({ from }, i) => (
        !i || isOnStripe(from[0] - band[i - 1].from[0], HATCH_STRIPE_STEP)
      ))),
      phase: Math.max(...segments.map(({ from }) => getPhase(from[0]))),
      firstLabelX,
    };
  };
  await hatchLine.scrollIntoViewIfNeeded();
  const lineMinimapWidth = (await hatchMinimap.boundingBox()).width;
  const lineEar = await hatchLine.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await drag(page, lineEar.x + lineEar.width / 2, lineEar.y + lineEar.height / 2, lineMinimapWidth * 0.35, 0);
  await waitForIdle(page, 600);
  const lineSlider = hatchLine.locator('.lovely-chart--minimap-slider-inner');
  const narrowSlider = await lineSlider.boundingBox();
  await drag(page, narrowSlider.x + narrowSlider.width / 2, narrowSlider.y + narrowSlider.height / 2,
    -lineMinimapWidth * 0.2, 0);
  await waitForIdle(page, 600);
  const narrowStripes = await readStripes();
  const pannedSlider = await lineSlider.boundingBox();
  await drag(page, pannedSlider.x + pannedSlider.width / 2, pannedSlider.y + pannedSlider.height / 2,
    lineMinimapWidth / (hatchLabels.length - 1) / 3, 0);
  await waitForIdle(page, 600);
  const pannedStripes = await readStripes();
  await unmountProbe(page);
  check('hatch stripes rise across the plot a stripe step apart, on the grid of the first label as the window pans',
    [narrowStripes, pannedStripes].every(({ bands, isRising, isEven, phase }) => (
      bands > 0 && isRising && isEven && phase <= HATCH_STRIPE_TOLERANCE
    )) && Math.abs(pannedStripes.firstLabelX - narrowStripes.firstLabelX) > 1,
    JSON.stringify({ narrowStripes, pannedStripes }));

  // A range past the first label, clamped to it, and one that runs backwards and one of no number, both dropped, all in
  // a colour of their own
  const hatchBarValues = [4, 10, 6, 10, 8, 10, 6, 10];
  await mountProbe(page, {
    config: {
      type: 'bar',
      title: 'Probe — Hatched bars',
      labels: hatchLabels.slice(0, hatchBarValues.length),
      datasets: [{ name: 'Bars', color: '#0000FF', values: hatchBarValues }],
      hatchedRanges: [
        { from: 2, to: 3, color: PROBE_MAGENTA },
        { from: -3, to: 1.4, color: PROBE_CYAN },
        { from: 5, to: 2, color: PROBE_CYAN },
        { from: NaN, to: 1, color: PROBE_CYAN },
      ],
    },
  });
  const readBarHatchRuns = async (bounds) => findColumnRuns(
    await readAreaColumns(page, '#probe', bounds), MIN_HATCH_COLUMN_PIXELS,
  );
  const barHatch = await readAreaColumns(page, '#probe', BAR_HATCH_PIXEL);
  const barRuns = findColumnRuns(barHatch, MIN_HATCH_COLUMN_PIXELS);
  const barColumn = barHatch.width / hatchBarValues.length;
  const expectedBarRuns = [[2 * barColumn, 4 * barColumn]];
  check('bars hatch the columns of a range over their fill', areRunsNear(barRuns, expectedBarRuns),
    `${formatRuns(barRuns)} for ${formatRuns(expectedBarRuns)}`);
  const clampedRuns = await readBarHatchRuns(BAR_CYAN_HATCH_PIXEL);
  const expectedClampedRuns = [[0, 2 * barColumn]];
  check('a range from before the first label hatches from it, and one backwards or of no number hatches nothing',
    areRunsNear(clampedRuns, expectedClampedRuns), `${formatRuns(clampedRuns)} for ${formatRuns(expectedClampedRuns)}`);
  await page.evaluate(() => window.probeChart.selectLabel(6));
  await waitForIdle(page, 500);
  const elsewhereFocusRuns = await readBarHatchRuns(BAR_HATCH_PIXEL);
  const elsewhereMaskedRuns = await readBarHatchRuns(MASKED_BAR_HATCH_PIXEL);
  await page.evaluate(() => window.probeChart.selectLabel(2));
  await waitForIdle(page, 500);
  const hatchedFocusRuns = await readBarHatchRuns(BAR_HATCH_PIXEL);
  const hatchedMaskedRuns = await readBarHatchRuns(MASKED_BAR_HATCH_PIXEL);
  await unmountProbe(page);
  const expectedFocusRuns = [[2 * barColumn, 3 * barColumn]];
  const expectedMaskedRuns = [[3 * barColumn, 4 * barColumn]];
  check('a focused bar dims a hatched column like the others, the mask over the hatch',
    elsewhereFocusRuns.length === 0 && areRunsNear(elsewhereMaskedRuns, expectedBarRuns)
    && areRunsNear(hatchedFocusRuns, expectedFocusRuns) && areRunsNear(hatchedMaskedRuns, expectedMaskedRuns),
    `focus elsewhere ${formatRuns(elsewhereFocusRuns)}, masked ${formatRuns(elsewhereMaskedRuns)}; `
    + `on the range ${formatRuns(hatchedFocusRuns)}, masked ${formatRuns(hatchedMaskedRuns)}`);

  const sharesHatch = await mountProbe(page, {
    config: {
      type: 'bar',
      title: 'Probe — Hatched shares',
      isStacked: true,
      labels: hatchLabels.slice(0, hatchBarValues.length),
      datasets: [
        { name: 'Blue', color: '#0000FF', values: hatchBarValues },
        { name: 'Green', color: '#00FF00', values: hatchBarValues },
      ],
      zoomToShares: true,
      circleLabelsAround: 0,
      initialZoom: 'last',
      hatchedRanges: [{
        from: 0, to: hatchBarValues.length - 1, label: 'Estimated', hasEdge: true, color: PROBE_MAGENTA,
      }],
    },
  });
  const zoomedHatch = await countPickedPixels(sharesHatch, ANY_HATCH_PIXEL);
  await sharesHatch.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2000);
  const overviewHatch = await countPickedPixels(sharesHatch, ANY_HATCH_PIXEL);
  await unmountProbe(page);
  check('a zoom into shares draws no hatch, and its overview hatches again', zoomedHatch === 0 && overviewHatch > 0,
    `${zoomedHatch}px zoomed, ${overviewHatch}px in the overview`);

  // An area hatches over its opaque fill and its border at the tone over fills, steps hatch the columns of a range at
  // the tone under lines, under their line, and a line of one label hatches its whole plot. The area runs high through
  // its band, so the fill is thick across it, and steeply, so its border crosses many rows.
  await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Hatched area',
      labels: hatchLabels,
      datasets: [{ name: 'Area', color: '#0000FF', values: [1, 9, 8, 10, 4, 10, 9, 8, 9, 10, 9] }],
      areaOpacity: 1,
      areaBorderColor: '#00FF00',
      hatchedRanges: [{ from: 3, to: 4, color: PROBE_MAGENTA }],
    },
  });
  const areaHatch = await readAreaColumns(page, '#probe', BAR_HATCH_PIXEL);
  const areaStep = areaHatch.width / (hatchLabels.length - 1);
  const areaBorder = await readAreaColumns(page, '#probe', HATCHED_BORDER_PIXEL);
  await unmountProbe(page);
  const areaRuns = findColumnRuns(areaHatch, MIN_HATCH_COLUMN_PIXELS);
  const expectedAreaRuns = [[2 * areaStep, 4.5 * areaStep]];
  const hatchedBorder = sumColumns(areaBorder, 2 * areaStep, 4.5 * areaStep);
  check('an area hatches a range over its fill and its border',
    areRunsNear(areaRuns, expectedAreaRuns) && hatchedBorder >= MIN_HATCHED_BORDER_PIXELS,
    `${formatRuns(areaRuns)} for ${formatRuns(expectedAreaRuns)}, ${hatchedBorder}px of hatched border`);
  await mountProbe(page, {
    config: {
      type: 'step',
      title: 'Probe — Hatched steps',
      labels: hatchLabels.slice(0, hatchBarValues.length),
      datasets: [{ name: 'Steps', color: '#0000FF', values: hatchBarValues }],
      hatchedRanges: [{ from: 2, to: 3, color: PROBE_MAGENTA }],
    },
  });
  const stepHatch = await readAreaColumns(page, '#probe', CLEAR_HATCH_PIXEL);
  const stepColumn = stepHatch.width / hatchBarValues.length;
  const stepTint = await readAreaColumns(page, '#probe', TINTED_LINE_PIXEL);
  await unmountProbe(page);
  const stepRuns = findColumnRuns(stepHatch, MIN_HATCH_COLUMN_PIXELS);
  const expectedStepRuns = [[2 * stepColumn, 4 * stepColumn]];
  const stepAlpha = readPeakAlpha(stepHatch, 2 * stepColumn, 4 * stepColumn);
  const tintedSteps = sumColumns(stepTint, 2 * stepColumn, 4 * stepColumn);
  check('steps hatch the columns of a range at the tone under lines, the opaque core of the line untinted',
    areRunsNear(stepRuns, expectedStepRuns) && stepAlpha <= MAX_UNDER_LINES_ALPHA && tintedSteps === 0,
    `${formatRuns(stepRuns)} for ${formatRuns(expectedStepRuns)} at alpha ${stepAlpha}, ${tintedSteps}px tinted`);
  await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Hatched single label',
      labels: hatchLabels.slice(0, 1),
      datasets: [{ name: 'Line', color: '#0000FF', values: [5] }],
      hatchedRanges: [{ from: 0, to: 0, color: PROBE_MAGENTA }],
    },
  });
  const singleHatch = await readAreaColumns(page, '#probe', CLEAR_HATCH_PIXEL);
  await unmountProbe(page);
  const singleRuns = findColumnRuns(singleHatch, MIN_HATCH_COLUMN_PIXELS);
  const expectedSingleRuns = [[0, singleHatch.width]];
  check('a line of one label hatches its whole plot', areRunsNear(singleRuns, expectedSingleRuns),
    `${formatRuns(singleRuns)} for ${formatRuns(expectedSingleRuns)}`);

  // A range at the first label with no colour of its own, an accruing one whose label fits its band but would run into
  // the label of the next, and one in a colour of each skin, which the minimap follows as the skin switches
  await recordProbeNumbers(page);
  const hatchLabelProbe = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Hatch labels',
      labels: hatchLabels.slice(0, 4),
      datasets: [{ name: 'Line', color: '#0000FF', values: [12, 18, 15, 20] }],
      withMinimap: true,
      minimapRange: 'full',
      hatchedRanges: [
        { from: 0, to: 0, label: 'First' },
        { from: 1, to: 1, isAccruing: true, label: ACCRUING_LABEL },
        { from: 2, to: 3, label: 'Estimated', color: { light: PROBE_MAGENTA, dark: PROBE_CYAN } },
      ],
    },
  });
  const labelProbeStep = (await readAreaColumns(page, '#probe', CLEAR_CYAN_PIXEL)).width / 3;
  const labelMinimap = hatchLabelProbe.locator('.lovely-chart--minimap');
  const readMinimapHatch = async () => ({
    day: await countPickedPixels(labelMinimap, CLEAR_HATCH_PIXEL),
    night: await countPickedPixels(labelMinimap, CLEAR_CYAN_PIXEL),
  });
  const nightMinimapHatch = await readMinimapHatch();
  let dayMinimapHatch;
  await startCanvasRecording(hatchLabelProbe);
  await switchSkinAndBack(page, async () => {
    dayMinimapHatch = await readMinimapHatch();
  });
  const labelDrawing = await stopCanvasRecording(page);
  const rangeLabels = labelDrawing.texts.filter(({ text }) => ['First', ACCRUING_LABEL, 'Estimated'].includes(text));
  const accruingWidth = await hatchLabelProbe.evaluate((el, [font, text]) => {
    const context = el.querySelector('canvas').getContext('2d');
    context.save();
    context.font = font;
    const { width } = context.measureText(text);
    context.restore();
    return width;
  }, [rangeLabels.find(({ text }) => text === 'Estimated')?.font, ACCRUING_LABEL]);
  await unmountProbe(page);
  const yLabels = labelDrawing.texts.filter(({ text }) => /^\d+$/.test(text));
  const yLabelEnd = Math.max(...yLabels.map(({ x, width }) => x + width));
  const firstLabels = rangeLabels.filter(({ text }) => text === 'First');
  check('a range label at the first label stands clear of the Y-axis labels on its row',
    firstLabels.length > 0 && firstLabels.every(({ x }) => x >= yLabelEnd + HATCH_LABEL_INSET),
    `at ${JSON.stringify(firstLabels.map(({ x }) => x))}, the Y-axis labels ending at ${yLabelEnd}`);
  const yLabelColors = new Set(yLabels.map(({ color }) => color));
  const firstLabelColors = [...new Set(firstLabels.map(({ color }) => color))];
  check('a range of no colour of its own labels in the Y-axis text colour of each skin',
    firstLabelColors.length === 2 && firstLabelColors.every((color) => yLabelColors.has(color)),
    `${JSON.stringify(firstLabelColors)} for ${JSON.stringify([...yLabelColors])}`);
  const isOverlapping = rangeLabels.some((a) => rangeLabels.some((b) => (
    a.text !== b.text && a.x < b.x + b.width && b.x < a.x + a.width
  )));
  check('an accruing range drops a label that would run into the label of the next, though it fits its own band',
    !rangeLabels.some(({ text }) => text === ACCRUING_LABEL) && rangeLabels.some(({ text }) => text === 'Estimated')
    && !isOverlapping && accruingWidth <= labelProbeStep - 2 * HATCH_LABEL_INSET,
    `${accruingWidth.toFixed(1)}px wide in a band of ${labelProbeStep.toFixed(1)}px, `
    + JSON.stringify(rangeLabels.map(({ text, x, width }) => [text, x, width])));
  check('the minimap hatches in the colour of each skin as the skin switches',
    nightMinimapHatch.night > 0 && nightMinimapHatch.day === 0
    && dayMinimapHatch.day > 0 && dayMinimapHatch.night === 0,
    JSON.stringify({ nightMinimapHatch, dayMinimapHatch }));

  await recordProbeNumbers(page);
  const hatchSparkline = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Hatched sparkline',
      isSparkline: true,
      labels: hatchLabels,
      datasets: [{ name: 'Line', color: '#0000FF', values: [5, 6, 5, 7, 6, 8, 7, 6, 7, 8, 7] }],
      hatchedRanges: [{ from: 8, to: 10, label: 'Estimated', color: PROBE_MAGENTA }],
    },
  });
  const sparklineHatch = await countPickedPixels(hatchSparkline, CLEAR_HATCH_PIXEL);
  const sparklineLabels = (await readProbeTexts(page)).texts.filter(({ text }) => text === 'Estimated');
  await unmountProbe(page);
  check('a sparkline hatches a labelled range without its label', sparklineHatch > 0 && sparklineLabels.length === 0,
    `${sparklineHatch}px of hatch, labels ${JSON.stringify(sparklineLabels)}`);
});

const isNear = (a, b) => Math.abs(a - b) <= PLOT_AREA_TOLERANCE;
const readForecastFit = (forecastChart) => forecastChart.evaluate((el, [hex, inset]) => {
  const host = el.parentElement;
  const badge = host.querySelector('.forecast-badge');
  const canvas = el.querySelector('canvas');
  const hostBox = host.getBoundingClientRect();
  const toHost = ({ left, top, right, bottom }) => ({
    left: left - hostBox.left - host.clientLeft,
    top: top - hostBox.top - host.clientTop,
    right: right - hostBox.left - host.clientLeft,
    bottom: bottom - hostBox.top - host.clientTop,
  });
  const [left, top, width, height] = ['left', 'top', 'width', 'height']
    .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
  const canvasBox = toHost(canvas.getBoundingClientRect());
  const scale = canvas.width / canvas.clientWidth;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const line = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let j = 0; j < data.length; j += 4) {
    if (data[j + 3] <= 100 || rgb.some((channel, k) => Math.abs(data[j + k] - channel) >= 24)) continue;
    const x = canvasBox.left + ((j / 4) % canvas.width) / scale;
    const y = canvasBox.top + Math.floor(j / 4 / canvas.width) / scale;
    line.left = Math.min(line.left, x);
    line.top = Math.min(line.top, y);
    line.right = Math.max(line.right, x + 1 / scale);
    line.bottom = Math.max(line.bottom, y + 1 / scale);
  }
  return {
    area: { left, top, right: left + width, bottom: top + height },
    areaInCanvas: left - canvasBox.left,
    badge: toHost(badge.getBoundingClientRect()),
    badgeCorner: { left: left + inset, bottom: top + height - inset },
    line,
    isBadgeBeforeChart: badge.nextElementSibling === el,
    skin: document.documentElement.classList.contains('theme-dark') ? 'night' : 'day',
  };
}, [FORECAST_LINE_COLOR, FORECAST_BADGE_INSET]);
section('A forecast week the chart hatches, and a badge over the plot by the plot-area variables (demo '
  + 'chart)', async ({ page, charts }) => {
  const forecastChart = charts.nth(FORECAST_CHART);
  await forecastChart.scrollIntoViewIfNeeded();
  const forecastFit = await readForecastFit(forecastChart);
  const { area: forecastArea, badge: forecastBadge, line: forecastLine } = forecastFit;
  check('the demo forecast badge stands at the bottom start of the plot area by its variables, under the chart',
    isNear(forecastBadge.left, forecastFit.badgeCorner.left)
    && isNear(forecastBadge.bottom, forecastFit.badgeCorner.bottom)
    && forecastFit.isBadgeBeforeChart,
    `badge ${formatBox(forecastBadge)}, area ${formatBox(forecastArea)}`);
  check('the plot area of the demo forecast frames its line',
    isNear(forecastLine.left, forecastArea.left) && isNear(forecastLine.right, forecastArea.right)
    && forecastLine.top >= forecastArea.top - PLOT_AREA_TOLERANCE
    && forecastLine.bottom <= forecastArea.bottom + PLOT_AREA_TOLERANCE,
    `line ${formatBox(forecastLine)}, area ${formatBox(forecastArea)}`);
  const forecastAccent = FORECAST_ACCENTS[forecastFit.skin];
  const forecastStep = (forecastArea.right - forecastArea.left) / (FORECAST_DAYS - 1);
  const forecastStart = (FORECAST_DAYS - FORECAST_WEEK - 1) * forecastStep;
  const forecastHatch = await readAreaColumns(page, '.forecast-chart',
    getColorBounds(forecastAccent, CLEAR_HATCH_PIXEL.alpha, HATCH_COLOR_TOLERANCE));
  const forecastRuns = findColumnRuns(forecastHatch, MIN_HATCH_COLUMN_PIXELS);
  const forecastEdges = await readAreaColumns(page, '.forecast-chart',
    getColorBounds(forecastAccent, OPAQUE_MAGENTA_PIXEL.alpha, HATCH_COLOR_TOLERANCE));
  const forecastEdgePixels = forecastEdges.height * forecastEdges.scale;
  const forecastEdgeRuns = findColumnRuns(forecastEdges, forecastEdgePixels * MIN_EDGE_COVER);
  const forecastEdgeCover = Math.max(...forecastEdges.columns) / forecastEdgePixels;
  const expectedForecastRuns = [[forecastStart, forecastHatch.width]];
  check('the demo forecast hatches its last week in the accent from the last actual day, with an edge there',
    areRunsNear(forecastRuns, expectedForecastRuns) && forecastEdgeRuns.length === 1
    && Math.abs((forecastEdgeRuns[0][0] + forecastEdgeRuns[0][1]) / 2 - forecastStart) <= PLOT_AREA_TOLERANCE
    && forecastEdgeCover <= MAX_EDGE_COVER,
    `hatch ${formatRuns(forecastRuns)} for ${formatRuns(expectedForecastRuns)}, edges ${formatRuns(forecastEdgeRuns)} `
    + `covering ${forecastEdgeCover.toFixed(2)} of the height`);
  // A change of skin redraws the plot
  await startCanvasRecording(forecastChart);
  await switchSkinAndBack(page);
  const forecastDrawing = await stopCanvasRecording(page);
  const forecastLabels = forecastDrawing.texts.filter(({ text }) => text === 'Forecast');
  const forecastLabelX = forecastFit.areaInCanvas + forecastStart + HATCH_LABEL_INSET;
  const isForecastLabelFont = (font) => ['500', `${DEFAULT_AXIS_FONT_SIZE}px`].every((part) => (
    font.split(' ').includes(part)
  ));
  check('the demo forecast labels the start of its band in the accent of each skin, at weight 500 in the axis font',
    Object.values(FORECAST_ACCENTS).every((hex) => forecastLabels.some(({ color }) => isTextColor(color, hex)))
    && forecastLabels.every(({ x, font }) => Math.abs(x - forecastLabelX) <= 1 && isForecastLabelFont(font)),
    `${JSON.stringify(forecastLabels)} for x ${forecastLabelX.toFixed(1)}`);
  await hoverWiggle(page, await page.locator('.forecast-badge').boundingBox(), 0.5, 0.5);
  const forecastBalloon = await forecastChart.locator('.lovely-chart--tooltip-balloon').evaluate((el) => ({
    isShown: el.classList.contains('lovely-chart--state-shown'),
    title: el.querySelector('.lovely-chart--tooltip-title').textContent,
  }));
  await page.mouse.move(5, 5);
  check('the pointer over the demo forecast badge reaches the tooltip', forecastBalloon.isShown,
    JSON.stringify(forecastBalloon));

  // --- Planned days hatched under steps from a dashed edge, and estimated months over bars (demo charts) ---
  // What a chart draws through a change of skin: the texts, the stripes of its hatch, which rise at 45° from the bottom
  // of the plot, and the vertical rules, which a hatch edge alone draws as a path of its own, with the start and the
  // width of the plot area in the canvas, the plot keeping a gutter on either side
  const readDemoHatch = async (chart) => {
    await chart.scrollIntoViewIfNeeded();
    await startCanvasRecording(chart);
    await switchSkinAndBack(page);
    const { texts, paths } = await stopCanvasRecording(page);
    const segments = paths.flat().filter(({ to }) => to);
    const canvasWidth = await chart.evaluate((el) => el.querySelector('canvas').clientWidth);
    return {
      texts,
      stripes: segments.filter(({ from, to }) => to[0] > from[0]
        && Math.abs((to[0] - from[0]) - (from[1] - to[1])) <= STRIPE_SLOPE_TOLERANCE),
      edges: [...new Set(segments.filter(({ from, to }) => from[0] === to[0]).map(({ from }) => from[0]))],
      areaLeft: GUTTER,
      areaWidth: canvasWidth - GUTTER * 2,
    };
  };
  const formatHatch = ({ texts, stripes, edges }, label) => JSON.stringify({
    labels: texts.filter(({ text }) => text === label).map(({ x, color }) => ({ x: Number(x.toFixed(1)), color })),
    stripes: stripes.length,
    alphas: [...new Set(stripes.map(({ alpha }) => alpha))],
    edges: edges.map((x) => Number(x.toFixed(1))),
  });
  const isLabelledInSkins = (labels) => Object.values(AXIS_TEXT_COLORS)
    .every((hex) => labels.some(({ color }) => isTextColor(color, hex)));
  const limitChart = charts.nth(LIMIT_CHART);
  const stepsHatch = await readDemoHatch(limitChart);
  const plannedStart = stepsHatch.areaLeft + (stepsHatch.areaWidth * (LIMIT_DAYS - PLANNED_DAYS)) / LIMIT_DAYS;
  const plannedLabels = stepsHatch.texts.filter(({ text }) => text === 'Planned');
  check('the demo steps hatch their planned days under the steps, from a dashed edge their label stands in from',
    stepsHatch.stripes.length > 0
    && stepsHatch.stripes.every(({ alpha }) => Math.abs(alpha - UNDER_LINES_HATCH_OPACITY) < 0.001)
    && stepsHatch.edges.length === 1 && Math.abs(stepsHatch.edges[0] - plannedStart) <= PLOT_AREA_TOLERANCE
    && plannedLabels.length > 0 && isLabelledInSkins(plannedLabels)
    && plannedLabels.every(({ x }) => Math.abs(x - (stepsHatch.edges[0] + HATCH_LABEL_INSET)) <= 1),
    `${formatHatch(stepsHatch, 'Planned')} for an edge at ${plannedStart.toFixed(1)}`);
  const spendingHatch = await readDemoHatch(charts.nth(SPENDING_CHART));
  const estimatedStart = spendingHatch.areaLeft
    + (spendingHatch.areaWidth * (SPENDING_MONTHS - ESTIMATED_MONTHS)) / SPENDING_MONTHS;
  const estimatedLabels = spendingHatch.texts.filter(({ text }) => text === 'Estimated');
  check('the demo spending hatches its estimated months over the bars, labelled in from their start, with no edge',
    spendingHatch.stripes.length > 0
    && spendingHatch.stripes.every(({ alpha }) => Math.abs(alpha - OVER_FILLS_HATCH_OPACITY) < 0.001)
    && spendingHatch.edges.length === 0 && estimatedLabels.length > 0 && isLabelledInSkins(estimatedLabels)
    && estimatedLabels.every(({ x }) => Math.abs(x - (estimatedStart + HATCH_LABEL_INSET)) <= PLOT_AREA_TOLERANCE),
    `${formatHatch(spendingHatch, 'Estimated')} for a start at ${estimatedStart.toFixed(1)}`);

  // --- Event lines: their place by chart kind and offset, the room above the Y range, their labels, their dashes,
  // their heads and hints, a pan and zooms ---
  const isRuleAt = (run, x) => Math.abs((run[0] + run[1]) / 2 - x) <= PLOT_AREA_TOLERANCE;
  const findRules = (columns) => findColumnRuns(columns, columns.height * columns.scale * MIN_EDGE_COVER);
  // The middle of the 1px rule the probe's canvas draws at `x`, in px from the left of the plot area
  const snapRuleX = async (x) => {
    const areaLeft = await readPlotAreaLeft(page);
    return Math.round(areaLeft + x) + 0.5 - areaLeft;
  };
  // The row through the middle of the head of the probe's rule at `x`: the middle of the rule, the span of the pixels
  // `bounds` pick, whether the ring around the head is opaque and clear of them, and whether the row past the ring is
  // clear, with whether `bounds` pick every pixel of the head clear of its antialiased edge
  const readPinHead = async (x, bounds) => {
    const centerX = await snapRuleX(x);
    const headY = PIN_HEAD_RADIUS + PIN_RING_WIDTH - PLOT_TOP;
    const row = await readCanvasRow(page, '#probe', headY, [centerX - PIN_ROW_REACH, centerX + PIN_ROW_REACH]);
    const innerReach = PIN_HEAD_RADIUS - PIN_HEAD_TOLERANCE;
    const innerRows = [];
    for (let rowShift = -innerReach; rowShift <= innerReach; rowShift++) {
      innerRows.push(await readCanvasRow(page, '#probe', headY + rowShift, [
        centerX - innerReach - PIN_HEAD_TOLERANCE / 2, centerX + innerReach + PIN_HEAD_TOLERANCE / 2,
      ]));
    }
    const isDiscWhole = innerRows.every((pixels, i) => pixels
      .filter(({ left, right }) => Math.hypot((left + right) / 2 - centerX, i - innerReach) <= innerReach)
      .every(({ rgba }) => isPickedPixel(rgba, bounds)));
    const picked = row.filter(({ rgba }) => isPickedPixel(rgba, bounds));
    const findReach = ({ left, right }) => [left, right].map((edge) => Math.abs(edge - centerX)).sort((a, b) => a - b);
    const ring = row.filter((pixel) => {
      const [near, far] = findReach(pixel);
      return near >= PIN_HEAD_RADIUS && far <= PIN_HEAD_RADIUS + PIN_RING_WIDTH;
    });
    const outside = row.filter((pixel) => findReach(pixel)[0] >= PIN_HEAD_RADIUS + PIN_RING_WIDTH + PIN_HEAD_TOLERANCE);
    return {
      centerX,
      left: Math.min(...picked.map(({ left }) => left)),
      right: Math.max(...picked.map(({ right }) => right)),
      isDiscWhole,
      isRingOpaque: ring.length > 0 && ring.every(({ rgba }) => rgba[3] >= 200 && !isPickedPixel(rgba, bounds)),
      isOutsideClear: outside.length > 0 && outside.every(({ rgba }) => rgba[3] === 0),
    };
  };
  const isPinHead = ({
    centerX, left, right, isDiscWhole, isRingOpaque, isOutsideClear,
  }) => isDiscWhole && isRingOpaque && isOutsideClear
    && Math.abs(left - (centerX - PIN_HEAD_RADIUS)) <= PIN_HEAD_TOLERANCE
    && Math.abs(right - (centerX + PIN_HEAD_RADIUS)) <= PIN_HEAD_TOLERANCE;
  const formatPinHead = ({
    centerX, left, right, isDiscWhole, isRingOpaque, isOutsideClear,
  }) => `${left.toFixed(1)} to ${right.toFixed(1)} about ${centerX.toFixed(1)}, disc `
    + `${isDiscWhole ? 'whole' : 'broken'}, ring ${isRingOpaque ? 'opaque' : 'missing'}, `
    + `${isOutsideClear ? 'clear' : 'painted'} past it`;
  // The notes the probe's tooltip shows, for the label `selectLabel()` selects, or for the one it shows
  const readHints = (labelIndex) => page.evaluate(async (index) => {
    if (index !== undefined) {
      window.probeChart.selectLabel(index);
      await window.idleTracker.wait(300);
    }
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    return {
      isShown: balloon.classList.contains('lovely-chart--state-shown'),
      notes: [...balloon.querySelector('.lovely-chart--tooltip-notes').children].map((line) => line.textContent),
    };
  }, labelIndex);
  const promoColumns = await readAreaColumns(page, '.forecast-chart',
    getColorBounds(AXIS_TEXT_COLORS[forecastFit.skin], AXIS_TEXT_ALPHA, COLOR_TOLERANCE));
  const promoRuns = findRules(promoColumns);
  const promoX = (FORECAST_PROMO_DAY + FORECAST_PROMO_OFFSET) * forecastStep;
  // The recording of the forecast section holds the plot drawn in each skin
  const promoLabels = forecastDrawing.texts.filter(({ text }) => text === 'Promo');
  check('the demo forecast marks a promotion halfway through its day by an event rule labelled in the axis text colour',
    promoRuns.length === 1 && isRuleAt(promoRuns[0], promoX)
    && Object.values(AXIS_TEXT_COLORS).every((hex) => promoLabels.some(({ color }) => isTextColor(color, hex))),
    `rules ${formatRuns(promoRuns)} for ${promoX.toFixed(1)}, labels ${JSON.stringify(promoLabels)}`);
  // The demo forecast pins the promotion by a head over the axis labels at the top of the canvas, the translucent axis
  // text colour of its rule over the opaque ring of the background, and notes it under the tooltip rows of its day
  // alone
  const promoHeadColor = parseHex(AXIS_TEXT_COLORS[forecastFit.skin]).map((channel, k) => (
    channel * AXIS_TEXT_OPACITY + parseHex(CHART_BACKGROUNDS[forecastFit.skin])[k] * (1 - AXIS_TEXT_OPACITY)
  ));
  const promoHead = await forecastChart.evaluate((el, { x, rgb, radius, tolerance }) => {
    const canvas = el.querySelector('canvas');
    const scale = canvas.width / canvas.clientWidth;
    const reach = Math.ceil((radius + 2) * scale);
    const { data } = canvas.getContext('2d')
      .getImageData(Math.round(x * scale) - reach, 0, reach * 2 + 1, Math.ceil(radius * 3 * scale));
    let count = 0;
    for (let j = 0; j < data.length; j += 4) {
      if (data[j + 3] >= 200 && rgb.every((channel, k) => Math.abs(data[j + k] - channel) <= tolerance)) count++;
    }
    return { count, minCount: Math.round((Math.PI * (radius * scale) ** 2) / 2) };
  }, {
    x: forecastFit.areaInCanvas + promoX,
    rgb: promoHeadColor,
    radius: PIN_HEAD_RADIUS,
    tolerance: PIN_HEAD_COLOR_TOLERANCE,
  });
  await forecastChart.scrollIntoViewIfNeeded();
  const forecastHostBox = await page.locator('.forecast-chart').boundingBox();
  const forecastAreaBox = {
    x: forecastHostBox.x + forecastFit.area.left,
    y: forecastHostBox.y + forecastFit.area.top,
    width: forecastFit.area.right - forecastFit.area.left,
    height: forecastFit.area.bottom - forecastFit.area.top,
  };
  const readDayNotes = async (labelIndex) => {
    await hoverWiggle(page, forecastAreaBox, labelIndex / (FORECAST_DAYS - 1), 0.5);
    return forecastChart.locator('.lovely-chart--tooltip-notes')
      .evaluate((el) => [...el.children].map((line) => line.textContent));
  };
  const promoDayNotes = await readDayNotes(FORECAST_PROMO_DAY);
  const otherDayNotes = [
    await readDayNotes(FORECAST_PROMO_DAY - 1), await readDayNotes(FORECAST_PROMO_DAY + 1),
  ];
  await page.mouse.move(5, 5);
  check('the demo forecast pins its promotion by a head over the axis labels, with a note under the rows of its day',
    promoHead.count >= promoHead.minCount && JSON.stringify(promoDayNotes) === JSON.stringify(FORECAST_PROMO_HINT)
    && otherDayNotes.every((notes) => notes.length === 0),
    JSON.stringify({ promoHead, promoDayNotes, otherDayNotes }));

  // The texts the probe prints, with their colour and whether they read bottom to top
  await page.evaluate(() => {
    const { fillText } = CanvasRenderingContext2D.prototype;
    window.eventTexts = [];
    window.stopEventTextRecording = () => {
      CanvasRenderingContext2D.prototype.fillText = fillText;
    };
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas.closest('#probe')) {
        window.eventTexts.push({ text: String(text), color: this.fillStyle, isRising: this.getTransform().b < 0 });
      }
      return fillText.call(this, text, ...args);
    };
  });
  const readEventTexts = () => page.evaluate(() => window.eventTexts.splice(0));
  const readLabelXs = (spots) => page.evaluate((labelSpots) => (
    labelSpots.map(([labelIndex, offset]) => window.probeChart.getLabelX(labelIndex, offset))
  ), spots);
  const eventDays = Array.from({ length: 11 }, (_, i) => Date.UTC(2026, 1, i + 1));
  const eventValues = [5, 6, 5, 7, 6, 8, 7, 6, 7, 8, 7];
  const tooLongEventLabel = 'A label longer than the plot is high, which no rule of it has the room to carry';
  await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Event lines',
      labels: eventDays,
      datasets: [{ name: 'Line', color: '#0000FF', values: eventValues }],
      eventLines: [
        { labelIndex: 1, label: tooLongEventLabel },
        { labelIndex: 3, label: 'Launch', color: PROBE_MAGENTA },
        { labelIndex: 6, label: 'Crowded', color: PROBE_CYAN },
        { labelIndex: 6, offset: 0.1, label: 'Crowding', color: PROBE_CYAN },
        { labelIndex: 8, offset: 0.5, color: PROBE_MAGENTA },
        { labelIndex: eventDays.length, label: 'Past the labels', color: PROBE_MAGENTA },
      ],
    },
  });
  const [launchX, halfwayX] = await readLabelXs([[3], [8, 0.5]]);
  const eventColumns = await readAreaColumns(page, '#probe', OPAQUE_MAGENTA_PIXEL);
  const eventRuns = findRules(eventColumns);
  check('event rules stand where `getLabelX()` places their labels and offsets, and one past the labels draws none',
    eventRuns.length === 2 && isRuleAt(eventRuns[0], launchX) && isRuleAt(eventRuns[1], halfwayX),
    `${formatRuns(eventRuns)} for ${launchX.toFixed(1)} and ${halfwayX.toFixed(1)}`);
  const launchRule = await readPickedBox(page, '#probe', OPAQUE_MAGENTA_PIXEL, [launchX - 1, launchX + 2]);
  check('an event rule runs from the bottom of the Y range through the room above it',
    launchRule.top <= 1 - PLOT_TOP && launchRule.bottom >= eventColumns.height - 1,
    `${formatBox(launchRule)} over an area ${eventColumns.height}px high`);
  const launchLabel = await readPickedBox(
    page, '#probe', OPAQUE_MAGENTA_PIXEL, [launchX - EVENT_LABEL_COLUMNS, launchX - 1],
  );
  const eventTexts = await readEventTexts();
  const launchTexts = eventTexts.filter(({ text }) => text === 'Launch');
  check('an event label reads bottom to top from the top of its rule, before it, in its colour',
    launchTexts.length > 0 && launchTexts.every(({ color, isRising }) => isRising && isTextColor(color, PROBE_MAGENTA))
    && launchLabel.right <= launchX - EVENT_LABEL_GAP / 2 && launchLabel.top < -PLOT_TOP / 2
    && launchLabel.bottom - launchLabel.top > launchLabel.right - launchLabel.left,
    `${formatBox(launchLabel)} beside ${launchX.toFixed(1)}, ${JSON.stringify(launchTexts.slice(-1))}`);
  const otherRuns = findRules(await readAreaColumns(page, '#probe', OPAQUE_CYAN_PIXEL));
  const eventTextSet = new Set(eventTexts.map(({ text }) => text));
  check('an event label crowded by that of a later rule, or longer than its rule, is dropped, and the rule stays',
    eventTextSet.has('Crowding') && !eventTextSet.has('Crowded') && !eventTextSet.has(tooLongEventLabel)
    && !eventTextSet.has('Past the labels') && otherRuns.length === 2,
    `rules ${formatRuns(otherRuns)}, labels ${JSON.stringify([...eventTextSet].filter((text) => /[a-z]/.test(text)))}`);
  await unmountProbe(page);

  await mountNotesProbe(page, {
    type: 'line',
    title: 'Probe — Event pins',
    labels: eventDays,
    // The top Y-axis label, 80, runs past the head at the start of the plot
    datasets: [{ name: 'Line', color: '#0000FF', values: eventValues.map((value) => value * 10) }],
    isKeyboardSelectable: true,
    hatchedRanges: [{ from: 7, to: 8, note: 'Estimated' }],
    eventLines: [
      { labelIndex: 0, color: PROBE_MAGENTA, withHead: true },
      { labelIndex: 1, color: PROBE_MAGENTA },
      { labelIndex: 2, color: PROBE_MAGENTA, isDashed: true },
      { labelIndex: 3, color: PROBE_MAGENTA, isDashed: true, isDotted: true },
      { labelIndex: 7, offset: 0.5, label: 'Pin', color: PROBE_CYAN, withHead: true, hint: 'Promo starts\nEstimated' },
      { labelIndex: 7, hint: 'Ends Sunday' },
    ],
  }, { 7: { notes: ['Resolved', 'Ends Sunday'] } });
  const [startPinX, solidX, dashedX, dottedX, pinX] = await readLabelXs([[0], [1], [2], [3], [7, 0.5]]);
  const ruleRuns = [];
  for (const x of [solidX, dashedX, dottedX]) {
    ruleRuns.push(await readColumnRuns(page, '#probe', OPAQUE_MAGENTA_PIXEL, await snapRuleX(x)));
  }
  const [solidRuns, dashedRuns, dottedRuns] = ruleRuns;
  // The runs down a rule repeat a dash and a gap, aside from the last, which the end of the rule cuts
  const isRunPattern = ({ runs }, [dash, gap]) => runs.length > 2 && runs.slice(0, -1).every(([start, end], i) => (
    Math.abs(end - start - dash) <= RULE_RUN_TOLERANCE && Math.abs(runs[i + 1][0] - end - gap) <= RULE_RUN_TOLERANCE
  ));
  check('an event rule is solid by default, from the top of the canvas to the bottom of the Y range',
    solidRuns.runs.length === 1 && solidRuns.runs[0][0] <= 1 - PLOT_TOP
    && solidRuns.runs[0][1] >= solidRuns.height - 1,
    `${formatRuns(solidRuns.runs.slice(0, 4))} over an area ${solidRuns.height}px high`);
  check('`isDashed` draws an event rule in the dashes of a dataset, and `isDotted` in its dots, `isDashed` or not',
    isRunPattern(dashedRuns, RULE_DASH) && isRunPattern(dottedRuns, RULE_DOT),
    `dashed ${formatRuns(dashedRuns.runs.slice(0, 4))}, dotted ${formatRuns(dottedRuns.runs.slice(0, 4))}`);
  const pinHead = await readPinHead(pinX, OPAQUE_CYAN_PIXEL);
  const solidHead = await readPinHead(solidX, OPAQUE_MAGENTA_PIXEL);
  check('`withHead` tops an event rule with a disc of its colour in a ring of the background colour, and none without',
    isPinHead(pinHead) && solidHead.right - solidHead.left <= 1,
    `pin ${formatPinHead(pinHead)}, rule ${formatPinHead(solidHead)}`);
  const headBottom = (PIN_HEAD_RADIUS + PIN_RING_WIDTH) * 2 - PLOT_TOP;
  const startPinHead = await readPinHead(startPinX, PURE_MAGENTA_PIXEL);
  const headRight = startPinHead.centerX + PIN_HEAD_RADIUS + PIN_RING_WIDTH + PIN_HEAD_TOLERANCE;
  const topYLabel = await readPickedBox(page, '#probe', PAINTED_PIXEL, [headRight, headRight + PIN_ROW_REACH]);
  // The top Y-axis label runs on past the ring of the head at the start of the plot, in its rows
  check('the head of an event rule at the start of the plot stands whole over the top Y-axis label',
    isPinHead({ ...startPinHead, isOutsideClear: true }) && topYLabel.count > 0 && topYLabel.top < headBottom,
    `${formatPinHead(startPinHead)}, the label beside it ${formatBox(topYLabel)}`);
  const pinLabel = await readPickedBox(
    page, '#probe', OPAQUE_CYAN_PIXEL, [pinX - EVENT_LABEL_COLUMNS, pinHead.centerX - PIN_HEAD_RADIUS - PIN_RING_WIDTH],
  );
  const pinTexts = (await readEventTexts()).filter(({ text }) => text === 'Pin');
  check('the label of a pinned event rule reads bottom to top beside it from under its head',
    pinTexts.length > 0 && pinTexts.every(({ color, isRising }) => isRising && isTextColor(color, PROBE_CYAN))
    && pinLabel.count > 0 && pinLabel.top >= headBottom && pinLabel.top <= headBottom + EVENT_LABEL_GAP
    && pinLabel.right <= pinHead.centerX - EVENT_LABEL_GAP / 2,
    `${formatBox(pinLabel)} beside ${pinHead.centerX.toFixed(1)}, under a head ending at ${headBottom}`);
  const pinNotes = [];
  for (const labelIndex of [2, 6, 7, 8]) {
    pinNotes.push(await readHints(labelIndex));
  }
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  const pinLayer = page.locator('#probe .lovely-chart--tooltip');
  await pinLayer.scrollIntoViewIfNeeded();
  await pinLayer.focus();
  for (const key of ['End', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
    await page.keyboard.press(key);
    await waitForIdle(page, 150);
  }
  await waitForIdle(page, 300);
  const keyedPinNotes = await readHints();
  await unmountProbe(page);
  const pinLabelNotes = ['Estimated', 'Promo starts', 'Ends Sunday', 'Resolved'];
  const shownPinNotes = JSON.stringify(pinNotes.map(({ notes }) => notes));
  // At labels 2, 6, 7 and 8: a dashed rule with no hint, the label before the range, the pin's label and the range
  check('an event hint notes its label alone, after range notes, before resolved ones, a line shown already left out',
    pinNotes.every(({ isShown }) => isShown)
    && shownPinNotes === JSON.stringify([[], [], pinLabelNotes, ['Estimated']]),
    JSON.stringify(pinNotes));
  check('the keys select the hint of an event rule with its label',
    keyedPinNotes.isShown && JSON.stringify(keyedPinNotes.notes) === JSON.stringify(pinLabelNotes),
    JSON.stringify(keyedPinNotes));

  const eventBarValues = [4, 10, 6, 10, 8, 10, 6, 10];
  await mountProbe(page, {
    config: {
      type: 'bar',
      title: 'Probe — Event lines over bars',
      labels: eventDays.slice(0, eventBarValues.length),
      datasets: [{ name: 'Bars', color: '#0000FF', values: eventBarValues }],
      isYAxisOutward: true,
      eventLines: [
        { labelIndex: 0, offset: 0, label: 'Start', color: PROBE_MAGENTA },
        { labelIndex: 3, color: PROBE_CYAN },
      ],
    },
  });
  const [columnStartX, columnCentreX] = await readLabelXs([[0, 0], [3]]);
  const barRuleColumns = await readAreaColumns(page, '#probe', OPAQUE_CYAN_PIXEL);
  const barRuleRuns = findRules(barRuleColumns);
  const barStartRuns = findRules(await readAreaColumns(page, '#probe', OPAQUE_MAGENTA_PIXEL));
  const eventBarWidth = barRuleColumns.width / eventBarValues.length;
  check('on bars an event rule stands at its column centre, or `offset` through its column from the start, over bars',
    barRuleRuns.length === 1 && isRuleAt(barRuleRuns[0], 3.5 * eventBarWidth) && isRuleAt(barRuleRuns[0], columnCentreX)
    && barStartRuns.length === 1 && isRuleAt(barStartRuns[0], 0) && isRuleAt(barStartRuns[0], columnStartX),
    `${formatRuns(barRuleRuns)} for ${columnCentreX.toFixed(1)}, ${formatRuns(barStartRuns)} for ${columnStartX}`);
  const barAreaLeft = await readPlotAreaLeft(page);
  const startLabel = await readPickedBox(
    page, '#probe', OPAQUE_MAGENTA_PIXEL, [columnStartX + 1, columnStartX + EVENT_LABEL_COLUMNS],
  );
  const columnEvents = await readPickedBox(page, '#probe', OPAQUE_MAGENTA_PIXEL, [-barAreaLeft, columnStartX - 1]);
  check('an event label that would cover the outward Y-label column reads after its rule',
    (await readEventTexts()).some(({ text }) => text === 'Start') && startLabel.count > 0
    && startLabel.left >= columnStartX + EVENT_LABEL_GAP / 2 && columnEvents.count === 0,
    `label ${formatBox(startLabel)}, ${columnEvents.count}px in the column`);
  await unmountProbe(page);

  const pannedEvents = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Panned event lines',
      labels: eventDays,
      datasets: [{ name: 'Line', color: '#0000FF', values: eventValues }],
      isYAxisOutward: true,
      withMinimap: true,
      minimapRange: [0.25, 0.75],
      eventLines: [
        { labelIndex: 2, offset: 0.3, color: PROBE_MAGENTA, withHead: true },
        { labelIndex: 4, color: PROBE_CYAN, withHead: true },
      ],
    },
  });
  const [hiddenEventX, shownEventX, nextLabelX] = await readLabelXs([[2, 0.3], [4], [5]]);
  // The hidden rule's x in the panned window, which `getLabelX()` leaves out of it
  const columnEventX = shownEventX - (4 - 2.3) * (nextLabelX - shownEventX);
  const pannedAreaLeft = await readPlotAreaLeft(page);
  const pannedRuns = findRules(await readAreaColumns(page, '#probe', OPAQUE_CYAN_PIXEL));
  const pannedHidden = await countPickedPixels(pannedEvents, OPAQUE_MAGENTA_PIXEL);
  check('a pan moves an event rule with its label, and the outward Y-label column hides one under it',
    pannedRuns.length === 1 && isRuleAt(pannedRuns[0], shownEventX) && hiddenEventX === undefined
    && columnEventX < -Y_AXIS_LABEL_GAP && columnEventX >= -pannedAreaLeft && pannedHidden === 0,
    `${formatRuns(pannedRuns)} for ${shownEventX.toFixed(1)}, ${pannedHidden}px of the rule at `
    + `${columnEventX.toFixed(1)}`);
  const pannedHead = await readPinHead(shownEventX, OPAQUE_CYAN_PIXEL);
  await pannedEvents.scrollIntoViewIfNeeded();
  const eventSlider = await pannedEvents.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, eventSlider.x + eventSlider.width / 2, eventSlider.y + eventSlider.height / 2, 40, 0);
  await waitForIdle(page, 600);
  const [draggedEventX] = await readLabelXs([[4]]);
  const draggedHead = await readPinHead(draggedEventX, OPAQUE_CYAN_PIXEL);
  const minimapHeads = await countPickedPixels(pannedEvents.locator('.lovely-chart--minimap'), OPAQUE_CYAN_PIXEL);
  await unmountProbe(page);
  check('the head of an event rule moves with it as the window pans, and the minimap draws none',
    isPinHead(pannedHead) && Math.abs(pannedHead.centerX - shownEventX) <= PLOT_AREA_TOLERANCE
    && isPinHead(draggedHead) && Math.abs(draggedHead.centerX - draggedEventX) <= PLOT_AREA_TOLERANCE
    && shownEventX - draggedEventX > PIN_ROW_REACH && minimapHeads === 0,
    `${formatPinHead(pannedHead)} for ${shownEventX.toFixed(1)}, then ${formatPinHead(draggedHead)} for `
    + `${draggedEventX.toFixed(1)}, ${minimapHeads}px on the minimap`);

  const sparkEvents = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Sparkline event lines',
      labels: eventDays,
      datasets: [{ name: 'Area', color: '#0000FF', values: eventValues }],
      isSparkline: true,
      plotHeight: 64,
      eventLines: [
        { labelIndex: 5, label: 'Spark', color: PROBE_MAGENTA },
        { labelIndex: eventDays.length - 1, offset: 0.5, color: PROBE_CYAN },
      ],
    },
  });
  const sparkRule = await countPickedPixels(sparkEvents, OPAQUE_MAGENTA_PIXEL);
  const sparkTexts = await readEventTexts();
  const [lastPointX] = await readLabelXs([[eventDays.length - 1]]);
  const lastPointRule = await readPickedBox(
    page, '#probe', OPAQUE_CYAN_PIXEL, [lastPointX - EVENT_LABEL_COLUMNS, lastPointX + EVENT_LABEL_COLUMNS],
  );
  await unmountProbe(page);
  check('a sparkline draws event rules without their labels',
    sparkRule > 0 && !sparkTexts.some(({ text }) => text === 'Spark'), `${sparkRule}px of the rule`);
  check('the last point of an area chart has no interval after it and keeps an event rule with an offset at the point',
    lastPointRule.count > 0
    && Math.abs((lastPointRule.left + lastPointRule.right) / 2 - lastPointX) <= PLOT_AREA_TOLERANCE,
    `${formatBox(lastPointRule)} for ${lastPointX.toFixed(1)}`);

  const sharesEvents = await mountProbe(page, {
    config: {
      type: 'bar',
      title: 'Probe — Event lines in shares',
      isStacked: true,
      labels: eventDays.slice(0, eventBarValues.length),
      datasets: [
        { name: 'Blue', color: '#0000FF', values: eventBarValues },
        { name: 'Green', color: '#00FF00', values: eventBarValues },
      ],
      zoomToShares: true,
      circleLabelsAround: 0,
      initialZoom: 'last',
      eventLines: [{ labelIndex: 2, label: 'Launch', color: PROBE_MAGENTA, withHead: true }],
    },
  });
  const zoomedEvents = await countPickedPixels(sharesEvents, OPAQUE_MAGENTA_PIXEL);
  await sharesEvents.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2000);
  const overviewEvents = await countPickedPixels(sharesEvents, OPAQUE_MAGENTA_PIXEL);
  const [overviewEventX] = await readLabelXs([[2]]);
  const overviewHead = await readPinHead(overviewEventX, OPAQUE_MAGENTA_PIXEL);
  await unmountProbe(page);
  await page.evaluate(() => window.stopEventTextRecording());
  check('a zoom into shares draws no event rule or head, and its overview draws them again',
    zoomedEvents === 0 && overviewEvents > 0 && isPinHead(overviewHead),
    `${zoomedEvents}px zoomed, ${overviewEvents}px in the overview, head ${formatPinHead(overviewHead)}`);

  // The data `onZoom` returns notes the tooltip by hints of its own
  const hintZoom = await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }],
    config: { eventLines: [{ labelIndex: LINES_ZOOM_LAST_LABEL_INDEX, hint: 'Launch day' }] },
    zoomConfig: { eventLines: [{ labelIndex: 12, hint: 'Launch hour' }] },
  });
  await hintZoom.scrollIntoViewIfNeeded();
  const hintZoomPlot = await hintZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, hintZoomPlot, 0.5, 0.5);
  await page.mouse.click(hintZoomPlot.x + hintZoomPlot.width / 2, hintZoomPlot.y + hintZoomPlot.height / 2);
  await waitForIdle(page, 2000);
  await page.mouse.move(5, 5);
  const zoomedHints = [await readHints(LINES_ZOOM_LAST_LABEL_INDEX), await readHints(12)];
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  await hintZoom.locator('.lovely-chart--header-zoom-out-control').first().click();
  await waitForIdle(page, 2000);
  const overviewHints = [await readHints(LINES_ZOOM_LAST_LABEL_INDEX)];
  await unmountProbe(page);
  const zoomHints = [...zoomedHints, ...overviewHints];
  check('the hints of the data `onZoom` returns note its labels in place of those of the overview, which come back',
    zoomHints.every(({ isShown }) => isShown)
    && JSON.stringify(zoomHints.map(({ notes }) => notes)) === JSON.stringify([[], ['Launch hour'], ['Launch day']]),
    JSON.stringify({ zoomedHints, overviewHints }));
});

section('`selectLabel()` from the page and `onSelectedIndexChange` (demo chart)', async ({ page, charts }) => {
  const pickerChart = charts.nth(DAY_PICKER_CHART);
  const pickerDays = page.locator('.day-picker-day');
  await page.locator('.day-picker').scrollIntoViewIfNeeded();
  const pickerDates = await page.locator('.day-picker-date').allTextContents();
  const readDayPicker = () => pickerChart.evaluate((el) => {
    const balloon = el.querySelector('.lovely-chart--tooltip-balloon');
    return {
      isShown: balloon.classList.contains('lovely-chart--state-shown'),
      title: balloon.querySelector('.lovely-chart--tooltip-title').textContent.trim(),
      marked: [...document.querySelectorAll('.day-picker-day[aria-current="date"] .day-picker-date')]
        .map((date) => date.textContent),
    };
  });
  const isPickedDay = (picked, i) => picked.isShown && pickerDates[i].endsWith(` ${picked.title}`)
    && JSON.stringify(picked.marked) === JSON.stringify([pickerDates[i]]);
  await pickerDays.nth(2).hover();
  await waitForIdle(page, 400);
  const hoveredDay = await readDayPicker();
  await pickerDays.nth(4).focus();
  await page.keyboard.press('Tab');
  await waitForIdle(page, 400);
  const focusedDay = await readDayPicker();
  const previousDayButton = page.locator('.day-picker-step').first();
  const nextDayButton = page.locator('.day-picker-step').last();
  const readSteppedDay = async (button) => {
    await button.click();
    await waitForIdle(page, 400);
    return readDayPicker();
  };
  const steppedBackDay = await readSteppedDay(previousDayButton);
  const steppedOnDay = await readSteppedDay(nextDayButton);
  const lastDay = await readSteppedDay(nextDayButton);
  const pastLastDay = await readSteppedDay(nextDayButton);
  check('a row of the demo list selects its day in the tooltip on hover, and onSelectedIndexChange marks it',
    isPickedDay(hoveredDay, 2), JSON.stringify(hoveredDay));
  check('the demo list selects a day on keyboard focus and steps the selection with its buttons up to the last day',
    isPickedDay(focusedDay, 5) && isPickedDay(steppedBackDay, 4) && isPickedDay(steppedOnDay, 5)
    && isPickedDay(lastDay, 6) && isPickedDay(pastLastDay, 6),
    JSON.stringify({ focusedDay, steppedBackDay, steppedOnDay, lastDay, pastLastDay }));
  // The pointer reaches the plot only on screen, which the scroll to the list under the chart can leave above it
  const pickerTooltip = pickerChart.locator('.lovely-chart--tooltip');
  await pickerTooltip.scrollIntoViewIfNeeded();
  const pickerPlot = await pickerTooltip.boundingBox();
  await hoverWiggle(page, pickerPlot, 0.2, 0.5);
  const pointedDay = await readDayPicker();
  await page.mouse.move(5, 5);
  await waitForIdle(page, 400);
  const leftDay = await readDayPicker();
  check('the pointer over the demo chart takes the selection over, and leaving the chart clears it',
    pointedDay.isShown && !pickerDates.some((date) => date.endsWith(` ${pointedDay.title}`))
    && !pointedDay.marked.length && !leftDay.isShown && !leftDay.marked.length,
    JSON.stringify({ pointedDay, leftDay }));
  // A listed day the pointer picks on the chart, which leaves the tooltip as the pointer leaves for a button
  await hoverWiggle(page, pickerPlot, 0.9, 0.5);
  const pointedListedDay = await readDayPicker();
  const pointedListIndex = pickerDates.findIndex((date) => date.endsWith(` ${pointedListedDay.title}`));
  await page.mouse.move(5, 5);
  await waitForIdle(page, 400);
  const stepFromPointedDay = await readSteppedDay(previousDayButton);
  check('the demo buttons step from a day the pointer picked on the chart after it leaves',
    pointedListIndex > 0 && isPickedDay(stepFromPointedDay, pointedListIndex - 1),
    JSON.stringify({ pointedListedDay, stepFromPointedDay }));

  // The plot of the demo day picker takes the keys, and its list marks the day they select
  await pickerChart.locator('.lovely-chart--tooltip').focus();
  await page.keyboard.press('End');
  await waitForIdle(page, 300);
  const keyEndDay = await readDayPicker();
  await page.keyboard.press('ArrowLeft');
  await waitForIdle(page, 300);
  const keySteppedDay = await readDayPicker();
  await page.evaluate(() => document.activeElement.blur());
  check('the arrow keys on the plot of the demo day picker step its selection, and its list marks the day',
    isPickedDay(keyEndDay, 6) && isPickedDay(keySteppedDay, 5), JSON.stringify({ keyEndDay, keySteppedDay }));
});

section('A right-to-left page (demo chart)', async ({ page, charts }) => {
  const rtlChart = charts.nth(RTL_CHART);
  await rtlChart.scrollIntoViewIfNeeded();
  const rtlButton = rtlChart.locator('.lovely-chart--button').first();
  await startCanvasRecording(rtlChart);
  await rtlButton.click();
  await waitForIdle(page, 600);
  await rtlButton.click();
  await waitForIdle(page, 600);
  const rtlDrawing = await stopCanvasRecording(page);
  await hoverWiggle(page, await rtlChart.locator('.lovely-chart--tooltip').boundingBox(), 0.62, 0.5);
  const rtlTooltipNumbers = await readNegativeTooltipNumbers(rtlChart);
  const rtlDates = await readRightToLeftWords(rtlChart, [
    '.lovely-chart--header-caption', '.lovely-chart--tooltip-title > span:not(.lovely-chart--tooltip-title-total)',
  ]);
  await page.mouse.move(5, 5);
  const rtlYLabels = [...new Set(rtlDrawing.texts.filter(({ text }) => /^-\d/.test(text))
    .map(({ text, direction }) => `${text} ${direction}`))];
  const rtlXLabels = [...new Set(rtlDrawing.texts.filter(({ text }) => !/^-?[\d.]+K?$/.test(text))
    .map(({ text, direction }) => `${text} ${direction}`))];
  check('the right-to-left demo chart puts the signs of its Y-axis labels and tooltip numbers before the digits',
    rtlYLabels.length > 0 && rtlYLabels.every((label) => label.endsWith(' ltr'))
    && rtlTooltipNumbers.length > 0 && rtlTooltipNumbers.every(({ text, shown }) => shown === text.trim()),
    JSON.stringify({ rtlYLabels, rtlTooltipNumbers }));
  check('the right-to-left demo chart reads its Hebrew dates in order on the axis, the caption and the tooltip title',
    rtlXLabels.length > 0 && rtlXLabels.every((label) => /^\d+ ינו׳ rtl$/.test(label))
    && rtlDates.every(({ isRightToLeft }) => isRightToLeft),
    JSON.stringify({ rtlXLabels, rtlDates }));
});

section('A stack beside a second Y axis (demo chart)', async ({ page, charts }) => {
  const twoAxesChart = charts.nth(TWO_AXES_CHART);
  await twoAxesChart.scrollIntoViewIfNeeded();
  await startCanvasRecording(twoAxesChart);
  await switchSkinAndBack(page);
  const twoAxesDrawing = await stopCanvasRecording(page);
  const twoAxesWidth = await twoAxesChart.evaluate((el) => el.querySelector('canvas').clientWidth);
  const shareAxisLabels = twoAxesDrawing.texts.filter(({ color }) => isTextColor(color, TWO_AXES_SHARE_COLOR));
  const stackAxisLabels = twoAxesDrawing.texts.filter(({ text }) => /^\d+K$/.test(text));
  check('the demo stack labels the axis of the share at the right in its colour, and its own in thousands at the left',
    shareAxisLabels.length > 0 && shareAxisLabels.every(({ text, x }) => /^\d+$/.test(text) && x > twoAxesWidth / 2)
    && stackAxisLabels.length > 0
    && stackAxisLabels.every(({ color, x }) => !isTextColor(color, TWO_AXES_SHARE_COLOR) && x < twoAxesWidth / 2),
    JSON.stringify({ shareAxisLabels: shareAxisLabels.slice(0, 4), stackAxisLabels: stackAxisLabels.slice(0, 4) }));
  const twoAxesPaint = {
    share: (await findColor(twoAxesChart, parseHex(TWO_AXES_SHARE_COLOR))).count,
    apples: (await findColor(twoAxesChart, parseHex(TWO_AXES_APPLES_COLOR))).count,
  };
  check('the demo stack draws the share of apples as a line over the bars, by `datasets[*].type`',
    twoAxesPaint.share > 0 && twoAxesPaint.apples > MIN_BARS_PER_LINE_PIXEL * twoAxesPaint.share,
    JSON.stringify(twoAxesPaint));
  await hoverWiggle(page, await twoAxesChart.locator('.lovely-chart--tooltip').boundingBox(), 0.5, 0.5);
  const twoAxesRows = await twoAxesChart.locator('.lovely-chart--tooltip-balloon').evaluate((el) => (
    [...el.querySelectorAll('.lovely-chart--tooltip-dataset[data-present="true"]')].map((row) => ({
      name: row.firstElementChild.classList.contains('lovely-chart--tooltip-swatch')
        ? row.querySelector('.lovely-chart--dataset-title').textContent
        : row.firstElementChild.textContent,
      value: Number(row.querySelector('.lovely-chart--tooltip-dataset-value').textContent.replace(/,/g, '')),
    }))
  ));
  await page.mouse.move(5, 5);
  const twoAxesValues = Object.fromEntries(twoAxesRows.map(({ name, value }) => [name, value]));
  const fruitTotal = twoAxesValues.Apples + twoAxesValues.Oranges + twoAxesValues.Lemons;
  check('the demo stack totals its three fruits alone, beside the share of apples in them',
    twoAxesRows.length === 5 && twoAxesValues.Total === fruitTotal
    && twoAxesValues['Apples, %'] === Math.round((twoAxesValues.Apples / fruitTotal) * 1000) / 10,
    JSON.stringify(twoAxesRows));
});

section('A readout of the page in place of the balloon, the bars and swatches in colours of the page (demo '
  + 'chart)', async ({ page }) => {
  const readoutChart = page.locator('.readout-chart .lovely-chart--container');
  const readoutLayer = readoutChart.locator('.lovely-chart--tooltip');
  // The readout, the balloon, and the colours of the legend buttons and the readout
  // swatches as the canvas paints them, `color-mix()` included
  const readReadout = () => page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const toRgb = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const host = document.querySelector('.readout-chart');
    const readLine = (line) => line && [...line.children].map((part) => part.textContent);
    const balloon = host.querySelector('.lovely-chart--tooltip-balloon');
    return {
      hint: host.querySelector('.readout-hint')?.textContent,
      title: readLine(host.querySelector('.readout-title')),
      rows: [...host.querySelectorAll('.readout-row')].map(readLine),
      comparison: readLine(host.querySelector('.readout-comparison')),
      tone: host.querySelector('.readout-change')?.dataset.tone,
      balloonTitle: balloon.querySelector('.lovely-chart--tooltip-title').textContent.trim(),
      isBalloonShown: balloon.classList.contains('lovely-chart--state-shown'),
      balloonDisplay: getComputedStyle(balloon).display,
      legend: [...host.querySelectorAll('.lovely-chart--button')]
        .map((button) => toRgb(getComputedStyle(button).backgroundColor)),
      swatches: [...host.querySelectorAll('.readout-swatch')]
        .map((swatch) => toRgb(getComputedStyle(swatch).backgroundColor)),
      skin: document.documentElement.classList.contains('theme-dark') ? 'night' : 'day',
    };
  });
  const getReadoutColors = (skin) => {
    const accent = parseHex(PAGE_ACCENTS[skin]);
    const background = parseHex(PAGE_BACKGROUNDS[skin]);
    return READOUT_ACCENT_SHARES.map((share) => accent.map((channel, k) => (
      Math.round(channel * share + background[k] * (1 - share))
    )));
  };
  const areColorsNear = (colors, expected) => colors.length === expected.length
    && colors.every((color, i) => color.every((channel, k) => Math.abs(channel - expected[i][k]) <= MIX_TOLERANCE));
  const parseReadoutNumber = (text = '') => Number(text.replace(/,/g, ''));
  await readoutChart.scrollIntoViewIfNeeded();
  const idleReadout = await readReadout();
  const readoutBox = await readoutLayer.boundingBox();
  await hoverWiggle(page, readoutBox, 0.5, 0.5);
  const hoveredReadout = await readReadout();
  await page.mouse.move(5, 5);
  await waitForIdle(page, 300);
  const leftReadout = await readReadout();
  const nightAccentBars = await findColor(readoutChart, parseHex(PAGE_ACCENTS.night), [0, 1], 6);
  const readoutSum = hoveredReadout.rows.reduce((sum, [, value]) => sum + parseReadoutNumber(value), 0);
  const readoutTotal = parseReadoutNumber(hoveredReadout.title?.[1]);
  const [previousText, changeText = ''] = (hoveredReadout.comparison?.[1] ?? '').split(' ');
  const previousTotal = parseReadoutNumber(previousText);
  const readoutChange = Number(changeText.replace('−', '-').replace('%', ''));
  check('the demo reads the selected day out on the page in place of the hidden balloon, and a hint while none is',
    idleReadout.hint !== undefined && leftReadout.hint !== undefined && hoveredReadout.hint === undefined
    && hoveredReadout.isBalloonShown && hoveredReadout.balloonDisplay === 'none'
    && hoveredReadout.title?.[0] === hoveredReadout.balloonTitle
    && JSON.stringify(hoveredReadout.rows.map(([name]) => name)) === '["Apples","Oranges","Lemons"]'
    && readoutTotal === readoutSum && hoveredReadout.comparison?.[0] === 'Two weeks before'
    && Math.abs(readoutChange - ((readoutTotal - previousTotal) / previousTotal) * 100) < 0.06
    && hoveredReadout.tone === (readoutChange < 0 ? 'negative' : 'positive'),
    JSON.stringify({ idleReadout: idleReadout.hint, hoveredReadout, leftReadout: leftReadout.hint }));

  // The arrow keys step the selection of the focused plot, and a dataset hidden in the legend leaves the readout
  await readoutLayer.focus();
  await page.keyboard.press('End');
  await waitForIdle(page, 300);
  const lastDayReadout = await readReadout();
  await page.keyboard.press('ArrowLeft');
  await waitForIdle(page, 300);
  const steppedReadout = await readReadout();
  const lemonsButton = readoutChart.locator('.lovely-chart--button').last();
  await lemonsButton.focus();
  await page.keyboard.press('Enter');
  await waitForIdle(page, 600);
  const filteredReadout = await readReadout();
  await page.keyboard.press('Enter');
  await waitForIdle(page, 600);
  await page.mouse.move(5, 5);
  check('the demo readout follows the keys on the focused plot, and leaves out a dataset hidden in the legend',
    lastDayReadout.title?.[0] === lastDayReadout.balloonTitle
    && steppedReadout.title?.[0] === steppedReadout.balloonTitle
    && steppedReadout.title[0] !== lastDayReadout.title[0]
    && JSON.stringify(filteredReadout.rows?.map(([name]) => name)) === '["Apples","Oranges"]',
    JSON.stringify({ lastDayReadout, steppedReadout, filteredReadout }));

  // The colours of the page's variables follow its skin, on the canvas, the legend and the readout alike
  let dayReadout;
  let dayAccentBars;
  let dayNightAccentBars;
  await switchSkinAndBack(page, async () => {
    await hoverWiggle(page, readoutBox, 0.5, 0.5);
    dayReadout = await readReadout();
    await page.mouse.move(5, 5);
    await waitForIdle(page, 300);
    dayAccentBars = await findColor(readoutChart, parseHex(PAGE_ACCENTS.day), [0, 1], 6);
    dayNightAccentBars = await findColor(readoutChart, parseHex(PAGE_ACCENTS.night), [0, 1], 6);
  });
  check('the demo readout chart takes its colours from variables of the page, `var()` and `color-mix()`, in each skin',
    hoveredReadout.skin === 'night' && dayReadout.skin === 'day'
    && areColorsNear(hoveredReadout.legend, getReadoutColors('night'))
    && areColorsNear(hoveredReadout.swatches, getReadoutColors('night'))
    && areColorsNear(dayReadout.legend, getReadoutColors('day'))
    && areColorsNear(dayReadout.swatches, getReadoutColors('day'))
    && nightAccentBars.count > 1000 && dayAccentBars.count > 1000 && dayNightAccentBars.count < 50,
    JSON.stringify({
      night: hoveredReadout.legend, nightSwatches: hoveredReadout.swatches, day: dayReadout.legend,
      daySwatches: dayReadout.swatches, bars: [nightAccentBars.count, dayAccentBars.count, dayNightAccentBars.count],
    }));
});

section('A skeleton while the data loads, and a reload that shows it again (demo chart)', async ({ page }) => {
  const skeletonChart = page.locator('.skeleton-chart .lovely-chart--container');
  const reloadButton = page.locator('.reload-button');
  const readSkeleton = () => page.evaluate(() => {
    const host = document.querySelector('.skeleton-chart');
    const chart = host.querySelector('.lovely-chart--container');
    const button = host.querySelector('.reload-button');
    return {
      isSkeleton: chart.classList.contains('lovely-chart--state-skeleton'),
      isInert: chart.inert,
      color: getComputedStyle(chart).getPropertyValue('--skeleton-color').replace(/\s/g, ''),
      pills: chart.querySelectorAll('.lovely-chart--tools .lovely-chart--button').length,
      button: [button.disabled, button.textContent],
      skin: document.documentElement.classList.contains('theme-dark') ? 'night' : 'day',
    };
  });
  // The share of the plot canvas the skeleton tint of the skin covers
  const readSkeletonCover = (skin) => skeletonChart.evaluate((el, [{ red, green, blue, alpha }]) => {
    const canvas = el.querySelector(':scope > canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let j = 0; j < data.length; j += 4) {
      if ([red, green, blue, alpha].every(([min, max], k) => data[j + k] >= min && data[j + k] <= max)) count++;
    }
    return count / (canvas.width * canvas.height);
  }, [getColorBounds(SKELETON_TINTS[skin].hex, SKELETON_TINTS[skin].alpha, HATCH_COLOR_TOLERANCE)]);
  // A reload shows the skeleton at once, and the data once it arrives
  const reloadSkeleton = async () => {
    await reloadButton.click();
    // eslint-disable-next-line no-restricted-syntax -- reads the skeleton while the reload holds the data back
    await sleep(200);
    const loading = await readSkeleton();
    loading.cover = await readSkeletonCover(loading.skin);
    await waitForIdle(page, MIN_LOADING_TIME + 800);
    const loaded = await readSkeleton();
    loaded.lines = (await findColor(skeletonChart, parseHex(LOADED_LINE_COLOR))).count;
    return { loading, loaded };
  };
  const isSkeletonShown = ({ isSkeleton, isInert, color, pills, button, skin, cover }) => isSkeleton && isInert
    && color === SKELETON_TINTS[skin].css && pills === 3 && button[0] && button[1] === 'Loading…'
    && cover >= MIN_SKELETON_COVER;
  const isDataShown = ({ isSkeleton, isInert, button, lines }) => !isSkeleton && !isInert && !button[0]
    && button[1] === 'Reload the data' && lines > 100;
  await skeletonChart.scrollIntoViewIfNeeded();
  const firstLoaded = await readSkeleton();
  firstLoaded.lines = (await findColor(skeletonChart, parseHex(LOADED_LINE_COLOR))).count;
  const nightReload = await reloadSkeleton();
  let dayReload;
  await switchSkinAndBack(page, async () => {
    dayReload = await reloadSkeleton();
  });
  check('the demo skeleton chart shows its data once it loads, and the skeleton in the tint of each skin on a reload',
    isDataShown(firstLoaded) && isSkeletonShown(nightReload.loading) && isDataShown(nightReload.loaded)
    && isSkeletonShown(dayReload.loading) && isDataShown(dayReload.loaded),
    JSON.stringify({ firstLoaded, nightReload, dayReload }));
});

section('Small multiples: the axes and the plot alone, titled and keyed by the page (demo '
  + 'charts)', async ({ page }) => {
  await page.locator('.multiples').scrollIntoViewIfNeeded();
  const multiples = await page.locator('.multiples').evaluate(async (el) => {
    const { datasets } = await (await fetch('./data/areas-absolute.json')).json();
    return {
      names: [...el.querySelectorAll('.multiple-name')].map((name) => name.textContent),
      values: [...el.querySelectorAll('.multiple-value')].map((value) => value.textContent),
      latest: datasets.map(({ values }) => values.at(-1).toLocaleString('en-US')),
      legends: el.querySelectorAll('.lovely-chart--tools').length,
      charts: [...el.querySelectorAll('.lovely-chart--container')].map((chart) => {
        const box = chart.getBoundingClientRect();
        return {
          isWithoutHeader: chart.classList.contains('lovely-chart--container-no-header'),
          plotTop: chart.querySelector(':scope > canvas').getBoundingClientRect().top - box.top,
          hasTooltip: Boolean(chart.querySelector('.lovely-chart--tooltip')),
          label: chart.querySelector('[role="img"]').getAttribute('aria-label'),
        };
      }),
    };
  });
  const multipleLines = [];
  for (let i = 0; i < multiples.charts.length; i++) {
    multipleLines.push((await findColor(
      page.locator('.multiples .lovely-chart--container').nth(i), parseHex(MULTIPLE_COLOR),
    )).count);
  }
  check('the demo multiples draw the plot alone, from the top of each chart, with no header, tooltip or legend',
    multiples.charts.length === MULTIPLE_FRUITS.length && multiples.legends === 0
    && multiples.charts.every(({ isWithoutHeader, plotTop, hasTooltip }) => isWithoutHeader && !hasTooltip
      && Math.abs(plotTop - MULTIPLE_PLOT_MARGIN_TOP) <= 1)
    && multipleLines.every((count) => count > 100),
    JSON.stringify({ charts: multiples.charts, legends: multiples.legends, multipleLines }));
  check('the page titles each demo multiple with its latest value, and names its plot',
    JSON.stringify(multiples.names) === JSON.stringify(MULTIPLE_FRUITS)
    && JSON.stringify(multiples.values) === JSON.stringify(multiples.latest.slice(0, MULTIPLE_FRUITS.length))
    && multiples.charts.every(({ label }, i) => label.startsWith(`${MULTIPLE_FRUITS[i]}, `)),
    JSON.stringify({
      names: multiples.names, values: multiples.values, labels: multiples.charts.map(({ label }) => label),
    }));
});

section('Selection, legend callbacks and the plot height property', async ({ page }) => {
  await page.evaluate(() => {
    window.probeLog = [];
  });
  const driven = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.setProperty('--lovely-chart-plot-height', '12.5rem');
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Driven from outside',
      labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', values: [1, 2, 3, 4, 5] }, { name: 'B', values: [5, 4, 3, 2, 1] }],
      onSelectedIndexChange: (index) => window.probeLog.push(['selected', index ?? 'none']),
      onHiddenSeriesChange: (names, indexes) => window.probeLog.push(['hidden', names.join(), indexes.join()]),
    });
    await window.idleTracker.wait(1200);
    window.probeChart.selectLabel(3);
    await window.idleTracker.wait(300);
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    const isShown = balloon.classList.contains('lovely-chart--state-shown');
    element.querySelector('.lovely-chart--button').click();
    await window.idleTracker.wait(300);
    return {
      isShown,
      height: element.querySelector('canvas').clientHeight,
      remHeight: 12.5 * parseFloat(getComputedStyle(document.documentElement).fontSize),
      log: window.probeLog,
    };
  });
  check('selectLabel shows the tooltip and reports the index', driven.isShown && driven.log[0]?.[1] === 3,
    JSON.stringify(driven.log));
  check('a legend toggle reports the hidden datasets',
    JSON.stringify(driven.log.find(([kind]) => kind === 'hidden')) === JSON.stringify(['hidden', 'A', '0']),
    JSON.stringify(driven.log));
  check('the plot height follows --lovely-chart-plot-height', driven.height === driven.remHeight,
    `${driven.height}px of ${driven.remHeight}px`);

  // The pointer crossing the chart's header, outside its plot, leaves a called selection in place
  const drivenHeader = await page.locator('#probe .lovely-chart--header-title').boundingBox();
  await page.mouse.move(drivenHeader.x + 2, drivenHeader.y + drivenHeader.height / 2);
  await page.mouse.move(drivenHeader.x + 30, drivenHeader.y + drivenHeader.height / 2, { steps: 5 });
  await waitForIdle(page, 300);
  const heldSelection = await page.evaluate(async () => {
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const isHeld = balloon.classList.contains('lovely-chart--state-shown');
    const heldLog = window.probeLog.filter(([kind]) => kind === 'selected');
    window.probeChart.selectLabel(undefined);
    await window.idleTracker.wait(300);
    return {
      isHeld,
      heldLog,
      isCleared: !balloon.classList.contains('lovely-chart--state-shown'),
      clearedLog: window.probeLog.filter(([kind]) => kind === 'selected'),
    };
  });
  check('a called selection holds while the pointer moves elsewhere',
    heldSelection.isHeld && JSON.stringify(heldSelection.heldLog) === '[["selected",3]]',
    JSON.stringify(heldSelection.heldLog));
  check('selectLabel(undefined) clears the selection and reports it',
    heldSelection.isCleared && JSON.stringify(heldSelection.clearedLog) === '[["selected",3],["selected","none"]]',
    JSON.stringify(heldSelection.clearedLog));
  await unmountProbe(page);

  // A callback can destroy or rebuild the chart that calls it, which then leaves alone what the callback did
  const callbackRebuilds = await page.evaluate(async ({ labels, newLabels }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const buildParams = (length, onSelectedIndexChange) => ({
      type: 'bar',
      isStacked: true,
      title: 'Probe — Rebuilt by a callback',
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [
        { name: 'A', color: '#3497ED', values: Array.from({ length }, (_, i) => 10 + (i % 4) * 10) },
        { name: 'B', color: '#F34C44', values: Array.from({ length }, (_, i) => 20 + (i % 3) * 10) },
      ],
      onSelectedIndexChange,
    });
    const readError = (act) => {
      try {
        act();
        return 'none';
      } catch (error) {
        return error.message;
      }
    };

    let chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index !== undefined) chart.destroy();
    }));
    await window.idleTracker.wait(800);
    const selectError = readError(() => chart.selectLabel(labels - 1));
    const selectChildren = element.childElementCount;

    // `update()` reports the end of the selection before it rebuilds the chart
    chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index === undefined) chart.destroy();
    }));
    await window.idleTracker.wait(800);
    chart.selectLabel(labels - 1);
    const updateError = readError(() => chart.update(buildParams(newLabels)));
    const updateChildren = element.childElementCount;

    let isUpdated = false;
    chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index === undefined || isUpdated) return;
      isUpdated = true;
      chart.update(buildParams(newLabels));
    }));
    await window.idleTracker.wait(800);
    const rebuildError = readError(() => chart.selectLabel(labels - 1));
    await window.idleTracker.wait(1200);
    const canvas = element.querySelector('.lovely-chart--container > canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let fullColorPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 0x34 && data[i + 1] === 0x97 && data[i + 2] === 0xED && data[i + 3] === 255) {
        fullColorPixels++;
      }
    }
    chart.destroy();
    element.remove();

    return {
      selectError, selectChildren, updateError, updateChildren, rebuildError, isUpdated, fullColorPixels,
    };
  }, { labels: CALLBACK_CHART_LABELS, newLabels: CALLBACK_UPDATE_LABELS });
  check('destroy() from onSelectedIndexChange of a bar chart throws nothing and leaves nothing mounted',
    callbackRebuilds.selectError === 'none' && callbackRebuilds.selectChildren === 0,
    JSON.stringify(callbackRebuilds));
  check('destroy() from the onSelectedIndexChange that update() calls stops the update',
    callbackRebuilds.updateError === 'none' && callbackRebuilds.updateChildren === 0,
    JSON.stringify(callbackRebuilds));
  check('update() from onSelectedIndexChange of a bar chart draws the new data in full colour',
    callbackRebuilds.rebuildError === 'none' && callbackRebuilds.isUpdated
    && callbackRebuilds.fullColorPixels > MIN_DATASET_PIXELS,
    JSON.stringify(callbackRebuilds));

  // The state's label range reaches one label past each edge of the window, which selectLabel must not
  const windowSelection = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    const count = 101;
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Selection in the window',
      withMinimap: true,
      labels: Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length: count }, (_, i) => i % 7) }],
      onSelectedIndexChange: (index) => window.probeLog.push(index ?? 'none'),
    });
    await window.idleTracker.wait(1200);
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    // The default window is the last 20%, so its first label is 80
    window.probeChart.selectLabel(79);
    await window.idleTracker.wait(300);
    const isShownBefore = balloon.classList.contains('lovely-chart--state-shown');
    window.probeChart.selectLabel(80);
    await window.idleTracker.wait(300);
    return {
      isShownBefore,
      isShownFirst: balloon.classList.contains('lovely-chart--state-shown'),
      title: element.querySelector('.lovely-chart--tooltip-title').textContent,
      log: [...window.probeLog],
    };
  });
  check('selectLabel ignores the label before the window and takes its first',
    !windowSelection.isShownBefore && windowSelection.isShownFirst && JSON.stringify(windowSelection.log) === '[80]',
    JSON.stringify(windowSelection));

  // Panning keeps a called selection on its label until the label leaves the window
  const windowProbe = page.locator('#probe .lovely-chart--container');
  await windowProbe.scrollIntoViewIfNeeded();
  const windowMinimap = await windowProbe.locator('.lovely-chart--minimap').boundingBox();
  const readWindowSelection = () => page.evaluate(() => ({
    isShown: document.querySelector('#probe .lovely-chart--tooltip-balloon')
      .classList.contains('lovely-chart--state-shown'),
    title: document.querySelector('#probe .lovely-chart--tooltip-title').textContent,
    log: window.probeLog,
  }));
  const sliderX = windowMinimap.x + windowMinimap.width * 0.9;
  const sliderY = windowMinimap.y + windowMinimap.height / 2;
  await drag(page, sliderX, sliderY, -windowMinimap.width * 0.1, 0);
  await waitForIdle(page, 600);
  const panned = await readWindowSelection();
  await drag(page, sliderX - windowMinimap.width * 0.1, sliderY, -windowMinimap.width * 0.2, 0);
  await waitForIdle(page, 600);
  const pannedAway = await readWindowSelection();
  check('a called selection follows its label through a pan',
    panned.isShown && panned.title === windowSelection.title && JSON.stringify(panned.log) === '[80]',
    JSON.stringify(panned));
  check('a called selection clears once its label leaves the window',
    !pannedAway.isShown && JSON.stringify(pannedAway.log) === '[80,"none"]', JSON.stringify(pannedAway));
  await unmountProbe(page);

  // A balloon opened empty, or swapping narrow content for wide within one content update, sits where a pointer on
  // its label puts it: left of the newest label, inside the chart
  for (const dir of ['ltr', 'rtl']) {
    await page.evaluate((value) => document.documentElement.setAttribute('dir', value), dir);
    const edgeChart = await mountProbe(page, {
      config: {
        type: 'line',
        title: 'Probe — Balloon at the edge',
        labels: Array.from({ length: EDGE_LABEL_COUNT }, (_, i) => Date.UTC(2026, 10, 1 + i)),
        datasets: [
          { name: 'A dataset of a rather long name', values: [1, 2, 3, 4, 5, 6, 7, 1_234_567_890] },
          { name: 'Another dataset of a long name', values: [1, 2, 3, 4, 5, 6, 7, 987_654_321] },
        ],
      },
    });
    await edgeChart.scrollIntoViewIfNeeded();
    const lastIndex = EDGE_LABEL_COUNT - 1;
    const readEdgeBalloon = () => edgeChart.evaluate((el) => {
      const container = el.getBoundingClientRect();
      const balloon = el.querySelector('.lovely-chart--tooltip-balloon').getBoundingClientRect();
      // The tail runs down the tooltip canvas at the selected label
      const canvas = el.querySelector('.lovely-chart--tooltip canvas');
      const row = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
      let alphaSum = 0;
      let xSum = 0;
      for (let x = 0; x < canvas.width; x++) {
        alphaSum += row[x * 4 + 3];
        xSum += row[x * 4 + 3] * (x + 0.5);
      }
      return {
        left: balloon.left - container.left,
        right: balloon.right - container.left,
        containerWidth: container.width,
        tailX: xSum / alphaSum / (canvas.width / canvas.clientWidth),
      };
    });
    await page.evaluate((index) => window.probeChart.selectLabel(index), lastIndex);
    await waitForIdle(page, 300);
    const calledEmpty = await readEdgeBalloon();
    await page.evaluate(async (index) => {
      window.probeChart.selectLabel(1);
      await window.idleTracker.wait(300);
      window.probeChart.selectLabel(2);
      window.probeChart.selectLabel(index);
    }, lastIndex);
    await waitForIdle(page, 300);
    const calledWider = await readEdgeBalloon();
    await page.evaluate(() => window.probeChart.selectLabel(undefined));
    const edgePlot = await edgeChart.locator('.lovely-chart--tooltip').boundingBox();
    const edgePointerY = edgePlot.y + edgePlot.height / 2;
    await page.mouse.move(edgePlot.x + calledEmpty.tailX - 40, edgePointerY, { steps: 5 });
    await page.mouse.move(edgePlot.x + calledEmpty.tailX, edgePointerY, { steps: 5 });
    await waitForIdle(page, 300);
    const hovered = await readEdgeBalloon();
    await page.mouse.move(0, 0);
    await unmountProbe(page);
    const isBesideLabel = ({ left, right, containerWidth }) => (
      Math.abs(left - hovered.left) <= 1 && right <= containerWidth && right <= hovered.tailX
    );
    check(`${dir}: selectLabel places a balloon at the edge as a pointer on its label does`,
      isBesideLabel(calledEmpty) && isBesideLabel(calledWider),
      JSON.stringify({ calledEmpty, calledWider, hovered }));
  }
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
});

section('Datasets sharing a name keep a tooltip row and a legend button each, and the datasets that start hidden go '
  + 'unreported', async ({ page }) => {
  // Two datasets of one name and a third of the comparison's name, then with the first and the third hidden
  const sharedNameRows = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const reports = [];
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Tooltip rows of datasets sharing a name',
      labels: [1, 2].map((day) => Date.UTC(2026, 9, day)),
      datasets: [
        { name: 'No channel', values: [10, 20] },
        { name: 'No channel', values: [100, 200] },
        { name: 'Previous period', values: [1000, 2000] },
      ],
      comparison: { name: 'Previous period', values: [[5, 10], [50, 100], [500, 1000]] },
      onTooltipChange: (tooltip) => reports.push(tooltip),
    });
    await window.idleTracker.wait(1200);
    // The name and the value of each row the balloon shows, and the rows the last report lists
    const readRows = () => ({
      shown: [...element.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
        row.dataset.name ?? row.firstElementChild.textContent,
        row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
      ]),
      reported: reports.at(-1)?.rows,
    });
    window.probeChart.selectLabel(0);
    await window.idleTracker.wait(300);
    const allShown = readRows();
    const buttons = element.querySelectorAll('.lovely-chart--button');
    buttons[0].click();
    buttons[2].click();
    await window.idleTracker.wait(800);
    const someHidden = readRows();
    window.probeChart.destroy();
    element.remove();
    return { allShown, someHidden };
  });
  check('datasets sharing a name, the comparison\'s included, keep a tooltip row each, reported by their indexes',
    JSON.stringify(sharedNameRows.allShown) === JSON.stringify({
      shown: [
        ['Previous period', '555 · +100%'], ['Previous period', '1 000'], ['No channel', '100'], ['No channel', '10'],
        ['Total', '1 110'],
      ],
      reported: [
        { datasetIndex: 0, name: 'No channel', value: 10 },
        { datasetIndex: 1, name: 'No channel', value: 100 },
        { datasetIndex: 2, name: 'Previous period', value: 1000 },
      ],
    }),
    JSON.stringify(sharedNameRows.allShown));
  check('hiding a dataset of a shared name leaves the row of the other, and of the comparison of the same name',
    JSON.stringify(sharedNameRows.someHidden) === JSON.stringify({
      shown: [['Previous period', '50 · +100%'], ['No channel', '100'], ['Total', '100']],
      reported: [{ datasetIndex: 1, name: 'No channel', value: 100 }],
    }),
    JSON.stringify(sharedNameRows.someHidden));

  // Three datasets of one name, the last of which starts hidden, through toggles, two resizes and `update()`
  await page.evaluate(async (colors) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeParams = {
      type: 'line',
      title: 'Probe — Legend of datasets sharing a name',
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 9, day)),
      datasets: colors.map((color, i) => ({
        name: 'No channel', color, values: [10, 20, 15].map((value) => value + i * 30), isInitiallyHidden: i === 2,
      })),
      onHiddenSeriesChange: (names, indexes) => window.probeLog.push(`${names.join()}@${indexes.join()}`),
    };
    window.probeChart = new LovelyChart(element, window.probeParams);
    await window.idleTracker.wait(1200);
  }, SHARED_NAME_COLORS);
  const sharedNameChart = page.locator('#probe .lovely-chart--container');
  await sharedNameChart.scrollIntoViewIfNeeded();
  const sharedNameButtons = sharedNameChart.locator('.lovely-chart--button');
  // The pressed state of each button, the colours on the plot and the reports so far
  const readSharedNameLegend = async () => {
    const painted = [];
    for (const color of SHARED_NAME_COLORS) {
      if ((await findColor(sharedNameChart, parseHex(color))).count > MIN_DATASET_PIXELS) painted.push(color);
    }
    return {
      pressed: (await sharedNameButtons.evaluateAll((buttons) => (
        buttons.map((button) => button.getAttribute('aria-pressed'))
      ))).join(),
      painted: painted.join(),
      log: await page.evaluate(() => window.probeLog.join(' ')),
    };
  };
  const resizeAndBack = async () => {
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: viewport.width - 20, height: viewport.height });
    await waitForIdle(page, 1200);
    await page.setViewportSize(viewport);
    await waitForIdle(page, 1200);
  };
  const sharedNameLegend = { built: await readSharedNameLegend() };
  await sharedNameButtons.nth(0).click();
  // The legend keeps the last dataset on screen
  await sharedNameButtons.nth(1).click();
  await waitForIdle(page, 600);
  sharedNameLegend.firstHidden = await readSharedNameLegend();
  await resizeAndBack();
  sharedNameLegend.firstHiddenResized = await readSharedNameLegend();
  await sharedNameButtons.nth(2).click();
  await waitForIdle(page, 600);
  sharedNameLegend.lastShown = await readSharedNameLegend();
  await resizeAndBack();
  sharedNameLegend.lastShownResized = await readSharedNameLegend();
  await page.evaluate(() => window.probeChart.update(window.probeParams));
  await waitForIdle(page, 600);
  sharedNameLegend.updated = await readSharedNameLegend();
  await unmountProbe(page);
  const [firstColor, secondColor, lastColor] = SHARED_NAME_COLORS;
  const builtLegend = { pressed: 'true,true,false', painted: `${firstColor},${secondColor}`, log: '' };
  const firstHiddenLegend = { pressed: 'false,true,false', painted: secondColor, log: 'No channel,No channel@0,2' };
  const lastShownLegend = {
    pressed: 'false,true,true', painted: `${secondColor},${lastColor}`, log: `${firstHiddenLegend.log} No channel@0`,
  };
  check('a dataset that starts hidden goes unreported as the chart builds and as update() rebuilds it',
    JSON.stringify(sharedNameLegend.built) === JSON.stringify(builtLegend)
    && JSON.stringify(sharedNameLegend.updated) === JSON.stringify({ ...builtLegend, log: lastShownLegend.log }),
    JSON.stringify(sharedNameLegend));
  check('the legend buttons of datasets sharing a name keep the datasets they hide through a resize, unreported',
    [sharedNameLegend.firstHidden, sharedNameLegend.firstHiddenResized].every((legend) => (
      JSON.stringify(legend) === JSON.stringify(firstHiddenLegend)
    ))
    && [sharedNameLegend.lastShown, sharedNameLegend.lastShownResized].every((legend) => (
      JSON.stringify(legend) === JSON.stringify(lastShownLegend)
    )),
    JSON.stringify(sharedNameLegend));

  // A lone dataset that starts hidden keeps its legend, whose button shows it
  await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — A lone dataset that starts hidden',
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 9, day)),
      datasets: [{ name: 'No channel', color: '#FF0000', values: [10, 20, 15], isInitiallyHidden: true }],
      onHiddenSeriesChange: (names, indexes) => window.probeLog.push(`${names.join()}@${indexes.join()}`),
    });
    await window.idleTracker.wait(1200);
  });
  const loneChart = page.locator('#probe .lovely-chart--container');
  await loneChart.scrollIntoViewIfNeeded();
  const readLoneLegend = async () => ({
    isLegendShown: await loneChart.locator('.lovely-chart--tools')
      .evaluate((legend) => !legend.classList.contains('lovely-chart--state-hidden')),
    pressed: await loneChart.locator('.lovely-chart--button').getAttribute('aria-pressed'),
    paint: (await findColor(loneChart, [255, 0, 0])).count,
    log: await page.evaluate(() => window.probeLog.join(' ')),
  });
  const loneBuilt = await readLoneLegend();
  await loneChart.locator('.lovely-chart--button').click();
  await waitForIdle(page, 600);
  const loneShown = await readLoneLegend();
  await unmountProbe(page);
  check('a lone dataset that starts hidden keeps its legend, unreported, and its button shows it',
    loneBuilt.isLegendShown && loneBuilt.pressed === 'false' && loneBuilt.paint === 0 && loneBuilt.log === ''
    && loneShown.pressed === 'true' && loneShown.paint > MIN_DATASET_PIXELS && loneShown.log === '@',
    JSON.stringify({ loneBuilt, loneShown }));
});

section('`selectLabel()`, the keys and a touch select the labels alone, and a touch beyond the first or the last label '
  + 'of the plot selects the label a key does there', async ({ page, errors, browser, url }) => {
  const boundsConfig = {
    type: 'line',
    title: 'Probe — Selection bounds',
    isKeyboardSelectable: true,
    labels: Array.from({ length: BOUNDS_LABEL_COUNT }, (_, i) => Date.UTC(2026, 9, 1 + i)),
    datasets: [{ name: 'Count', values: [10, 30, 0, 20, 5, 15] }],
  };
  const mountBoundsProbe = (targetPage) => targetPage.evaluate(async (config) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    (document.getElementById('container') ?? document.body).appendChild(element);
    window.probeLog = [];
    window.probeChart = new LovelyChart(element, {
      ...config, onSelectedIndexChange: (index) => window.probeLog.push(index ?? 'none'),
    });
    await window.idleTracker.wait(1200);
  }, boundsConfig);
  // Whether the reports so far are `log` and the hover line marks the label at `labelIndex`
  const isLineOnLabel = (selection, log, labelIndex) => JSON.stringify(selection.log) === JSON.stringify(log)
    && Math.abs(selection.lineX - selection.labelXs[labelIndex]) <= HOVER_LINE_TOLERANCE;
  const lastBoundsIndex = BOUNDS_LABEL_COUNT - 1;

  await mountBoundsProbe(page);
  const ignoredIndexErrors = await page.evaluate(async ({ preselectedIndexes, ignoredIndexes }) => {
    preselectedIndexes.forEach((index) => window.probeChart.selectLabel(index));
    await window.idleTracker.wait(300);
    return ignoredIndexes.flatMap((index) => {
      try {
        window.probeChart.selectLabel(index);
        return [];
      } catch (err) {
        return [err.message];
      }
    });
  }, { preselectedIndexes: PRESELECTED_LABEL_INDEXES, ignoredIndexes: IGNORED_LABEL_INDEXES });
  await waitForIdle(page, 300);
  const ignoredIndexSelection = await readProbeHoverLine(page, BOUNDS_LABEL_COUNT);
  const isKeptBalloonShown = await page.locator('#probe .lovely-chart--tooltip-balloon')
    .evaluate((balloon) => balloon.classList.contains('lovely-chart--state-shown'));
  await unmountProbe(page);
  check('selectLabel() ignores an index before the first label, past the last, between two or not a number at all',
    ignoredIndexErrors.length === 0 && isKeptBalloonShown
    && isLineOnLabel(ignoredIndexSelection, PRESELECTED_LABEL_INDEXES, PRESELECTED_LABEL_INDEXES.at(-1)),
    JSON.stringify({ ignoredIndexErrors, isKeptBalloonShown, ignoredIndexSelection }));

  // A page of its own, which a touch screen gives touch events in place of mouse ones
  const touchPage = await newTestPage(browser, { viewport: { width: 900, height: 1200 }, hasTouch: true });
  touchPage.on('pageerror', (err) => errors.push(`[touch pageerror] ${err.message}`));
  await touchPage.goto(`${url}isolated`);
  await touchPage.addStyleTag({ url: `${url}LovelyChart.css` });
  await mountBoundsProbe(touchPage);
  const touchLayer = touchPage.locator('#probe .lovely-chart--tooltip');
  await touchLayer.scrollIntoViewIfNeeded();
  const touchPlot = await touchLayer.locator('canvas').boundingBox();
  const touchY = touchPlot.y + touchPlot.height / 2;
  const touchSelections = {};
  await touchPage.touchscreen.tap(touchPlot.x + 1, touchY);
  await waitForIdle(touchPage, 300);
  touchSelections.tappedFirst = await readProbeHoverLine(touchPage, BOUNDS_LABEL_COUNT);
  await touchLayer.focus();
  await touchPage.keyboard.press('End');
  await waitForIdle(touchPage, 300);
  touchSelections.keyedLast = await readProbeHoverLine(touchPage, BOUNDS_LABEL_COUNT);
  await touchPage.keyboard.press('Home');
  await waitForIdle(touchPage, 300);
  touchSelections.keyedFirst = await readProbeHoverLine(touchPage, BOUNDS_LABEL_COUNT);
  await touchPage.touchscreen.tap(touchPlot.x + touchPlot.width - 1, touchY);
  await waitForIdle(touchPage, 300);
  touchSelections.tappedLast = await readProbeHoverLine(touchPage, BOUNDS_LABEL_COUNT);
  await touchPage.close();
  check('a touch beyond the first or the last label of the plot selects it, its hover line where a key puts it',
    isLineOnLabel(touchSelections.tappedFirst, [0], 0)
    && isLineOnLabel(touchSelections.keyedLast, [0, lastBoundsIndex], lastBoundsIndex)
    && isLineOnLabel(touchSelections.keyedFirst, [0, lastBoundsIndex, 0], 0)
    && isLineOnLabel(touchSelections.tappedLast, [0, lastBoundsIndex, 0, lastBoundsIndex], lastBoundsIndex),
    JSON.stringify(touchSelections));
});

section('The header, the tooltip and the legend left out, the band of an empty header, and '
  + '`zoomOut()`', async ({ page, errors }) => {
  // The plot, its hover layer and the plot area start under the header: at the top of a chart without the band or with
  // no title and no caption, and under the band a page keeps for such a header. A legend in a hidden element takes its
  // spacing along, as the legend a lone dataset hides.
  const headerLayouts = await page.evaluate(async (band) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const labels = [1, 2, 3, 4].map((day) => Date.UTC(2026, 0, day));
    const textLabels = labels.map((_, i) => `Label ${i}`);
    const specs = {
      titled: { title: 'Probe — Header' },
      untitled: {},
      noHeader: { title: 'Probe — No header', noHeader: true },
      noCaption: { noCaption: true },
      textLabels: { labels: textLabels },
      keptBand: { labels: textLabels },
      hiddenLegend: { title: 'Probe — Hidden legend' },
      loneDataset: { title: 'Probe — Lone dataset', datasets: [{ name: 'A', values: [3, 5, 2, 6] }] },
    };
    const layouts = {};
    for (const [name, config] of Object.entries(specs)) {
      const element = document.createElement('div');
      const legend = document.createElement('div');
      legend.hidden = true;
      if (name === 'keptBand') {
        element.style.setProperty('--lovely-chart-empty-header-height', `${band}px`);
      }
      document.getElementById('container').append(element, legend);
      const chart = new LovelyChart(element, {
        type: 'line',
        labels,
        datasets: [{ name: 'A', values: [3, 5, 2, 6] }, { name: 'B', values: [1, 2, 3, 2] }],
        legendContainer: name === 'hiddenLegend' ? legend : undefined,
        ...config,
      });
      await window.idleTracker.wait(600);
      const container = element.querySelector('.lovely-chart--container');
      const top = container.getBoundingClientRect().top;
      const plot = container.querySelector(':scope > canvas').getBoundingClientRect();
      const caption = container.querySelector('.lovely-chart--header-caption');
      layouts[name] = {
        plotTop: plot.top - top,
        hoverTop: container.querySelector('.lovely-chart--tooltip canvas').getBoundingClientRect().top - top,
        areaInset: parseFloat(element.style.getPropertyValue('--lovely-chart-plot-area-top')) - (plot.top - top),
        headerHeight: container.querySelector('.lovely-chart--header').getBoundingClientRect().height,
        title: container.querySelector('.lovely-chart--header-title').textContent,
        caption: getComputedStyle(caption).display === 'none' ? '' : caption.textContent,
        bottomSpace: container.getBoundingClientRect().bottom - plot.bottom,
        legendButtons: legend.querySelectorAll('.lovely-chart--button').length,
      };
      chart.destroy();
      element.remove();
      legend.remove();
    }
    return layouts;
  }, EMPTY_HEADER_BAND);
  const { titled, untitled, noHeader, noCaption, textLabels, keptBand, hiddenLegend, loneDataset } = headerLayouts;
  const isUnderPlot = ({ hoverTop, plotTop, areaInset }) => (
    isNear(hoverTop, plotTop) && isNear(areaInset, titled.areaInset)
  );
  check('noHeader starts the plot, its hover layer and the plot area at the top, with no title or caption',
    isNear(noHeader.plotTop, titled.plotTop - titled.headerHeight) && isUnderPlot(noHeader)
    && !noHeader.title && !noHeader.caption,
    JSON.stringify({ titled, noHeader }));
  check('a header with no title folds by noCaption or text labels, and keeps its band for a caption of dates',
    isNear(noCaption.plotTop, noHeader.plotTop) && isNear(textLabels.plotTop, noHeader.plotTop)
    && isNear(untitled.plotTop, titled.plotTop) && Boolean(untitled.caption)
    && [noCaption, textLabels, untitled].every(isUnderPlot),
    JSON.stringify({ untitled, noCaption, textLabels }));
  check('--lovely-chart-empty-header-height keeps the band of an empty header over the plot and its hover layer',
    isNear(keptBand.plotTop, noHeader.plotTop + EMPTY_HEADER_BAND) && isUnderPlot(keptBand), JSON.stringify(keptBand));
  check('a legend in a hidden element takes its spacing along, ending the chart where a lone dataset ends it',
    hiddenLegend.legendButtons === 2 && isNear(hiddenLegend.bottomSpace, loneDataset.bottomSpace)
    && titled.bottomSpace > loneDataset.bottomSpace,
    JSON.stringify({ hiddenLegend, loneDataset, titled }));

  // While zoomed, the zoom-out control of a chart without the band, or with nothing in it to show, floats over the top
  // inline-start corner of the plot, above the hover layer, and zooms out. `zoomOut()` is ignored while a zoom in
  // settles.
  const mountZoomProbe = (config) => page.evaluate(async (probeConfig) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeSelections = [];
    const labels = Array.from({ length: 14 }, (_, i) => Date.UTC(2026, 0, 1 + i));
    window.probeChart = new LovelyChart(element, {
      type: 'area',
      isPercentage: true,
      isStacked: true,
      labels,
      datasets: [
        { name: 'A', values: labels.map((_, i) => 10 + i) }, { name: 'B', values: labels.map((_, i) => 30 - i) },
      ],
      onZoomChange: (labelValue) => {
        window.probeLog.push(labelValue === undefined ? 'out' : 'in');
        if (labelValue !== undefined && window.shouldZoomOutOnZoom) {
          window.probeChart.zoomOut();
        }
      },
      onSelectedIndexChange: (labelIndex) => window.probeSelections.push(labelIndex),
      ...probeConfig,
    });
    element.scrollIntoView({ block: 'center' });
  }, config);
  const clickProbeMiddle = async (selector) => {
    const box = await page.locator(selector).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  // The shown zoom-out control against the plot, the top of the plot in the chart, and whether the control is on top
  const readFloatingControl = () => page.evaluate(() => {
    const host = document.getElementById('probe');
    const control = host.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)');
    const log = [...window.probeLog];
    const hasHoverLayer = Boolean(host.querySelector('.lovely-chart--tooltip'));
    if (!control) return { isShown: false, hasHoverLayer, log };
    const box = control.getBoundingClientRect();
    const plot = host.querySelector('.lovely-chart--container > canvas').getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      isShown: true,
      left: box.left - plot.left,
      top: box.top - plot.top,
      bottom: box.bottom - plot.top,
      plotTop: plot.top - host.querySelector('.lovely-chart--container').getBoundingClientRect().top,
      isOnTop: control.contains(hit),
      hasHoverLayer,
      log,
    };
  });
  const isFloating = ({ isShown, left, top, bottom, plotTop, isOnTop }) => (
    isShown && left >= 0 && left <= GUTTER && top < 0 && bottom > 0 && isNear(plotTop, noHeader.plotTop) && isOnTop
  );
  await mountZoomProbe({ title: 'Probe — Zoom without the header', noHeader: true });
  await waitForIdle(page, 1200);
  await clickProbeMiddle('#probe .lovely-chart--tooltip');
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, ZOOM_SETTLE_MS);
  await page.mouse.move(0, 0);
  const floatingControl = await readFloatingControl();
  await page.locator('#probe .lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').click();
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const floatingLog = await page.evaluate(() => window.probeLog);
  await unmountProbe(page);
  check('zoomOut() is ignored while a zoom in settles', JSON.stringify(floatingControl.log) === '["in"]',
    JSON.stringify(floatingControl.log));
  check('without the band, the zoom-out control floats over the top inline-start corner of the plot and zooms out',
    isFloating(floatingControl) && JSON.stringify(floatingLog) === '["in","out"]',
    JSON.stringify({ ...floatingControl, log: floatingLog }));

  // Without the tooltip, neither a pointer nor `selectLabel()` selects a label or zooms in, while `initialZoom` opens a
  // zoom whose control floats from an empty header, and which `zoomOut()` leaves once
  await mountZoomProbe({ noCaption: true, noTooltip: true, initialZoom: 'last' });
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const openedZoom = await readFloatingControl();
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, ZOOM_SETTLE_MS);
  await page.evaluate(() => window.probeChart.zoomOut());
  await clickProbeMiddle('#probe .lovely-chart--container > canvas');
  await page.evaluate(() => window.probeChart.selectLabel(2));
  await waitForIdle(page, ZOOM_SETTLE_MS);
  await page.mouse.move(0, 0);
  const tooltipless = await page.evaluate(() => {
    const log = { zooms: window.probeLog, selections: window.probeSelections };
    window.probeChart.destroy();
    window.probeChart.zoomOut();
    document.getElementById('probe').remove();
    return log;
  });
  check('noTooltip leaves out the hover layer, and initialZoom opens a zoom whose control floats from an empty header',
    !openedZoom.hasHoverLayer && isFloating(openedZoom) && JSON.stringify(openedZoom.log) === '["in"]',
    JSON.stringify(openedZoom));
  check('zoomOut() zooms out once, and neither a pointer nor selectLabel() selects or zooms in without the tooltip',
    JSON.stringify(tooltipless.zooms) === '["in","out"]' && !tooltipless.selections.length,
    JSON.stringify(tooltipless));

  // `zoomOut()` from within `onZoomChange` waits for the zoomed view to draw, then leaves it for the overview
  await page.evaluate(() => {
    window.shouldZoomOutOnZoom = true;
  });
  await mountZoomProbe({ title: 'Probe — Zoom out as the zoom settles', initialZoom: 'last' });
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const settledZoomOut = await page.evaluate(() => {
    delete window.shouldZoomOutOnZoom;
    return {
      log: window.probeLog,
      caption: document.querySelector('#probe .lovely-chart--header-caption').textContent,
    };
  });
  await unmountProbe(page);
  check('zoomOut() from within onZoomChange leaves the zoom it reports for the overview',
    JSON.stringify(settledZoomOut.log) === '["in","out"]' && settledZoomOut.caption.includes('—'),
    JSON.stringify(settledZoomOut));

  // `noZoomOutControl` keeps the title while zoomed, with no zoom-out control, and `zoomOut()` still zooms out
  await mountZoomProbe({ title: 'Probe — No zoom-out control', noZoomOutControl: true, initialZoom: 'last' });
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const controlless = await page.evaluate(() => ({
    title: document.querySelector('#probe .lovely-chart--header-title').textContent,
    controls: document.querySelectorAll('#probe .lovely-chart--header-zoom-out-control').length,
    log: [...window.probeLog],
  }));
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const controllessLog = await page.evaluate(() => window.probeLog);
  await unmountProbe(page);
  check('noZoomOutControl keeps the title while zoomed, with no zoom-out control, and zoomOut() still zooms out',
    controlless.title === 'Probe — No zoom-out control' && !controlless.controls
    && JSON.stringify(controlless.log) === '["in"]' && JSON.stringify(controllessLog) === '["in","out"]',
    JSON.stringify({ ...controlless, log: controllessLog }));

  // A titled header names the day a click zooms into and the dates on screen again after the zoom out, while
  // `noCaption` leaves its caption out all along, also through a zoom into data `onZoom` returns without `noCaption`,
  // as do text labels zoomed into dates
  const mountHourlyZoomProbe = (config, hasTextLabels = false) => page.evaluate(
    async ([probeConfig, hasProbeTextLabels, hourMs]) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const element = document.createElement('div');
      element.id = 'probe';
      document.getElementById('container').appendChild(element);
      window.probeLog = [];
      const buildValues = (length) => Array.from({ length }, (_, i) => 50 + ((i * 37) % 101));
      const days = Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 10, 1 + i));
      window.probeChart = new LovelyChart(element, {
        type: 'line',
        labels: hasProbeTextLabels ? days.map((_, i) => `Item ${i}`) : days,
        datasets: [{ name: 'A', values: buildValues(10) }],
        // `onZoom` takes the index of a text label
        onZoom: (labelValue) => Promise.resolve({
          type: 'line',
          labels: Array.from({ length: 24 }, (_, hour) => (
            (hasProbeTextLabels ? days[labelValue] : labelValue) + hour * hourMs
          )),
          datasets: [{ name: 'A', values: buildValues(24) }],
        }),
        onZoomChange: (labelValue) => window.probeLog.push(labelValue === undefined ? 'out' : 'in'),
        ...probeConfig,
      });
      element.scrollIntoView({ block: 'center' });
    },
    [config, hasTextLabels, HOUR_MS],
  );
  // The caption in the overview, while zoomed in by a click, and after the zoom out by the zoom-out control or by
  // `zoomOut()`
  const readZoomCaptions = async (mount, config, isZoomedOutByApi = false) => {
    const readCaption = () => page.locator('#probe .lovely-chart--header-caption').textContent();
    await mount(config);
    await waitForIdle(page, 1200);
    const overview = await readCaption();
    await clickProbeMiddle('#probe .lovely-chart--tooltip');
    await waitForIdle(page, ZOOM_SETTLE_MS);
    await page.mouse.move(0, 0);
    const zoomed = await readCaption();
    if (isZoomedOutByApi) {
      await page.evaluate(() => window.probeChart.zoomOut());
    } else {
      await page.locator('#probe .lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').click();
    }
    await waitForIdle(page, ZOOM_SETTLE_MS);
    const zoomedOut = await readCaption();
    const log = await page.evaluate(() => window.probeLog);
    await unmountProbe(page);
    return { overview, zoomed, zoomedOut, log };
  };
  const isZoomedInAndOut = ({ log }) => JSON.stringify(log) === '["in","out"]';
  const captionlessZooms = {
    onZoom: await readZoomCaptions(mountHourlyZoomProbe, { title: 'Probe — Zoom with no caption', noCaption: true }),
    shares: await readZoomCaptions(mountZoomProbe, { title: 'Probe — Shares with no caption', noCaption: true }, true),
    textLabels: await readZoomCaptions(
      (config) => mountHourlyZoomProbe(config, true), { title: 'Probe — Text labels zoomed into dates' }, true,
    ),
  };
  const captionedZoom = await readZoomCaptions(mountHourlyZoomProbe, { title: 'Probe — Zoom with a caption' });
  check('noCaption and text labels leave a titled header no caption, zoomed by onZoom or into shares and zoomed out',
    Object.values(captionlessZooms).every((captions) => (
      isZoomedInAndOut(captions) && !captions.overview && !captions.zoomed && !captions.zoomedOut
    )),
    JSON.stringify(captionlessZooms));
  check('a titled header names the zoomed day while zoomed, and the dates on screen of the overview once zoomed out',
    isZoomedInAndOut(captionedZoom) && captionedZoom.overview.includes('—')
    && Boolean(captionedZoom.zoomed) && !captionedZoom.zoomed.includes('—')
    && captionedZoom.zoomedOut === captionedZoom.overview,
    JSON.stringify(captionedZoom));

  // While zoomed into a day, the balloon of a label left of the middle stacks over the floating zoom-out control, and the
  // control beside the balloon takes a click. The control sits on a backdrop of `--background-color` over the top label
  // of the main axis.
  await mountHourlyZoomProbe({ noHeader: true });
  await waitForIdle(page, 1200);
  await clickProbeMiddle('#probe .lovely-chart--tooltip');
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const hoverLayer = await page.locator('#probe .lovely-chart--tooltip').boundingBox();
  await page.mouse.move(hoverLayer.x + FLOATING_CONTROL_HOVER_X, hoverLayer.y + hoverLayer.height / 2, { steps: 5 });
  await waitForIdle(page, 400);
  const stacking = await page.evaluate(() => {
    const host = document.getElementById('probe');
    const control = host.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)');
    const balloon = host.querySelector('.lovely-chart--tooltip-balloon.lovely-chart--state-shown');
    if (!control || !balloon) return { isControlShown: Boolean(control), isBalloonShown: Boolean(balloon) };
    const controlBox = control.getBoundingClientRect();
    const balloonBox = balloon.getBoundingClientRect();
    const left = Math.max(controlBox.left, balloonBox.left);
    const right = Math.min(controlBox.right, balloonBox.right);
    const top = Math.max(controlBox.top, balloonBox.top);
    const bottom = Math.min(controlBox.bottom, balloonBox.bottom);
    const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    const swatch = document.createElement('div');
    swatch.style.background = 'var(--background-color)';
    control.parentNode.appendChild(swatch);
    const skinBackground = getComputedStyle(swatch).backgroundColor;
    swatch.remove();
    return {
      overlap: [right - left, bottom - top],
      isBalloonOnTop: balloon.contains(hit),
      background: getComputedStyle(control).backgroundColor,
      skinBackground,
    };
  });
  const controlBox = await page.locator(
    '#probe .lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)',
  ).boundingBox();
  await page.mouse.move(controlBox.x + GUTTER, controlBox.y + controlBox.height / 2, { steps: 5 });
  await page.mouse.click(controlBox.x + GUTTER, controlBox.y + controlBox.height / 2);
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const stackingLog = await page.evaluate(() => window.probeLog);
  await unmountProbe(page);
  check('while zoomed, a balloon stacks over the floating zoom-out control, and the control beside it takes a click',
    Boolean(stacking.overlap?.every((side) => side > 0)) && stacking.isBalloonOnTop
    && JSON.stringify(stackingLog) === '["in","out"]',
    JSON.stringify({ ...stacking, log: stackingLog }));
  check('the floating zoom-out control sits on a backdrop of --background-color',
    stacking.background === stacking.skinBackground && stacking.background !== 'rgba(0, 0, 0, 0)',
    JSON.stringify(stacking));

  // --- `zoomOutLabel`, `labelFormatter`, `withGradient`, `limitDate` and `onLimitedRangeClick`, and a pie of totals ---
  // The pointer stays off the probes, so no hover focuses a sector or a label
  await page.mouse.move(0, 0);
  const limitLabels = Array.from({ length: LIMIT_LABEL_COUNT }, (_, i) => Date.UTC(2026, 10, 1 + i));
  const sharesConfig = {
    type: 'area',
    isPercentage: true,
    isStacked: true,
    labels: limitLabels,
    datasets: [
      { name: 'A', color: '#808080', values: limitLabels.map(() => 30) },
      { name: 'B', values: limitLabels.map(() => 10) },
    ],
  };

  // The zoom-out control reads `zoomOutLabel` in the header and floating over the plot, and `Zoom out` by default
  const zoomOutTexts = [];
  for (const config of [{ zoomOutLabel: ZOOM_OUT_LABEL }, { zoomOutLabel: ZOOM_OUT_LABEL, noHeader: true }, {}]) {
    await mountProbe(page, {
      config: { ...sharesConfig, title: 'Probe — Zoom-out label', initialZoom: 'last', ...config },
    });
    zoomOutTexts.push(await page.evaluate(() => document.querySelector(
      '#probe .lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)',
    )?.textContent));
    await unmountProbe(page);
  }
  check('the zoom-out control reads zoomOutLabel in the header and floating over the plot, and Zoom out by default',
    JSON.stringify(zoomOutTexts) === JSON.stringify([ZOOM_OUT_LABEL, ZOOM_OUT_LABEL, DEFAULT_ZOOM_OUT_LABEL]),
    JSON.stringify(zoomOutTexts));

  // `labelFormatter` formats the X-axis labels over `labelType`, and the tooltip title unless `tooltipFormatter` sets
  // one, while the caption keeps the granularity of the labels: weekly labels by the date each week starts on
  const weekLabels = Array.from({ length: 8 }, (_, i) => Date.UTC(2026, 8, 7 + i * 7));
  const formatSpecs = {
    weeks: {},
    days: { labelFormatter: 'statsFormat(\'day\')' },
    weekTitles: { labelFormatter: 'statsFormat(\'day\')', tooltipFormatter: 'statsTooltipFormat(\'week\')' },
  };
  const formats = {};
  for (const [name, config] of Object.entries(formatSpecs)) {
    const formatChart = await mountProbe(page, {
      config: {
        type: 'bar',
        title: 'Probe — Label format',
        labels: weekLabels,
        isUtc: true,
        datasets: [{ name: 'A', values: weekLabels.map((_, i) => 10 + i) }],
        ...config,
      },
    });
    await startCanvasRecording(formatChart);
    await page.evaluate(() => window.probeChart.refreshColors());
    await waitForIdle(page, 300);
    const { texts } = await stopCanvasRecording(page);
    formats[name] = await page.evaluate(async (axisTexts) => {
      window.probeChart.selectLabel(2);
      await window.idleTracker.wait(300);
      const host = document.getElementById('probe');
      return {
        xLabels: axisTexts.filter((text) => !/^\d+$/.test(text)),
        title: host.querySelector('.lovely-chart--tooltip-title').textContent,
        caption: host.querySelector('.lovely-chart--header-caption').textContent,
      };
    }, [...new Set(texts.map(({ text }) => text))]);
    await unmountProbe(page);
  }
  const { weeks, days, weekTitles } = formats;
  check('labelFormatter formats the X-axis labels and the tooltip title over labelType, keeping the caption',
    weeks.xLabels.length > 0 && weeks.xLabels.every((text) => /^Week \d+$/.test(text)) && weeks.title === 'Week 39'
    && days.xLabels.includes('14 Sep') && days.xLabels.every((text) => /^\d{1,2} [A-Z][a-z]{2}$/.test(text))
    && days.title === '21 Sep' && days.caption === weeks.caption,
    JSON.stringify(formats));
  check('tooltipFormatter sets the tooltip title over labelFormatter',
    weekTitles.title === 'Week of 21 Sep' && JSON.stringify(weekTitles.xLabels) === JSON.stringify(days.xLabels),
    JSON.stringify(weekTitles));

  // `withGradient` shades a sector from lighter than its colour at the inner edge to darker at the outer edge, in a pie,
  // the ring of a donut and the pie of a zoom into shares. A pie of one total per dataset takes a single text label, so
  // its header shows the title alone.
  const readCircleRadius = (fractions) => page.evaluate((radiusFractions) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const readProperty = (name) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${name}`));
    const scale = canvas.width / canvas.clientWidth;
    const radius = readProperty('width') / 2;
    const centerX = hostBox.left + readProperty('left') + radius - canvasBox.left;
    const centerY = hostBox.top + readProperty('top') + radius - canvasBox.top;
    // Up and to the right, clear of the shares the sectors print at their middles
    const angle = -Math.PI / 4;
    return {
      title: host.querySelector('.lovely-chart--header-title').textContent,
      caption: host.querySelector('.lovely-chart--header-caption').textContent,
      isHeaderFolded: host.querySelector('.lovely-chart--container').classList
        .contains('lovely-chart--container-empty-header'),
      name: canvas.getAttribute('aria-label'),
      pixels: radiusFractions.map((fraction) => [...canvas.getContext('2d').getImageData(
        Math.round((centerX + Math.cos(angle) * radius * fraction) * scale),
        Math.round((centerY + Math.sin(angle) * radius * fraction) * scale),
        1,
        1,
      ).data]),
    };
  }, fractions);
  const totals = {};
  for (const [name, type, withGradient, fractions] of [
    ['plainPie', 'pie', false, PIE_RADIUS_FRACTIONS],
    ['pie', 'pie', true, PIE_RADIUS_FRACTIONS],
    ['donut', 'donut', true, DONUT_RADIUS_FRACTIONS],
  ]) {
    await mountProbe(page, {
      config: {
        type,
        title: 'Probe — Totals',
        labels: ['Total'],
        datasets: sharesConfig.datasets.map((dataset) => ({ ...dataset, values: dataset.values.slice(0, 1) })),
        withGradient,
      },
    });
    totals[name] = await readCircleRadius(fractions);
    await unmountProbe(page);
  }
  await mountProbe(page, {
    config: { ...sharesConfig, title: 'Probe — Gradient zoom', initialZoom: 'last', withGradient: true },
  });
  const zoomedGradient = await readCircleRadius(PIE_RADIUS_FRACTIONS);
  await unmountProbe(page);
  const isOpaqueGrey = (pixels, isInRange) => pixels.every(([red, green, blue, alpha]) => (
    alpha === 255 && red === green && green === blue && isInRange(red - GRADIENT_GREY)
  ));
  const isShaded = ({ pixels: [inner, outer] }) => (
    isOpaqueGrey([inner], (shade) => shade >= MIN_GRADIENT_SHADE)
    && isOpaqueGrey([outer], (shade) => shade <= -MIN_GRADIENT_SHADE)
  );
  check('withGradient shades a pie, a donut ring and a zoom into shares lighter inside and darker outside',
    isOpaqueGrey(totals.plainPie.pixels, (shade) => Math.abs(shade) <= PLAIN_SECTOR_TOLERANCE)
    && isShaded(totals.pie) && isShaded(totals.donut) && isShaded(zoomedGradient),
    JSON.stringify({ ...totals, zoomedGradient }));
  check('a pie or donut of one total in a text label shows its title with no caption of dates',
    Object.values(totals).every(({ title, caption, isHeaderFolded }) => (
      title === 'Probe — Totals' && caption === '' && !isHeaderFolded
    )) && totals.donut.name === 'Donut chart, Total: A, B',
    JSON.stringify(Object.values(totals).map(({ title, caption, isHeaderFolded, name }) => (
      { title, caption, isHeaderFolded, name }
    ))));

  // `limitDate` locks the labels before the first label at or after it: the minimap masks them, and its window starts
  // at that label, as `minimapRange: 'full'` asks and after a drag of the slider past it. The mask takes a click with
  // `onLimitedRangeClick`, and lets the pointer through without it. A date at or before the first label or after the
  // label before the last, or a chart without the minimap, locks none.
  const mountLimitProbe = (config, hasClickHandler) => page.evaluate(async ([probeConfig, labels, hasHandler]) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Limit',
      labels,
      datasets: [{ name: 'A', values: labels.map((_, i) => 10 + (i % 5)) }],
      isUtc: true,
      withMinimap: true,
      minimapRange: 'full',
      onLimitedRangeClick: hasHandler ? () => window.probeLog.push('click') : undefined,
      ...probeConfig,
    });
    element.scrollIntoView({ block: 'center' });
    await window.idleTracker.wait(1200);
  }, [config, limitLabels, hasClickHandler]);
  const readLimit = () => page.evaluate(() => {
    const host = document.getElementById('probe');
    const minimap = host.querySelector('.lovely-chart--minimap')?.getBoundingClientRect();
    const mask = host.querySelector('.lovely-chart--minimap-limit-mask');
    const slider = host.querySelector('.lovely-chart--minimap-slider')?.getBoundingClientRect();
    return {
      caption: host.querySelector('.lovely-chart--header-caption').textContent,
      maskShare: mask ? mask.getBoundingClientRect().width / minimap.width : undefined,
      window: slider && [(slider.left - minimap.left) / minimap.width, (slider.right - minimap.left) / minimap.width],
      maskPointer: mask ? getComputedStyle(mask).pointerEvents : undefined,
      clicks: window.probeLog.length,
    };
  });
  const readDay = (index) => `${new Date(limitLabels[index]).getUTCDate()} Nov`;
  const firstOpenDay = `${readDay(LIMIT_LABEL_INDEX)} `;
  const firstDay = `${readDay(0)} `;
  await mountLimitProbe({ limitDate: limitLabels[LIMIT_LABEL_INDEX] - HOUR_MS }, true);
  const limited = await readLimit();
  const limitSlider = await page.locator('#probe .lovely-chart--minimap-slider-inner').boundingBox();
  const limitMinimap = await page.locator('#probe .lovely-chart--minimap').boundingBox();
  const limitSliderY = limitSlider.y + limitSlider.height / 2;
  await drag(page, limitSlider.x + limitSlider.width / 2, limitSliderY, -limitMinimap.width, 0);
  await waitForIdle(page, 600);
  const limitDragged = await readLimit();
  const limitMask = await page.locator('#probe .lovely-chart--minimap-limit-mask').boundingBox();
  await page.mouse.click(limitMask.x + limitMask.width / 2, limitMask.y + limitMask.height / 2);
  await waitForIdle(page, 200);
  const limitClicked = await readLimit();
  await unmountProbe(page);
  await page.mouse.move(0, 0);
  check('limitDate masks the labels before the first label at or after it, and the window starts at that label',
    limited.caption.startsWith(firstOpenDay)
    && Math.abs(limited.maskShare - LIMIT_LABEL_INDEX / (LIMIT_LABEL_COUNT - 1)) <= LIMIT_MASK_TOLERANCE
    && limitDragged.caption === limited.caption,
    JSON.stringify({ limited, limitDragged }));
  check('onLimitedRangeClick is called by a click on the mask, which takes the pointer',
    limited.maskPointer === 'auto' && !limited.clicks && limitClicked.clicks === 1, JSON.stringify(limitClicked));

  // A `minimapRange` of locked labels starts at the first open label, keeping its width, and a limit at the label
  // before the last leaves the window the last two labels, a span of one day the caption names by its later label
  const movedWindows = {};
  for (const [name, config] of Object.entries({
    lockedRange: { limitDate: limitLabels[LIMIT_LABEL_INDEX], minimapRange: { from: 0, to: LOCKED_RANGE_LAST_INDEX } },
    beforeLastLabel: { limitDate: limitLabels[LIMIT_LABEL_COUNT - 2] },
  })) {
    await mountLimitProbe(config, false);
    movedWindows[name] = await readLimit();
    await unmountProbe(page);
  }
  const isWindowAtMask = ({ maskShare, window: [begin, end] }) => (
    Math.abs(begin - maskShare) <= LIMIT_MASK_TOLERANCE && end > begin && end <= 1 + LIMIT_MASK_TOLERANCE
  );
  const { lockedRange, beforeLastLabel } = movedWindows;
  check('a minimapRange of the labels limitDate locks starts at the first open label, keeping its width',
    lockedRange.caption.startsWith(firstOpenDay)
    && lockedRange.caption.includes(readDay(LIMIT_LABEL_INDEX + LOCKED_RANGE_LAST_INDEX))
    && isWindowAtMask(lockedRange),
    JSON.stringify(lockedRange));
  check('limitDate at the label before the last leaves the window the last two labels',
    beforeLastLabel.caption.includes(readDay(LIMIT_LABEL_COUNT - 1))
    && Math.abs(beforeLastLabel.maskShare - (LIMIT_LABEL_COUNT - 2) / (LIMIT_LABEL_COUNT - 1)) <= LIMIT_MASK_TOLERANCE
    && isWindowAtMask(beforeLastLabel) && Math.abs(beforeLastLabel.window[1] - 1) <= LIMIT_MASK_TOLERANCE,
    JSON.stringify(beforeLastLabel));

  const unlocked = {};
  for (const [name, config] of Object.entries({
    noHandler: { limitDate: limitLabels[LIMIT_LABEL_INDEX] },
    firstLabel: { limitDate: limitLabels[0] },
    lastLabel: { limitDate: limitLabels[LIMIT_LABEL_COUNT - 1] },
    pastLastLabel: { limitDate: limitLabels[LIMIT_LABEL_COUNT - 1] + HOUR_MS },
    noMinimap: { limitDate: limitLabels[LIMIT_LABEL_INDEX], withMinimap: false },
  })) {
    await mountLimitProbe(config, false);
    unlocked[name] = await readLimit();
    await unmountProbe(page);
  }
  const { noHandler, ...unlimited } = unlocked;
  check('the mask of limitDate lets the pointer through without onLimitedRangeClick',
    noHandler.maskPointer === 'none' && noHandler.caption.startsWith(firstOpenDay), JSON.stringify(noHandler));
  check('limitDate at or before the first label or after the label before the last, or with no minimap, locks none',
    Object.values(unlimited).every(({ caption, maskShare }) => caption.startsWith(firstDay) && maskShare === undefined),
    JSON.stringify(unlimited));

  // --- A loading chart: a skeleton in the chart's own geometry in place of data with no labels, or its data dimmed ---
  // The skeleton of a line chart takes the boxes of the chart its data builds: the plot, the minimap and a pill for
  // each legend entry, checked or not. The plot draws a block over its data area alone in the colour of the skin, which
  // follows a change of skin, the minimap and the pills take the colour too, and the chart and its legend are inert. A
  // pie draws a circle, a donut a ring, and a legend in `legendContainer` takes a grey of its own.
  const loadingSkeleton = await page.evaluate(async (width) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const wasHtmlDark = document.documentElement.classList.contains('theme-dark');
    document.documentElement.classList.add('theme-dark');
    const labels = Array.from({ length: 30 }, (_, i) => Date.UTC(2026, 0, 1 + i));
    const datasets = [{ name: 'Desktop' }, { name: 'Mobile users' }, { name: 'Tablet', isInitiallyHidden: true }];
    const elements = [];
    const build = (config) => {
      const element = document.createElement('div');
      element.style.width = `${width}px`;
      document.getElementById('container').appendChild(element);
      elements.push(element);
      return { element, chart: new LovelyChart(element, { title: 'Probe — Loading', type: 'line', ...config }) };
    };
    const emptyDatasets = datasets.map((dataset) => ({ ...dataset, values: [] }));
    const legend = document.createElement('div');
    document.getElementById('container').appendChild(legend);
    elements.push(legend);
    const skeleton = build({ labels: [], datasets: emptyDatasets, withMinimap: true, isLoading: true });
    const loaded = build({
      labels,
      datasets: datasets.map((dataset, k) => ({
        ...dataset, values: labels.map((_, i) => 50 + ((i * 37 * (k + 1)) % 101)),
      })),
      withMinimap: true,
    });
    const pie = build({ type: 'pie', labels: [], datasets: emptyDatasets, isLoading: true });
    const donut = build({ type: 'donut', labels: [], datasets: emptyDatasets, isLoading: true });
    const outsideLegend = build({ labels: [], datasets: emptyDatasets, isLoading: true, legendContainer: legend });
    await window.idleTracker.wait(600);

    const readPixel = (canvas, [x, y]) => {
      const scale = canvas.width / canvas.clientWidth;
      return [...canvas.getContext('2d').getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data];
    };
    const measure = ({ element }) => {
      const origin = element.getBoundingClientRect();
      const box = (el) => {
        const rect = el.getBoundingClientRect();
        return [rect.left - origin.left, rect.top - origin.top, rect.width, rect.height];
      };
      const container = element.querySelector('.lovely-chart--container');
      return {
        height: container.getBoundingClientRect().height,
        plot: box(container.querySelector(':scope > canvas')),
        minimap: box(container.querySelector('.lovely-chart--minimap')),
        legend: [...container.querySelectorAll('.lovely-chart--button')].map(box),
      };
    };
    // The data area on the canvas, by the plot-area properties of the element, and the pixels at its middle, in the
    // gutter left of it and in the X-axis band under it
    const readPlotSkeleton = ({ element }) => {
      const canvas = element.querySelector('.lovely-chart--container > canvas');
      const canvasRect = canvas.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const [left, top, areaWidth, areaHeight] = ['left', 'top', 'width', 'height']
        .map((key) => parseFloat(element.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
      const area = {
        left: left - (canvasRect.left - elementRect.left),
        top: top - (canvasRect.top - elementRect.top),
        width: areaWidth,
        height: areaHeight,
      };
      const middle = [area.left + area.width / 2, area.top + area.height / 2];
      return {
        area,
        middle: readPixel(canvas, middle),
        gutter: readPixel(canvas, [area.left / 2, middle[1]]),
        xAxisBand: readPixel(canvas, [middle[0], (area.top + area.height + canvas.clientHeight) / 2]),
      };
    };
    const readSkeletonColors = ({ element }) => {
      const container = element.querySelector('.lovely-chart--container');
      const swatch = document.createElement('div');
      swatch.style.background = 'var(--skeleton-color)';
      container.appendChild(swatch);
      const skinColor = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      const minimap = container.querySelector('.lovely-chart--minimap');
      return {
        skinColor,
        minimap: getComputedStyle(minimap).backgroundColor,
        isRulerHidden: getComputedStyle(minimap.querySelector('.lovely-chart--minimap-ruler')).visibility === 'hidden',
      };
    };
    const readPills = (tools) => [...tools.querySelectorAll('.lovely-chart--button')].map((button) => ({
      fill: getComputedStyle(button).backgroundColor,
      border: getComputedStyle(button).borderTopColor,
      isLabelHidden: getComputedStyle(button.querySelector('.lovely-chart--button-label')).visibility === 'hidden',
    }));
    // The middle of the circle, a point of the ring between the hole of a donut, half the radius, and the edge, and a
    // corner of the square around the circle
    const readCircle = ({ element }) => {
      const { area } = readPlotSkeleton({ element });
      const canvas = element.querySelector('.lovely-chart--container > canvas');
      const center = [area.left + area.width / 2, area.top + area.height / 2];
      return {
        center: readPixel(canvas, center),
        ring: readPixel(canvas, [center[0] + area.width * 0.375, center[1]]),
        corner: readPixel(canvas, [area.left + 2, area.top + 2]),
      };
    };

    const skeletonContainer = skeleton.element.querySelector('.lovely-chart--container');
    const result = {
      skeleton: measure(skeleton),
      loaded: measure(loaded),
      nightPlot: readPlotSkeleton(skeleton),
      nightColors: readSkeletonColors(skeleton),
      pills: readPills(skeletonContainer.querySelector('.lovely-chart--tools')),
      isInert: skeletonContainer.inert && skeletonContainer.querySelector('.lovely-chart--tools').inert,
      caption: skeletonContainer.querySelector('.lovely-chart--header-caption').textContent,
      pie: readCircle(pie),
      donut: readCircle(donut),
      outsideLegend: { isInert: legend.firstElementChild.inert, pills: readPills(legend) },
      outsideChartInert: outsideLegend.element.querySelector('.lovely-chart--container').inert,
    };

    document.documentElement.classList.remove('theme-dark');
    await window.idleTracker.wait(300);
    result.dayPlot = readPlotSkeleton(skeleton);
    result.dayColors = readSkeletonColors(skeleton);
    document.documentElement.classList.toggle('theme-dark', wasHtmlDark);

    [skeleton, loaded, pie, donut, outsideLegend].forEach(({ chart }) => chart.destroy());
    elements.forEach((element) => element.remove());
    return result;
  }, LOADING_PROBE_WIDTH);
  const {
    skeleton: skeletonLayout, loaded: loadedLayout, nightPlot: nightPlotSkeleton, dayPlot: dayPlotSkeleton,
    nightColors: nightSkeletonColors, dayColors: daySkeletonColors, pie: pieSkeleton, donut: donutSkeleton,
  } = loadingSkeleton;
  const isSameBox = (box, otherBox) => box.every((side, i) => isNear(side, otherBox[i]));
  const isPixelPicked = (pixel, { red, green, blue, alpha }) => (
    [red, green, blue, alpha].every(([min, max], k) => pixel[k] >= min && pixel[k] <= max)
  );
  const isClearPixel = (pixel) => pixel[3] === 0;
  check('a loading chart with no labels takes the boxes of the chart its data builds: plot, minimap and legend pills',
    isNear(skeletonLayout.height, loadedLayout.height) && isSameBox(skeletonLayout.plot, loadedLayout.plot)
    && isSameBox(skeletonLayout.minimap, loadedLayout.minimap)
    && skeletonLayout.legend.length === loadedLayout.legend.length
    && skeletonLayout.legend.every((box, i) => isSameBox(box, loadedLayout.legend[i])),
    JSON.stringify({ skeletonLayout, loadedLayout }));
  check('the plot skeleton fills the data area alone, in the colour of either skin',
    isPixelPicked(nightPlotSkeleton.middle, NIGHT_SKELETON_PIXEL)
    && isPixelPicked(dayPlotSkeleton.middle, DAY_SKELETON_PIXEL)
    && [nightPlotSkeleton, dayPlotSkeleton].every(({ gutter, xAxisBand }) => (
      isClearPixel(gutter) && isClearPixel(xAxisBand)
    )),
    JSON.stringify({ nightPlotSkeleton, dayPlotSkeleton }));
  check('the minimap skeleton takes --skeleton-color in either skin, without its ruler',
    [nightSkeletonColors, daySkeletonColors].every(({ skinColor, minimap, isRulerHidden }) => (
      minimap === skinColor && skinColor !== 'rgba(0, 0, 0, 0)' && isRulerHidden
    )) && nightSkeletonColors.skinColor !== daySkeletonColors.skinColor,
    JSON.stringify({ nightSkeletonColors, daySkeletonColors }));
  check('the legend skeleton is a pill of --skeleton-color for each entry, its label hidden, checked or not',
    loadingSkeleton.pills.length === 3 && loadingSkeleton.pills.every(({ fill, border, isLabelHidden }) => (
      fill === nightSkeletonColors.skinColor && border === 'rgba(0, 0, 0, 0)' && isLabelHidden
    )),
    JSON.stringify(loadingSkeleton.pills));
  check('a loading chart and its legend are inert, the legend in legendContainer too, and the caption stays empty',
    loadingSkeleton.isInert && loadingSkeleton.outsideChartInert && loadingSkeleton.outsideLegend.isInert
    && !loadingSkeleton.caption,
    JSON.stringify({
      isInert: loadingSkeleton.isInert,
      outsideChartInert: loadingSkeleton.outsideChartInert,
      outsideLegendInert: loadingSkeleton.outsideLegend.isInert,
      caption: loadingSkeleton.caption,
    }));
  check('a legend skeleton in legendContainer takes a grey of its own',
    loadingSkeleton.outsideLegend.pills.length === 3 && loadingSkeleton.outsideLegend.pills.every(({ fill }) => (
      fill !== 'rgba(0, 0, 0, 0)'
    )),
    JSON.stringify(loadingSkeleton.outsideLegend));
  check('a pie skeleton fills its circle and a donut skeleton its ring, the corners of their squares left clear',
    isPixelPicked(pieSkeleton.center, NIGHT_SKELETON_PIXEL) && isPixelPicked(pieSkeleton.ring, NIGHT_SKELETON_PIXEL)
    && isClearPixel(donutSkeleton.center) && isPixelPicked(donutSkeleton.ring, NIGHT_SKELETON_PIXEL)
    && isClearPixel(pieSkeleton.corner) && isClearPixel(donutSkeleton.corner),
    JSON.stringify({ pieSkeleton, donutSkeleton }));

  // The skeleton pulses unless the reader prefers reduced motion
  const readSkeletonAnimations = () => page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    document.getElementById('container').appendChild(element);
    const chart = new LovelyChart(element, {
      type: 'line', labels: [], datasets: [{ name: 'A', values: [] }, { name: 'B', values: [] }], isLoading: true,
    });
    await window.idleTracker.wait(300);
    const animations = element.querySelector('.lovely-chart--container > canvas').getAnimations().length;
    chart.destroy();
    element.remove();
    return animations;
  });
  const pulsingAnimations = await readSkeletonAnimations();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const stillAnimations = await readSkeletonAnimations();
  // Playwright restores the preference on `null` alone
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ reducedMotion: null });
  check('the skeleton pulses, unless the reader prefers reduced motion',
    pulsingAnimations === 1 && stillAnimations === 0, JSON.stringify({ pulsingAnimations, stillAnimations }));

  // `setLoading()` takes the skeleton of data with no labels away in place, so the chart draws nothing, with no error,
  // and brings it back. A browser without `roundRect` draws the block with square corners.
  const errorsBefore = errors.length;
  const { shown: shownSkeleton, cleared: clearedSkeleton, squared: squaredSkeleton } = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    document.getElementById('container').appendChild(element);
    const chart = new LovelyChart(element, {
      type: 'line', labels: [], datasets: [{ name: 'A', values: [] }, { name: 'B', values: [] }], isLoading: true,
    });
    const container = element.querySelector('.lovely-chart--container');
    const canvas = container.querySelector(':scope > canvas');
    const read = async () => {
      await window.idleTracker.wait(300);
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const parts = [container, container.querySelector('.lovely-chart--tools')];
      return {
        painted: data.filter((channel, j) => j % 4 === 3 && channel).length,
        states: parts.flatMap(({ inert, classList }) => [inert, classList.contains('lovely-chart--state-skeleton')]),
        isSameContainer: element.querySelector('.lovely-chart--container') === container,
      };
    };
    const shown = await read();
    chart.setLoading(false);
    const cleared = await read();
    const { roundRect } = CanvasRenderingContext2D.prototype;
    delete CanvasRenderingContext2D.prototype.roundRect;
    chart.setLoading(true);
    const squared = await read();
    CanvasRenderingContext2D.prototype.roundRect = roundRect;
    chart.destroy();
    element.remove();
    return { shown, cleared, squared };
  });
  check('setLoading(false) takes the skeleton away in place, and data with no labels that does not load draws nothing',
    shownSkeleton.painted > 0 && shownSkeleton.states.every(Boolean)
    && !clearedSkeleton.painted && !clearedSkeleton.states.some(Boolean) && clearedSkeleton.isSameContainer
    && errors.length === errorsBefore,
    JSON.stringify({ shownSkeleton, clearedSkeleton, errors: errors.slice(errorsBefore) }));
  check('setLoading(true) brings the skeleton back, with square corners in a browser without roundRect',
    squaredSkeleton.painted > shownSkeleton.painted && squaredSkeleton.states.every(Boolean)
    && squaredSkeleton.isSameContainer,
    JSON.stringify({ shownSkeleton, squaredSkeleton }));

  // A loading chart with labels dims its plot, minimap and legend, and takes no pointer: hovering the plot opens no
  // balloon, a click on it zooms nothing, and a click on the legend hides nothing. `setLoading()` shows the data in
  // full and dims it again in place, with no callback: the chart keeps the datasets the reader hid and the zoom. A zoom
  // that redraws the legend keeps it as the chart loads or not.
  await page.evaluate(async (hourMs) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    const labels = Array.from({ length: 14 }, (_, i) => Date.UTC(2026, 0, 1 + i));
    const buildDatasets = (length, suffix) => [
      { name: `A${suffix}`, values: Array.from({ length }, (_, i) => 10 + i) },
      { name: `B${suffix}`, values: Array.from({ length }, (_, i) => 30 - i) },
    ];
    window.probeChart = new LovelyChart(element, {
      title: 'Probe — Loading data',
      type: 'line',
      withMinimap: true,
      labels,
      datasets: buildDatasets(labels.length, ''),
      isLoading: true,
      onZoom: (day) => Promise.resolve({
        type: 'line',
        labels: Array.from({ length: 24 }, (_, hour) => day + hour * hourMs),
        datasets: buildDatasets(24, ' hourly'),
      }),
      onZoomChange: (labelValue) => window.probeLog.push(labelValue === undefined ? 'zoom out' : 'zoom in'),
      onHiddenSeriesChange: (names) => window.probeLog.push(`hidden ${names}`),
      onSelectedIndexChange: (labelIndex) => window.probeLog.push(`selected ${labelIndex}`),
    });
    window.probeContainer = element.querySelector('.lovely-chart--container');
    element.scrollIntoView({ block: 'center' });
  }, HOUR_MS);
  await waitForIdle(page, 1200);
  const readLoadingProbe = () => page.evaluate(() => {
    const container = document.querySelector('#probe .lovely-chart--container');
    return {
      opacities: [':scope > canvas', '.lovely-chart--minimap', '.lovely-chart--tools']
        .map((selector) => Number(getComputedStyle(container.querySelector(selector)).opacity)),
      isInert: container.inert,
      isSameContainer: container === window.probeContainer,
      pressed: [...container.querySelectorAll('.lovely-chart--button')].map((button) => (
        button.getAttribute('aria-pressed')
      )),
      isBalloonShown: Boolean(container.querySelector('.lovely-chart--tooltip-balloon.lovely-chart--state-shown')),
      log: [...window.probeLog],
    };
  });
  const setProbeLoading = async (isLoading) => {
    await page.evaluate((isProbeLoading) => window.probeChart.setLoading(isProbeLoading), isLoading);
    await waitForIdle(page, LOADING_FADE_MS);
  };
  // A click by the position of the first legend button, as an inert one takes no click of its own
  const clickFirstLegendButton = async () => {
    const box = await page.locator('#probe .lovely-chart--button').first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForIdle(page, 300);
  };
  const loadingPlotBox = await page.locator('#probe .lovely-chart--tooltip').boundingBox();
  await page.mouse.move(
    loadingPlotBox.x + loadingPlotBox.width / 2, loadingPlotBox.y + loadingPlotBox.height / 2, { steps: 5 },
  );
  await waitForIdle(page, 400);
  const hoveredLoading = await readLoadingProbe();
  await clickProbeMiddle('#probe .lovely-chart--tooltip');
  await waitForIdle(page, ZOOM_SETTLE_MS);
  await clickFirstLegendButton();
  await page.mouse.move(0, 0);
  const dimmed = await readLoadingProbe();
  await setProbeLoading(false);
  await clickFirstLegendButton();
  const shownLoading = await readLoadingProbe();
  await clickProbeMiddle('#probe .lovely-chart--tooltip');
  await waitForIdle(page, ZOOM_SETTLE_MS);
  await page.mouse.move(0, 0);
  const zoomed = await readLoadingProbe();
  await setProbeLoading(true);
  const zoomedLoading = await readLoadingProbe();
  await page.evaluate(() => window.probeChart.zoomOut());
  await waitForIdle(page, ZOOM_SETTLE_MS);
  const zoomedOutLoading = await readLoadingProbe();
  await setProbeLoading(false);
  const loadedAgain = await readLoadingProbe();
  await unmountProbe(page);
  const isDimmed = ({ opacities, isInert, isSameContainer }) => (
    opacities.every((opacity) => opacity === LOADING_OPACITY) && isInert && isSameContainer
  );
  const isShown = ({ opacities, isInert, isSameContainer }) => (
    opacities.every((opacity) => opacity === 1) && !isInert && isSameContainer
  );
  check('a loading chart dims its plot, minimap and legend, and is inert',
    isDimmed(dimmed), JSON.stringify(dimmed));
  check('a loading chart opens no balloon on hover, and a click on the plot or the legend neither zooms nor hides',
    !hoveredLoading.isBalloonShown && !hoveredLoading.log.length && !dimmed.log.length,
    JSON.stringify({ hoveredLoading, dimmed }));
  check('setLoading(false) shows the data in full in place, and the legend takes a click again',
    isShown(shownLoading) && JSON.stringify(shownLoading.log) === '["hidden A"]'
    && JSON.stringify(shownLoading.pressed) === '["false","true"]',
    JSON.stringify(shownLoading));
  check('a zoom shows the chart as loaded, and setLoading(true) dims it in place, which stays zoomed with no callback',
    zoomed.log.includes('zoom in') && isShown(zoomed) && isDimmed(zoomedLoading)
    && JSON.stringify(zoomedLoading.log) === JSON.stringify(zoomed.log),
    JSON.stringify({ zoomed, zoomedLoading }));
  check('a zoom out while loading keeps the chart and its legend dimmed, and the datasets the reader hid',
    isDimmed(zoomedOutLoading) && zoomedOutLoading.log.at(-1) === 'zoom out'
    && JSON.stringify(zoomedOutLoading.pressed) === '["false","true"]'
    && isShown(loadedAgain) && JSON.stringify(loadedAgain.pressed) === '["false","true"]',
    JSON.stringify({ zoomedOutLoading, loadedAgain }));
});

section('Keyboard selection, the tooltip content `onTooltipChange` reports and a balloon the page '
  + 'hides', async ({ page }) => {
  // The keys step inside the window the minimap opens on, the last 20% of 101 labels, from 80 to 100
  await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeKeys = [];
    window.probeKeyListener = (e) => window.probeKeys.push([e.key, e.defaultPrevented]);
    document.addEventListener('keydown', window.probeKeyListener);
    const count = 101;
    window.probeParams = {
      type: 'line',
      title: 'Probe — Keyboard selection',
      withMinimap: true,
      isKeyboardSelectable: true,
      labels: Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length: count }, (_, i) => i % 7) }],
      onSelectedIndexChange: (index) => window.probeLog.push(index ?? 'none'),
    };
    window.probeChart = new LovelyChart(element, window.probeParams);
    await window.idleTracker.wait(1200);
  });
  const keyLayer = page.locator('#probe .lovely-chart--tooltip');
  await keyLayer.scrollIntoViewIfNeeded();
  await keyLayer.focus();
  const readLastSelection = () => page.evaluate(() => window.probeLog.at(-1));
  const pressKeys = async (keys) => {
    const selections = [];
    for (const key of keys) {
      await page.keyboard.press(key);
      await waitForIdle(page, 150);
      selections.push(await readLastSelection());
    }
    return selections;
  };
  const steppingKeys = ['ArrowLeft', 'ArrowLeft', 'Home', 'ArrowLeft', 'ArrowRight', 'End', 'ArrowRight'];
  const keySelections = await pressKeys(steppingKeys);
  const steppedLog = await page.evaluate(() => [...window.probeLog]);
  const otherKeySelections = await pressKeys(['Control+ArrowLeft', 'ArrowUp']);
  const keyDefaults = await page.evaluate(() => window.probeKeys.filter(([key]) => key !== 'Control'));
  await hoverWiggle(page, await keyLayer.boundingBox(), 0.5, 0.5);
  const pointedIndex = await readLastSelection();
  const [steppedFromPointer] = await pressKeys(['ArrowLeft']);
  await page.mouse.move(5, 5);
  // `update()` and a resize rebuild the plot, which keeps the focus and the keys
  const isKeyLayerFocused = () => page.evaluate(() => (
    document.activeElement === document.querySelector('#probe .lovely-chart--tooltip')
  ));
  await keyLayer.focus();
  await page.evaluate(() => window.probeChart.update(window.probeParams));
  await waitForIdle(page, 300);
  const isFocusedAfterUpdate = await isKeyLayerFocused();
  const [keyAfterUpdate] = await pressKeys(['End']);
  const keyViewport = page.viewportSize();
  await page.setViewportSize({ width: keyViewport.width - 20, height: keyViewport.height });
  await waitForIdle(page, 1200);
  const isFocusedAfterResize = await isKeyLayerFocused();
  await page.setViewportSize(keyViewport);
  await waitForIdle(page, 1200);
  const keyFocusable = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const readTabIndex = (params) => {
      const element = document.createElement('div');
      document.getElementById('container').appendChild(element);
      const chart = new LovelyChart(element, {
        labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
        datasets: [{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [3, 2, 1] }],
        ...params,
      });
      const tabIndex = element.querySelector('.lovely-chart--tooltip').getAttribute('tabindex');
      chart.destroy();
      element.remove();
      return tabIndex ?? 'none';
    };
    document.removeEventListener('keydown', window.probeKeyListener);
    return {
      selectable: document.querySelector('#probe .lovely-chart--tooltip').getAttribute('tabindex'),
      plain: readTabIndex({ type: 'line' }),
      pie: readTabIndex({ type: 'pie', isKeyboardSelectable: true }),
    };
  });
  await unmountProbe(page);
  check('isKeyboardSelectable puts the plot in the tab order, unless it is a pie, and a chart without it stays out',
    JSON.stringify(keyFocusable) === '{"selectable":"0","plain":"none","pie":"none"}', JSON.stringify(keyFocusable));
  check('the arrows step the selection from the last label of the window, and Home and End select its first and last',
    JSON.stringify(keySelections) === '[100,99,80,80,81,100,100]'
    && JSON.stringify(steppedLog) === '[100,99,80,81,100]',
    JSON.stringify({ keySelections, steppedLog }));
  check('a key the chart takes has its default prevented, and one with a modifier or another key stays the page\'s',
    JSON.stringify(otherKeySelections) === '[100,100]'
    && JSON.stringify(keyDefaults) === JSON.stringify([
      ...steppingKeys.map((key) => [key, true]), ['ArrowLeft', false], ['ArrowUp', false],
    ]),
    JSON.stringify({ otherKeySelections, keyDefaults }));
  check('an arrow steps from the label the pointer selected',
    pointedIndex > 80 && pointedIndex < 100 && steppedFromPointer === pointedIndex - 1,
    JSON.stringify({ pointedIndex, steppedFromPointer }));
  check('the plot keeps the focus and the keys through update() and a resize',
    isFocusedAfterUpdate && keyAfterUpdate === 100 && isFocusedAfterResize,
    JSON.stringify({ isFocusedAfterUpdate, keyAfterUpdate, isFocusedAfterResize }));

  // The pie a zoom opens takes no keys and leaves the tab order, and the bars it zooms out to take them back
  const pieZoomKeys = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const count = 10;
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Keys on the pie of a zoom',
      zoomToShares: true,
      isKeyboardSelectable: true,
      initialZoom: 'last',
      labels: Array.from({ length: count }, (_, i) => Date.UTC(2026, 10, 1 + i)),
      datasets: [{ name: 'A', values: Array(count).fill(2) }, { name: 'B', values: Array(count).fill(1) }],
      onSelectedIndexChange: (index) => log.push(index ?? 'none'),
    });
    await window.idleTracker.wait(1800);
    // Whether the plot is in the tab order, whether it takes the key and the selections the key makes
    const readKey = (key) => {
      log.length = 0;
      const plot = element.querySelector('.lovely-chart--tooltip');
      const isTaken = !plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      return { tabIndex: plot.getAttribute('tabindex') ?? 'none', isTaken, log: [...log] };
    };
    const zoomed = readKey('End');
    element.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').click();
    await window.idleTracker.wait(2000);
    const zoomedOut = readKey('End');
    window.probeChart.destroy();
    element.remove();
    return { zoomed, zoomedOut };
  });
  check('the pie a zoom opens takes no keys and leaves the tab order, and the bars it zooms out to take them back',
    JSON.stringify(pieZoomKeys) === JSON.stringify({
      zoomed: { tabIndex: 'none', isTaken: false, log: [] },
      zoomedOut: { tabIndex: '0', isTaken: true, log: [9] },
    }),
    JSON.stringify(pieZoomKeys));

  // A stacked bar chart against the previous period: a gap, a zero, a resolved total, a `null` one, a gap of the
  // previous period and a hidden dataset, then the line chart `update()` swaps in, which has no total. The public API
  // marks a gap and a missing total with `null`.
  /* eslint-disable no-null/no-null */
  const tooltipLabels = [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day));
  const tooltipSteps = await page.evaluate(async (labels) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    const params = {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Tooltip content',
      labels,
      isUtc: true,
      tooltipFormatter: 'statsTooltipFormat(\'day\')',
      datasets: [
        { name: 'A', values: [10, 20, 30, 40, 50] },
        { name: 'B', values: [5, 0, 15, null, 25] },
        { name: 'C', values: [1, 2, 3, 4, 5] },
      ],
      comparison: { name: 'Week before', values: [[8, 16, 24, 32, 40], [4, 4, 12, 4, 20], [1, 1, 1, 1, null]] },
      resolveTooltipTotal: (value, datasetIndexes, index) => {
        if (index === 1) return 100;
        return index === 2 ? null : undefined;
      },
      onSelectedIndexChange: (index) => log.push(['selected', index ?? 'none']),
      onTooltipChange: (tooltip) => log.push(['tooltip', tooltip ?? 'none']),
    };
    window.probeChart = new LovelyChart(element, params);
    await window.idleTracker.wait(1200);
    // The reports of a step, and what the balloon shows after it
    const readStep = async (action, ms = 300) => {
      log.length = 0;
      action();
      await window.idleTracker.wait(ms);
      const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
      return {
        log: [...log],
        title: balloon.querySelector('.lovely-chart--tooltip-title > span')?.textContent,
        total: balloon.querySelector('[data-total="true"] .lovely-chart--tooltip-dataset-value')?.textContent,
        change: balloon.querySelector('.lovely-chart--tooltip-change')?.textContent,
        display: getComputedStyle(balloon).display,
      };
    };
    const steps = {
      atGap: await readStep(() => window.probeChart.selectLabel(3)),
      repeated: await readStep(() => window.probeChart.selectLabel(3)),
      atZero: await readStep(() => window.probeChart.selectLabel(1)),
      atNullTotal: await readStep(() => window.probeChart.selectLabel(2)),
      atPreviousGap: await readStep(() => window.probeChart.selectLabel(4)),
      beforeHiding: await readStep(() => window.probeChart.selectLabel(3)),
      afterHiding: await readStep(() => element.querySelectorAll('.lovely-chart--button')[2].click(), 800),
      afterClearing: await readStep(() => window.probeChart.selectLabel(undefined)),
      beforeUpdate: await readStep(() => window.probeChart.selectLabel(3)),
      afterUpdate: await readStep(() => window.probeChart.update({ ...params, type: 'line', isStacked: false }), 1200),
      onLine: await readStep(() => window.probeChart.selectLabel(3)),
    };
    window.probeChart.destroy();
    element.remove();
    return steps;
  }, tooltipLabels);
  const buildChange = (current, previous) => (current / previous - 1) * 100;
  // Whether the last report of a step is the content of the label, its title the one the balloon shows
  const isReported = (step, labelIndex, values, total, comparison) => {
    const [kind, tooltip] = step.log.at(-1) ?? [];
    const rows = values.map((value, i) => ({ datasetIndex: i, name: 'ABC'[i], value }));
    return kind === 'tooltip' && JSON.stringify(tooltip) === JSON.stringify({
      labelIndex,
      title: step.title,
      rows,
      ...(total !== undefined && { total }),
      comparison: { name: 'Week before', ...comparison },
    });
  };
  // Whether the balloon shows the reported total and the reported change, rounded
  const isBalloonMatched = (step) => {
    const { total, comparison: { change } } = step.log.at(-1)[1];
    const rounded = Math.round(change);
    return step.total === (total === null ? '—' : String(total))
      && step.change === (change === undefined ? undefined : `${rounded > 0 ? '+' : ''}${rounded}%`);
  };
  const {
    atGap, repeated, atZero, atNullTotal, atPreviousGap, beforeHiding, afterHiding, afterClearing, afterUpdate, onLine,
  } = tooltipSteps;
  const contentSteps = [atGap, atZero, atNullTotal, atPreviousGap];
  check('onTooltipChange reports, after the index, the title, the datasets on screen, the total and the comparison',
    atGap.log.length === 2 && JSON.stringify(atGap.log[0]) === '["selected",3]'
    && isReported(atGap, 3, [40, null, 4], 44, { value: 37, change: buildChange(44, 37) })
    && isReported(atZero, 1, [20, 0, 2], 100, { value: 21, change: buildChange(100, 21) })
    && isReported(atNullTotal, 2, [30, 15, 3], null, { value: 37 })
    && isReported(atPreviousGap, 4, [50, 25, 5], 80, { value: null }),
    JSON.stringify(contentSteps.map(({ log }) => log)));
  check('onTooltipChange reports the title, the total and the change the balloon shows',
    contentSteps.every((step) => step.title && isBalloonMatched(step)) && atGap.display === 'block',
    JSON.stringify(contentSteps.map(({ title, total, change, display }) => ({ title, total, change, display }))));
  check('onTooltipChange reports a hidden dataset once, and nothing for a selection that changes nothing',
    repeated.log.length === 0 && beforeHiding.log.length === 2 && afterHiding.log.length === 1
    && isReported(afterHiding, 3, [40, null], 40, { value: 36, change: buildChange(40, 36) }),
    JSON.stringify({ repeated, beforeHiding, afterHiding }));
  check('onTooltipChange reports undefined once nothing is selected, by selectLabel(undefined) or update()',
    JSON.stringify(afterClearing.log) === '[["selected","none"],["tooltip","none"]]'
    && JSON.stringify(afterUpdate.log) === '[["selected","none"],["tooltip","none"]]',
    JSON.stringify({ afterClearing: afterClearing.log, afterUpdate: afterUpdate.log }));
  check('onTooltipChange reports no total for a line chart',
    isReported(onLine, 3, [40, null, 4], undefined, { value: 37, change: buildChange(44, 37) }),
    JSON.stringify(onLine.log));
  /* eslint-enable no-null/no-null */

  // A callback of the reports that selects again, as a page keeping the last label the reader selected does, or that
  // clears the selection has the content of its own selection reported last
  const reselectedSteps = await page.evaluate(async (labels) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const log = [];
    let keptIndex;
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Selections of the callbacks',
      labels,
      datasets: [{ name: 'A', values: [1, 2, 3, 4, 5] }],
      onSelectedIndexChange: (index) => {
        log.push(['selected', index ?? 'none']);
        if (index === undefined && keptIndex !== undefined) {
          window.probeChart.selectLabel(keptIndex);
        } else if (index === 3) {
          window.probeChart.selectLabel(undefined);
        }
      },
      onTooltipChange: (tooltip) => log.push(['tooltip', tooltip?.labelIndex ?? 'none']),
    });
    await window.idleTracker.wait(1200);
    const readStep = async (action) => {
      log.length = 0;
      action();
      await window.idleTracker.wait(300);
      const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
      return { log: [...log], isShown: balloon.classList.contains('lovely-chart--state-shown') };
    };
    const selected = await readStep(() => window.probeChart.selectLabel(1));
    keptIndex = 1;
    const kept = await readStep(() => window.probeChart.selectLabel(undefined));
    keptIndex = undefined;
    const cleared = await readStep(() => window.probeChart.selectLabel(3));
    window.probeChart.destroy();
    element.remove();
    return { selected, kept, cleared };
  }, tooltipLabels);
  check('onTooltipChange reports last the selection a callback of the reports makes or clears',
    JSON.stringify(reselectedSteps) === JSON.stringify({
      selected: { log: [['selected', 1], ['tooltip', 1]], isShown: true },
      kept: { log: [['selected', 'none'], ['selected', 1]], isShown: true },
      cleared: { log: [['selected', 3], ['selected', 'none'], ['tooltip', 'none']], isShown: false },
    }),
    JSON.stringify(reselectedSteps));

  // A pie shows its balloon over a sector and reports no tooltip content, while a line chart whose element hides the
  // balloon keeps the hover line and the dots and reports the selection and the content
  const readReportingProbe = async (config, hostStyle = '', shouldCountHoverPixels = false) => {
    await page.evaluate(async (spec) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const element = document.createElement('div');
      element.id = 'probe';
      element.style.cssText = spec.hostStyle;
      document.getElementById('container').appendChild(element);
      window.probeLog = [];
      window.probeChart = new LovelyChart(element, {
        ...spec.config,
        onSelectedIndexChange: (index) => window.probeLog.push(['selected', index ?? 'none']),
        onTooltipChange: (tooltip) => window.probeLog.push(['tooltip', tooltip ?? 'none']),
      });
      await window.idleTracker.wait(1200);
    }, { config, hostStyle });
    const plot = page.locator('#probe .lovely-chart--container > canvas');
    await plot.scrollIntoViewIfNeeded();
    await hoverWiggle(page, await plot.boundingBox(), 0.5, 0.45);
    const reports = await page.evaluate((isCounting) => {
      const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
      const balloonState = {
        isShown: balloon.classList.contains('lovely-chart--state-shown'),
        display: getComputedStyle(balloon).display,
        log: window.probeLog.map(([kind, value]) => [kind, value.labelIndex ?? value]),
      };
      if (!isCounting) return balloonState;

      const canvas = document.querySelector('#probe .lovely-chart--tooltip canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let hoverPixels = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]) hoverPixels++;
      }
      return { ...balloonState, hoverPixels };
    }, shouldCountHoverPixels);
    await page.mouse.move(5, 5);
    await unmountProbe(page);
    return reports;
  };
  const reportingDatasets = [{ name: 'A', values: [1, 2, 3, 4, 5] }, { name: 'B', values: [5, 4, 3, 2, 1] }];
  const pieReports = await readReportingProbe({
    type: 'pie', title: 'Probe — A pie that reports no tooltip', labels: tooltipLabels, datasets: reportingDatasets,
  });
  const hiddenBalloonReports = await readReportingProbe({
    type: 'line', title: 'Probe — A balloon the page hides', labels: tooltipLabels, datasets: reportingDatasets,
  }, '--lovely-chart-balloon-display: none', true);
  check('a pie shows its balloon and reports no tooltip content',
    pieReports.isShown && pieReports.display === 'block' && pieReports.log.length === 0, JSON.stringify(pieReports));
  // The pointer can cross other labels on its way to the middle one
  check('--lovely-chart-balloon-display: none hides the balloon and keeps the hover line, the dots and the reports',
    hiddenBalloonReports.isShown && hiddenBalloonReports.display === 'none'
    && hiddenBalloonReports.hoverPixels > MIN_DATASET_PIXELS
    && JSON.stringify(hiddenBalloonReports.log.slice(-2)) === '[["selected",2],["tooltip",2]]',
    JSON.stringify(hiddenBalloonReports));
});

section('The index of a label that `onZoomChange` and `resolveTooltipTotal` pass after its value', async ({ page }) => {
  // A text label's value is its index, and a date label's its timestamp. The data `onZoom` returns passes its own
  // `resolveTooltipTotal` the indexes of its own labels.
  const readLabelArguments = (labels) => page.evaluate(async (spec) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const log = [];
    const buildDatasets = (length) => ['A', 'B'].map((name, i) => ({
      name, values: Array.from({ length }, (_, j) => 10 * (i + 1) + j),
    }));
    const isText = typeof spec.labels[0] === 'string';
    const params = {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Label indexes',
      labels: spec.labels,
      datasets: buildDatasets(spec.labels.length),
      zoomToShares: isText,
      onZoom: isText ? undefined : (day) => Promise.resolve({
        type: 'bar',
        isStacked: true,
        labels: Array.from({ length: 24 }, (_, hour) => day + hour * spec.hourMs),
        datasets: buildDatasets(24),
        resolveTooltipTotal: (value, datasetIndexes, index) => {
          log.push(['zoomed total', value, index]);
        },
      }),
      resolveTooltipTotal: (value, datasetIndexes, index) => {
        log.push(['total', value, index]);
      },
      onZoomChange: (value, index) => log.push(['zoom', value ?? 'none', index ?? 'none']),
    };
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    // The calls of the callbacks while a step settles, each distinct call once
    const readStep = async (action, ms) => {
      log.length = 0;
      action();
      await window.idleTracker.wait(ms);
      return [...new Set(log.map((entry) => JSON.stringify(entry)))].map((entry) => JSON.parse(entry));
    };
    const clickColumn = (labelIndex) => {
      const plot = element.querySelector('.lovely-chart--tooltip');
      const { left, top, width, height } = plot.getBoundingClientRect();
      plot.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: left + (width * (labelIndex + 0.5)) / spec.labels.length,
        clientY: top + height / 2,
      }));
    };
    const steps = {
      initialZoom: await readStep(() => {
        window.probeChart = new LovelyChart(element, { ...params, initialZoom: 2 });
      }, 1800),
      zoomedSelection: await readStep(() => window.probeChart.selectLabel(5), 300),
      zoomOut: await readStep(() => (
        element.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').click()
      ), 1500),
      selection: await readStep(() => window.probeChart.selectLabel(3), 300),
      zoomIn: await readStep(() => clickColumn(1), 1500),
      update: await readStep(() => window.probeChart.update(params), 300),
    };
    window.probeChart.destroy();
    element.remove();
    return steps;
  }, { labels, hourMs: HOUR_MS });
  const readZoomCalls = (calls) => JSON.stringify(calls.filter(([kind]) => kind === 'zoom'));
  const labelDays = Array.from({ length: 5 }, (_, i) => Date.UTC(2026, 10, 1 + i));
  const dateArguments = await readLabelArguments(labelDays);
  const textArguments = await readLabelArguments(['North', 'South', 'East', 'West', 'Central']);
  check('onZoomChange passes a date label\'s timestamp and its index, and undefined for both once zoomed out',
    readZoomCalls(dateArguments.initialZoom) === JSON.stringify([['zoom', labelDays[2], 2]])
    && readZoomCalls(dateArguments.zoomIn) === JSON.stringify([['zoom', labelDays[1], 1]])
    && readZoomCalls(dateArguments.zoomOut) === '[["zoom","none","none"]]'
    && readZoomCalls(dateArguments.update) === '[["zoom","none","none"]]',
    JSON.stringify(dateArguments));
  const zoomedHourTotal = ['zoomed total', labelDays[2] + 5 * HOUR_MS, 5];
  check('resolveTooltipTotal passes a date label\'s timestamp, then its index in the labels of its own data',
    JSON.stringify(dateArguments.selection) === JSON.stringify([['total', labelDays[3], 3]])
    && JSON.stringify(dateArguments.zoomedSelection) === JSON.stringify([zoomedHourTotal]),
    JSON.stringify(dateArguments));
  check('a text label\'s value is its index, in onZoomChange and resolveTooltipTotal',
    readZoomCalls(textArguments.initialZoom) === '[["zoom",2,2]]'
    && readZoomCalls(textArguments.zoomIn) === '[["zoom",1,1]]'
    && readZoomCalls(textArguments.zoomOut) === '[["zoom","none","none"]]'
    && readZoomCalls(textArguments.update) === '[["zoom","none","none"]]'
    && JSON.stringify(textArguments.selection) === '[["total",3,3]]',
    JSON.stringify(textArguments));
});

section('Colour schemes: the `theme-dark` class on <html>, or the system scheme, each against the '
  + 'other', async ({ page }) => {
  // A reference line of a colour per skin shows the skin of the canvas, and `--background-color` that of the CSS
  const schemeConfig = {
    type: 'line',
    labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'A', color: '#3497ED', values: [1, 3, 2, 4] }],
    referenceLines: [{ value: 2.5, color: { light: '#FF00FF', dark: '#00FFFF' } }],
  };
  const readSkins = async (chart) => {
    await waitForIdle(page, 300);
    const day = await findColor(chart, [255, 0, 255]);
    const night = await findColor(chart, [0, 255, 255]);
    const background = await chart.evaluate((el) => (
      getComputedStyle(el).getPropertyValue('--background-color').trim().toLowerCase()
    ));
    const canvas = (day.count > 50 && !night.count && 'day') || (night.count > 50 && !day.count && 'night') || 'mixed';
    return `${canvas} canvas, ${background}`;
  };
  const setHtmlDark = (isDark) => page.evaluate((value) => {
    document.documentElement.classList.toggle('theme-dark', value);
  }, isDark);
  const wasHtmlDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));

  const defaultSchemeChart = await mountProbe(page, { config: { ...schemeConfig, title: 'Probe — Default scheme' } });
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const defaultSchemeDay = await readSkins(defaultSchemeChart);
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const defaultSchemeNight = await readSkins(defaultSchemeChart);
  await unmountProbe(page);
  check('a chart without colorScheme follows the theme-dark class on <html>, not the system',
    defaultSchemeDay === 'day canvas, #ffffff' && defaultSchemeNight === 'night canvas, #242f3e',
    `dark system without the class: ${defaultSchemeDay}; light system with it: ${defaultSchemeNight}`);

  const classChart = await mountProbe(page, {
    config: { ...schemeConfig, title: 'Probe — HTML class name scheme', colorScheme: 'htmlClassName' },
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const classDay = await readSkins(classChart);
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const classNight = await readSkins(classChart);
  await unmountProbe(page);
  check('colorScheme htmlClassName follows the theme-dark class on <html>',
    classDay === 'day canvas, #ffffff' && classNight === 'night canvas, #242f3e',
    `without the class: ${classDay}; with it: ${classNight}`);

  const systemChart = await mountProbe(page, {
    config: { ...schemeConfig, title: 'Probe — System scheme', colorScheme: 'system' },
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const systemDay = await readSkins(systemChart);
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const systemNight = await readSkins(systemChart);
  // Playwright restores the system scheme on `null` alone
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ colorScheme: null });
  await setHtmlDark(wasHtmlDark);
  await unmountProbe(page);
  check('colorScheme system follows prefers-color-scheme',
    systemDay === 'day canvas, #ffffff' && systemNight === 'night canvas, #242f3e',
    `light: ${systemDay}; dark: ${systemNight}`);

  // A zoom into a lines view keeps the chart's scheme, live
  const schemeReferenceLines = [{ value: 25, color: { light: '#FF00FF', dark: '#00FFFF' } }];
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(false);
  const systemZoom = await mountLinesZoom(page, {
    overview: [{ name: 'A', color: '#3497ED' }, { name: 'B', color: '#E65850' }],
    zoomed: [{ name: 'C', color: '#3497ED' }, { name: 'D', color: '#E65850' }, { name: 'E', color: '#9ED448' }],
    config: { colorScheme: 'system', referenceLines: schemeReferenceLines },
    zoomConfig: { referenceLines: schemeReferenceLines },
  });
  await systemZoom.scrollIntoViewIfNeeded();
  const systemZoomPlot = await systemZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, systemZoomPlot, 0.5, 0.5);
  await page.mouse.click(systemZoomPlot.x + systemZoomPlot.width / 2, systemZoomPlot.y + systemZoomPlot.height / 2);
  await waitForIdle(page, 2000);
  await page.mouse.move(0, 0);
  const systemZoomDay = await readSkins(systemZoom);
  await page.emulateMedia({ colorScheme: 'dark' });
  const systemZoomNight = await readSkins(systemZoom);
  const isSystemZoomLines = await systemZoom.locator('.lovely-chart--button').count() === 3;
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ colorScheme: null });
  await setHtmlDark(wasHtmlDark);
  await unmountProbe(page);
  check('colorScheme system follows prefers-color-scheme through a zoom into a lines view',
    isSystemZoomLines && systemZoomDay === 'day canvas, #ffffff' && systemZoomNight === 'night canvas, #242f3e',
    `light: ${systemZoomDay}; dark: ${systemZoomNight}`);

  // --- A page's night colours, under the library's own night selectors, apply ---
  const nightOverride = await mountProbe(page, {
    dataUrl: './data/steps.json',
    config: { title: 'Probe — Night override' },
  });
  const nightColors = await nightOverride.evaluate((el) => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('theme-dark');
    root.classList.add('theme-dark');
    const style = document.createElement('style');
    style.textContent = 'html.theme-dark .lovely-chart--container { --background-color: #101010; }'
      + ' html.theme-dark .lovely-chart--tooltip-balloon { box-shadow: rgb(1, 2, 3) 0px 0px 3px; }';
    document.head.appendChild(style);
    const colors = {
      background: getComputedStyle(el).getPropertyValue('--background-color').trim().toLowerCase(),
      balloonShadow: getComputedStyle(el.querySelector('.lovely-chart--tooltip-balloon')).boxShadow,
    };
    style.remove();
    root.classList.toggle('theme-dark', wasDark);
    return colors;
  });
  check('a page overrides the night colours with the library\'s night selectors',
    nightColors.background === '#101010' && nightColors.balloonShadow.includes('rgb(1, 2, 3)'),
    JSON.stringify(nightColors));
  await unmountProbe(page);

  // --- Colours per skin and `var()` colours of the page, read again on a change of the skin and by refreshColors() ---
  const wasTokensDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  await page.evaluate((textContent) => {
    const style = document.createElement('style');
    style.id = 'probe-tokens';
    style.textContent = textContent;
    document.head.appendChild(style);
  }, PAGE_TOKENS_STYLE);
  await setHtmlDark(false);

  // A dataset and the comparison of a colour per skin, and a dataset pale by day and deep by night
  const pairChart = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Colours per skin',
      labels: [1, 2, 3, 4, 5, 6].map((day) => Date.UTC(2026, 10, day)),
      datasets: [
        { name: 'Pair', color: { light: '#FF00FF', dark: '#00FFFF' }, values: [10, 30, 20, 40, 30, 50] },
        { name: 'Pale by day', color: { light: '#9ED448', dark: '#2373DB' }, values: [5, 15, 10, 20, 15, 25] },
      ],
      comparison: {
        name: 'Before',
        color: { light: '#FF8000', dark: '#8000FF' },
        values: [Array(6).fill(20), Array(6).fill(10)],
      },
      withMinimap: true,
      minimapRange: 'full',
    },
  });
  await readProbeTooltip(page, 2);
  const readPairSkin = async () => {
    const plot = {};
    for (const color of ['#FF00FF', '#00FFFF', '#FF8000', '#8000FF']) {
      plot[color] = (await findColor(pairChart, parseHex(color))).count;
    }
    const minimap = pairChart.locator('.lovely-chart--minimap');
    const dom = await pairChart.evaluate((el) => ({
      buttons: [...el.querySelectorAll('.lovely-chart--button')].map((button) => [
        getComputedStyle(button).borderTopColor, button.classList.contains('lovely-chart--dark-content'),
      ]),
      comparison: getComputedStyle(el.querySelector('.lovely-chart--comparison-legend'), '::before').borderTopColor,
      swatches: [...el.querySelectorAll('.lovely-chart--tooltip-swatch')].map((swatch) => (
        getComputedStyle(swatch)[swatch.matches('[data-dashed]') ? 'borderTopColor' : 'backgroundColor']
      )),
    }));
    return {
      plot,
      minimap: [(await findColor(minimap, [255, 0, 255])).count, (await findColor(minimap, [0, 255, 255])).count],
      ...dom,
    };
  };
  const pairDay = await readPairSkin();
  await setHtmlDark(true);
  await waitForIdle(page, 400);
  const pairNight = await readPairSkin();
  await unmountProbe(page);
  check('a dataset and a comparison of a colour per skin paint the plot and the minimap in the skin on screen',
    pairDay.plot['#FF00FF'] > MIN_DATASET_PIXELS && pairDay.plot['#00FFFF'] === 0
    && pairDay.plot['#FF8000'] > MIN_THIN_PIXELS && pairDay.plot['#8000FF'] === 0
    && pairDay.minimap[0] > MIN_THIN_PIXELS && pairDay.minimap[1] === 0
    && pairNight.plot['#00FFFF'] > MIN_DATASET_PIXELS && pairNight.plot['#FF00FF'] === 0
    && pairNight.plot['#8000FF'] > MIN_THIN_PIXELS && pairNight.plot['#FF8000'] === 0
    && pairNight.minimap[1] > MIN_THIN_PIXELS && pairNight.minimap[0] === 0,
    JSON.stringify({ day: [pairDay.plot, pairDay.minimap], night: [pairNight.plot, pairNight.minimap] }));
  const readPairDom = ({ buttons, comparison, swatches }) => JSON.stringify({ buttons, comparison, swatches });
  check('the legend buttons, their labels, the comparison entry and the shown tooltip\'s swatches follow the skin',
    readPairDom(pairDay) === JSON.stringify({
      buttons: [['rgb(255, 0, 255)', false], ['rgb(158, 212, 72)', true]],
      comparison: 'rgb(255, 128, 0)',
      swatches: ['rgb(255, 128, 0)', 'rgb(255, 0, 255)', 'rgb(158, 212, 72)'],
    }) && readPairDom(pairNight) === JSON.stringify({
      buttons: [['rgb(0, 255, 255)', true], ['rgb(35, 115, 219)', false]],
      comparison: 'rgb(128, 0, 255)',
      swatches: ['rgb(128, 0, 255)', 'rgb(0, 255, 255)', 'rgb(35, 115, 219)'],
    }),
    `day: ${readPairDom(pairDay)}; night: ${readPairDom(pairNight)}`);

  // Every colour parameter as a `var()` of the page, one of them a `color-mix()`
  await setHtmlDark(false);
  await recordProbeNumbers(page);
  const tokenChart = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Colours of the page',
      labels: Array.from({ length: 8 }, (_, i) => Date.UTC(2026, 10, i + 1)),
      datasets: [
        { name: 'Token', color: 'var(--probe-series)', values: [10, 30, 20, 40, 30, 50, 40, 60] },
        { name: 'Mix', color: 'var(--probe-mix)', values: [5, 15, 10, 20, 15, 25, 20, 30] },
      ],
      comparison: { name: 'Before', color: 'var(--probe-comparison)', values: [Array(8).fill(20), Array(8).fill(10)] },
      referenceLines: [{ value: 55, color: 'var(--probe-reference)' }],
      hatchedRanges: [{ from: 6, to: 7, hasEdge: true, color: 'var(--probe-hatch)' }],
      axisTextColor: 'var(--probe-axis)',
      backgroundColor: 'var(--probe-surface)',
    },
  });
  const readTokenPaint = async () => {
    const paint = {};
    for (const key of ['series', 'seriesNight', 'mix', 'comparison', 'reference', 'surface']) {
      paint[key] = (await findColor(tokenChart, parseHex(PAGE_TOKEN_COLORS[key]))).count;
    }
    paint.hatch = await countPickedPixels(
      tokenChart, getColorBounds(PAGE_TOKEN_COLORS.hatch, [5, 255], HATCH_COLOR_TOLERANCE),
    );
    paint.axisTexts = (await readProbeTexts(page)).texts.map(({ color }) => color);

    return paint;
  };
  const tokenDay = await readTokenPaint();
  await tokenChart.evaluate((el) => {
    el.dataset.marker = 'built';
  });
  await setHtmlDark(true);
  await waitForIdle(page, 400);
  const tokenNight = await readTokenPaint();
  const tokenMarker = await tokenChart.evaluate((el) => el.dataset.marker);
  await unmountProbe(page);
  const isTokenPainted = (paint) => paint.mix > MIN_DATASET_PIXELS && paint.comparison > MIN_THIN_PIXELS
    && paint.reference > MIN_THIN_PIXELS && paint.surface > MIN_THIN_PIXELS && paint.hatch > MIN_THIN_PIXELS
    && paint.axisTexts.length > 0 && paint.axisTexts.every((color) => isTextColor(color, PAGE_TOKEN_COLORS.axis));
  const formatTokenPaint = ({ axisTexts, ...paint }) => JSON.stringify({
    ...paint, axisTexts: [...new Set(axisTexts)],
  });
  check('every colour parameter takes a var() of the page, a color-mix() among them',
    isTokenPainted(tokenDay) && tokenDay.series > MIN_DATASET_PIXELS && tokenDay.seriesNight === 0,
    formatTokenPaint(tokenDay));
  check('a var() colour reads the page again as the theme-dark class changes, repainting without a rebuild',
    isTokenPainted(tokenNight) && tokenNight.seriesNight > MIN_DATASET_PIXELS && tokenNight.series === 0
    && tokenMarker === 'built',
    `${formatTokenPaint(tokenNight)}, element ${tokenMarker ?? 'rebuilt'}`);

  // A CSS colour the canvas does not take, as `light-dark()`, on a reference line and a hatch. The page leaves
  // `color-scheme` as it is, which picks the light colour.
  const lightDarkChart = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Colours the canvas does not take',
      labels: Array.from({ length: 8 }, (_, i) => Date.UTC(2026, 10, i + 1)),
      datasets: [{ name: 'Blue', color: '#0000FF', values: [10, 30, 20, 40, 30, 50, 40, 60] }],
      referenceLines: [{ value: 55, color: 'light-dark(#00FF00, #FF0000)' }],
      hatchedRanges: [{ from: 6, to: 7, hasEdge: true, color: 'light-dark(#FF00FF, #00FFFF)' }],
    },
  });
  const lightDarkPaint = [
    (await findColor(lightDarkChart, parseHex('#00FF00'))).count,
    (await findColor(lightDarkChart, parseHex('#FF0000'))).count,
    await countPickedPixels(lightDarkChart, getColorBounds('#FF00FF', [5, 255], HATCH_COLOR_TOLERANCE)),
    await countPickedPixels(lightDarkChart, getColorBounds('#00FFFF', [5, 255], HATCH_COLOR_TOLERANCE)),
  ];
  await unmountProbe(page);
  check('a reference line and a hatch take a CSS colour the canvas does not, as light-dark()',
    lightDarkPaint[0] > MIN_THIN_PIXELS && lightDarkPaint[1] === 0
    && lightDarkPaint[2] > MIN_THIN_PIXELS && lightDarkPaint[3] === 0,
    `green, red, magenta and cyan px: ${JSON.stringify(lightDarkPaint)}`);

  // A chart that follows the system scheme reads the page again as the scheme changes, its datasets and legend among
  // the colours it reads
  await page.emulateMedia({ colorScheme: 'light' });
  const systemTokenChart = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Colours of the page, system scheme',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [
        { name: 'Token', color: 'var(--probe-system)', values: [20, 30, 25, 35] },
        { name: 'Other', color: '#0000FF', values: [10, 15, 12, 18] },
      ],
      areaBorderColor: 'var(--probe-system)',
      colorScheme: 'system',
    },
  });
  const readSystemTokens = async () => [
    (await findColor(systemTokenChart, parseHex(PAGE_TOKEN_COLORS.system))).count,
    (await findColor(systemTokenChart, parseHex(PAGE_TOKEN_COLORS.systemNight))).count,
    await systemTokenChart.locator('.lovely-chart--button').first()
      .evaluate((button) => getComputedStyle(button).borderTopColor),
  ];
  const systemTokenLight = await readSystemTokens();
  await page.emulateMedia({ colorScheme: 'dark' });
  await waitForIdle(page, 400);
  const systemTokenDark = await readSystemTokens();
  // Playwright restores the system scheme on `null` alone
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ colorScheme: null });
  await unmountProbe(page);
  check('a chart of the system scheme reads its var() colours again as the scheme changes, the legend\'s among them',
    systemTokenLight[0] > MIN_DATASET_PIXELS && systemTokenLight[1] === 0 && systemTokenLight[2] === 'rgb(255, 0, 255)'
    && systemTokenDark[0] === 0 && systemTokenDark[1] > MIN_DATASET_PIXELS && systemTokenDark[2] === 'rgb(0, 255, 255)',
    `magenta px, cyan px and the legend outline: ${JSON.stringify(systemTokenLight)} light, `
    + `${JSON.stringify(systemTokenDark)} dark`);

  // A change of the page the chart does not watch, as a `data-theme` attribute, waits for `refreshColors()`, which
  // keeps the range, the legend and the selection
  await setHtmlDark(false);
  await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const buildValues = (base) => Array.from({ length: 20 }, (_, i) => base + (i % 4) * 10);
    window.colorRefreshLog = [];
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Refreshed colours',
      labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2026, 10, i + 1)),
      datasets: [
        { name: 'Token', color: 'var(--probe-series)', values: buildValues(10) },
        { name: 'Other', color: '#3497ED', values: buildValues(20) },
      ],
      withMinimap: true,
      minimapRange: [0.5, 1],
      onSelectedIndexChange: (index) => window.colorRefreshLog.push(`select ${index}`),
      onHiddenSeriesChange: (names) => window.colorRefreshLog.push(`hidden ${names}`),
    });
  });
  await settleMount(page);
  const refreshChart = page.locator('#probe .lovely-chart--container');
  await refreshChart.evaluate((el) => {
    el.querySelectorAll('.lovely-chart--button')[1].click();
    el.dataset.marker = 'built';
  });
  await readProbeTooltip(page, 15);
  const readRefreshView = () => refreshChart.evaluate((el) => ({
    marker: el.dataset.marker,
    ruler: [...el.querySelector('.lovely-chart--minimap-ruler').children].map(({ style }) => style.width),
    pressed: [...el.querySelectorAll('.lovely-chart--button')].map((button) => button.getAttribute('aria-pressed')),
    legend: getComputedStyle(el.querySelector('.lovely-chart--button')).borderTopColor,
    swatches: [...el.querySelectorAll('.lovely-chart--tooltip-swatch')]
      .map((swatch) => getComputedStyle(swatch).backgroundColor),
    log: window.colorRefreshLog.join('; '),
  }));
  const readRefreshPaint = async () => [
    (await findColor(refreshChart, parseHex(PAGE_TOKEN_COLORS.series))).count,
    (await findColor(refreshChart, parseHex(PAGE_TOKEN_COLORS.seriesAlt))).count,
    (await findColor(refreshChart.locator('.lovely-chart--minimap'), parseHex(PAGE_TOKEN_COLORS.seriesAlt))).count,
  ];
  const refreshViewBefore = await readRefreshView();
  await page.evaluate(() => document.getElementById('probe').setAttribute('data-theme', 'alt'));
  await waitForIdle(page, 400);
  const unwatchedPaint = await readRefreshPaint();
  await page.evaluate(() => window.probeChart.refreshColors());
  await waitForIdle(page, 400);
  const refreshedPaint = await readRefreshPaint();
  const refreshViewAfter = await readRefreshView();
  await unmountProbe(page);
  check('a var() colour holds through a change of the page the chart does not watch',
    unwatchedPaint[0] > MIN_DATASET_PIXELS && unwatchedPaint[1] === 0, JSON.stringify(unwatchedPaint));
  const { legend: refreshedLegend, swatches: refreshedSwatches, ...refreshedView } = refreshViewAfter;
  const { legend: legendBefore, swatches: swatchesBefore, ...viewBefore } = refreshViewBefore;
  check('refreshColors() repaints the plot, minimap, legend and tooltip, keeping the range, legend and selection',
    refreshedPaint[0] === 0 && refreshedPaint[1] > MIN_DATASET_PIXELS && refreshedPaint[2] > MIN_THIN_PIXELS
    && legendBefore === 'rgb(255, 0, 0)' && refreshedLegend === 'rgb(128, 0, 255)'
    && JSON.stringify(swatchesBefore) === '["rgb(255, 0, 0)"]'
    && JSON.stringify(refreshedSwatches) === '["rgb(128, 0, 255)"]'
    && JSON.stringify(refreshedView) === JSON.stringify(viewBefore) && viewBefore.marker === 'built'
    && JSON.stringify(viewBefore.pressed) === '["true","false"]' && viewBefore.log === 'hidden Other; select 15',
    JSON.stringify({ refreshedPaint, refreshViewBefore, refreshViewAfter }));

  // A zoomed view keeps its zoom through `refreshColors()`, its datasets of `var()` colours read again
  const zoomedTokenChart = await mountLinesZoom(page, {
    overview: [{ name: 'A', color: 'var(--probe-series)' }, { name: 'B', color: '#3497ED' }],
    zoomed: [
      { name: 'C', color: 'var(--probe-series)' }, { name: 'D', color: '#3497ED' }, { name: 'E', color: '#9ED448' },
    ],
    config: { initialZoom: 'last' },
  });
  const readZoomedTokens = async () => [
    (await findColor(zoomedTokenChart, parseHex(PAGE_TOKEN_COLORS.series))).count,
    (await findColor(zoomedTokenChart, parseHex(PAGE_TOKEN_COLORS.seriesAlt))).count,
    await zoomedTokenChart.locator('.lovely-chart--button').count(),
  ];
  const zoomedTokensBefore = await readZoomedTokens();
  await page.evaluate(() => {
    document.getElementById('probe').setAttribute('data-theme', 'alt');
    window.probeChart.refreshColors();
  });
  await waitForIdle(page, 400);
  const zoomedTokensAfter = await readZoomedTokens();
  await unmountProbe(page);
  check('refreshColors() keeps a zoom, its datasets of var() colours in the colours the page now gives',
    zoomedTokensBefore[0] > MIN_DATASET_PIXELS && zoomedTokensBefore[2] === 3
    && zoomedTokensAfter[0] === 0 && zoomedTokensAfter[1] > MIN_DATASET_PIXELS && zoomedTokensAfter[2] === 3,
    `red px, violet px and legend buttons: ${JSON.stringify(zoomedTokensBefore)} before, `
    + `${JSON.stringify(zoomedTokensAfter)} after`);

  // A zoom into datasets of the names and colours of the overview's keeps the legend, and reads its `var()` colours
  // again with those of the plot
  const keptLegendChart = await mountLinesZoom(page, {
    overview: [{ name: 'A', color: 'var(--probe-series)' }, { name: 'B', color: '#3497ED' }],
    zoomed: [{ name: 'A', color: 'var(--probe-series)' }, { name: 'B', color: '#3497ED' }],
  });
  await keptLegendChart.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('probe').setAttribute('data-theme', 'alt'));
  const keptLegendPlot = await keptLegendChart.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, keptLegendPlot, 0.5, 0.5);
  await page.mouse.click(keptLegendPlot.x + keptLegendPlot.width / 2, keptLegendPlot.y + keptLegendPlot.height / 2);
  await waitForIdle(page, 2000);
  const keptLegend = [
    (await keptLegendChart
      .locator('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').count()) > 0,
    (await findColor(keptLegendChart, parseHex(PAGE_TOKEN_COLORS.series))).count,
    (await findColor(keptLegendChart, parseHex(PAGE_TOKEN_COLORS.seriesAlt))).count,
    await keptLegendChart.locator('.lovely-chart--button').first()
      .evaluate((button) => getComputedStyle(button).borderTopColor),
  ];
  await page.mouse.move(0, 0);
  await unmountProbe(page);
  check('a zoom that keeps the legend reads its var() colours again, in the legend as in the plot',
    keptLegend[0] && keptLegend[1] === 0 && keptLegend[2] > MIN_DATASET_PIXELS && keptLegend[3] === 'rgb(128, 0, 255)',
    `zoomed, red px, violet px and the legend outline: ${JSON.stringify(keptLegend)}`);
  await page.evaluate(() => document.getElementById('probe-tokens').remove());
  await setHtmlDark(wasTokensDark);
});

section('UTC labels, west of UTC', async ({ browser, url }) => {
  const westContext = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  const westPage = await newTestPage(westContext);
  await westPage.goto(url);
  const westTitles = await westPage.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const titleAt = async (isUtc) => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const chart = new LovelyChart(element, {
        type: 'line',
        labels: [Date.UTC(2026, 10, 17), Date.UTC(2026, 10, 18)],
        labelType: 'day',
        isUtc,
        datasets: [{ name: 'A', values: [1, 2] }],
      });
      await window.idleTracker.wait(800);
      chart.selectLabel(1);
      await window.idleTracker.wait(300);
      const title = element.querySelector('.lovely-chart--tooltip-title').textContent;
      chart.destroy();
      element.remove();
      return title;
    };
    return { utc: await titleAt(true), local: await titleAt(false) };
  });
  await westPage.locator('.day-picker-day').nth(2).hover();
  await waitForIdle(westPage, 400);
  const westPickedDay = {
    date: await westPage.locator('.day-picker-date').nth(2).textContent(),
    title: (await westPage.locator('.lovely-chart--container').nth(DAY_PICKER_CHART)
      .locator('.lovely-chart--tooltip-title').textContent()).trim(),
  };
  await westContext.close();
  check('isUtc reads day labels in UTC', westTitles.utc === '18 Nov' && westTitles.local === '17 Nov',
    JSON.stringify(westTitles));
  check('the demo list and its chart\'s tooltip read the same day west of UTC',
    westPickedDay.date.endsWith(` ${westPickedDay.title}`), JSON.stringify(westPickedDay));
});

section('RTL layout (header sides swap, nothing overlaps)', async ({ page, charts }) => {
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  await waitForIdle(page, 300);
  const rtlHeader = await charts.nth(0).evaluate((el) => {
    const box = (selector) => el.querySelector(selector).getBoundingClientRect();
    const title = box('.lovely-chart--header-title');
    const caption = box('.lovely-chart--header-caption');
    return { titleLeft: title.left, captionRight: caption.right };
  });
  check('rtl header puts the title on the trailing side',
    rtlHeader.titleLeft >= rtlHeader.captionRight,
    `title left: ${Math.round(rtlHeader.titleLeft)}, caption right: ${Math.round(rtlHeader.captionRight)}`);
  await charts.nth(0).scrollIntoViewIfNeeded();
  await hoverWiggle(page, await charts.nth(0).locator('.lovely-chart--tooltip').boundingBox(), 0.45, 0.5);
  const rtlRow = await charts.nth(0).evaluate((el) => {
    const row = el.querySelector('.lovely-chart--tooltip-dataset');
    const box = (selector) => row.querySelector(selector).getBoundingClientRect();
    return {
      swatchLeft: box('.lovely-chart--tooltip-swatch').left,
      name: { left: box('.lovely-chart--dataset-title').left, right: box('.lovely-chart--dataset-title').right },
      valueRight: box('.lovely-chart--tooltip-dataset-value').right,
    };
  });
  check('an rtl tooltip row puts the swatch on the right and the value on the left',
    rtlRow.swatchLeft >= rtlRow.name.right && rtlRow.valueRight <= rtlRow.name.left, JSON.stringify(rtlRow));
  await mountProbe(page, {
    config: {
      type: 'bar', isStacked: true, labelType: 'text', labels: ['A', 'B'], isTooltipTotalInTitle: true,
      datasets: [{ name: 'Sales', values: [10, -30] }, { name: 'Fees', values: [5, 10] }],
      comparison: { name: 'Before', values: [[5, 10], [2, 5]] },
    },
  });
  // The characters of an element's text in the order they show, left to right
  await page.evaluate(() => {
    window.readVisualOrder = (element) => {
      const range = document.createRange();
      const characters = [];
      const walk = (node) => {
        if (node.nodeType !== Node.TEXT_NODE) {
          node.childNodes.forEach(walk);
          return;
        }
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          if (node.data[i].trim()) characters.push([node.data[i], range.getBoundingClientRect().left]);
        }
      };
      walk(element);
      return characters.sort((a, b) => a[1] - b[1]).map(([character]) => character).join('');
    };
  });
  const rtlNumbers = await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const { readVisualOrder } = window;
    return {
      comparison: readVisualOrder(balloon.querySelector(
        '.lovely-chart--tooltip-dataset-comparison .lovely-chart--tooltip-dataset-value',
      )),
      sales: readVisualOrder(balloon.querySelector('[data-name="Sales"] .lovely-chart--tooltip-dataset-value')),
      titleTotal: readVisualOrder(balloon.querySelector('.lovely-chart--tooltip-title-total')),
    };
  });
  check('an rtl tooltip puts the signs of its numbers before the digits',
    rtlNumbers.comparison === '15·-233%' && rtlNumbers.sales === '-30' && rtlNumbers.titleTotal === '-20',
    JSON.stringify(rtlNumbers));
  await unmountProbe(page);
  await mountProbe(page, {
    config: {
      type: 'bar', isPercentage: true, isStacked: true, labelType: 'text', labels: ['A', 'B'],
      datasets: [
        { name: 'Gains', values: [50, 50] }, { name: 'Losses', values: [-10, -10] }, { name: 'Flat', values: [7, 7] },
      ],
    },
  });
  const rtlColumns = await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const balloonLeft = balloon.getBoundingClientRect().left;
    const range = document.createRange();
    const shares = [...balloon.querySelectorAll('.lovely-chart--percentage-title')];
    return {
      valueLefts: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset-value')]
        .map((value) => Math.round(value.getBoundingClientRect().left - balloonLeft)),
      loss: window.readVisualOrder(balloon.querySelector('[data-name="Losses"] .lovely-chart--percentage-title')),
      // Each share's text starts at the left of its box, beside the swatch
      shareInsets: shares.map((share) => {
        range.selectNodeContents(share);
        return Math.round(range.getBoundingClientRect().left - share.getBoundingClientRect().left);
      }),
    };
  });
  check('an rtl tooltip keeps its values in a column and its shares, signs first, beside their swatches',
    rtlColumns.valueLefts.length === 4 && new Set(rtlColumns.valueLefts).size === 1 && rtlColumns.loss === '-21%'
    && rtlColumns.shareInsets.length === 3 && rtlColumns.shareInsets.every((inset) => inset === 0),
    JSON.stringify(rtlColumns));
  // A chart of left-to-right direction on the right-to-left page sets its rows left to right
  const nestedColumns = await page.evaluate(async () => {
    document.getElementById('probe').dir = 'ltr';
    window.probeChart.selectLabel(1);
    await window.idleTracker.wait(300);
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const range = document.createRange();
    return {
      valueEnds: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => Math.round(
        row.getBoundingClientRect().right
        - row.querySelector('.lovely-chart--tooltip-dataset-value').getBoundingClientRect().right,
      )),
      // Each share's text ends at the right of its box, beside the swatch
      shareInsets: [...balloon.querySelectorAll('.lovely-chart--percentage-title')].map((share) => {
        range.selectNodeContents(share);
        return Math.round(share.getBoundingClientRect().right - range.getBoundingClientRect().right);
      }),
    };
  });
  check('an ltr chart on an rtl page keeps its values in a column at the end of its rows, its shares by their swatches',
    nestedColumns.valueEnds.length === 4 && nestedColumns.valueEnds.every((end) => end === 0)
    && nestedColumns.shareInsets.length === 3 && nestedColumns.shareInsets.every((inset) => inset === 0),
    JSON.stringify(nestedColumns));
  await unmountProbe(page);
  // The Y-axis labels of both axes and of `secondaryYAxis` draw left to right, and so do the X-axis labels, dates in
  // English words
  await recordProbeNumbers(page);
  const rtlAxisTexts = [];
  const rtlAxisConfigs = [
    {
      type: 'line', hasSecondYAxis: true,
      datasets: [{ name: 'A', values: [-450_000, -3_000, 2_000] }, { name: 'B', values: [-50, 10, -40] }],
    },
    {
      type: 'bar', isStacked: true, datasets: [{ name: 'A', values: [-450, 300, 1_000] }],
      secondaryYAxis: { label: 'USD ≈', multiplier: 2.5, prefix: '$' },
    },
  ];
  for (const config of rtlAxisConfigs) {
    await mountProbe(page, { config: { ...config, labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)) } });
    rtlAxisTexts.push(...(await readProbeTexts(page)).texts);
    await unmountProbe(page);
  }
  const negativeLabels = [...new Set(rtlAxisTexts
    .filter(({ text }) => /^\$?-\d/.test(text))
    .map(({ text, direction }) => `${text} ${direction}`))];
  const xLabelDirections = [...new Set(rtlAxisTexts.filter(({ text }) => text.endsWith(' Nov'))
    .map(({ direction }) => direction))];
  check('rtl Y-axis labels put the signs of their numbers before the digits',
    [/^-\d+K /, /^-\d+ /, /^\$-/].every((pattern) => negativeLabels.some((label) => pattern.test(label)))
    && negativeLabels.every((label) => label.endsWith(' ltr')) && JSON.stringify(xLabelDirections) === '["ltr"]',
    JSON.stringify({ negativeLabels, xLabelDirections }));
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
  await waitForIdle(page, 300);
});

section('Dates in the direction of their words', async ({ page }) => {
  // Each pair of charts draws the same dates in an element of either direction, and the X-axis labels, the caption and
  // the tooltip title read in the direction of their first letter, left to right without one
  const datePairs = await page.evaluate(async (plotBottom) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const days = [1, 2, 3, 4, 5].map((day) => Date.UTC(2025, 10, day));
    const hebrewMonths = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
    const configs = {
      englishDates: { labels: days },
      hebrewDates: { labels: days, dateLocale: { months: hebrewMonths } },
      yearDates: { labels: [2022, 2023, 2024, 2025, 2026].map((year) => Date.UTC(year, 0, 1)), labelType: 'year' },
    };
    const pairs = Object.entries(configs).map(([name, config]) => ['ltr', 'rtl'].map((dir) => {
      const element = document.createElement('div');
      element.dir = dir;
      document.getElementById('container').appendChild(element);
      const chart = new LovelyChart(element, {
        ...config, type: 'line', title: `Probe — ${name}`, isUtc: true,
        datasets: [{ name: 'A', values: [1, 3, 2, 5, 4] }],
      });
      return { name, element, chart };
    }));
    await window.idleTracker.wait(1800);

    const readXAxisBand = (element) => {
      const canvas = element.querySelector('.lovely-chart--container > canvas');
      const top = Math.ceil(plotBottom * canvas.width / canvas.clientWidth);
      return canvas.getContext('2d').getImageData(0, top, canvas.width, canvas.height - top).data;
    };
    // The words of an element's text, and whether they run left to right on screen or right to left
    const readWordOrder = (element) => {
      const range = document.createRange();
      const node = element.firstChild;
      const words = [...node.data.matchAll(/\S+/g)].map((match) => {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        return range.getBoundingClientRect();
      });
      return {
        text: node.data,
        isLeftToRight: words.length > 1 && words.every((word, i) => !i || word.left >= words[i - 1].right - 1),
        isRightToLeft: words.length > 1 && words.every((word, i) => !i || word.right <= words[i - 1].left + 1),
      };
    };
    const readTexts = async ({ element, chart }) => {
      chart.selectLabel(2);
      await window.idleTracker.wait(300);
      return {
        caption: readWordOrder(element.querySelector('.lovely-chart--header-caption')),
        title: readWordOrder(
          element.querySelector('.lovely-chart--tooltip-title > span:not(.lovely-chart--tooltip-title-total)'),
        ),
      };
    };
    const results = {};
    for (const [ltr, rtl] of pairs) {
      const [ltrBand, rtlBand] = [readXAxisBand(ltr.element), readXAxisBand(rtl.element)];
      results[ltr.name] = {
        isAxisAlike: ltrBand.every((value, i) => value === rtlBand[i]),
        axisPixels: ltrBand.filter((value, i) => i % 4 === 3 && value > 0).length,
        ltr: await readTexts(ltr),
        rtl: await readTexts(rtl),
      };
      [ltr, rtl].forEach(({ element, chart }) => {
        chart.destroy();
        element.remove();
      });
    }
    return results;
  }, PLOT_BOTTOM);
  const { englishDates, hebrewDates, yearDates } = datePairs;
  check('English dates read left to right in a right-to-left chart, on the X axis, the caption and the tooltip title',
    englishDates.isAxisAlike && englishDates.axisPixels > 100 && [englishDates.ltr, englishDates.rtl]
      .every(({ caption, title }) => caption.isLeftToRight && title.isLeftToRight),
    JSON.stringify(englishDates));
  check('dates in Hebrew words read right to left in a left-to-right chart, on the X axis, the caption and the title',
    hebrewDates.isAxisAlike && hebrewDates.axisPixels > 100 && [hebrewDates.ltr, hebrewDates.rtl]
      .every(({ caption, title }) => caption.isRightToLeft && title.isRightToLeft),
    JSON.stringify(hebrewDates));
  check('a caption of years reads left to right in a right-to-left chart, as the X axis runs',
    yearDates.ltr.caption.isLeftToRight && yearDates.rtl.caption.isLeftToRight, JSON.stringify(yearDates));
  // A caption beside a long title on a phone wraps, and each of its lines ends at the end of the header
  await mountProbe(page, {
    config: {
      type: 'line', title: 'A rather long chart title for a phone', isUtc: true,
      labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2025, 10, day)), datasets: [{ name: 'A', values: [1, 3, 2, 5, 4] }],
    },
    width: 360,
  });
  const captionEndGaps = await page.evaluate(() => ['ltr', 'rtl'].map((dir) => {
    const probe = document.getElementById('probe');
    probe.dir = dir;
    const caption = probe.querySelector('.lovely-chart--header-caption');
    const box = caption.getBoundingClientRect();
    const node = caption.firstChild;
    const range = document.createRange();
    const lineGaps = new Map();
    for (const match of node.data.matchAll(/\S+/g)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const { top, left, right } = range.getBoundingClientRect();
      const gap = dir === 'rtl' ? left - box.left : box.right - right;
      const line = Math.round(top);
      lineGaps.set(line, Math.min(lineGaps.get(line) ?? Infinity, gap));
    }
    return [...lineGaps.values()].map(Math.round);
  }));
  await unmountProbe(page);
  check('a wrapped caption ends each of its lines at the end of the header, in a chart of either direction',
    captionEndGaps.every((gaps) => gaps.length > 1 && gaps.every((gap) => gap === 0)), JSON.stringify(captionEndGaps));
});

section('Theme switch (MutationObserver -> state update path)', async ({ page }) => {
  await page.locator('#skin-switcher').click();
  await waitForIdle(page, 800);
  check('theme switch repaints without errors', (await paintedPixels(page, 0)) > 1000);
});

section('Resize (debounced destroy-and-recreate path)', async ({ page, charts }) => {
  // The probe's element follows the viewport width, so the rebuild narrows the plot area
  const resizedAreaChart = await mountProbe(page, {
    config: { ...areaConfig, title: 'Probe — Plot area resize' },
    hostStyle: `${PADDED_HOST_STYLE}; width: 40vw`,
  });
  await resizedAreaChart.scrollIntoViewIfNeeded();
  await addPlotAreaOverlay(page);
  const wideAreaFit = await readPlotAreaFit(page, ['#FF0000']);
  await page.setViewportSize({ width: 700, height: 1200 });
  await waitForIdle(page, 1200);
  const narrowAreaFit = await readPlotAreaFit(page, ['#FF0000']);
  await unmountProbe(page);
  check('a rebuild on resize narrows the plot area with the plot',
    isFramedBy(narrowAreaFit.overlay, narrowAreaFit.boxes[0])
    && narrowAreaFit.overlay.right < wideAreaFit.overlay.right - 50,
    `overlay ${formatBox(narrowAreaFit.overlay)} after ${formatBox(wideAreaFit.overlay)}, `
    + `line ${formatBox(narrowAreaFit.boxes[0])}`);

  const countAfterResize = await page.locator('.lovely-chart--container').count();
  const paintedAfterResize = await paintedPixels(page, 0);
  check('resize redraw keeps all charts alive', countAfterResize === EXPECTED_CHARTS && paintedAfterResize > 1000,
    `charts: ${countAfterResize}, painted: ${paintedAfterResize}px`);

  await page.setViewportSize({ width: PHONE_WIDTH, height: 812 });
  await waitForIdle(page, 1200);
  const phoneWidths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  check('the demo page fits a phone without scrolling sideways', phoneWidths.scroll <= phoneWidths.client,
    JSON.stringify(phoneWidths));
  const phoneMultiples = await page.locator('.multiples .lovely-chart--container').evaluateAll((elements) => (
    elements.map((el) => {
      const { left, top, width } = el.getBoundingClientRect();
      return { left: Math.round(left), top: Math.round(top), width: Math.round(width) };
    })
  ));
  check('the demo multiples stand two to a row on a phone',
    phoneMultiples.length === MULTIPLE_FRUITS.length && phoneMultiples[0].top === phoneMultiples[1].top
    && phoneMultiples[2].top === phoneMultiples[3].top && phoneMultiples[2].top > phoneMultiples[0].top
    && phoneMultiples.every(({ width }) => width >= MIN_PHONE_MULTIPLE_WIDTH),
    JSON.stringify(phoneMultiples));
  // A change of skin redraws the plot the resize rebuilt
  const forecastChart = charts.nth(FORECAST_CHART);
  await forecastChart.scrollIntoViewIfNeeded();
  await startCanvasRecording(forecastChart);
  await switchSkinAndBack(page);
  const phoneForecastDrawing = await stopCanvasRecording(page);
  const phoneForecastFit = await readForecastFit(forecastChart);
  const { area: phoneForecastArea, badge: phoneForecastBadge, areaInCanvas: phoneAreaInCanvas } = phoneForecastFit;
  const phoneForecastWidth = phoneForecastArea.right - phoneForecastArea.left;
  const phoneForecastStart = phoneAreaInCanvas
    + phoneForecastWidth * (FORECAST_DAYS - FORECAST_WEEK - 1) / (FORECAST_DAYS - 1);
  const isPhoneBadgeInside = phoneForecastBadge.left >= phoneForecastArea.left
    && phoneForecastBadge.right <= phoneForecastArea.right && phoneForecastBadge.top >= phoneForecastArea.top
    && phoneForecastBadge.bottom <= phoneForecastArea.bottom;
  const phoneForecastLabels = phoneForecastDrawing.texts.filter(({ text }) => text === 'Forecast');
  check('the demo forecast holds its label inside the band and its badge inside the plot on a phone',
    phoneForecastLabels.length > 0 && phoneForecastLabels.every(({ x, width }) => (
      x >= phoneForecastStart && x + width <= phoneAreaInCanvas + phoneForecastWidth
    )) && isPhoneBadgeInside,
    `labels ${JSON.stringify(phoneForecastLabels)} from ${phoneForecastStart.toFixed(1)}, `
    + `badge ${formatBox(phoneForecastBadge)}, area ${formatBox(phoneForecastArea)}`);
});

(async () => {
  const startedAt = performance.now();
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launchBrowser();
  const browserName = `${process.env.E2E_CHANNEL || 'chromium-headless-shell'} ${browser.version()}`;
  console.log(`Browser: ${browserName}, ${WORKER_COUNT} pages at once`);
  const errors = [];
  const workers = await Promise.all(Array.from({ length: WORKER_COUNT }, () => openDemoPage(browser, url, errors)));
  await runSections(workers);

  // --- Idle waits ---
  check('each chart built asked the page for a frame, a timer or a fetch before its wait for an idle page ended',
    !idleWaits.unseenMounts, `${idleWaits.unseenMounts} built asking for none`);

  // --- Console hygiene ---
  check('no page or console errors', errors.length === 0, errors.join('; ').slice(0, 200));

  await browser.close();
  server.close();

  printTimings(browserName, startedAt);
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
