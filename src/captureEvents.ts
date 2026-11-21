import { LONG_PRESS_TIMEOUT, TOUCH_DIRECTION_THRESHOLD } from './constants.js';
import { addEventListener, removeEventListener } from './minifiers.js';

// Touch events get `pageX` grafted onto them (see the StackOverflow link
// below), so handlers see a unified shape
export type CaptureEvent = (MouseEvent | TouchEvent) & { pageX?: number };

interface CaptureEventsOptions {
  draggingCursor?: string;
  // A touch that moves more down or up than across before it moves far, or under which the page scrolls, is a swipe of
  // the page, which ends the capture with no drag; one across cancels what moves of it it can, so the page stays still
  shouldYieldVerticalTouch?: boolean;
  onCapture?: (e: CaptureEvent) => void;
  onRelease?: (e: CaptureEvent) => void;
  onDrag?: (moveEvent: CaptureEvent, captureEvent: CaptureEvent, extra: { dragOffsetX: number }) => void;
  onLongPress?: () => void;
}

// Returns a function that detaches every listener, cancels a pending long press and ends a drag without `onRelease`
export function captureEvents(element: HTMLElement, options: CaptureEventsOptions): () => void {
  let captureEvent: CaptureEvent | undefined;
  let longPressTimeout: number | undefined;
  // Where a touch landed in the viewport, which a scroll of the page leaves under the finger, and the scroll of the page
  // then, which the offset of the page from the viewport under the touch gives
  let touchStart: { x: number; y: number; scrollY: number } | undefined;
  let isTouchAcross = false;

  // The document hears the moves and the release before any element of the page, which can stop them
  function onCapture(e: CaptureEvent) {
    captureEvent = e;
    touchStart = undefined;
    isTouchAcross = false;

    if (e.type === 'mousedown') {
      addEventListener(document, 'mousemove', onMove, true);
      addEventListener(document, 'mouseup', onRelease, true);
      // A context menu opened by the press, as a secondary or Control click opens it on macOS, takes its release
      addEventListener(document, 'contextmenu', onRelease, true);
    } else if (e.type === 'touchstart') {
      if (options.shouldYieldVerticalTouch) {
        // A drag across cancels the moves of its touch, which a passive listener cannot
        document.addEventListener('touchmove', onMove, { capture: true, passive: false });
      } else {
        addEventListener(document, 'touchmove', onMove, true);
      }
      addEventListener(document, 'touchend', onRelease, true);
      addEventListener(document, 'touchcancel', onRelease, true);

      // https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
      // Android does not have this value, and iOS has it but as read-only
      if (e.pageX === undefined) {
        (e as { pageX?: number }).pageX = (e as TouchEvent).touches[0].pageX;
      }

      if (options.shouldYieldVerticalTouch) {
        const { clientX, clientY, pageY } = (e as TouchEvent).touches[0];
        touchStart = { x: clientX, y: clientY, scrollY: pageY - clientY };
      }
    }

    if (options.draggingCursor) {
      document.documentElement.classList.add(`lovely-chart--cursor-${options.draggingCursor}`);
    }

    options.onCapture?.(e);

    if (options.onLongPress) {
      // A second press before the release, such as another finger, restarts the one pending
      clearTimeout(longPressTimeout);
      longPressTimeout = window.setTimeout(() => options.onLongPress!(), LONG_PRESS_TIMEOUT);
    }
  }

  function onRelease(e: CaptureEvent) {
    if (captureEvent) {
      endCapture();

      options.onRelease?.(e);
    }
  }

  function endCapture() {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = undefined;
    }

    if (options.draggingCursor) {
      document.documentElement.classList.remove(`lovely-chart--cursor-${options.draggingCursor}`);
    }

    removeEventListener(document, 'mouseup', onRelease, true);
    removeEventListener(document, 'mousemove', onMove, true);
    removeEventListener(document, 'contextmenu', onRelease, true);
    removeEventListener(document, 'touchcancel', onRelease, true);
    removeEventListener(document, 'touchend', onRelease, true);
    removeEventListener(document, 'touchmove', onMove, true);

    captureEvent = undefined;
  }

  function onMove(e: CaptureEvent) {
    // A release over a frame never reaches the document, which hears the pointer's next move with no button pressed
    if (captureEvent && e.type === 'mousemove' && (e as MouseEvent).buttons === 0) {
      onRelease(e);
      return;
    }

    if (captureEvent) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = undefined;
      }

      if (e.type === 'touchmove' && e.pageX === undefined) {
        (e as { pageX?: number }).pageX = (e as TouchEvent).touches[0].pageX;
      }

      if (touchStart && e.type === 'touchmove') {
        const { clientX, clientY, pageY } = (e as TouchEvent).touches[0];
        // A browser that judges the way of the swipe for itself has scrolled the page under it
        if (pageY - clientY !== touchStart.scrollY) {
          onRelease(e);
          return;
        }

        if (!isTouchAcross) {
          const across = Math.abs(clientX - touchStart.x);
          const along = Math.abs(clientY - touchStart.y);
          if (Math.max(across, along) < TOUCH_DIRECTION_THRESHOLD) {
            return;
          }

          if (along > across) {
            onRelease(e);
            return;
          }

          isTouchAcross = true;
        }

        // A browser lets the page cancel the first moves of a touch alone, before it may scroll the page
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      options.onDrag?.(e, captureEvent, {
        dragOffsetX: e.pageX! - captureEvent.pageX!,
      });
    }
  }

  addEventListener(element, 'mousedown', onCapture);
  addEventListener(element, 'touchstart', onCapture);

  return () => {
    if (captureEvent) {
      endCapture();
    }

    removeEventListener(element, 'mousedown', onCapture);
    removeEventListener(element, 'touchstart', onCapture);
  };
}
