const $ = selector => document.querySelector(selector);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const range = (time, start, end) => clamp((time - start) / (end - start));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = t => Math.pow(clamp(t), 3);
const easeInOut = t => t < .5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const backOut = t => {
  t = clamp(t);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const setTyped = (selector, copy, progress) => {
  const visible = Math.floor(copy.length * clamp(progress));
  $(`${selector} .typed`).textContent = copy.slice(0, visible);
};

const setCaret = (selector, time, endTime, hideTime) => {
  const done = time >= endTime;
  const blink = Math.floor(Math.max(0, time - endTime) * 3.2) % 2 === 0;
  $(`${selector} .caret`).style.opacity = String(done ? (time < hideTime && blink ? 1 : 0) : 1);
};

window.renderFrame = (frame, fps) => {
  const time = frame / fps;
  const heroIn = backOut(range(time, .28, 1.00));
  const heroOut = easeInOut(range(time, 2.72, 3.28));
  const heroOpacity = heroIn * (1 - heroOut);
  const jitterX = time > 1.05 && time < 2.7 ? ((frame % 5 === 0 ? 1 : -1) * 1.6) : 0;
  const jitterY = time > 1.05 && time < 2.7 ? ((frame % 7 === 0 ? -1 : 1) * .8) : 0;

  $('.hero').style.opacity = String(heroOpacity);
  $('.hero').style.clipPath = `inset(${lerp(48, 0, heroIn)}% ${heroOut * 58}% ${lerp(48, 0, heroIn)}% 0)`;
  $('.hero').style.transform = `translate(${jitterX - heroOut * 150}px, ${jitterY}px)`;
  $('.poster-main').style.transform = `translate(-50%, -50%) scale(${lerp(.78, 1, heroIn)}) rotate(${lerp(-4, 0, heroIn)}deg)`;
  $('.poster-echo').style.transform = `translate(calc(-50% + ${11 + jitterX}px), calc(-50% + ${8 + jitterY}px)) scale(${lerp(.78, 1, heroIn)})`;
  $('.title-mark').style.transform = `translateX(-50%) rotate(-1.2deg) scaleX(${easeOut(range(time, .82, 1.38))})`;

  const halftoneHero = easeOut(range(time, .55, 1.05)) * (1 - heroOut);
  $('.halftone-left').style.opacity = String(halftoneHero * .9);
  $('.halftone-left').style.transform = `rotate(-5deg) scale(${lerp(.76, 1, halftoneHero)})`;

  const ripIn = easeOut(range(time, 2.62, 2.96));
  const ripOut = easeIn(range(time, 3.04, 3.42));
  const ripOpacity = ripIn * (1 - ripOut);
  $('.rip-amber').style.opacity = String(ripOpacity);
  $('.rip-amber').style.transform = `translateX(${lerp(-110, 105, easeInOut(range(time, 2.62, 3.42)))}%) rotate(-4deg)`;
  $('.rip-ink').style.opacity = String(ripOpacity * .9);
  $('.rip-ink').style.transform = `translateX(${lerp(-125, 118, easeInOut(range(time, 2.68, 3.38)))}%) rotate(2deg)`;

  const messageIn = easeOut(range(time, 3.28, 3.62));
  const messageOut = easeIn(range(time, 11.42, 11.93));
  $('.message').style.opacity = String(messageIn * (1 - messageOut));
  $('.message').style.transform = `translate(-50%, calc(-50% + ${lerp(18, 0, messageIn)}px))`;

  const first = range(time, 3.68, 5.25);
  setTyped('.line-one', 'Pause the noise.', first);
  setCaret('.line-one', time, 5.25, 5.78);
  $('.line-one .marker').style.transform = `translateY(.12em) rotate(-.8deg) scaleX(${easeOut(range(time, 5.25, 5.82))})`;

  const second = range(time, 6.08, 8.35);
  setTyped('.line-two', 'Let the idea arrive.', second);
  setCaret('.line-two', time, 8.35, 8.96);
  $('.line-two .marker').style.transform = `translateY(.12em) rotate(.7deg) scaleX(${easeOut(range(time, 8.38, 9.02))})`;

  const halftoneMessage = easeOut(range(time, 8.1, 8.82)) * (1 - messageOut);
  $('.halftone-right').style.opacity = String(halftoneMessage * .78);
  $('.halftone-right').style.transform = `rotate(7deg) scale(${lerp(.74, 1, halftoneMessage)})`;

  $('.paper-texture').style.transform = `translate(${Math.sin(time * .63) * 3}px, ${Math.cos(time * .51) * 2}px) scale(1.012)`;
  $('.toner').style.opacity = String(.055 + (frame % 4 === 0 ? .027 : 0));
  const flash = Math.sin(range(time, 3.06, 3.18) * Math.PI);
  $('.flash').style.opacity = String(flash * .62 + messageOut * .8);
};

window.__NEXU_READY = Promise.all([
  document.fonts?.ready,
  ...[...document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  }))
]);
window.renderFrame(0, 30);
