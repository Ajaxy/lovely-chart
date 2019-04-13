import { mergeArrays } from './fast';

let colors;
let colorKeys;

const CHANNEL_KEYS = ['R', 'G', 'B', 'A'];

export function setupColors(_colors) {
  colors = _colors;
  colorKeys = Object.keys(colors['skin-day']);
}

export function getSkin() {
  return document.body.classList.contains('skin-night') ? 'skin-night' : 'skin-day';
}

export function buildSkinState() {
  const state = {};
  const skin = colors[getSkin()];

  // TODO perf !
  colorKeys.forEach((key) => {
    CHANNEL_KEYS.forEach((channel, i) => {
      const channels = hexToChannels(skin[key]);
      state[`colorChannels#${key}#${channel}`] = channels[i];
    });
  });

  return state;
}

export function buildSkinStateKeys() {
  return mergeArrays(colorKeys.map((key) => (
    CHANNEL_KEYS.map((channel) => `colorChannels#${key}#${channel}`)
  )));
}

export function buildCssColorFromState(state, key, opacity = 1) {
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
