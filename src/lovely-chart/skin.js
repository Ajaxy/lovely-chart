import { SKINS } from './constants';

export function getSkin() {
  return document.body.classList.contains('skin-night') ? 'night' : 'day';
}

export function buildSkinState(overrides = {}) {
  const state = {};
  const skin = SKINS[getSkin()];

  Object.keys(SKINS.day).forEach((key) => {
    setStateColorProps(state, key, overrides[key] || skin[key]);
  });

  return state;
}

function setStateColorProps(state, key, rgb) {
  ['R', 'G', 'B'].forEach((channel, i) => {
    state[`colorChannels#${key}#${channel}`] = rgb[i];
  });
}

export function buildRgbaFromState(state, key, opacity = 1) {
  return buildRgba(getColorFromState(state, key), opacity);
}

function getColorFromState(state, key) {
  return ['R', 'G', 'B'].map((channel) => Math.round(state[`colorChannels#${key}#${channel}`]));
}

export function hexToRgba(hex, opacity) {
  hex = hex.replace('#', '');

  return buildRgba([
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ], opacity);
}

function buildRgba([r, g, b], a = 1) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
