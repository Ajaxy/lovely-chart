const ANIMATION_TIME = 400;

function fadeIn(element) {
  element.classList.add('animated');
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.remove('animated');
  }, ANIMATION_TIME);
}

function fadeOut(element) {
  element.classList.add('animated');
  element.classList.add('hidden');

  setTimeout(() => {
    element.classList.remove('animated');
  }, ANIMATION_TIME);
}

export default {
  fadeIn,
  fadeOut
}
