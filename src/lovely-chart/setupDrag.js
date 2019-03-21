export function setupDrag(element, options) {
  let captureEvent = null;

  function onCapture(e) {
    if (e.target !== element) {
      return;
    }

    e.preventDefault();

    captureEvent = e;

    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onRelease);

      // https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
      e.offsetX = e.touches[0].pageX - e.touches[0].target.offsetLeft;
    }

    if (options.draggingCursor) {
      document.body.classList.add(`cursor-${options.draggingCursor}`);
    }

    options.onCapture && options.onCapture(e);
  }

  function onRelease(e) {
    if (captureEvent) {
      e.preventDefault();

      if (options.draggingCursor) {
        document.body.classList.remove(`cursor-${options.draggingCursor}`);
      }

      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onRelease);

      captureEvent = null;
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
  element.addEventListener('touchstart', onCapture);
}
