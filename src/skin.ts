import type { ChartColors, ColorChannels, ThemedColor } from './types.js';

const COLOR_CLOSENESS_THRESHOLD = 70;
const MASK_OPACITY = 0.5;
// The label colours of a checked legend button, as `_buttons.scss` sets them
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

function detectSkin() {
  return document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
}

let skin: 'skin-day' | 'skin-night' | undefined;
let styleSheet: CSSStyleSheet | null | undefined;

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

  // Prefer Constructable Stylesheets so a strict `style-src` CSP without
  // `'unsafe-inline'` does not block us; fall back to an injected <style> on
  // browsers that do not support them or where construction throws
  if (typeof CSSStyleSheet === 'function') {
    try {
      styleSheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
    } catch {
      styleSheet = undefined;
    }
  }
  if (!styleSheet) {
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(''));
    document.head.appendChild(styleElement);
    styleSheet = styleElement.sheet;
  }

  new MutationObserver(() => {
    skin = detectSkin();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

export function createColors(
  datasetColors: Record<string, string>,
  { axisTextColor, backgroundColor }: { axisTextColor?: ThemedColor; backgroundColor?: ThemedColor } = {},
): ChartColors {
  ensureInited();

  const colors: ChartColors = {};
  const baseClass = `.lovely-chart--color`;

  (['skin-day', 'skin-night'] as const).forEach((skin) => {
    colors[skin] = {};

    Object.entries(COLORS[skin]).forEach(([prop, value]) => {
      colors[skin][prop] = hexToChannels(value);
    });

    if (axisTextColor) {
      const axisText = hexToChannels(pickSchemeColor(axisTextColor, SKIN_SCHEMES[skin]));
      colors[skin]['x-axis-text'] = axisText;
      colors[skin]['y-axis-text'] = axisText;
    }

    if (backgroundColor) {
      const background = hexToChannels(pickSchemeColor(backgroundColor, SKIN_SCHEMES[skin]));
      colors[skin].background = background;
      colors[skin].mask = [background[0], background[1], background[2], background[3]! * MASK_OPACITY];
    }

    Object.entries(datasetColors).forEach(([key, color]) => {
      const colorSuffix = color.slice(1);
      colors[skin][`dataset#${key}`] = hexToChannels(color);

      addCssRule(
        styleSheet!,
        `.lovely-chart--tooltip-dataset-value${baseClass}-${colorSuffix}`,
        `color: ${color}`,
      );
      addCssRule(
        styleSheet!,
        `.lovely-chart--button${baseClass}-${colorSuffix}`,
        `border-color: ${color}; color: ${color}`,
      );

      const checkedButtonSelector = `.lovely-chart--button.lovely-chart--state-checked${baseClass}-${colorSuffix}`;
      addCssRule(styleSheet!, checkedButtonSelector, `background-color: ${color}`);
    });
  });

  return colors;
}

function pickSchemeColor(color: ThemedColor, scheme: 'light' | 'dark') {
  return typeof color === 'string' ? color : color[scheme];
}

export function getCssColor(colors: ChartColors, key: string, opacity?: number): string {
  return buildCssColor(colors[skin!][key], opacity);
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

export function isColorCloseToBackground(colors: ChartColors, hex: string): boolean {
  const background = colors[skin!]['tooltip-background'];
  const foreground = hexToChannels(hex);
  return getColorDistance(background, foreground) < COLOR_CLOSENESS_THRESHOLD;
}

// A checked legend button keeps its light label while that reaches `MIN_LIGHT_CONTENT_CONTRAST` on the fill
export function isLightContentTooFaint(hex: string): boolean {
  const luminance = getRelativeLuminance(hexToChannels(hex));
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

function getColorDistance([r1, g1, b1]: ColorChannels, [r2, g2, b2]: ColorChannels): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function addCssRule(sheet: CSSStyleSheet, selector: string, rule: string) {
  sheet.insertRule(`${selector} { ${rule} }`, sheet.cssRules.length);
}
