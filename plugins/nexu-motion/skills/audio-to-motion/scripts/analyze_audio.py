#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
from pathlib import Path


def run(command):
    return subprocess.run(command, check=True, text=True, capture_output=True)


def probe_audio(input_path):
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,bit_rate:stream=codec_name,sample_rate,channels",
        "-of", "json", str(input_path),
    ])
    return json.loads(result.stdout)


def detect_silence(input_path, noise_db, minimum_duration):
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(input_path),
        "-af", f"silencedetect=noise={noise_db}dB:d={minimum_duration}",
        "-f", "null", "-",
    ], text=True, capture_output=True)
    starts = [float(value) for value in re.findall(r"silence_start:\s*([0-9.]+)", result.stderr)]
    ends = [
        (float(end), float(duration))
        for end, duration in re.findall(
            r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)",
            result.stderr,
        )
    ]
    intervals = []
    for index, (end, duration) in enumerate(ends):
        start = starts[index] if index < len(starts) else max(0.0, end - duration)
        intervals.append({"start": round(start, 4), "end": round(end, 4), "duration": round(duration, 4)})
    return intervals


def detect_volume(input_path):
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(input_path),
        "-af", "volumedetect", "-f", "null", "-",
    ], text=True, capture_output=True)
    mean = re.search(r"mean_volume:\s*([-0-9.]+) dB", result.stderr)
    peak = re.search(r"max_volume:\s*([-0-9.]+) dB", result.stderr)
    return {
        "meanDb": float(mean.group(1)) if mean else None,
        "peakDb": float(peak.group(1)) if peak else None,
    }


def render_diagnostics(input_path, output_dir):
    waveform = output_dir / "waveform.png"
    spectrogram = output_dir / "spectrogram.png"
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(input_path),
        "-filter_complex", "aformat=channel_layouts=mono,showwavespic=s=1800x420:colors=0xC7FF16",
        "-frames:v", "1", str(waveform),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(input_path),
        "-lavfi", "showspectrumpic=s=1800x720:legend=1:color=viridis",
        "-frames:v", "1", str(spectrogram),
    ], check=True)
    return {"waveform": str(waveform), "spectrogram": str(spectrogram)}


def transcript_words(transcript_path):
    data = json.loads(Path(transcript_path).read_text())
    words = []
    for segment in data.get("segments", []):
        if segment.get("words"):
            for word in segment["words"]:
                words.append({
                    "start": float(word["start"]),
                    "end": float(word["end"]),
                    "text": str(word.get("word", word.get("text", ""))).strip(),
                })
        elif segment.get("text"):
            words.append({
                "start": float(segment["start"]),
                "end": float(segment["end"]),
                "text": str(segment["text"]).strip(),
            })
    return sorted(words, key=lambda word: word["start"])


def overlap_duration(start, end, intervals):
    return sum(max(0.0, min(end, item["end"]) - max(start, item["start"])) for item in intervals)


def find_untranscribed_candidates(words, silences, duration):
    if not words:
        return []
    boundaries = [{"end": 0.0}] + words
    following = words + [{"start": duration}]
    candidates = []
    for previous, next_word in zip(boundaries, following):
        start = float(previous["end"])
        end = float(next_word["start"])
        gap = end - start
        if gap < 0.28:
            continue
        silent = overlap_duration(start, end, silences)
        active = gap - silent
        if active >= 0.18 and active / gap >= 0.32:
            candidates.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "duration": round(gap, 3),
                "activeAudioSeconds": round(active, 3),
                "reason": "Untranscribed active audio; inspect for cough, breath, music, or handling noise",
            })
    return candidates


def main():
    parser = argparse.ArgumentParser(description="Analyze source audio before editorial cuts.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--transcript")
    parser.add_argument("--noise-db", type=float, default=-35.0)
    parser.add_argument("--minimum-silence", type=float, default=0.25)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    probe = probe_audio(input_path)
    duration = float(probe["format"]["duration"])
    silences = detect_silence(input_path, args.noise_db, args.minimum_silence)
    suggestions = []
    if silences and silences[0]["start"] <= 0.02 and silences[0]["duration"] >= 0.35:
        suggestions.append({"start": 0.0, "end": silences[0]["end"], "reason": "leading silence candidate"})
    if silences and duration - silences[-1]["end"] <= 0.03 and silences[-1]["duration"] >= 0.5:
        suggestions.append({"start": silences[-1]["start"], "end": duration, "reason": "trailing silence candidate"})
    words = transcript_words(args.transcript) if args.transcript else []
    analysis = {
        "source": str(input_path),
        "duration": duration,
        "probe": probe,
        "volume": detect_volume(input_path),
        "silenceThresholdDb": args.noise_db,
        "silences": silences,
        "suggestedOuterTrims": suggestions,
        "untranscribedActiveAudioCandidates": find_untranscribed_candidates(words, silences, duration),
        "diagnostics": render_diagnostics(input_path, output_dir),
    }
    output_path = output_dir / "analysis.json"
    output_path.write_text(json.dumps(analysis, indent=2) + "\n")
    print(json.dumps({
        "analysis": str(output_path),
        "duration": duration,
        "silences": len(silences),
        "reviewCandidates": len(analysis["untranscribedActiveAudioCandidates"]),
    }, indent=2))


if __name__ == "__main__":
    main()
