import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appStorage } from "@/lib/storage";
import type { LevelBonus } from "@/lib/economy/levelBonus";
import { applyAnswer, type SenseProgress } from "@/lib/srs";

export type AnswerLog = { senseId: string; correct: boolean };

export type SessionResult = {
  /** レベルのボーナス込みのスコア(ハイスコア・ミッション・実績・イベントにはこれを使う) */
  score: number;
  /** ボーナス前のスコア(古い記録には無い) */
  baseScore?: number;
  /** そのゲームを始めたときのレベルによるボーナス(古い記録には無い) */
  levelBonus?: LevelBonus;
  maxCombo: number;
  correct: number;
  wrong: number;
  feverCount: number;
  /** 新しく紹介した単語の数 */
  newWords: number;
  answers: AnswerLog[];
  finishedAt: number;
  /** finishSession が記録更新かどうかを判定して入れる */
  newRecord?: boolean;
};

type ProgressStore = {
  progress: Record<string, SenseProgress>;
  sessions: number;
  bestScore: number;
  bestCombo: number;
  lastResult: SessionResult | null;
  recordAnswer: (senseId: string, correct: boolean) => void;
  finishSession: (result: SessionResult) => void;
};

export const useProgress = create<ProgressStore>()(
  persist(
    (set) => ({
      progress: {},
      sessions: 0,
      bestScore: 0,
      bestCombo: 0,
      lastResult: null,
      recordAnswer: (senseId, correct) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [senseId]: applyAnswer(s.progress[senseId], correct, Date.now()),
          },
        })),
      finishSession: (result) =>
        set((s) => ({
          sessions: s.sessions + 1,
          bestScore: Math.max(s.bestScore, result.score),
          bestCombo: Math.max(s.bestCombo, result.maxCombo),
          lastResult: { ...result, newRecord: result.score > s.bestScore },
        })),
    }),
    { name: "dopatan-progress", storage: appStorage, skipHydration: true },
  ),
);
