const $ = selector => document.querySelector(selector);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const range = (time, start, end) => clamp((time - start) / (end - start));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = t => Math.pow(clamp(t), 3);
const easeInOut = t => t < .5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;

const opacityWindow = (time, enterStart, enterEnd, exitStart, exitEnd) => {
  const enter = easeOut(range(time, enterStart, enterEnd));
  const exit = easeIn(range(time, exitStart, exitEnd));
  return enter * (1 - exit);
};

window.renderFrame = (frame, fps) => {
  const time = frame / fps;

  const lessIn = easeOut(range(time, .18, .52));
  const lessOpacity = opacityWindow(time, .18, .48, 1.12, 1.34);
  const less = $('.beat-less');
  less.style.opacity = lessOpacity;
  less.style.clipPath = `inset(0 ${lerp(100, 0, lessIn)}% 0 0)`;
  less.style.transform = `translateY(${lerp(22, 0, lessIn)}px)`;
  less.querySelector('span').style.letterSpacing = `${lerp(.04, -.075, lessIn)}em`;

  const textIn = easeOut(range(time, 1.27, 1.60));
  const textOpacity = opacityWindow(time, 1.27, 1.53, 2.20, 2.43);
  const text = $('.beat-text');
  text.style.opacity = textOpacity;
  text.style.transform = `translateX(${lerp(70, 0, textIn)}px) rotate(${lerp(-2.5, -5, textIn)}deg)`;

  const moreIn = easeOut(range(time, 2.37, 2.72));
  const moreOpacity = opacityWindow(time, 2.37, 2.65, 3.31, 3.54);
  const more = $('.beat-more');
  more.style.opacity = moreOpacity;
  more.style.transform = `scale(${lerp(1.14, 1, moreIn)})`;
  more.style.clipPath = `inset(${lerp(48, 0, moreIn)}% 0)`;

  const meaningIn = easeOut(range(time, 3.48, 3.88));
  const meaning = $('.beat-meaning');
  meaning.style.opacity = meaningIn;
  meaning.style.transform = `translateY(${lerp(44, 0, meaningIn)}px)`;
  meaning.querySelector('i').style.transform = `scaleX(${easeInOut(range(time, 3.82, 4.28))})`;

  const paperShift = easeInOut(range(time, 2.22, 2.64));
  $('.paper').style.transform = `translateX(${lerp(0, 7, paperShift)}px)`;
};

window.__NEXU_READY = Promise.resolve(document.fonts?.ready);
window.renderFrame(0, 30);
