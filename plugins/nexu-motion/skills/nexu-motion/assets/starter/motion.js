const hook = document.querySelector('.scene-hook');
const payoff = document.querySelector('.scene-payoff');
const eyebrow = document.querySelector('.eyebrow');
const lines = [...document.querySelectorAll('h1 span')];
const rule = document.querySelector('.rule');
const ambientA = document.querySelector('.ambient-a');
const ambientB = document.querySelector('.ambient-b');

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const range = (time, start, end) => clamp((time - start) / (end - start));
const lerp = (a, b, amount) => a + (b - a) * amount;
const easeOut = value => 1 - Math.pow(1 - clamp(value), 3);
const easeInOut = value => value < .5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
const backOut = value => {
  const t = clamp(value);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

window.renderFrame = (frame, fps) => {
  const time = frame / fps;
  const intro = backOut(range(time, .05, .75));
  const hookExit = easeInOut(range(time, 1.65, 2.15));
  const payoffIn = easeOut(range(time, 1.9, 2.7));

  eyebrow.style.opacity = String(easeOut(range(time, 0, .4)) * (1 - hookExit));
  eyebrow.style.transform = `translateY(${lerp(30, 0, intro)}px)`;
  lines.forEach((line, index) => {
    const progress = backOut(range(time, .15 + index * .12, .85 + index * .12));
    line.style.opacity = String(progress * (1 - hookExit));
    line.style.transform = `translateY(${lerp(120, 0, progress) - hookExit * 70}px)`;
  });
  rule.style.transform = `scaleX(${easeOut(range(time, .55, 1.2)) * (1 - hookExit)})`;
  hook.style.filter = `blur(${hookExit * 18}px)`;
  hook.style.opacity = String(1 - hookExit);

  payoff.style.opacity = String(payoffIn);
  payoff.style.transform = `translateY(${lerp(80, 0, payoffIn)}px) scale(${lerp(.94, 1, payoffIn)})`;
  ambientA.style.transform = `translate(${Math.sin(time * 1.1) * 70}px, ${Math.cos(time * .8) * 50}px)`;
  ambientB.style.transform = `translate(${Math.cos(time * .7) * 45}px, ${Math.sin(time * .9) * 60}px)`;
};

window.__NEXU_READY = Promise.resolve();
window.renderFrame(0, 30);
