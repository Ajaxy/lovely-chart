import { LONG_PRESS_TIMEOUT } from './constants';
import { addEventListener, removeEventListener } from './minifiers';

// Touch events get `pageX` grafted onto them (see the StackOverflow link
// below), so handlers see a unified shape
export type CaptureEvent = (MouseEvent | TouchEvent) & { pageX?: number };

interface CaptureEventsOptions {
  draggingCursor?: string;
  onCapture?: (e: CaptureEvent) => void;
  onRelease?: (e: CaptureEvent) => void;
  onDrag?: (moveEvent: CaptureEvent, captureEvent: CaptureEvent, extra: { dragOffsetX: number }) => void;
  onLongPress?: () => void;
}

export function captureEvents(element: HTMLElement, options: CaptureEventsOptions) {
  let captureEvent: CaptureEvent | undefined;
  let longPressTimeout: number | undefined;

  function onCapture(e: CaptureEvent) {
    captureEvent = e;

    if (e.type === 'mousedown') {
      addEventListener(document, 'mousemove', onMove);
      addEventListener(document, 'mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      addEventListener(document, 'touchmove', onMove);
      addEventListener(document, 'touchend', onRelease);
      addEventListener(document, 'touchcancel', onRelease);

      // https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
      // Android does not have this value, and iOS has it but as read-only
      if (e.pageX === undefined) {
        (e as { pageX?: number }).pageX = (e as TouchEvent).touches[0].pageX;
      }
    }

    if (options.draggingCursor) {
      document.documentElement.classList.add(`cursor-${options.draggingCursor}`);
    }

    options.onCapture?.(e);

    if (options.onLongPress) {
      longPressTimeout = window.setTimeout(() => options.onLongPress!(), LONG_PRESS_TIMEOUT);
    }
  }

  function onRelease(e: CaptureEvent) {
    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = undefined;
      }

      if (options.draggingCursor) {
        document.documentElement.classList.remove(`cursor-${options.draggingCursor}`);
      }

      removeEventListener(document, 'mouseup', onRelease);
      removeEventListener(document, 'mousemove', onMove);
      removeEventListener(document, 'touchcancel', onRelease);
      removeEventListener(document, 'touchend', onRelease);
      removeEventListener(document, 'touchmove', onMove);

      captureEvent = undefined;

      options.onRelease?.(e);
    }
  }

  function onMove(e: CaptureEvent) {
    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = undefined;
      }

      if (e.type === 'touchmove' && e.pageX === undefined) {
        (e as { pageX?: number }).pageX = (e as TouchEvent).touches[0].pageX;
      }

      options.onDrag?.(e, captureEvent, {
        dragOffsetX: e.pageX! - captureEvent.pageX!,
      });
    }
  }

  addEventListener(element, 'mousedown', onCapture);
  addEventListener(element, 'touchstart', onCapture);
}
