# 発音音声の作り方

[Kokoro-82M](https://github.com/hexgrad/kokoro)(Apache-2.0)の ONNX 版(`kokoro-onnx`)で、単語ごとの mp3 を `public/audio/` に作ります。
すでにあるファイルは作り直さないので、単語を増やしたら同じ手順をもう一度実行するだけです。

```bash
python3 -m venv .venv-tts
.venv-tts/bin/pip install kokoro-onnx soundfile

mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..

.venv-tts/bin/python scripts/tts/generate.py --models models
```

- 声は `af_heart`(米国英語)、速さ 0.9 です。`--voice` と `--force` で変えて作り直せます。
- ffmpeg で前後の無音を切り、音量をそろえて 24kbps のモノラル mp3 にします(1語あたり約4KB)。
- ファイル名の決め方は `lib/fx/audio.ts` の `audioFileName` と同じです。
