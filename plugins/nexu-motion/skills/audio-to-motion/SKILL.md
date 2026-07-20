---
name: audio-to-motion
description: Turn spoken audio, voiceovers, interviews, podcasts, and rough ad recordings into tightly edited motion-caption videos. Use when Codex must transcribe audio locally, remove coughs, throat clears, retakes, repeated phrases, filler, dead air, or long gaps, rebuild caption timestamps after cuts, clean and normalize sound, design synchronized motion graphics, and export a finished captioned video without an external AI API key.
---

# Audio to Motion

Edit the story before designing the video. Every cut changes time; regenerate captions from the edited timeline rather than reusing source timestamps.

## Workflow

1. Preserve the source audio. Work on a copy.
2. Run `scripts/analyze_audio.py` to create technical metadata, silence intervals, a waveform, a spectrogram, and trim suggestions.
3. Run `scripts/transcribe_local.py` for word-timestamped local transcription. Do not upload the audio or call an external transcription API.
4. Rerun audio analysis with `--transcript transcript.json`. Review non-speech active-audio candidates; these often contain coughs, throat clears, handling noise, or breaths but may also contain music or intentional sound design.
5. Read the transcript and create `edl.json` following [references/edit-decision-format.md](references/edit-decision-format.md). Mark only verified removals and explicitly correct currencies, names, locations, numbers, and unclear proper nouns.
6. Apply the EDL with `scripts/apply_edl.py`. This creates edited audio, corrected SRT captions, and `caption-data.json` containing word timing for motion.
7. Listen to or inspect every cut boundary. Keep natural micro-pauses. Remove repeated takes and obvious noise; shorten long pauses instead of collapsing all silence.
8. Design the motion page from the edited transcript. Use `caption-data.json` as the single timing source. Follow the installed `$nexu-motion` workflow when available.
9. Preview frames at every cut and caption change. Confirm that spoken words, highlighted captions, and visual beats align.
10. Render the video, combine it with the edited audio, and verify duration, audio stream, caption timing, and black frames.

## Commands

```bash
python3 scripts/analyze_audio.py \
  --input /absolute/path/source.mp3 \
  --output-dir /absolute/path/analysis

python3 scripts/transcribe_local.py \
  --input /absolute/path/source.mp3 \
  --output-dir /absolute/path/transcript

python3 scripts/analyze_audio.py \
  --input /absolute/path/source.mp3 \
  --transcript /absolute/path/transcript/transcript.json \
  --output-dir /absolute/path/analysis

python3 scripts/apply_edl.py \
  --input /absolute/path/source.mp3 \
  --edl /absolute/path/edl.json \
  --transcript /absolute/path/transcript/transcript.json \
  --output-audio /absolute/path/audio-edited.wav \
  --output-srt /absolute/path/captions.srt \
  --output-caption-data /absolute/path/caption-data.json
```

## Editing rules

- Remove a cough, throat clear, click, or handling noise only after verifying it does not overlap a wanted word.
- For repeated lines, retain the clearest complete take and remove the false start plus enough surrounding pause to make a natural join.
- Shorten dead gaps to roughly 120–300 ms for energetic ads; retain longer pauses when they carry meaning.
- Remove filler words only when the surrounding phonetics allow a clean edit.
- Use short boundary fades to avoid clicks.
- Apply light high-pass filtering and loudness normalization after structural edits. Avoid aggressive denoising that produces metallic speech.
- Never fabricate uncertain words. Mark unclear transcription for review or use broader on-screen copy.
- Correct transcription mistakes before caption generation. Time-scoped `transcriptCorrections` prevent an uncertain global replacement from changing the wrong phrase.
- Keep captions to one or two lines, usually 2–7 words per card. Highlight the currently spoken word from corrected timestamps.

Deliver the finished video, edited audio, corrected captions, EDL, and editable motion project.
