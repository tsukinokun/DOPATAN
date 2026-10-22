import { skinOf, type SoundLook } from "@/lib/skins";

/**
 * 効果音と BGM を Web Audio API で合成する(素材ファイル不要)。
 * 本番用の音源ができたら、ここを差し替える。
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master! };
}

/** ブラウザは操作の中でしか音を鳴らせないので、最初のタップで呼ぶ */
export function unlockAudio(): void {
  audio();
}

type ToneOptions = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
  slideTo?: number;
};

function tone({ freq, duration, type = "square", volume = 0.2, delay = 0, slideTo }: ToneOptions, out?: AudioNode) {
  const a = audio();
  if (!a) return;
  const start = a.ctx.currentTime + delay;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(out ?? a.out);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const semitone = (base: number, steps: number) => base * Math.pow(2, steps / 12);

let soundLook: SoundLook = skinOf("sound", undefined).look;

/** 装備中の効果音セット(SkinApplier が設定する) */
export function setSoundSkin(look: SoundLook): void {
  soundLook = look;
}

/** 効果音を装備中の効果音セットの音色で鳴らす */
function play(options: ToneOptions) {
  const { wave, pitch, original, layer, sparkle } = soundLook;
  const freq = options.freq * pitch;
  const slideTo = options.slideTo && options.slideTo * pitch;
  tone({ ...options, freq, slideTo, type: original ? options.type : wave });
  if (layer) tone({ ...options, freq: freq * 2, slideTo: slideTo && slideTo * 2, type: layer, volume: (options.volume ?? 0.2) * 0.35 });
  if (sparkle) tone({ ...options, freq: freq * 3, type: "sine", volume: (options.volume ?? 0.2) * 0.25, delay: (options.delay ?? 0) + 0.04 });
}

export const sfx = {
  /** コンボが続くほど音程が上がる */
  correct(combo: number) {
    const base = semitone(660, Math.min(combo, 24));
    play({ freq: base, duration: 0.12, type: "square", volume: 0.15 });
    play({ freq: base * 1.5, duration: 0.18, type: "triangle", volume: 0.2, delay: 0.07 });
  },
  wrong() {
    play({ freq: 220, duration: 0.3, type: "sawtooth", volume: 0.18, slideTo: 90 });
  },
  pickup() {
    play({ freq: 520, duration: 0.06, type: "sine", volume: 0.12, slideTo: 780 });
  },
  intro() {
    [0, 4, 7, 12].forEach((s, i) =>
      play({ freq: semitone(523, s), duration: 0.15, type: "triangle", volume: 0.18, delay: i * 0.06 }),
    );
  },
  comboMilestone() {
    [0, 4, 7, 12, 16].forEach((s, i) =>
      play({ freq: semitone(784, s), duration: 0.12, type: "square", volume: 0.12, delay: i * 0.05 }),
    );
  },
  fever() {
    for (let i = 0; i < 12; i++) {
      play({ freq: semitone(440, i * 2), duration: 0.1, type: "square", volume: 0.14, delay: i * 0.035 });
    }
    play({ freq: 1760, duration: 0.6, type: "sawtooth", volume: 0.1, delay: 0.42 });
  },
  countdown(final: boolean) {
    play({ freq: final ? 1320 : 660, duration: final ? 0.4 : 0.15, type: "square", volume: 0.18 });
  },
  timeUp() {
    [12, 7, 4, 0].forEach((s, i) =>
      play({ freq: semitone(523, s), duration: 0.22, type: "square", volume: 0.16, delay: i * 0.12 }),
    );
  },
  coin() {
    play({ freq: 988, duration: 0.08, type: "square", volume: 0.12 });
    play({ freq: 1319, duration: 0.25, type: "square", volume: 0.12, delay: 0.08 });
  },
};

/** 簡単なループ BGM。フィーバー中はテンポと音程を上げる */
export class Bgm {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stepIndex = 0;
  private fever = false;
  private gain: GainNode | null = null;

  private static readonly BASS = [0, 0, 7, 0, 5, 5, 3, 5];
  private static readonly LEAD = [12, 15, 19, 15, 17, 19, 22, 19];

  start() {
    const a = audio();
    if (!a || this.timer) return;
    this.gain = a.ctx.createGain();
    this.gain.gain.value = 0.35;
    this.gain.connect(a.out);
    this.schedule();
  }

  setFever(on: boolean) {
    if (this.fever === on) return;
    this.fever = on;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.schedule();
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.gain?.disconnect();
    this.gain = null;
  }

  private schedule() {
    const interval = this.fever ? 125 : 180;
    this.timer = setInterval(() => this.tick(), interval);
  }

  private tick() {
    if (!this.gain) return;
    const i = this.stepIndex++ % Bgm.BASS.length;
    const root = this.fever ? 220 : 165;
    tone({ freq: semitone(root / 2, Bgm.BASS[i]), duration: 0.16, type: "triangle", volume: 0.3 }, this.gain);
    if (this.fever || i % 2 === 0) {
      tone({ freq: semitone(root, Bgm.LEAD[i]), duration: 0.1, type: "square", volume: 0.08 }, this.gain);
    }
  }
}

/** scripts/tts/generate.py の audio_name と同じ規則 */
export function audioFileName(word: string): string {
  return word
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 読み込んだ発音(失敗したものは null を覚えておき、読み上げ機能に任せる) */
const voiceCache = new Map<string, Promise<AudioBuffer | null>>();

function loadVoice(word: string): Promise<AudioBuffer | null> {
  const a = audio();
  if (!a) return Promise.resolve(null);
  const name = audioFileName(word);
  let buffer = voiceCache.get(name);
  if (!buffer) {
    buffer = fetch(`/audio/${name}.mp3`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => a.ctx.decodeAudioData(data))
      .catch(() => null);
    voiceCache.set(name, buffer);
  }
  return buffer;
}

/** 次に出す単語の発音を先に読み込んでおく */
export function preloadVoice(word: string): void {
  void loadVoice(word);
}

function speakWithBrowser(word: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

let currentVoice: AudioBufferSourceNode | null = null;

/** 発音を再生する。音声ファイルが無い・読み込めないときはブラウザの読み上げを使う */
export function speak(word: string): void {
  void loadVoice(word).then((buffer) => {
    const a = audio();
    if (!buffer || !a) {
      speakWithBrowser(word);
      return;
    }
    currentVoice?.stop();
    const source = a.ctx.createBufferSource();
    source.buffer = buffer;
    // 効果音より聞き取りやすいよう、全体の音量(master)を通さずに鳴らす
    source.connect(a.ctx.destination);
    source.start();
    currentVoice = source;
  });
}
