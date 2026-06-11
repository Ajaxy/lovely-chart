import type { ChartColors, ColorChannels } from './types';

const COLOR_CLOSENESS_THRESHOLD = 70;

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

export function createColors(datasetColors: Record<string, string>): ChartColors {
  ensureInited();

  const colors: ChartColors = {};
  const baseClass = `.lovely-chart--color`;

  (['skin-day', 'skin-night'] as const).forEach((skin) => {
    colors[skin] = {};

    Object.entries(COLORS[skin]).forEach(([prop, value]) => {
      colors[skin][prop] = hexToChannels(value);
    });

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

export function isColorCloseToWhite(hex: string): boolean {
  return getColorDistance(hexToChannels(hex), [255, 255, 255]) < COLOR_CLOSENESS_THRESHOLD;
}

function getColorDistance([r1, g1, b1]: ColorChannels, [r2, g2, b2]: ColorChannels): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function addCssRule(sheet: CSSStyleSheet, selector: string, rule: string) {
  sheet.insertRule(`${selector} { ${rule} }`, sheet.cssRules.length);
}
