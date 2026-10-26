import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appStorage } from "@/lib/storage";
import { QUESTION_MODES, type EffectIntensity, type QuestionMode, type ScoreBand, type Theme } from "@/lib/types";

export type Settings = {
  showJapanese: boolean;
  effectIntensity: EffectIntensity;
  sound: boolean;
  bgm: boolean;
  vibration: boolean;
  modes: QuestionMode[];
  /** 空なら全範囲 */
  bands: ScoreBand[];
  themes: Theme[];
  /** 問題が出たときに英単語を読み上げる(絵→英単語は答えた後に読む) */
  speakWords: boolean;
  /** 遊び方の説明を見た出題形式 */
  seenTutorials: QuestionMode[];
  /** ログインしていない人の名前(端末に保存)。ログインしてクラウドの名前が無ければ、それに使う */
  guestName: string | null;
};

type SettingsStore = Settings & {
  update: (patch: Partial<Settings>) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  showJapanese: true,
  effectIntensity: "max",
  sound: true,
  bgm: true,
  vibration: true,
  modes: [...QUESTION_MODES],
  bands: [],
  themes: [],
  speakWords: true,
  seenTutorials: [],
  guestName: null,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
    }),
    {
      name: "dopatan-settings",
      storage: appStorage,
      skipHydration: true,
      version: 1,
      // version 0 のころはリスニングとつづり並べ替えが無かったので、追加してオンにする
      migrate: (persisted, version) => {
        const state = persisted as Partial<Settings>;
        if (version < 1 && state.modes) {
          state.modes = [...new Set([...state.modes, "listening", "spelling"] as QuestionMode[])];
        }
        return state as SettingsStore;
      },
    },
  ),
);
