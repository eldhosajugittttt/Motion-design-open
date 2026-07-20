# Nexu Motion

Nexu Motion is a reusable Codex audio-editing and motion-graphics toolkit. Codex can clean a rough voiceover, remove retakes and dead air, rebuild word-timed captions, build a website-like animated layout, and record it deterministically into a video. The plugin also includes MCP tools for structured scene editing.

It does **not** call an external AI service and does not require a separate AI API key.

## How it works

1. A user describes an ad, title sequence, social post, explainer, or animated graphic to Codex.
2. Codex creates a polished HTML/CSS layout and a frame-controlled JavaScript timeline.
3. Nexu Motion advances the page one exact frame at a time in local headless Chrome.
4. Nexu Motion captures the clean viewport and assembles an MP4 locally with FFmpeg.

This is more reliable than a normal real-time screen recording: no browser chrome, cursor, dropped frames, or timing drift.

## Fastest path: the skill

The standalone skill lives in `skills/nexu-motion/`. It contains:

- a concise production workflow for Codex;
- a responsive HTML/CSS/JavaScript starter;
- a deterministic page recorder;
- a timeline contract with reusable easing patterns.

The companion `skills/audio-to-motion/` workflow handles rough recordings before animation. It includes:

- silence, loudness, waveform, and spectrogram analysis;
- local word-timestamped transcription;
- auditable edit-decision lists for coughs, retakes, repeated lines, filler, and dead air;
- automatic caption timestamp remapping after every cut;
- verified transcript corrections for currencies, names, numbers, and locations.

The `skills/motion-typography/` workflow keeps short videos readable. It treats a word, line, or short sentence as one possible reading target, removes decorative filler copy, provides editorial font-pairing guidance, and includes both sequential-beat and deterministic typewriter starters.

The `skills/imagegen-to-motion/` workflow uses Codex's built-in image generation to create original raster layers, moves the selected assets into the project, and animates them locally. It includes a tested grunge-poster recipe with chroma cutouts, halftone, paper texture, typewriter copy, and marker highlights.

Ask Codex to use `$nexu-motion`, describe the video, and provide any brand or product assets. Codex creates the page, previews key frames, and exports the MP4.

For a text-led piece, ask Codex to use `$motion-typography` and provide only the essential phrase. A five-second composition defaults to 2–6 total words shown sequentially.

## Included MCP tools

- `create_project` — create an empty project with dimensions, duration, and frame rate.
- `set_composition` — replace the project's scenes with a complete editable composition.
- `get_project` — inspect the current scene graph.
- `list_projects` — list locally created projects.
- `preview_frame` — render a PNG at a chosen frame or time.
- `render_video` — render the full composition to MP4.

## Optional MCP scene model

Projects contain timed scenes. Scenes contain `text`, `shape`, and `image` elements. Every element can animate `x`, `y`, `scale`, `rotation`, `opacity`, and `blur` with linear, ease-in, ease-out, ease-in-out, back-out, and elastic-out easing.

All positions are pixel values on the project canvas. Element time values are frames relative to the beginning of their scene.

## Local requirements

- Node.js 20 or newer
- Google Chrome, Chromium, or Microsoft Edge
- FFmpeg for MP4 export

No npm packages are required for this first version.

## Try the renderer

Run `npm run demo`. The demo writes its project, a poster frame, and an MP4 into `work/demo/`.

## Codex plugin setup

The repository already contains a valid Codex plugin manifest and `.mcp.json`. Install it as a local plugin, start a new Codex task, then ask:

> Use Nexu Motion to create a six-second vertical launch ad for a futuristic running shoe. Use kinetic typography, electric lime accents, and a dramatic product reveal.

The bundled skill guides Codex through concept, scene construction, preview, revision, and export.
