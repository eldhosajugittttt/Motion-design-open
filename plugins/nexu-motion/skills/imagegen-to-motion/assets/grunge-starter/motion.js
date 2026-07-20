const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
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
  const crush = easeInOut(range(time, .06, .70));
  const release = easeOut(range(time, .72, 1.16));
  const panelSpecs = [
    ['.panel-tl', -16, -10, -8], ['.panel-tr', 15, -12, 10],
    ['.panel-br', 13, 12, -11], ['.panel-bl', -14, 11, 9]
  ];
  panelSpecs.forEach(([selector, x, y, rotation]) => {
    const panel = $(selector);
    panel.style.opacity = String(1 - release);
    panel.style.transform = `translate(${x * crush}px, ${y * crush}px) scale(${lerp(1, .155, crush)}) rotate(${rotation * crush + release * rotation * 1.8}deg)`;
    panel.style.filter = `contrast(${lerp(1.06, 1.34, crush)}) brightness(${lerp(1, .82, crush)})`;
  });

  const coreIn = backOut(range(time, .30, .72));
  const coreOpacity = coreIn * (1 - release);
  $('.crush-core').style.opacity = String(coreOpacity);
  $('.crush-core').style.transform = `translate(-50%, -50%) scale(${lerp(.1, 1, coreIn) + release * 6.2}) rotate(${Math.sin(time * 32) * (1 - release) * 3 + release * 18}deg)`;

  $$('.crease').forEach((crease, index) => {
    const angle = [19, -31, 67, 143][index];
    crease.style.opacity = String(Math.sin(crush * Math.PI) * (1 - release) * .68);
    crease.style.transform = `rotate(${angle + Math.sin(time * 19 + index) * 2}deg) translateX(-50%) scaleX(${lerp(.15, 1, crush)})`;
  });

  const fragmentSpecs = [[-330,-135,-20],[300,-150,18],[-390,95,13],[350,105,-17],[-165,240,31],[180,235,-27]];
  $$('.fragment').forEach((fragment, index) => {
    const [x, y, rotation] = fragmentSpecs[index];
    const opacity = Math.sin(release * Math.PI);
    fragment.style.opacity = String(opacity * .9);
    fragment.style.transform = `translate(calc(-50% + ${x * release}px), calc(-50% + ${y * release}px)) rotate(${rotation * release}deg) scale(${lerp(.2, 1.2, release)})`;
  });
  $('.crush-intro').style.opacity = String(1 - easeIn(range(time, 1.04, 1.22)));

  const localTime = Math.max(0, time - .95);
  const heroIn = backOut(range(localTime, .28, 1.00));
  const heroOut = easeInOut(range(localTime, 2.72, 3.28));
  const heroOpacity = heroIn * (1 - heroOut);
  const jitterX = localTime > 1.05 && localTime < 2.7 ? ((frame % 5 === 0 ? 1 : -1) * 1.6) : 0;
  const jitterY = localTime > 1.05 && localTime < 2.7 ? ((frame % 7 === 0 ? -1 : 1) * .8) : 0;

  $('.hero').style.opacity = String(heroOpacity);
  $('.hero').style.clipPath = `inset(${lerp(48, 0, heroIn)}% ${heroOut * 58}% ${lerp(48, 0, heroIn)}% 0)`;
  $('.hero').style.transform = `translate(${jitterX - heroOut * 150}px, ${jitterY}px)`;
  $('.poster-main').style.transform = `translate(-50%, -50%) scale(${lerp(.78, 1, heroIn)}) rotate(${lerp(-4, 0, heroIn)}deg)`;
  $('.poster-echo').style.transform = `translate(calc(-50% + ${11 + jitterX}px), calc(-50% + ${8 + jitterY}px)) scale(${lerp(.78, 1, heroIn)})`;
  $('.title-mark').style.transform = `translateX(-50%) rotate(-1.2deg) scaleX(${easeOut(range(localTime, .82, 1.38))})`;

  const halftoneHero = easeOut(range(localTime, .55, 1.05)) * (1 - heroOut);
  $('.halftone-left').style.opacity = String(halftoneHero * .9);
  $('.halftone-left').style.transform = `rotate(-5deg) scale(${lerp(.76, 1, halftoneHero)})`;

  const ripIn = easeOut(range(localTime, 2.62, 2.96));
  const ripOut = easeIn(range(localTime, 3.04, 3.42));
  const ripOpacity = ripIn * (1 - ripOut);
  $('.rip-amber').style.opacity = String(ripOpacity);
  $('.rip-amber').style.transform = `translateX(${lerp(-110, 105, easeInOut(range(localTime, 2.62, 3.42)))}%) rotate(-4deg)`;
  $('.rip-ink').style.opacity = String(ripOpacity * .9);
  $('.rip-ink').style.transform = `translateX(${lerp(-125, 118, easeInOut(range(localTime, 2.68, 3.38)))}%) rotate(2deg)`;

  const messageIn = easeOut(range(localTime, 3.28, 3.62));
  const messageOut = easeIn(range(localTime, 11.42, 11.93));
  $('.message').style.opacity = String(messageIn * (1 - messageOut));
  $('.message').style.transform = `translate(-50%, calc(-50% + ${lerp(18, 0, messageIn)}px))`;

  const first = range(localTime, 3.68, 5.25);
  setTyped('.line-one', 'Pause the noise.', first);
  setCaret('.line-one', localTime, 5.25, 5.78);
  $('.line-one .marker').style.transform = `translateY(.12em) rotate(-.8deg) scaleX(${easeOut(range(localTime, 5.25, 5.82))})`;

  const second = range(localTime, 6.08, 8.35);
  setTyped('.line-two', 'Let the idea arrive.', second);
  setCaret('.line-two', localTime, 8.35, 8.96);
  $('.line-two .marker').style.transform = `translateY(.12em) rotate(.7deg) scaleX(${easeOut(range(localTime, 8.38, 9.02))})`;

  const halftoneMessage = easeOut(range(localTime, 8.1, 8.82)) * (1 - messageOut);
  $('.halftone-right').style.opacity = String(halftoneMessage * .78);
  $('.halftone-right').style.transform = `rotate(7deg) scale(${lerp(.74, 1, halftoneMessage)})`;

  $('.paper-texture').style.transform = `translate(${Math.sin(time * .63) * 3}px, ${Math.cos(time * .51) * 2}px) scale(1.012)`;
  $('.toner').style.opacity = String(.055 + (frame % 4 === 0 ? .027 : 0));
  const ripFlash = Math.sin(range(localTime, 3.06, 3.18) * Math.PI);
  const crushFlash = Math.sin(range(time, .86, 1.08) * Math.PI);
  $('.flash').style.opacity = String(Math.max(ripFlash * .62, crushFlash * .78, messageOut * .8));
};

window.__NEXU_READY = Promise.all([
  document.fonts?.ready,
  ...[...document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  }))
]);
window.renderFrame(0, 30);
