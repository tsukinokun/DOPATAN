import { pickDistractors } from "./distractors";
import { shuffle, type Rng } from "./random";
import { choiceCountFor, isDue, type SenseProgress } from "./srs";
import type { QuestionMode, WordSense } from "./types";

export type Question = {
  /** 何問目か(React の key にも使う) */
  step: number;
  target: WordSense;
  /** 正解を含めてシャッフル済み */
  options: WordSense[];
  mode: QuestionMode;
  /** 新しい単語の紹介(カード1枚) */
  isIntro: boolean;
};

type Pending = { senseId: string; readyAt: number };

export type SessionOptions = {
  /** 全単語。ハズレ選択肢はここから選ぶ */
  allWords: readonly WordSense[];
  /** 出題範囲(スコア帯・テーマで絞ったもの) */
  scope: readonly WordSense[];
  progress: Readonly<Record<string, SenseProgress>>;
  modes: readonly QuestionMode[];
  now: number;
  rng: Rng;
  /** 同時に覚えている途中の単語数の上限 */
  maxLearning?: number;
};

/** 新しい単語は紹介→2枚→4枚の3回で一区切り */
const RAMP_EXPOSURES = 3;
/** 再出題までに挟む問題数 */
const REQUEUE_GAP = 2;

/**
 * 1回のプレイ(3分)の出題順を決める。
 * 間違えた単語と覚えている途中の単語は数問後に再出題し、その合間に復習と新しい単語を混ぜる。
 */
export class SessionEngine {
  private step = 0;
  private pending: Pending[] = [];
  private reviews: string[];
  private newWords: string[];
  private exposures = new Map<string, number>();
  private introducedWords = new Set<string>();
  private lastTargetId: string | undefined;
  private readonly byId: Map<string, WordSense>;
  private readonly opts: Required<SessionOptions>;

  constructor(options: SessionOptions) {
    this.opts = { maxLearning: 3, ...options };
    const { allWords, scope, progress, now, rng } = this.opts;
    this.byId = new Map(allWords.map((w) => [w.id, w]));
    for (const [id, p] of Object.entries(progress)) this.exposures.set(id, p.exposures);

    this.reviews = scope
      .filter((w) => isDue(progress[w.id], now))
      .sort((a, b) => progress[a.id].due - progress[b.id].due)
      .map((w) => w.id);
    // 簡単なスコア帯から順に、同じ帯の中はランダムに紹介する
    this.newWords = shuffle(
      scope.filter((w) => !progress[w.id] || progress[w.id].exposures === 0),
      rng,
    )
      .sort((a, b) => a.band - b.band)
      .map((w) => w.id);
  }

  next(): Question {
    const id = this.pickNextId();
    this.lastTargetId = id;
    return this.buildQuestion(this.byId.get(id)!);
  }

  answer(question: Question, correct: boolean): void {
    const id = question.target.id;
    const exposures = (this.exposures.get(id) ?? 0) + 1;
    this.exposures.set(id, exposures);
    this.step++;
    if (!correct || exposures < RAMP_EXPOSURES) {
      this.pending.push({ senseId: id, readyAt: this.step + REQUEUE_GAP });
    }
  }

  private pickNextId(): string {
    const ready = this.takePending((p) => p.readyAt <= this.step);
    if (ready) return ready;

    const canIntroduce = this.pending.length < this.opts.maxLearning && this.hasNewWord();
    if (canIntroduce && (this.reviews.length === 0 || this.step % 2 === 0)) {
      return this.takeNewWord()!;
    }
    const review = this.takeFrom(this.reviews);
    if (review) return review;

    // 待ち行列しか残っていなければ、待ち時間を無視して一番早いものを出す
    const waiting = this.takePending(() => true);
    if (waiting) return waiting;

    const fresh = this.takeNewWord();
    if (fresh) return fresh;

    return this.pickPractice();
  }

  /** 条件に合う待ち行列の中で一番早いもの。直前と同じ単語はなるべく避ける */
  private takePending(match: (p: Pending) => boolean): string | undefined {
    const candidates = this.pending
      .filter(match)
      .sort((a, b) => a.readyAt - b.readyAt);
    const chosen =
      candidates.find((p) => p.senseId !== this.lastTargetId) ??
      (this.pending.length === candidates.length ? candidates[0] : undefined);
    if (!chosen) return undefined;
    this.pending.splice(this.pending.indexOf(chosen), 1);
    return chosen.senseId;
  }

  private takeFrom(list: string[]): string | undefined {
    const index = list.findIndex((id) => id !== this.lastTargetId);
    if (index === -1) return list.shift();
    return list.splice(index, 1)[0];
  }

  /** 同じ英単語の別の意味は、同じセッション中に新しく紹介しない */
  private hasNewWord(): boolean {
    return this.newWords.some((id) => !this.introducedWords.has(this.byId.get(id)!.word));
  }

  private takeNewWord(): string | undefined {
    const index = this.newWords.findIndex(
      (id) => !this.introducedWords.has(this.byId.get(id)!.word),
    );
    if (index === -1) return undefined;
    const [id] = this.newWords.splice(index, 1);
    this.introducedWords.add(this.byId.get(id)!.word);
    return id;
  }

  /** 新しい単語も復習も尽きたら、学習済みの単語をランダムに練習する */
  private pickPractice(): string {
    const { scope, rng } = this.opts;
    const learned = scope.filter((w) => (this.exposures.get(w.id) ?? 0) > 0);
    const pool = (learned.length > 0 ? learned : scope).filter(
      (w) => w.id !== this.lastTargetId,
    );
    const list = pool.length > 0 ? pool : scope;
    return list[Math.floor(rng() * list.length)].id;
  }

  private buildQuestion(target: WordSense): Question {
    const { allWords, modes, rng } = this.opts;
    const exposures = this.exposures.get(target.id) ?? 0;
    const choiceCount = choiceCountFor(exposures);
    const isIntro = choiceCount === 1;
    const distractors = pickDistractors(target, allWords, choiceCount - 1, rng);
    const mode: QuestionMode =
      isIntro || modes.length === 0
        ? "wordToPicture"
        : modes[Math.floor(rng() * modes.length)];
    return {
      step: this.step,
      target,
      options: shuffle([target, ...distractors], rng),
      mode,
      isIntro,
    };
  }
}
