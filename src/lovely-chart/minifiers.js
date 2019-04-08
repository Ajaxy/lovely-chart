export const createElement = document.createElement.bind(document);

export function addEventListener(element, event, cb) {
  element.addEventListener(event, cb);
}

export function removeEventListener(element, event, cb) {
  element.removeEventListener(event, cb);
}
