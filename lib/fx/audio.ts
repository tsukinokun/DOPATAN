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

export const sfx = {
  /** コンボが続くほど音程が上がる */
  correct(combo: number) {
    const base = semitone(660, Math.min(combo, 24));
    tone({ freq: base, duration: 0.12, type: "square", volume: 0.15 });
    tone({ freq: base * 1.5, duration: 0.18, type: "triangle", volume: 0.2, delay: 0.07 });
  },
  wrong() {
    tone({ freq: 220, duration: 0.3, type: "sawtooth", volume: 0.18, slideTo: 90 });
  },
  pickup() {
    tone({ freq: 520, duration: 0.06, type: "sine", volume: 0.12, slideTo: 780 });
  },
  intro() {
    [0, 4, 7, 12].forEach((s, i) =>
      tone({ freq: semitone(523, s), duration: 0.15, type: "triangle", volume: 0.18, delay: i * 0.06 }),
    );
  },
  comboMilestone() {
    [0, 4, 7, 12, 16].forEach((s, i) =>
      tone({ freq: semitone(784, s), duration: 0.12, type: "square", volume: 0.12, delay: i * 0.05 }),
    );
  },
  fever() {
    for (let i = 0; i < 12; i++) {
      tone({ freq: semitone(440, i * 2), duration: 0.1, type: "square", volume: 0.14, delay: i * 0.035 });
    }
    tone({ freq: 1760, duration: 0.6, type: "sawtooth", volume: 0.1, delay: 0.42 });
  },
  countdown(final: boolean) {
    tone({ freq: final ? 1320 : 660, duration: final ? 0.4 : 0.15, type: "square", volume: 0.18 });
  },
  timeUp() {
    [12, 7, 4, 0].forEach((s, i) =>
      tone({ freq: semitone(523, s), duration: 0.22, type: "square", volume: 0.16, delay: i * 0.12 }),
    );
  },
  coin() {
    tone({ freq: 988, duration: 0.08, type: "square", volume: 0.12 });
    tone({ freq: 1319, duration: 0.25, type: "square", volume: 0.12, delay: 0.08 });
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

/** 発音。フェーズ5で音声合成した音声ファイルに差し替える */
export function speak(word: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
