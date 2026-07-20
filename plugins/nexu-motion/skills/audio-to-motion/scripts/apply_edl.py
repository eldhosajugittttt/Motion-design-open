#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


def media_duration(input_path):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(input_path),
    ], check=True, text=True, capture_output=True)
    return float(result.stdout.strip())


def normalize_removals(removals, duration):
    normalized = []
    for index, item in enumerate(removals):
        start = max(0.0, float(item["start"]))
        end = min(duration, float(item["end"]))
        if end <= start:
            raise ValueError(f"Removal {index} must have end greater than start")
        normalized.append({"start": start, "end": end, "reason": str(item.get("reason", ""))})
    normalized.sort(key=lambda item: item["start"])
    for previous, current in zip(normalized, normalized[1:]):
        if current["start"] < previous["end"] - 1e-6:
            raise ValueError("Removal intervals must not overlap")
    return normalized


def keep_intervals(removals, duration):
    keeps = []
    cursor = 0.0
    for item in removals:
        if item["start"] > cursor:
            keeps.append({"start": cursor, "end": item["start"]})
        cursor = item["end"]
    if cursor < duration:
        keeps.append({"start": cursor, "end": duration})
    return [item for item in keeps if item["end"] - item["start"] >= 0.02]


def removed_before(time_value, removals):
    removed = 0.0
    for item in removals:
        if time_value <= item["start"]:
            break
        removed += max(0.0, min(time_value, item["end"]) - item["start"])
    return removed


def map_time(time_value, removals):
    return max(0.0, time_value - removed_before(time_value, removals))


def point_is_removed(time_value, removals):
    return any(item["start"] <= time_value < item["end"] for item in removals)


def transcript_words(transcript):
    words = []
    for segment in transcript.get("segments", []):
        if segment.get("words"):
            for item in segment["words"]:
                text = str(item.get("word", item.get("text", ""))).strip()
                if text:
                    words.append({"start": float(item["start"]), "end": float(item["end"]), "text": text})
        else:
            text = str(segment.get("text", "")).strip()
            if text:
                words.append({"start": float(segment["start"]), "end": float(segment["end"]), "text": text})
    return sorted(words, key=lambda item: item["start"])


def apply_transcript_corrections(words, corrections):
    corrected = list(words)
    ordered = sorted(corrections, key=lambda item: float(item["start"]))
    for index, correction in enumerate(ordered):
        start = float(correction["start"])
        end = float(correction["end"])
        if end <= start:
            raise ValueError(f"Transcript correction {index} must have end greater than start")
        corrected = [
            word for word in corrected
            if not (start <= (word["start"] + word["end"]) / 2 < end)
        ]
        tokens = str(correction.get("text", "")).split()
        if tokens:
            step = (end - start) / len(tokens)
            corrected.extend({
                "start": start + token_index * step,
                "end": start + (token_index + 1) * step,
                "text": token,
            } for token_index, token in enumerate(tokens))
    return sorted(corrected, key=lambda item: item["start"])


def remap_words(words, removals):
    remapped = []
    for word in words:
        midpoint = (word["start"] + word["end"]) / 2
        if point_is_removed(midpoint, removals):
            continue
        start = map_time(word["start"], removals)
        end = map_time(word["end"], removals)
        if end <= start:
            continue
        remapped.append({"start": round(start, 4), "end": round(end, 4), "text": word["text"]})
    return remapped


def group_captions(words, max_words=7, max_duration=2.8, split_gap=0.55):
    captions = []
    current = []
    for word in words:
        if current:
            gap = word["start"] - current[-1]["end"]
            duration = word["end"] - current[0]["start"]
            if len(current) >= max_words or gap > split_gap or duration > max_duration:
                captions.append(make_caption(current))
                current = []
        current.append(word)
    if current:
        captions.append(make_caption(current))
    return captions


def make_caption(words):
    text = " ".join(word["text"] for word in words)
    return {
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": text,
        "words": words,
    }


def srt_time(seconds):
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_srt(captions, output_path):
    blocks = []
    for index, caption in enumerate(captions, 1):
        blocks.append(
            f"{index}\n{srt_time(caption['start'])} --> {srt_time(caption['end'])}\n{caption['text']}"
        )
    output_path.write_text("\n\n".join(blocks) + "\n")


