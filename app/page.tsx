"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { unlockAudio } from "@/lib/fx/audio";
import { isDue, isMastered } from "@/lib/srs";
import { SCORE_BANDS, THEMES, type Theme } from "@/lib/types";
import { filterScope, getWords } from "@/lib/words";
import { CurrencyBar } from "@/components/economy/CurrencyBar";
import { DailyMissions } from "@/components/economy/DailyMissions";
import { LoginBonus } from "@/components/economy/LoginBonus";
import { usePendingPresents } from "@/components/presents/usePresents";
import { LevelBar, SocialNotices } from "@/components/social/common";
import { Chip, Hydrated, Panel, PopButton } from "@/components/ui";
import { useSocial } from "@/stores/social";
import { useProgress } from "@/stores/progress";
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
  const scope = filterScope(getWords(), bands, themes);
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
          <Image src="/logo.svg" alt="DOPATAN" width={240} height={60} priority className="h-auto w-[180px] sm:w-[240px]" />
        </motion.div>
        <div className="flex shrink-0 gap-2">
          <PresentsButton />
          <ProfileButton />
          <PopButton href="/settings" color="white" className="px-3 py-2" testId="open-settings">
            ⚙️
          </PopButton>
        </div>
      </header>

      <CurrencyBar now={now} />
      <LevelBar />

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
      <p className="-mt-3 text-center text-sm font-black text-white">1回90秒・スワイプで答えよう</p>

      <div className="grid grid-cols-2 gap-3">
        <PopButton href="/gacha" color="pink" className="whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-gacha">
          🎰 ガチャ
        </PopButton>
        <PopButton href="/collection" color="mint" className="whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-collection">
          🎒 コレクション
        </PopButton>
        <PopButton href="/league" color="yellow" className="whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-league">
          🏆 リーグ
        </PopButton>
        <FriendsButton />
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
      <SocialNotices />
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

/** プロフィール(名前・記録・ログイン)への入口 */
/** プレゼントボックス。未受け取りがあれば数を出す */
function PresentsButton() {
  const { pending } = usePendingPresents();
  return (
    <PopButton href="/presents" color="white" className="relative px-3 py-2" testId="open-presents">
      🎁
      {pending.length > 0 && (
        <motion.span
          key={pending.length}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-slate-900 bg-pink-500 px-1 text-xs text-white"
          data-testid="presents-badge"
        >
          {pending.length}
        </motion.span>
      )}
    </PopButton>
  );
}

function ProfileButton() {
  return (
    <PopButton href="/profile" color="white" className="px-3 py-2" testId="open-profile">
      👤
    </PopButton>
  );
}

/** 届いた申請があれば数を出す */
function FriendsButton() {
  const incoming = useSocial((s) => s.inbox?.incomingRequests.length ?? 0);
  return (
    <PopButton href="/friends" color="white" className="relative whitespace-nowrap px-2 py-4 text-lg sm:text-xl" testId="open-friends">
      👥 フレンド
      {incoming > 0 && (
        <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-slate-900 bg-pink-500 text-sm text-white">
          {incoming}
        </span>
      )}
    </PopButton>
  );
}
