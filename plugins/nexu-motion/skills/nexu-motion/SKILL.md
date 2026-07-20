---
name: nexu-motion
description: Create polished motion graphics, animated ads, reels, title sequences, kinetic typography, product promos, explainers, and screen-recorded web animations from a user prompt. Use when Codex should design a website-like HTML/CSS layout, animate it on a deterministic timeline, preview key frames, and export MP4 video locally without an external AI API key.
---

# Nexu Motion

Create each video as a small, responsive-looking web composition that a local recorder advances frame by frame. Use the active Codex session for creative decisions; do not add an AI API call.

## Workflow

1. Infer missing production settings. Default to 6 seconds, 30 fps, and 1080×1920 for social video. Use 1080×1080 for square posts and 1920×1080 for landscape.
2. Plan 3–5 beats: hook, context/product, proof or transformation, and final CTA. Keep one dominant message per beat.
   When text is a primary visual element, use the sibling `motion-typography` skill and show one reading target at a time.
3. Copy `assets/starter/` into a new project folder. Replace its content and styling with a complete HTML/CSS motion design.
4. Implement `window.renderFrame(frame, fps)` in `motion.js`. Derive all visual state from the supplied frame. Do not use `requestAnimationFrame`, timers, CSS autoplay, random values, or network-loaded runtime dependencies.
5. Use transform and opacity for primary motion. Prefer coordinated sequences, overshoot, masks, stagger, type scale, depth, and strong composition over many unrelated effects.
6. Read [references/timeline-contract.md](references/timeline-contract.md) when writing or debugging the timeline.
7. Render at least three stills before the full video: early hook, visual midpoint, and final CTA. Inspect them for cropping, hierarchy, contrast, spelling, safe areas, and unintended blank frames.
8. Export MP4 with the bundled recorder. Rerender after any timeline or layout change.

## Recorder

Run from the skill directory or use absolute paths:

```bash
node scripts/record-page.mjs \
  --input /absolute/path/to/index.html \
  --output /absolute/path/to/video.mp4 \
  --width 1080 --height 1920 --fps 30 --duration 6
```

Render a still with the same page and dimensions:

```bash
node scripts/record-page.mjs \
  --input /absolute/path/to/index.html \
  --output /absolute/path/to/poster.png \
  --width 1080 --height 1920 --fps 30 --frame 90
```

## Quality bar

- Make the first useful visual appear within 0.3 seconds.
- Keep essential text inside a 7% safe margin.
- Use no more than two font families and three principal colors unless the brief requires more.
- Use large, legible typography; avoid paragraph-sized copy in short ads.
- Apply the removal test to every text element. Do not add decorative eyebrow copy, badges, labels, taglines, or footers that the message does not require.
- Ensure the last CTA holds long enough to read.
- Produce deterministic output: the same frame number must always look identical.
- Use only user-provided, locally available, or explicitly generated assets. Never invent a product image when product truth matters.

Return the final MP4 as the primary deliverable and include the editable web-motion folder.
