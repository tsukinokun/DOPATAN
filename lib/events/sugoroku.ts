import { hashString, seededRng } from "@/lib/random";
import type { EventRules, Milestone } from "./types";

export const BOARD = 120;
/** 止まると3マス進めるマス */
export const FORWARD_SQUARES: readonly number[] = [7, 19, 33, 46, 58, 73, 86, 97, 108];
export const FORWARD_STEPS = 3;

const MILESTONES: Milestone[] = [
  { id: "sq10", label: "10マス", reward: { coins: 300 } },
  { id: "sq20", label: "20マス", reward: { tickets: { N: 1 } } },
  { id: "sq30", label: "30マス", reward: { gems: 20 } },
  { id: "sq40", label: "40マス", reward: { xp: 100 } },
  { id: "sq50", label: "50マス", reward: { tickets: { R: 1 } } },
  { id: "sq60", label: "60マス", reward: { tickets: { ANY: 1 } } },
  { id: "sq70", label: "70マス", reward: { coins: 500 } },
  { id: "sq80", label: "80マス", reward: { gems: 30 } },
  { id: "sq90", label: "90マス", reward: { tickets: { SR: 1 } } },
  { id: "sq100", label: "100マス", reward: { xp: 200 } },
  { id: "sq110", label: "110マス", reward: { gems: 30 } },
  { id: "goal", label: "ゴール", reward: { skin: "ev-sugoroku", gems: 100, tickets: { SR: 1 } }, final: true },
];

/** その報酬が届くマス */
export const milestoneSquare = (id: string) => (id === "goal" ? BOARD : Number(id.slice(2)));

export type SugorokuState = { position: number };
export type SugorokuStep = {
  dice: number[];
  from: number;
  /** 止まったマス(サイコロの分) */
  landed: number;
  /** 進むマスで進んだ後のマス */
  to: number;
};

/** サイコロの数:基本1個、正解30問以上で+1個、フィーバー2回以上で+1個 */
export function diceCount(correct: number, fevers: number): number {
  return 1 + (correct >= 30 ? 1 : 0) + (fevers >= 2 ? 1 : 0);
}

export const sugoroku: EventRules<SugorokuState, SugorokuStep> = {
  id: "sugoroku",
  name: "すごろく",
  emoji: "🎲",
  color: "from-emerald-400 to-sky-400",
  tagline: "サイコロを振ってゴールを目指せ!",
  rules: [
    "1回遊ぶごとにサイコロを1個振って進みます",
    "1回で正解30問以上ならサイコロ+1個、フィーバー2回以上でさらに+1個",
    `⏩ のマスに止まると${FORWARD_STEPS}マス進みます`,
    "10マスごとに報酬。ゴールで限定スキン!",
  ],
  limitedSkin: "ev-sugoroku",
  milestones: () => MILESTONES,
  initial: () => ({ position: 0 }),
  apply: (state, play) => {
    const rng = seededRng(hashString(play.id));
    const dice = Array.from({ length: diceCount(play.stats.correct, play.stats.fevers) }, () => 1 + Math.floor(rng() * 6));
    const from = state.position;
    const landed = Math.min(BOARD, from + dice.reduce((a, b) => a + b, 0));
    const to = FORWARD_SQUARES.includes(landed) ? Math.min(BOARD, landed + FORWARD_STEPS) : landed;
    return { state: { position: to }, detail: { dice, from, landed, to } };
  },
  reached: (state) => MILESTONES.filter((m) => state.position >= milestoneSquare(m.id)).map((m) => m.id),
  progress: (state) => ({ value: state.position, max: BOARD, text: `${state.position} / ${BOARD} マス` }),
};
