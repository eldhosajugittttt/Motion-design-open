# Grunge poster motion

## Layer stack

1. Generated warm paper or scanned texture.
2. Code-native toner specks or subtle grain.
3. Generated posterized subject cutout.
4. Code-native halftone fields and accent scraps.
5. Real HTML typography, marker highlights, and caret.
6. Code-native paper-rip transition and exposure flash.

Do not ask imagegen to bake the complete poster, text, and highlights into one flattened frame. Separate layers make the result editable and animatable.

## Subject prompt pattern

```text
Use case: stylized-concept
Asset type: isolated hero cutout for motion graphics
Primary request: <one complete subject>
Style/medium: high-contrast black-and-white photocopy, posterized screen print, coarse halftone, rough collage edges, imperfect ink registration, one warm accent color
Composition/framing: complete centered subject with generous padding
Scene/backdrop: perfectly flat chroma-key background
Text: none
Constraints: no cast shadow, no logo, no watermark, no background scene
```

Use reference frames only for visual language. State explicitly that their subject, text, and composition must not be copied.

## Type and highlight

- Use one title during the hero beat and one short statement during the message beat.
- Type short sentences at 35–90 ms per character.
- Reserve the completed line width before typing so proportional type does not jump.
- Sweep the accent marker after the important clause finishes typing.
- Keep the marker behind the live text and use a rough polygon edge.
- Stop the caret after completion and hold the final statement for at least 1.2 seconds.

## 10–12 second structure

- Optional 0.0–1.2: paper-crush intro; fold four asymmetric paper regions into an irregular layered core, add crease shadows, then burst outward with small scraps and a brief exposure flash. Shift later beats by the intro duration.
- 0.0–0.3: paper exposure and toner flicker.
- 0.3–1.2: generated cutout reveals with mask and registration offset.
- 0.8–2.7: concise title and accent underline hold.
- 2.6–3.4: paper-rip transition.
- 3.5–5.5: first clause types.
- 5.3–5.9: first marker swipe.
- 6.0–8.5: second clause types.
- 8.4–9.1: second marker swipe.
- 9.1–11.4: clean final hold.
- 11.4–12.0: paper fade.

## Paper-crush transition

- Reuse the same generated paper texture on every fold so the surface remains coherent.
- Use asymmetric polygon masks and slightly different rotation values; symmetric quadrants read as origami.
- Layer two or three irregular paper masses over the compressed center and add opposing light/dark crease gradients.
- Keep compression around 650 ms and release around 400 ms.
- Add dry brown-noise crunch during compression and a short high-frequency paper burst on release.
- Remove the intro overlay completely after the flash so it cannot interfere with the main composition.

## Review

- Composite cutouts over the actual paper color; transparent previews can hide black or white edge problems.
- Inspect a partial typewriter frame and the completed phrase.
- Reject chroma fringe, baked-in gibberish, logos, unreadable microtext, or competing decorations.
- Use original sound design: paper scrapes, dry clicks, subtle tape hiss, or marker swipes.
