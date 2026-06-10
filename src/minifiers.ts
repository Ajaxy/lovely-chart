export const createElement = <T extends HTMLElement = HTMLDivElement>(tagName = 'div'): T => {
  return document.createElement(tagName) as T;
};

export function addEventListener(element: EventTarget, event: string, cb: (e: any) => void) {
  element.addEventListener(event, cb);
}

export function removeEventListener(element: EventTarget, event: string, cb: (e: any) => void) {
  element.removeEventListener(event, cb);
}
