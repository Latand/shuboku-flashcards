"""Checks that every clip says what the card says.

Listening to 314 clips by hand is how two rounds went wrong: a person gets
tired somewhere around clip forty. Speech recognition does not, and its
mistakes are uncorrelated with the generator's, so a mismatch is worth looking
at even when the recogniser is the one at fault.

Both sides are reduced to hiragana before comparing, because the recogniser
writes real words in kanji — 「やま」 comes back as 山, which is the right sound
spelled another way.

    uv run --with openai-whisper --with numpy --with pykakasi \\
        python scripts/verify-audio.py [--raw] [--fresh]

Prints a pass rate and every mismatch, ending with a line that feeds straight
into  bun run scripts/generate-audio.ts --only=...
"""

import json
import subprocess
import sys
from pathlib import Path

import pykakasi
import whisper

ROOT = Path(__file__).resolve().parent.parent
RAW = "--raw" in sys.argv
CLIPS = ROOT / (".audio-raw" if RAW else "audio")
CACHE = ROOT / ".audio-raw" / ("asr-raw.json" if RAW else "asr-clips.json")

STRIP = "、。，．・…ー「」!?！？ 　\n"
kks = pykakasi.kakasi()


def to_kana(text: str) -> str:
    """Everything the recogniser might write, reduced to bare hiragana."""
    hira = "".join(item["hira"] for item in kks.convert(text))
    return "".join(c for c in hira if c not in STRIP)


def readings() -> list[str]:
    out = subprocess.run(
        ["bun", "-e",
         'import { BUILTIN_DECKS } from "./src/data/packs";'
         'console.log(JSON.stringify([...new Set(BUILTIN_DECKS.flatMap(d => d.cards.map(c => c.speak)).filter(Boolean))]))'],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


def key(text: str) -> str:
    return "-".join(f"{ord(c):x}" for c in text)


cache: dict[str, str] = {}
if CACHE.exists() and "--fresh" not in sys.argv:
    cache = json.loads(CACHE.read_text())

model = None
wanted = readings()
matches, mismatches = [], []

for i, reading in enumerate(wanted, 1):
    path = CLIPS / f"{key(reading)}.mp3"
    if not path.exists():
        mismatches.append((reading, "<missing file>"))
        continue
    if reading not in cache:
        if model is None:
            model = whisper.load_model("large-v3-turbo")
        cache[reading] = model.transcribe(
            str(path), language="ja", temperature=0, fp16=False
        )["text"].strip()
        if i % 50 == 0:
            print(f"  {i}/{len(wanted)}", flush=True)
    heard = cache[reading]
    (matches if to_kana(heard) == to_kana(reading) else mismatches).append((reading, heard))

CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))

total = len(wanted)
print(f"\n{len(matches)}/{total} clips say what the card says ({100 * len(matches) / total:.0f}%)")
print(f"\n{len(mismatches)} mismatches:")
for reading, heard in mismatches:
    print(f"  {reading:<7} heard {heard[:40]!r}")
print("\n--only=" + ",".join(r for r, _ in mismatches))
