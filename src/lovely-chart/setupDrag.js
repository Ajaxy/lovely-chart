import { addEventListener, removeEventListener } from './minifiers';

export function setupDrag(element, options) {
  let captureEvent = null;

  function onCapture(e) {
    if (e.target !== element) {
      return;
    }

    e.preventDefault();
    captureEvent = e;

    if (e.type === 'mousedown') {
      addEventListener(document, 'mousemove', onMove);
      addEventListener(document, 'mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      addEventListener(document, 'touchmove', onMove);
      addEventListener(document, 'touchend', onRelease);
      addEventListener(document, 'touchcancel', onRelease);

      // https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
      // Android does not have this value, and iOS has it but as read-only.
      if (e.pageX === undefined) {
        e.pageX = e.touches[0].pageX;
      }
    }

    if (options.draggingCursor) {
      document.body.classList.add(`cursor-${options.draggingCursor}`);
    }

    options.onCapture && options.onCapture(e);
  }

  function onRelease() {
    if (captureEvent) {
      if (options.draggingCursor) {
        document.body.classList.remove(`cursor-${options.draggingCursor}`);
      }

      removeEventListener(document, 'mouseup', onRelease);
      removeEventListener(document, 'mousemove', onMove);
      removeEventListener(document, 'touchcancel', onRelease);
      removeEventListener(document, 'touchend', onRelease);
      removeEventListener(document, 'touchmove', onMove);

      captureEvent = null;
    }
  }

  function onMove(e) {
    if (captureEvent) {
      if (e.type === 'touchmove' && e.pageX === undefined) {
        e.pageX = e.touches[0].pageX;
      }

      options.onDrag(e, captureEvent, {
        dragOffsetX: e.pageX - captureEvent.pageX,
      });
    }
  }

  addEventListener(element, 'mousedown', onCapture);
  addEventListener(element, 'touchstart', onCapture);
}