def audio_codec(output_path):
    suffix = output_path.suffix.lower()
    if suffix == ".wav":
        return ["-c:a", "pcm_s16le"]
    if suffix == ".mp3":
        return ["-c:a", "libmp3lame", "-b:a", "192k"]
    return ["-c:a", "aac", "-b:a", "192k"]


def render_audio(input_path, output_path, keeps, audio_settings):
    if not keeps:
        raise ValueError("The EDL removes the entire source")
    fade = max(0.0, float(audio_settings.get("fadeMs", 12))) / 1000
    highpass = float(audio_settings.get("highpassHz", 70))
    target_lufs = float(audio_settings.get("targetLufs", -16))
    true_peak = float(audio_settings.get("truePeakDb", -1.5))
    filters = []
    labels = []
    for index, keep in enumerate(keeps):
        duration = keep["end"] - keep["start"]
        fade_duration = min(fade, duration / 4)
        fade_out_start = max(0.0, duration - fade_duration)
        label = f"a{index}"
        filters.append(
            f"[0:a]atrim=start={keep['start']:.6f}:end={keep['end']:.6f},"
            f"asetpts=PTS-STARTPTS,afade=t=in:st=0:d={fade_duration:.6f},"
            f"afade=t=out:st={fade_out_start:.6f}:d={fade_duration:.6f}[{label}]"
        )
        labels.append(f"[{label}]")
    if len(labels) == 1:
        combined = labels[0]
    else:
        filters.append(f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1[edited]")
        combined = "[edited]"
    filters.append(
        f"{combined}highpass=f={highpass:.2f},"
        f"loudnorm=I={target_lufs:.2f}:TP={true_peak:.2f}:LRA=11[outa]"
    )
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(input_path),
        "-filter_complex", ";".join(filters), "-map", "[outa]",
        *audio_codec(output_path), str(output_path),
    ]
    subprocess.run(command, check=True)


def main():
    parser = argparse.ArgumentParser(description="Apply audio cuts and rebuild caption timestamps.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--edl", required=True)
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--output-audio", required=True)
    parser.add_argument("--output-srt", required=True)
    parser.add_argument("--output-caption-data", required=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_audio = Path(args.output_audio).resolve()
    output_srt = Path(args.output_srt).resolve()
    output_caption_data = Path(args.output_caption_data).resolve()
    for parent in {output_audio.parent, output_srt.parent, output_caption_data.parent}:
        parent.mkdir(parents=True, exist_ok=True)

    edl = json.loads(Path(args.edl).read_text())
    if edl.get("version") != 1:
        raise ValueError("EDL version must be 1")
    duration = media_duration(input_path)
    removals = normalize_removals(edl.get("remove", []), duration)
    keeps = keep_intervals(removals, duration)
    render_audio(input_path, output_audio, keeps, edl.get("audio", {}))

    transcript = json.loads(Path(args.transcript).read_text())
    source_words = apply_transcript_corrections(
        transcript_words(transcript),
        edl.get("transcriptCorrections", []),
    )
    words = remap_words(source_words, removals)
    caption_settings = edl.get("captions", {})
    captions = group_captions(
        words,
        int(caption_settings.get("maxWords", 7)),
        float(caption_settings.get("maxDuration", 2.8)),
        float(caption_settings.get("splitGap", 0.55)),
    )
    write_srt(captions, output_srt)
    edited_duration = sum(item["end"] - item["start"] for item in keeps)
    caption_payload = {
        "version": 1,
        "sourceDuration": duration,
        "editedDuration": round(edited_duration, 6),
        "removals": removals,
        "captions": captions,
    }
    output_caption_data.write_text(json.dumps(caption_payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "outputAudio": str(output_audio),
        "outputSrt": str(output_srt),
        "outputCaptionData": str(output_caption_data),
        "sourceDuration": duration,
        "editedDuration": edited_duration,
        "removedSeconds": duration - edited_duration,
        "captionCards": len(captions),
    }, indent=2))


if __name__ == "__main__":
    main()
