export function setupDrag(element, options) {
  let captureEvent = null;

  function onCapture(e) {
    if (e.target !== element) {
      return;
    }

    e.preventDefault();

    captureEvent = e;

    if (options.draggingCursor) {
      document.body.classList.add(`cursor-${options.draggingCursor}`);
    }

    options.onCapture && options.onCapture(e);
  }

  function onRelease(e) {
    if (captureEvent) {
      e.preventDefault();

      captureEvent = null;

      if (options.draggingCursor) {
        document.body.classList.remove(`cursor-${options.draggingCursor}`);
      }
    }
  }

  function onMove(e) {
    if (captureEvent) {
      e.preventDefault();

      options.onDrag(e, captureEvent, {
        dragOffsetX: e.pageX - captureEvent.pageX,
      });
    }
  }

  element.addEventListener('mousedown', onCapture);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onRelease);

  element.addEventListener('touchstart', onCapture);
  document.addEventListener('touchmove', onMove);
  document.addEventListener('touchend', onRelease);
}
