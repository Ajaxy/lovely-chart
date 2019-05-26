import { DEFAULT_SKIN } from './constants';

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

export function createColors(datasetColors) {
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

export function getCssColor(colors, key, opacity) {
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
