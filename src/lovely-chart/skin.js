import { SKINS } from './constants';

export function getSkin() {
  return document.body.classList.contains('skin-night') ? 'night' : 'day';
}

export function buildSkinState() {
  const state = {};

  Object.keys(SKINS.day).forEach((key) => {
    ['R', 'G', 'B'].forEach((channel, i) => {
      state[`colorChannels#${key}#${channel}`] = SKINS[getSkin()][key][i];
    });
  });

  return state;
}

export function buildRgbaFromState(state, key, opacity = 1) {
  return buildRgba(getColorFromState(state, key), opacity);
}

function getColorFromState(state, key) {
  return ['R', 'G', 'B'].map((channel) => state[`colorChannels#${key}#${channel}`]);
}

function buildRgba([r, g, b], a = 1) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
