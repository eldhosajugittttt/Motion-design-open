---
name: imagegen-to-motion
description: Generate original raster artwork with the built-in imagegen skill and animate it into polished local videos with Nexu Motion. Use for image-led ads, grunge poster animation, collage motion, posterized or halftone styles, generated product or character layers, style-reference videos, image-to-video experiments, and workflows that need AI-created visual assets without a separate external API key.
---

# Imagegen to Motion

Use image generation for artwork and local deterministic code for motion. Never treat a static generated image as the finished video.

## Workflow

1. Inspect the reference as key frames. Record its visual grammar: palette, texture, composition, subject treatment, motion rhythm, and typography behavior. Create an original concept instead of copying its subjects, wording, or audio.
2. Plan 2–4 independent raster layers. Typical layers are a background texture, a foreground cutout, and one optional supporting texture. Keep typography, highlights, masks, and simple geometry code-native.
3. Use the built-in `imagegen` skill by default. It needs no separate API key. Label every input image as a style reference, edit target, or supporting input.
4. Issue one imagegen call per distinct asset. Prompt generated motion assets without baked-in text, logos, watermarks, or UI decoration.
5. For a simple opaque cutout, generate on a perfectly flat chroma background and remove it with the installed imagegen helper. Composite the result over the intended background and inspect the edges before animation.
6. Copy every selected generated image into the project. Do not reference files only from the generated-images cache.
7. Build a deterministic HTML/CSS/JS timeline with the sibling Nexu Motion recorder. Derive all state from `window.renderFrame(frame, fps)`.
8. Use the sibling Motion Typography rules for copy. Show one reading target at a time; a target may be a word, line, or short sentence.
9. Render stills for the entrance, transition, partial text reveal, completed highlight, and final hold. Inspect texture, alpha edges, hierarchy, cropping, and readability.
10. Render the MP4 locally, combine original or user-provided audio, and return the video, poster, editable project, generated assets, and final prompt set.

## Chroma cutout

Use the built-in imagegen path and prompt a flat key color absent from the subject. Then run:

```bash
python3 /absolute/path/to/imagegen/scripts/remove_chroma_key.py \
  --input subject-key.png \
  --out subject-cutout.png \
  --auto-key border --soft-matte \
  --transparent-threshold 12 --opaque-threshold 220 --despill
```

Validate transparent corners, plausible subject coverage, and a composite over the real background. Ask before using the API-key-dependent CLI fallback for true native transparency.

## Grunge poster recipe

Read [references/grunge-poster-motion.md](references/grunge-poster-motion.md) for posterized asset prompts, layer order, marker highlights, typewriter pacing, and a reusable 10–12 second beat structure. Copy `assets/grunge-starter/` when that visual language matches the brief.

## Quality bar

- Use imagegen for meaningful raster artwork, not shapes that CSS can draw more reliably.
- Keep generated text out of artwork; animate real HTML text instead.
- Limit the poster palette to paper, ink, and one accent unless the brief requires more.
- Give generated assets motion through masks, parallax, scale, crop, registration offsets, or controlled jitter.
- Preserve one clear subject and one clear reading target.
- Do not reuse reference footage or audio in the final output.
