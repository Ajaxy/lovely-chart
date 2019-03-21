export function setupDragListener(element, callbacks) {
  let captureEvent = null;

  function onCapture(e) {
    e.preventDefault();

    captureEvent = e;
    callbacks.onCapture && callbacks.onCapture(e);
  }

  function onRelease(e) {
    if (captureEvent) {
      e.preventDefault();

      captureEvent = null;
    }
  }

  function onMove(e) {
    if (captureEvent) {
      e.preventDefault();

      callbacks.onDrag(e, captureEvent, {
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
