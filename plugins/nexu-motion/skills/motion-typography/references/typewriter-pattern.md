# Deterministic typewriter pattern

Use a typewriter reveal for one short sentence when progressive disclosure supports the idea. Do not use it merely to fill time.

## Layout rules

- Reserve the completed sentence dimensions with an invisible duplicate so proportional type does not recenter or reflow while typing.
- Keep the line left-aligned inside its reserved block; the block itself may be centered.
- Keep only one caret. Stop or remove it after the sentence completes.
- Do not combine typing with large camera, scale, or position motion.
- Hold the finished sentence for at least 1.2 seconds.

## HTML pattern

```html
<p class="type-line">
  <span class="reserve">Say what matters.</span>
  <span class="typed-wrap" aria-hidden="true">
    <span class="typed"></span><i class="caret"></i>
  </span>
</p>
```

Place `.reserve` and `.typed-wrap` in the same CSS grid cell. Set `.reserve { visibility: hidden; }` so it occupies the final width without appearing.

## Frame-driven reveal

```js
const copy = 'Say what matters.';
const typing = range(time, 0.45, 2.15);
const visibleCount = Math.floor(copy.length * typing);
document.querySelector('.typed').textContent = copy.slice(0, visibleCount);

const typingDone = time >= 2.15;
const blink = Math.floor(Math.max(0, time - 2.15) * 3) % 2 === 0;
document.querySelector('.caret').style.opacity = String(typingDone ? (time < 2.9 && blink) : 1);
```

Use `frame / fps` as the only time source. Do not use timers, CSS typing keyframes, randomness, or runtime measurement to decide how many characters are visible.
