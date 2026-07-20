# Edit decision format

Use a JSON file with version `1` and a `remove` array. Times refer to the original source audio in seconds.

```json
{
  "version": 1,
  "remove": [
    {
      "start": 0.0,
      "end": 0.72,
      "reason": "leading dead air"
    },
    {
      "start": 8.42,
      "end": 9.18,
      "reason": "cough between sentences"
    },
    {
      "start": 14.05,
      "end": 16.31,
      "reason": "false start; stronger repeated take follows"
    }
  ],
  "transcriptCorrections": [
    {
      "start": 20.0,
      "end": 20.5,
      "text": "₹299,"
    },
    {
      "start": 36.66,
      "end": 38.74,
      "text": "Now at select premium outlets."
    }
  ],
  "audio": {
    "highpassHz": 70,
    "targetLufs": -16,
    "truePeakDb": -1.5,
    "fadeMs": 12
  },
  "captions": {
    "maxWords": 7,
    "maxDuration": 2.8,
    "splitGap": 0.55
  }
}
```

## Rules

- Sort removal intervals by `start`.
- Do not overlap removal intervals.
- Do not remove wanted speech.
- To shorten a pause, remove only the middle of it and leave natural context on both sides.
- Give every removal a concise reason so another editor can audit the decision.
- Use `transcriptCorrections` for verified currency, brand, location, number, or phrase corrections. Match the original source time range; use an empty `text` value only to remove a confirmed transcription hallucination.
- The edited timeline is the complement of the removal intervals.

`apply_edl.py` maps every retained word from source time to edited time, drops words whose midpoint is removed, and generates both SRT and machine-readable caption data. Motion graphics must use those outputs, not the original transcript timestamps.
