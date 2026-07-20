# Deterministic timeline contract

The recorder loads `index.html`, waits for `window.__NEXU_READY` when present, and calls:

```js
await window.renderFrame(frame, fps);
```

`renderFrame` must synchronously or asynchronously place the page in its exact visual state for that frame. The recorder then captures the viewport.

## Required rules

- Compute `time = frame / fps` inside `renderFrame`.
- Set every animated property from time; do not increment existing state.
- Keep generated randomness stable by replacing it with hard-coded values or a seeded function.
- Preload local images and fonts in `window.__NEXU_READY`.
- Hide overflow on the page and size the stage to `100vw × 100vh`.
- Design at the requested viewport; the recorder sets exact output dimensions.

## Useful timeline helpers

```js
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const range = (time, start, end) => clamp((time - start) / (end - start));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
const backOut = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(clamp(t) - 1, 3) + c1 * Math.pow(clamp(t) - 1, 2);
};
```

## Pattern

```js
window.renderFrame = (frame, fps) => {
  const time = frame / fps;
  const intro = backOut(range(time, 0.1, 0.8));
  const exit = easeInOut(range(time, 4.8, 5.4));

  headline.style.transform = `translateY(${lerp(80, 0, intro) - exit * 60}px)`;
  headline.style.opacity = String(intro * (1 - exit));
};
```

For sequential scenes, keep all scene containers in the DOM and derive each scene's opacity and transform from its own time range. This makes cuts, overlaps, and transitions deterministic.
