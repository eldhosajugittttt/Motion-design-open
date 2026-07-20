---
name: motion-typography
description: Create minimal, highly readable kinetic typography for short videos, title cards, reels, ads, captions, and editorial motion graphics, including phrase reveals and deterministic typewriter effects. Use when text is a primary visual element, when a video feels like a crowded website, when typography or font pairing needs improvement, or when Codex should animate copy while keeping one clear reading target at a time.
---

# Motion Typography

Design attention, not decoration. Make every visible word earn its place.

## Non-negotiable rules

1. Show one dominant reading target at a time. A target may be one word, one line, or one short sentence; it does not have to be a single word.
2. Apply the removal test: if deleting text does not change the message or required action, delete it.
3. Do not add eyebrow copy, badges, version labels, footers, taglines, or decorative microcopy unless the brief explicitly needs them.
4. For a five-second piece, prefer one short sentence or 2–4 sequential beats. Keep roughly 2–10 total words and never show a paragraph or website-like hierarchy.
5. Use no more than two font families and two expressive styles. Prefer a roman display face plus its italic or a restrained companion italic.
6. Preserve natural letterforms. Do not stretch type, fake an italic with skew, or use a script face for long copy.
7. Keep strong contrast, safe margins, and a hold long enough to read without pausing.

## Workflow

1. Reduce the brief to one core statement. Write the smallest copy that preserves the meaning.
2. Choose a reveal model: whole phrase, sequential lines, or typewriter. Let a new target replace the previous target instead of accumulating unrelated copy.
3. Choose one typographic contrast: roman/italic, large/small, or serif/sans. Do not combine all three without a clear reason.
4. Copy `assets/starter/` for sequential beats or `assets/typewriter-starter/` for a progressive sentence reveal. Keep `window.renderFrame(frame, fps)` deterministic.
5. Animate with masks, position, scale, tracking, opacity, or a paced typewriter reveal. Use at most two motion ideas in a five-second piece.
6. Render the midpoint of every reading beat. At thumbnail size, identify the intended word within 200 ms. If two elements compete, remove or delay one.
7. Render the full video and watch once without pausing. Revise any beat that cannot be read comfortably.

## Timing for short pieces

- Enter over 250–400 ms.
- Hold a single word for at least 650 ms.
- Hold a 4–7 word phrase for at least 1.8 seconds.
- Type at 35–90 ms per character, then hold the completed sentence for at least 1.2 seconds.
- Exit over 180–300 ms.
- Allow only a brief transition overlap; do not leave old copy behind as visual furniture.

For typewriter motion, reveal one meaningful sentence in place, reserve the final layout before typing so the composition does not jump, and remove or stop the caret after completion. Read [references/typewriter-pattern.md](references/typewriter-pattern.md) before implementing the effect.

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
