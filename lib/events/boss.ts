import type { PlayStats } from "@/lib/economy/ledger";
import type { EventRules, Milestone } from "./types";

export const BOSSES: readonly { name: string; emoji: string; hp: number }[] = [
  { name: "ケロッグ", emoji: "🐸", hp: 1000 },
  { name: "バットン", emoji: "🦇", hp: 1800 },
  { name: "タコゾー", emoji: "🐙", hp: 2600 },
  { name: "ドラゴン", emoji: "🐉", hp: 3200 },
  { name: "ゴーマ大王", emoji: "👹", hp: 4000 },
];

export const TOTAL_HP = BOSSES.reduce((sum, b) => sum + b.hp, 0);

/** 1回のプレイで与えるダメージ */
export function damageOf(s: PlayStats): number {
  return s.correct * 10 + s.maxCombo * 5 + s.fevers * 100;
}

/** それまでのダメージの合計から、今のボスと残り HP を出す。全部倒したら index = BOSSES.length */
export function bossAt(damage: number): { index: number; hpLeft: number; hp: number } {
  let left = damage;
  for (const [index, b] of BOSSES.entries()) {
    if (left < b.hp) return { index, hpLeft: b.hp - left, hp: b.hp };
    left -= b.hp;
  }
  return { index: BOSSES.length, hpLeft: 0, hp: BOSSES[BOSSES.length - 1].hp };
}

/** そのボスを倒すのに必要なダメージの合計(half なら半分削るまで) */
function threshold(index: number, half: boolean): number {
  const before = BOSSES.slice(0, index).reduce((sum, b) => sum + b.hp, 0);
  return before + (half ? BOSSES[index].hp / 2 : BOSSES[index].hp);
}

const REWARDS: [Milestone["reward"], Milestone["reward"]][] = [
  [{ coins: 300 }, { tickets: { N: 1 } }],
  [{ gems: 20 }, { tickets: { R: 1 } }],
  [{ xp: 150 }, { tickets: { ANY: 1 } }],
  [{ coins: 500 }, { tickets: { SR: 1 } }],
  [{ gems: 30 }, { skin: "ev-boss", gems: 100, tickets: { SR: 1 } }],
];

const MILESTONES: Milestone[] = BOSSES.flatMap((b, i) => [
  { id: `b${i + 1}half`, label: `${b.name}のHPを半分削る`, reward: REWARDS[i][0] },
  { id: `b${i + 1}down`, label: `${b.name}を倒す`, reward: REWARDS[i][1], final: i === BOSSES.length - 1 },
]);

export type BossState = { damage: number };
export type BossStep = { damage: number; from: number; to: number };

export const boss: EventRules<BossState, BossStep> = {
  id: "boss",
  name: "ボスバトル",
  emoji: "⚔️",
  color: "from-rose-500 to-violet-500",
  tagline: "正解でボスにダメージ!5体倒せ!",
  rules: [
    "ダメージ = 正解×10 + 最大コンボ×5 + フィーバー×100",
    "ボスの HP を半分削るごとと、倒すごとに報酬",
    "5体目のゴーマ大王を倒すと限定スキン!",
  ],
  limitedSkin: "ev-boss",
  milestones: () => MILESTONES,
  initial: () => ({ damage: 0 }),
  apply: (state, play) => {
    const damage = damageOf(play.stats);
    const to = Math.min(TOTAL_HP, state.damage + damage);
    return { state: { damage: to }, detail: { damage, from: state.damage, to } };
  },
  reached: (state) =>
    BOSSES.flatMap((_, i) => [
      ...(state.damage >= threshold(i, true) ? [`b${i + 1}half`] : []),
      ...(state.damage >= threshold(i, false) ? [`b${i + 1}down`] : []),
    ]),
  progress: (state) => {
    const { index } = bossAt(state.damage);
    return { value: state.damage, max: TOTAL_HP, text: `${Math.min(index, BOSSES.length)} / ${BOSSES.length} 体撃破` };
  },
};
