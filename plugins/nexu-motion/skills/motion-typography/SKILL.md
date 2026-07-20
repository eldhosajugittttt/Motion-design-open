---
name: motion-typography
description: Create minimal, highly readable kinetic typography for short videos, title cards, reels, ads, captions, and editorial motion graphics. Use when text is a primary visual element, when a video feels like a crowded website, when typography or font pairing needs improvement, or when Codex should animate copy while keeping one clear reading target at a time.
---

# Motion Typography

Design attention, not decoration. Make every visible word earn its place.

## Non-negotiable rules

1. Show one dominant reading target at a time. Treat a short phrase set as one target only when it reads in a single glance.
2. Apply the removal test: if deleting text does not change the message or required action, delete it.
3. Do not add eyebrow copy, badges, version labels, footers, taglines, or decorative microcopy unless the brief explicitly needs them.
4. For a five-second piece, prefer 2–6 total words. Never show a paragraph or a website-like hierarchy.
5. Use no more than two font families and two expressive styles. Prefer a roman display face plus its italic or a restrained companion italic.
6. Preserve natural letterforms. Do not stretch type, fake an italic with skew, or use a script face for long copy.
7. Keep strong contrast, safe margins, and a hold long enough to read without pausing.

## Workflow

1. Reduce the brief to one core statement. Write the smallest copy that preserves the meaning.
2. Break the statement into sequential reading beats. Let each beat replace the previous beat instead of accumulating on screen.
3. Choose one typographic contrast: roman/italic, large/small, or serif/sans. Do not combine all three without a clear reason.
4. Copy `assets/starter/` into the project and replace the sample words. Keep `window.renderFrame(frame, fps)` deterministic.
5. Animate with masks, position, scale, tracking, or opacity. Use at most two motion ideas in a five-second piece.
6. Render the midpoint of every reading beat. At thumbnail size, identify the intended word within 200 ms. If two elements compete, remove or delay one.
7. Render the full video and watch once without pausing. Revise any beat that cannot be read comfortably.

## Timing for short pieces

- Enter over 250–400 ms.
- Hold a single word for at least 650 ms.
- Hold a 4–7 word phrase for at least 1.8 seconds.
- Exit over 180–300 ms.
- Allow only a brief transition overlap; do not leave old copy behind as visual furniture.

## Editorial pairing

For a warm paper composition, prefer a high-contrast serif such as Didot or Bodoni for the anchor and Baskerville italic for one expressive word. Use local fallbacks and verify the rendered glyphs. Read [references/typography-principles.md](references/typography-principles.md) when selecting a pairing, setting scale, or diagnosing crowded typography.

## Rendering

Use the sibling Nexu Motion recorder:

```bash
node ../nexu-motion/scripts/record-page.mjs \
  --input /absolute/path/to/index.html \
  --output /absolute/path/to/video.mp4 \
  --width 720 --height 1280 --fps 30 --duration 5
```

Return the MP4, a poster frame, and the editable HTML/CSS/JS folder.
