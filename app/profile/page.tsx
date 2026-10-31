"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Achievements } from "@/components/economy/Achievements";
import { AnimatedBar } from "@/components/fx/AnimatedBar";
import { LevelBar, NicknameForm } from "@/components/social/common";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { totalFevers, totalXp } from "@/lib/economy/ledger";
import { currentStreak, dateKey, longestStreak, recentDays } from "@/lib/economy/rewards";
import { displayName } from "@/lib/social/names";
import { isMastered } from "@/lib/srs";
import { SCORE_BANDS } from "@/lib/types";
import { getWords } from "@/lib/words";
import { useAuth } from "@/stores/auth";
import { useProgress } from "@/stores/progress";
import { useSettings } from "@/stores/settings";
import { useSocial } from "@/stores/social";
import { useWallet } from "@/stores/wallet";

export default function ProfilePage() {
  return (
    <Hydrated>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <PopButton href="/" color="white" className="px-3 py-2">
            ←
          </PopButton>
          <h1 className="text-3xl font-black text-white text-stroke">プロフィール</h1>
        </header>
        <NameCard />
        <LevelBar />
        <BasicStats />
        <WordStats />
        <RecentChart />
        <h2 className="text-xl font-black text-white text-stroke">実績</h2>
        <Achievements />
      </main>
    </Hydrated>
  );
}

/** 名前と、名前の変更・ログイン状態 */
function NameCard() {
  const status = useAuth((s) => s.status);
  const email = useAuth((s) => s.email);
  const profile = useSocial((s) => s.profile);
  const guestName = useSettings((s) => s.guestName);
  const [editing, setEditing] = useState(false);
  const signedIn = status === "signedIn";
  const name = signedIn ? (profile ? displayName(profile) : "読み込み中…") : (guestName ?? "ゲスト");

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-slate-900 bg-gradient-to-br from-pink-400 via-violet-400 to-sky-400 text-2xl font-black text-white text-stroke"
          aria-hidden
        >
          {[...name][0]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-2xl font-black" data-testid="profile-name">
            {name}
          </span>
          {signedIn && profile && <span className="text-xs text-slate-500">フレンドコード {profile.friendCode}</span>}
        </div>
        {!editing && (signedIn ? profile !== null : true) && (
          <PopButton color="yellow" className="shrink-0 px-3 py-2 text-sm" onClick={() => setEditing(true)} testId="edit-name">
            ✏️ 名前を変える
          </PopButton>
        )}
      </div>
      {editing &&
        (signedIn ? (
          <NicknameForm key="cloud" onDone={() => setEditing(false)} />
        ) : (
          <NicknameForm
            key="guest"
            initial={guestName}
            onSave={(value) => useSettings.getState().update({ guestName: value })}
            onDone={() => setEditing(false)}
          />
        ))}
      {status !== "disabled" && (
        <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-slate-200 pt-3 text-sm">
          <span className="min-w-0 truncate font-bold text-slate-600">
            {signedIn ? `☁️ ログイン中(${email ?? "メールアドレスなし"})` : "👤 ゲスト(記録はこの端末だけ)"}
          </span>
          <PopButton href="/account" color="white" className="shrink-0 px-3 py-1.5 text-sm" testId="open-account">
            {signedIn ? "アカウント" : "ログイン"}
          </PopButton>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-slate-50 px-2 py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="text-xl font-black tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="ml-0.5 text-xs text-slate-500">{unit}</span>}
      </span>
    </div>
  );
}

function BasicStats() {
  const { sessions, bestScore, bestCombo } = useProgress();
  const { ledger, loginDates } = useWallet();
  const [today] = useState(() => dateKey(Date.now()));
  return (
    <Panel className="flex flex-col gap-2" testId="basic-stats">
      <h2 className="font-black">記録</h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="プレイ回数" value={sessions} unit="回" />
        <Stat label="ハイスコア" value={bestScore} />
        <Stat label="最大コンボ" value={bestCombo} />
        <Stat label="累計XP" value={totalXp(ledger)} />
        <Stat label="フィーバー" value={totalFevers(ledger)} unit="回" />
        <Stat label="ログイン日数" value={loginDates.length} unit="日" />
        <Stat label="連続ログイン" value={currentStreak(loginDates, today)} unit="日" />
        <Stat label="最長連続" value={longestStreak(loginDates)} unit="日" />
      </div>
    </Panel>
  );
}

function Bar({ value, max, className, delay }: { value: number; max: number; className: string; delay?: number }) {
  return <AnimatedBar ratio={max === 0 ? 0 : value / max} className={className} delay={delay} />;
}

function WordStats() {
  const progress = useProgress((s) => s.progress);
  const words = getWords();
  const rows = [{ label: "全体", list: words }, ...SCORE_BANDS.map((b) => ({ label: `${b}点`, list: words.filter((w) => w.band === b) }))].map(
    ({ label, list }) => ({
      label,
      total: list.length,
      learned: list.filter((w) => (progress[w.id]?.exposures ?? 0) > 0).length,
      mastered: list.filter((w) => isMastered(progress[w.id])).length,
    }),
  );
  let correct = 0;
  let wrong = 0;
  for (const p of Object.values(progress)) {
    correct += p.correct;
    wrong += p.wrong;
  }
  const accuracy = correct + wrong === 0 ? null : Math.round((correct / (correct + wrong)) * 100);

  return (
    <Panel className="flex flex-col gap-3" testId="word-stats">
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">単語</h2>
        <span className="text-sm font-black text-slate-600">
          正答率 <span className="text-lg text-pink-500">{accuracy === null ? "-" : `${accuracy}%`}</span>
        </span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-sm font-black">
            <span>{r.label}</span>
            <span className="tabular-nums text-slate-600">
              学習 {r.learned} / {r.total}・マスター {r.mastered}
            </span>
          </div>
          <Bar value={r.learned} max={r.total} className="bg-gradient-to-r from-sky-400 to-violet-500" delay={i * 0.1} />
          <Bar value={r.mastered} max={r.total} className="bg-amber-400" delay={i * 0.1 + 0.05} />
        </div>
      ))}
      <p className="text-xs text-slate-500">上のバーは学習した単語、下のバーはマスターした単語です。</p>
    </Panel>
  );
}

