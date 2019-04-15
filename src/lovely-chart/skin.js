import { DEFAULT_SKIN } from './constants';

let allColors;
let skin = DEFAULT_SKIN;

export function setupColors(_colors) {
  allColors = _colors;
}

export function changeSkin(_skin) {
  skin = _skin;
}

export function createColors(palette) {
  const colors = {};

  ['skin-day', 'skin-night'].forEach((skin) => {
    colors[skin] = {};

    Object.keys(allColors[skin]).forEach((prop) => {
      const channels = hexToChannels(allColors[skin][prop]);

      if (prop.startsWith(`palette-${palette}`)) {
        colors[skin][prop.replace(`palette-${palette}-`, '')] = channels;
      } else if (!prop.startsWith(`palette-`)) {
        colors[skin][prop] = channels;
      }
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
