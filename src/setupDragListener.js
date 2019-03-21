export function setupDragListener(element, callbacks) {
  let captureEvent = null;

  function onCapture(e) {
    captureEvent = e;
    callbacks.onCapture && callbacks.onCapture(e);
  }

  function onRelease() {
    captureEvent = null;
  }

  function onMove(e) {
    if (captureEvent) {
      const dragOffsetX = e.pageX - captureEvent.pageX;
      // const captureOffsetX = captureEvent.offsetX + dragOffsetX;

      callbacks.onDrag(e, captureEvent, { dragOffsetX });
    }
  }

  element.addEventListener('mousedown', onCapture);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onRelease);
}
