"""単語の発音音声を作る(Kokoro-82M, Apache-2.0)。

使い方は scripts/tts/README.md を参照。
data/words/*.json の英単語ごとに public/audio/<ファイル名>.mp3 を作る。既にあるファイルは作り直さない。
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
BANDS = ["600", "730", "860", "990"]


def audio_name(word: str) -> str:
    """アプリ側(lib/fx/audio.ts の audioFileName)と同じ規則でファイル名を決める"""
    return re.sub(r"[^a-z0-9]+", "-", word.lower().replace("é", "e")).strip("-")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", required=True, help="kokoro-v1.0.int8.onnx と voices-v1.0.bin のあるフォルダ")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--force", action="store_true", help="既にある音声も作り直す")
    args = parser.parse_args()

    models = Path(args.models)
    kokoro = Kokoro(str(models / "kokoro-v1.0.int8.onnx"), str(models / "voices-v1.0.bin"))
    out_dir = ROOT / "public" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)

    words = sorted({w["word"] for band in BANDS for w in json.loads((ROOT / "data" / "words" / f"{band}.json").read_text())})
    made = 0
    for word in words:
        target = out_dir / f"{audio_name(word)}.mp3"
        if target.exists() and not args.force:
            continue
        samples, rate = kokoro.create(word, voice=args.voice, speed=0.9, lang="en-us")
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, samples, rate)
            # 前後の無音を切り、音量をそろえ、24kbps のモノラル mp3 にする
            subprocess.run(
                [
                    "ffmpeg", "-loglevel", "error", "-y", "-i", wav.name,
                    "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5",
                    "-ac", "1", "-ar", "24000", "-b:a", "24k", str(target),
                ],
                check=True,
            )
        made += 1
        print(f"{made}: {word}", file=sys.stderr)
    print(f"作った音声: {made} / 単語: {len(words)}")


if __name__ == "__main__":
    main()
