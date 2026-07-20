const $ = selector => document.querySelector(selector);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const range = (time, start, end) => clamp((time - start) / (end - start));
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);

const copy = 'Say what matters.';

window.renderFrame = (frame, fps) => {
  const time = frame / fps;
  const typing = range(time, .42, 2.15);
  const visibleCount = Math.floor(copy.length * typing);
  $('.typed').textContent = copy.slice(0, visibleCount);

  const done = time >= 2.15;
  const blink = Math.floor(Math.max(0, time - 2.15) * 3) % 2 === 0;
  $('.caret').style.opacity = String(done ? (time < 2.95 && blink ? 1 : 0) : 1);

  const settle = easeOut(range(time, 2.12, 2.62));
  $('.type-line').style.transform = `translateY(${(1 - settle) * 7}px)`;
  $('.rule').style.transform = `scaleX(${easeOut(range(time, 2.32, 3.02))})`;
};

window.__NEXU_READY = Promise.resolve(document.fonts?.ready);
window.renderFrame(0, 30);
