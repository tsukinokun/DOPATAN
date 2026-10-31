import type { PlayStats } from "@/lib/economy/ledger";
import { hashString, seededRng, shuffle } from "@/lib/random";
import { accuracy, type EventRules, type Milestone } from "./types";

export const SIZE = 4;
export const CELLS = SIZE * SIZE;

type Totals = { plays: number; correct: number; fevers: number; score: number };

/**
 * ビンゴのお題。遊び続ければ誰でも必ず達成できるもの(回数・正解・コンボ・フィーバー・スコア・正解率)だけを使う。
 * 新しい単語・マスター・出題形式・スコア帯/テーマは、設定や学習の進み具合で達成できなくなることがあるので使わない。
 */
export type BingoMission = {
  id: string;
  label: string;
  /** そのプレイ1回で達成するお題 */
  single?: (s: PlayStats) => boolean;
  /** 今週の累計で達成するお題 */
  total?: (t: Totals) => boolean;
};

/** 使ってよい成績の項目(テストで、詰むお題が混ざっていないかを確かめる) */
export const ALLOWED_STATS = ["plays", "correct", "wrong", "maxCombo", "fevers", "score"] as const;

export const SINGLE_MISSIONS: readonly BingoMission[] = [
  { id: "combo15", label: "1回で15コンボ", single: (s) => s.maxCombo >= 15 },
  { id: "combo25", label: "1回で25コンボ", single: (s) => s.maxCombo >= 25 },
  { id: "combo35", label: "1回で35コンボ", single: (s) => s.maxCombo >= 35 },
  { id: "acc90", label: "正解率90%以上", single: (s) => accuracy(s) >= 90 },
  { id: "acc95", label: "正解率95%以上", single: (s) => accuracy(s) >= 95 },
  { id: "fever1", label: "フィーバーを出す", single: (s) => s.fevers >= 1 },
  { id: "fever2", label: "1回でフィーバー2回", single: (s) => s.fevers >= 2 },
  { id: "fever3", label: "1回でフィーバー3回", single: (s) => s.fevers >= 3 },
  { id: "score6k", label: "スコア6,000以上", single: (s) => s.score >= 6000 },
  { id: "score10k", label: "スコア10,000以上", single: (s) => s.score >= 10000 },
  { id: "score15k", label: "スコア15,000以上", single: (s) => s.score >= 15000 },
  { id: "correct25", label: "1回で25問正解", single: (s) => s.correct >= 25 },
  { id: "correct30", label: "1回で30問正解", single: (s) => s.correct >= 30 },
];

/** 毎週必ず入れるお題(これがあるので、少ない回数では完走できない) */
export const ANCHOR_MISSION: BingoMission = { id: "plays30", label: "30回遊ぶ", total: (t) => t.plays >= 30 };

export const TOTAL_MISSIONS: readonly BingoMission[] = [
  { id: "plays5", label: "5回遊ぶ", total: (t) => t.plays >= 5 },
  { id: "plays10", label: "10回遊ぶ", total: (t) => t.plays >= 10 },
  { id: "plays20", label: "20回遊ぶ", total: (t) => t.plays >= 20 },
  { id: "tcorrect200", label: "累計200問正解", total: (t) => t.correct >= 200 },
  { id: "tcorrect400", label: "累計400問正解", total: (t) => t.correct >= 400 },
  { id: "tcorrect600", label: "累計600問正解", total: (t) => t.correct >= 600 },
  { id: "tfever5", label: "累計フィーバー5回", total: (t) => t.fevers >= 5 },
  { id: "tfever15", label: "累計フィーバー15回", total: (t) => t.fevers >= 15 },
  { id: "tscore100k", label: "累計スコア10万", total: (t) => t.score >= 100_000 },
  { id: "tscore200k", label: "累計スコア20万", total: (t) => t.score >= 200_000 },
];

const ALL = new Map([...SINGLE_MISSIONS, ...TOTAL_MISSIONS, ANCHOR_MISSION].map((m) => [m.id, m]));

/** その週のカード(16マス)。週から決まるので全員同じ。1回のお題8個+累計のお題8個(「30回遊ぶ」は必ず入る) */
export function cardFor(week: string): BingoMission[] {
  const rng = seededRng(hashString(`bingo:${week}`));
  const singles = shuffle(SINGLE_MISSIONS, rng).slice(0, 8);
  const totals = [ANCHOR_MISSION, ...shuffle(TOTAL_MISSIONS, rng).slice(0, 7)];
  return shuffle([...singles, ...totals], rng);
}

export const missionById = (id: string) => ALL.get(id);

/** 縦・横・斜めの10列(マスの番号) */
export const LINES: readonly number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
];

export const completedLines = (opened: readonly boolean[]) =>
  LINES.map((line, i) => (line.every((c) => opened[c]) ? i : -1)).filter((i) => i >= 0);

const LINE_REWARDS: Milestone["reward"][] = [
  { coins: 300 },
  { tickets: { N: 1 } },
  { gems: 20 },
  { xp: 150 },
  { tickets: { R: 1 } },
  { coins: 500 },
  { tickets: { ANY: 1 } },
  { gems: 30 },
  { tickets: { SR: 1 } },
];

const MILESTONES: Milestone[] = [
  ...LINE_REWARDS.map((reward, i) => ({ id: `lines${i + 1}`, label: `${i + 1}列そろう`, reward })),
  { id: "full", label: "全部のマスを開ける", reward: { skin: "ev-bingo", gems: 100, tickets: { SR: 1 } }, final: true },
];

export type BingoState = { opened: boolean[]; totals: Totals };
export type BingoStep = { newlyOpened: number[]; newLines: number[]; linesBefore: number };

export const bingo: EventRules<BingoState, BingoStep> = {
  id: "bingo",
  name: "ビンゴ",
  emoji: "🎱",
  color: "from-fuchsia-400 to-amber-300",
  tagline: "お題をクリアして穴を開けよう!",
  rules: [
    "マスのお題を達成すると穴が開きます(1回で達成するお題と、今週の累計のお題があります)",
    "縦・横・斜めが1列そろうごとに報酬",
    "16マス全部開けると限定スキン!",
  ],
  limitedSkin: "ev-bingo",
  milestones: () => MILESTONES,
  initial: () => ({ opened: Array(CELLS).fill(false), totals: { plays: 0, correct: 0, fevers: 0, score: 0 } }),
  apply: (state, play, week) => {
    const card = cardFor(week);
    const totals: Totals = {
      plays: state.totals.plays + 1,
      correct: state.totals.correct + play.stats.correct,
      fevers: state.totals.fevers + play.stats.fevers,
      score: state.totals.score + play.stats.score,
    };
    const linesBefore = completedLines(state.opened);
    const opened = card.map((m, i) => state.opened[i] || Boolean(m.single?.(play.stats) || m.total?.(totals)));
    const newlyOpened = opened.map((o, i) => (o && !state.opened[i] ? i : -1)).filter((i) => i >= 0);
    const newLines = completedLines(opened).filter((l) => !linesBefore.includes(l));
    return { state: { opened, totals }, detail: { newlyOpened, newLines, linesBefore: linesBefore.length } };
  },
  reached: (state) => {
    const lines = completedLines(state.opened).length;
    return MILESTONES.filter((m) => (m.final ? state.opened.every(Boolean) : lines >= Number(m.id.slice(5)))).map((m) => m.id);
  },
  progress: (state) => {
    const open = state.opened.filter(Boolean).length;
    return { value: open, max: CELLS, text: `${open} / ${CELLS} マス・${completedLines(state.opened).length}列` };
  },
};
