// The code of the playground, kept in the browser: a live block of the guide or an example opens it there, and the
// playground keeps what the reader types across reloads

import { getExampleUrl } from './pages.js';

const STORAGE_KEY = 'lovely-chart-docs-playground';

export function openInPlayground(source) {
  savePlayground(source);
  window.location.href = getExampleUrl('playground');
}

export function savePlayground(source) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
  } catch {
    // The playground starts from its default code where the browser keeps no storage
  }
}

export function readPlayground() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === 'object' ? stored : undefined;
  } catch {
    return undefined;
  }
}
