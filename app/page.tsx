"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { unlockAudio } from "@/lib/fx/audio";
import { isDue, isMastered } from "@/lib/srs";
import { SCORE_BANDS, THEMES, type Theme } from "@/lib/types";
import { filterScope, WORDS } from "@/lib/words";
import { CurrencyBar } from "@/components/economy/CurrencyBar";
import { DailyMissions } from "@/components/economy/DailyMissions";
import { LoginBonus } from "@/components/economy/LoginBonus";
import { Chip, Hydrated, Panel, PopButton } from "@/components/ui";
import { useProgress } from "@/stores/progress";
import { useAuth } from "@/stores/auth";
import { useSettings } from "@/stores/settings";

export default function HomePage() {
  return (
    <Hydrated>
      <Home />
    </Hydrated>
  );
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Home() {
  const { bands, themes, update } = useSettings();
  const { progress, bestScore, bestCombo } = useProgress();
  const scope = filterScope(WORDS, bands, themes);
  const [now] = useState(Date.now);
  const learned = scope.filter((w) => (progress[w.id]?.exposures ?? 0) > 0).length;
  const mastered = scope.filter((w) => isMastered(progress[w.id])).length;
  const due = scope.filter((w) => isDue(progress[w.id], now)).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 12 }}
        >
          <Image src="/logo.svg" alt="DOPATAN" width={240} height={60} priority />
        </motion.div>
        <div className="flex gap-2">
          <AccountButton />
          <PopButton href="/settings" color="white" className="px-3 py-2" testId="open-settings">
            ⚙️
          </PopButton>
        </div>
      </header>

      <CurrencyBar now={now} />

      <Panel className="grid grid-cols-3 gap-2 text-center">
        <Stat label="学習した" value={`${learned}`} unit={`/ ${scope.length}`} />
        <Stat label="マスター" value={`${mastered}`} unit="語" />
        <Stat label="復習待ち" value={`${due}`} unit="語" highlight={due > 0} />
      </Panel>

      <motion.div
        className="flex justify-center py-4"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <PopButton
          href="/play"
          onClick={unlockAudio}
          color="yellow"
          className="w-64 py-6 text-4xl"
          testId="play"
        >
          ▶ PLAY
        </PopButton>
      </motion.div>
      <p className="-mt-3 text-center text-sm font-black text-white">1回3分・スワイプで答えよう</p>

      <div className="grid grid-cols-2 gap-3">
        <PopButton href="/gacha" color="pink" className="whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-gacha">
          🎰 ガチャ
        </PopButton>
        <PopButton href="/collection" color="mint" className="whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-collection">
          🎒 コレクション
        </PopButton>
      </div>

      <DailyMissions now={now} />

      <Panel className="flex flex-col gap-3">
        <h2 className="font-black">出題範囲</h2>
        <div className="flex flex-wrap gap-2">
          <Chip active={bands.length === 0} onClick={() => update({ bands: [] })}>
            全スコア
          </Chip>
          {SCORE_BANDS.map((b) => (
            <Chip key={b} active={bands.includes(b)} onClick={() => update({ bands: toggle(bands, b) })}>
              {b}点
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={themes.length === 0} onClick={() => update({ themes: [] })}>
            全テーマ
          </Chip>
          {(Object.keys(THEMES) as Theme[]).map((t) => (
            <Chip key={t} active={themes.includes(t)} onClick={() => update({ themes: toggle(themes, t) })}>
              {THEMES[t]}
            </Chip>
          ))}
        </div>
      </Panel>

      <Panel className="flex justify-around text-center">
        <Stat label="ハイスコア" value={bestScore.toLocaleString()} />
        <Stat label="最大コンボ" value={`${bestCombo}`} />
      </Panel>

      <LoginBonus />
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <span className={`text-2xl font-black tabular-nums ${highlight ? "text-pink-500" : "text-slate-900"}`}>
        {value}
        {unit && <span className="ml-1 text-xs text-slate-500">{unit}</span>}
      </span>
    </div>
  );
}

/** ログイン中は ☁️、ゲストは 👤。ログイン機能が無効なら出さない */
function AccountButton() {
  const status = useAuth((s) => s.status);
  if (status === "disabled") return null;
  return (
    <PopButton href="/account" color="white" className="px-3 py-2" testId="open-account">
      {status === "signedIn" ? "☁️" : "👤"}
    </PopButton>
  );
}
