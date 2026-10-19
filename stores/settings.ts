import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appStorage } from "@/lib/storage";
import type { EffectIntensity, QuestionMode, ScoreBand, Theme } from "@/lib/types";

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
  modes: ["wordToPicture", "pictureToWord"],
  bands: [],
  themes: [],
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
    }),
    { name: "dopatan-settings", storage: appStorage, skipHydration: true },
  ),
);
