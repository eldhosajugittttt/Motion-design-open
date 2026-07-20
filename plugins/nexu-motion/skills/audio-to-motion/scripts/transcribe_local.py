#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def transcribe_mlx(input_path, model, language):
    import mlx_whisper
    return mlx_whisper.transcribe(
        str(input_path),
        path_or_hf_repo=model,
        language=language,
        word_timestamps=True,
        temperature=0,
        verbose=False,
    )


def transcribe_faster_whisper(input_path, model, language):
    from faster_whisper import WhisperModel
    whisper = WhisperModel(model, device="auto", compute_type="int8")
    segments, info = whisper.transcribe(str(input_path), language=language, word_timestamps=True)
    normalized = []
    full_text = []
    for index, segment in enumerate(segments):
        words = [{"start": word.start, "end": word.end, "word": word.word} for word in segment.words or []]
        normalized.append({
            "id": index,
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "words": words,
        })
        full_text.append(segment.text)
    return {"text": "".join(full_text), "segments": normalized, "language": info.language}


def srt_time(seconds):
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_segment_srt(result, output_path):
    blocks = []
    for index, segment in enumerate(result.get("segments", []), 1):
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        blocks.append(
            f"{index}\n{srt_time(float(segment['start']))} --> {srt_time(float(segment['end']))}\n{text}"
        )
    output_path.write_text("\n\n".join(blocks) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Run local word-timestamped transcription.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--engine", choices=["auto", "mlx", "faster-whisper"], default="auto")
    parser.add_argument("--model", default=None)
    parser.add_argument("--language", default=None)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    errors = []
    result = None
    engine = None
    if args.engine in ("auto", "mlx"):
        try:
            result = transcribe_mlx(
                input_path,
                args.model or "mlx-community/whisper-small-mlx",
                args.language,
            )
            engine = "mlx"
        except (ImportError, ModuleNotFoundError) as error:
            errors.append(f"mlx-whisper unavailable: {error}")
            if args.engine == "mlx":
                raise
    if result is None and args.engine in ("auto", "faster-whisper"):
        try:
            result = transcribe_faster_whisper(input_path, args.model or "small", args.language)
            engine = "faster-whisper"
        except (ImportError, ModuleNotFoundError) as error:
            errors.append(f"faster-whisper unavailable: {error}")
            if args.engine == "faster-whisper":
                raise
    if result is None:
        raise SystemExit(
            "No local transcription engine is installed. Install mlx-whisper on Apple Silicon "
            "or faster-whisper on other platforms. " + " | ".join(errors)
        )
    result["localEngine"] = engine
    json_path = output_dir / "transcript.json"
    srt_path = output_dir / "transcript.srt"
    json_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    write_segment_srt(result, srt_path)
    print(json.dumps({
        "engine": engine,
        "language": result.get("language"),
        "transcript": str(json_path),
        "srt": str(srt_path),
    }, indent=2))


if __name__ == "__main__":
    main()
