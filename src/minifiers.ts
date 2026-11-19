export function createElement<T extends HTMLElement = HTMLDivElement>(tagName = 'div'): T {
  return document.createElement(tagName) as T;
}

export function addEventListener(element: EventTarget, event: string, cb: (e: any) => void, shouldCapture = false) {
  element.addEventListener(event, cb, shouldCapture);
}

export function removeEventListener(element: EventTarget, event: string, cb: (e: any) => void, shouldCapture = false) {
  element.removeEventListener(event, cb, shouldCapture);
}
