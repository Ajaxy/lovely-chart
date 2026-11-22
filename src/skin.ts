import type { ChartColors, ColorChannels, LovelyChartParams, ThemedColor } from './types.js';

import { COLOR_PROBE, COLOR_SCHEME, SYSTEM_DARK_QUERY } from './constants.js';
import { createElement } from './minifiers.js';

type ColorParams = Pick<LovelyChartParams, 'axisTextColor' | 'backgroundColor' | 'colorScheme'>;

const MASK_OPACITY = 0.5;
// The label colours of a checked legend button, as `_buttons.scss` sets them, and of the share on a pie or donut sector
const DARK_CONTENT_COLOR = '#222222';
const LIGHT_CONTENT_COLOR = '#FFFFFF';
// The least contrast of a light label on its fill, below which the dark one takes over: pale fills, such as the light
// green and the amber of the default colours, take the dark label, while mid-tones, such as their green and orange,
// keep the light one
const MIN_LIGHT_CONTENT_CONTRAST = 2;
// Relative luminance and contrast ratio as WCAG 2 defines them
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722];
const SRGB_LINEAR_LIMIT = 0.03928;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_GAMMA = 2.4;
const CONTRAST_FLARE = 0.05;
const CHANNEL_MAX = 255;
const SKIN_SCHEMES = { 'skin-day': 'light', 'skin-night': 'dark' } as const;
// The form of a colour the chart reads itself; the browser computes any other
const HEX_COLOR_PATTERN = /^#[\da-f]{6}(\/[\d.]+)?$/i;
// The forms of a colour the canvas takes as given, `transparent` among them, as a reference line checks for the word
const CANVAS_COLOR_PATTERN = /^(#[\da-f]{6}|transparent)$/i;

function detectSkin() {
  return document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
}

export type Skin = 'skin-day' | 'skin-night';

let skin: Skin | undefined;
let systemDarkQuery: MediaQueryList | undefined;
// A canvas of a pixel, which turns a colour of any form the browser computes into channels
let colorReader: CanvasRenderingContext2D | undefined;

const COLORS = {
  'skin-day': {
    background: '#FFFFFF',
    'text-color': '#222222',
    'minimap-mask': '#E2EEF9/0.6',
    'minimap-slider': '#C0D1E1',
    'grid-lines': '#182D3B/0.1',
    'zoom-out-text': '#108BE3',
    'tooltip-background': '#FFFFFF',
    'tooltip-arrow': '#D2D5D7',
    mask: '#FFFFFF/0.5',
    'x-axis-text': '#252529/0.6',
    'y-axis-text': '#252529/0.6',
  },
  'skin-night': {
    background: '#242F3E',
    'text-color': '#FFFFFF',
    'minimap-mask': '#304259/0.6',
    'minimap-slider': '#56626D',
    'grid-lines': '#FFFFFF/0.1',
    'zoom-out-text': '#48AAF0',
    'tooltip-background': '#1c2533',
    'tooltip-arrow': '#D2D5D7',
    mask: '#242F3E/0.5',
    'x-axis-text': '#A3B1C2/0.6',
    'y-axis-text': '#A3B1C2/0.6',
  },
} satisfies Record<string, Record<string, string>>;

// All DOM access happens lazily on the first chart creation, so merely importing
// the library has no side effects and is safe in window-less environments
function ensureInited() {
  if (skin) {
    return;
  }

  skin = detectSkin();
  systemDarkQuery = typeof matchMedia === 'function' ? matchMedia(SYSTEM_DARK_QUERY) : undefined;

  new MutationObserver(() => {
    skin = detectSkin();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

// `probe` is a hidden element inside the chart, where each `var()` colour resolves
export function createColors(
  datasetColors: Record<string, ThemedColor>,
  { axisTextColor, backgroundColor, colorScheme }: ColorParams,
  probe: HTMLElement,
): ChartColors {
  ensureInited();

  const colors: ChartColors = {
    [COLOR_SCHEME]: colorScheme === 'system' ? 'system' : 'htmlClassName',
    [COLOR_PROBE]: probe,
  };

  (['skin-day', 'skin-night'] as const).forEach((skin) => {
    colors[skin] = {};

    Object.entries(COLORS[skin]).forEach(([prop, value]) => {
      colors[skin][prop] = hexToChannels(value);
    });

    if (axisTextColor) {
      const axisText = readColorChannels(pickSchemeColor(axisTextColor, SKIN_SCHEMES[skin]), probe);
      colors[skin]['x-axis-text'] = axisText;
      colors[skin]['y-axis-text'] = axisText;
    }

    if (backgroundColor) {
      const background = readColorChannels(pickSchemeColor(backgroundColor, SKIN_SCHEMES[skin]), probe);
      colors[skin].background = background;
      colors[skin].mask = [background[0], background[1], background[2], background[3]! * MASK_OPACITY];
    }

    Object.entries(datasetColors).forEach(([key, color]) => {
      colors[skin][`dataset#${key}`] = readColorChannels(pickSchemeColor(color, SKIN_SCHEMES[skin]), probe);
    });
  });

  return colors;
}

// Creates the colours again where the components of the chart read them, each `var()` resolved anew
export function recreateColors(colors: ChartColors, datasetColors: Record<string, ThemedColor>, params: ColorParams) {
  Object.assign(colors, createColors(datasetColors, params, colors[COLOR_PROBE]));
}

function pickSchemeColor(color: ThemedColor, scheme: 'light' | 'dark') {
  return typeof color === 'string' ? color : color[scheme];
}

// Picks the colour of the skin on screen from a colour given one per skin. A form other than `CANVAS_COLOR_PATTERN`,
// as a `var()` or `light-dark()`, which the canvas may not take, resolves once per creation of the colours, kept by
// its text among those of the skin.
export function pickSkinColor(colors: ChartColors, color: ThemedColor): string {
  const skin = getSkin(colors);
  const skinColor = pickSchemeColor(color, SKIN_SCHEMES[skin]);
  if (CANVAS_COLOR_PATTERN.test(skinColor)) {
    return skinColor;
  }

  colors[skin][skinColor] ??= readColorChannels(skinColor, colors[COLOR_PROBE]);
  return buildCssColor(colors[skin][skinColor]);
}

export function getCssColor(colors: ChartColors, key: string, opacity?: number): string {
  return buildCssColor(colors[getSkin(colors)][key], opacity);
}

export function getSkin(colors: ChartColors): Skin {
  if (colors[COLOR_SCHEME] === 'system') {
    return systemDarkQuery?.matches ? 'skin-night' : 'skin-day';
  }

  return skin!;
}

function readColorChannels(color: string, probe: HTMLElement): ColorChannels {
  return HEX_COLOR_PATTERN.test(color) ? hexToChannels(color) : resolveColor(color, probe);
}

// The colour computes on the probe, in the cascade of the chart, and a pixel of the canvas holds it in channels,
// whatever form it computes to, such as `color(srgb …)` for a `color-mix()`
function resolveColor(color: string, probe: HTMLElement): ColorChannels {
  // An `!important` rule of the page would take the place of the colour otherwise
  probe.style.setProperty('color', color, 'important');
  const computedColor = getComputedStyle(probe).color;
  probe.style.removeProperty('color');

  colorReader ??= createColorReader();
  colorReader.clearRect(0, 0, 1, 1);
  colorReader.fillStyle = computedColor;
  colorReader.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = colorReader.getImageData(0, 0, 1, 1).data;

  return [red, green, blue, alpha / CHANNEL_MAX];
}

function createColorReader() {
  const canvas = createElement<HTMLCanvasElement>('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return canvas.getContext('2d', { willReadFrequently: true })!;
}

function hexToChannels(hexWithAlpha: string): ColorChannels {
  const [hex, alpha] = hexWithAlpha.replace('#', '').split('/');

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    alpha ? parseFloat(alpha) : 1,
  ];
}

function buildCssColor([r, g, b, a = 1]: ColorChannels, opacity = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${a * opacity})`;
}

// The colour of a label on a fill of `key`: the light one, or the dark one where the light one is too faint
export function getContentColor(colors: ChartColors, key: string): string {
  return isLightContentTooFaint(colors, key) ? DARK_CONTENT_COLOR : LIGHT_CONTENT_COLOR;
}

// A checked legend button keeps its light label while that reaches `MIN_LIGHT_CONTENT_CONTRAST` on the fill
export function isLightContentTooFaint(colors: ChartColors, key: string): boolean {
  const luminance = getRelativeLuminance(colors[getSkin(colors)][key]);
  const darkContrast = getContrastRatio(luminance, getRelativeLuminance(hexToChannels(DARK_CONTENT_COLOR)));
  const lightContrast = getContrastRatio(luminance, getRelativeLuminance(hexToChannels(LIGHT_CONTENT_COLOR)));
  return lightContrast < MIN_LIGHT_CONTENT_CONTRAST && darkContrast > lightContrast;
}

function getRelativeLuminance([r, g, b]: ColorChannels): number {
  return [r, g, b].reduce((sum, channel, i) => {
    const value = channel / CHANNEL_MAX;
    const linear = value <= SRGB_LINEAR_LIMIT
      ? value / SRGB_LINEAR_SLOPE
      : ((value + SRGB_OFFSET) / (1 + SRGB_OFFSET)) ** SRGB_GAMMA;
    return sum + LUMINANCE_WEIGHTS[i] * linear;
  }, 0);
}

function getContrastRatio(luminance: number, otherLuminance: number): number {
  const lighter = Math.max(luminance, otherLuminance);
  const darker = Math.min(luminance, otherLuminance);
  return (lighter + CONTRAST_FLARE) / (darker + CONTRAST_FLARE);
}