function RecentChart() {
  const daily = useWallet((s) => s.daily);
  const [today] = useState(() => dateKey(Date.now()));
  const days = recentDays(daily, today);
  const max = Math.max(1, ...days.map((d) => d.correct));
  const playedDays = days.filter((d) => d.sessions > 0).length;
  const totalCorrect = days.reduce((sum, d) => sum + d.correct, 0);

  return (
    <Panel className="flex flex-col gap-3" testId="recent-chart">
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">最近30日</h2>
        <span className="text-sm font-black text-slate-600">
          {playedDays}日プレイ・正解 {totalCorrect.toLocaleString()}
        </span>
      </div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`最近30日で${playedDays}日プレイし、合計${totalCorrect}問正解`}>
        {days.map((d, i) => (
          <motion.div
            key={d.date}
            title={`${d.date.slice(5).replace("-", "/")}:正解 ${d.correct}(${d.sessions}回)`}
            className={`flex-1 rounded-t-md border-2 border-b-0 border-slate-900 ${d.date === today ? "bg-pink-400" : "bg-sky-400"}`}
            initial={{ height: 0 }}
            animate={{ height: d.correct === 0 ? 3 : `${Math.max(8, (d.correct / max) * 100)}%` }}
            transition={{ delay: i * 0.015, type: "spring", stiffness: 200, damping: 20 }}
            style={{ opacity: d.correct === 0 ? 0.25 : 1 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs font-bold text-slate-500">
        <span>{days[0].date.slice(5).replace("-", "/")}</span>
        <span>今日</span>
      </div>
    </Panel>
  );
}
