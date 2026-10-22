"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Avatar, LoginRequired, Modal, NicknameGate, ProfileModal } from "@/components/social/common";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { socialApi, type Standings } from "@/lib/social/api";
import { msUntilWeekEnd, tierOf, zoneOf } from "@/lib/social/leagues";
import { displayName } from "@/lib/social/names";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { useSocial } from "@/stores/social";

export default function LeaguePage() {
  return (
    <Hydrated>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <PopButton href="/" color="white" className="px-3 py-2">
            ←
          </PopButton>
          <h1 className="text-3xl font-black text-white text-stroke">リーグ</h1>
        </header>
        <League />
      </main>
    </Hydrated>
  );
}

function League() {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <Panel>読み込み中…</Panel>;
  if (status !== "signedIn") return <LoginRequired feature="週ごとのリーグ" />;
  return <Standings />;
}

function formatRemaining(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? `残り${Math.floor(hours / 24)}日${hours % 24}時間` : `残り${hours}時間${Math.floor((ms % 3_600_000) / 60_000)}分`;
}

const SEEN_KEY = "dopatan-league-result-seen";

function Standings() {
  const [data, setData] = useState<Standings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileCode, setProfileCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    socialApi
      .leagueStandings(supabase)
      .then(setData)
      .catch((e: Error) => setError(e.message));
    void useSocial.getState().refresh().catch(() => {});
    const tick = () => setRemaining(msUntilWeekEnd(Date.now()));
    const timer = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, []);

  if (error) return <Panel className="font-black text-pink-600">{error}</Panel>;
  if (!data) return <Panel>読み込み中…</Panel>;

  const tier = tierOf(data.tier);
  return (
    <>
      <NicknameGate />
      <LastWeekResult week={data.week} />
      <Panel className="flex flex-col items-center gap-1 text-center" >
        <motion.span
          className="text-6xl"
          animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          aria-hidden
        >
          {tier.emoji}
        </motion.span>
        <span className="text-2xl font-black" style={{ color: tier.color }} data-testid="league-tier">
          {tier.name}リーグ
        </span>
        <span className="text-sm font-black text-slate-500">
          {remaining !== null && formatRemaining(remaining)}・上位7人が昇格 / 下位5人が降格
        </span>
      </Panel>

      <Panel className="flex flex-col gap-1 px-2">
        <ol className="flex flex-col gap-1" data-testid="league-standings">
          {data.members.map((m, i) => {
            const zone = zoneOf(i + 1, data.members.length, data.tier, m.xp);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setProfileCode(m.friendCode)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left ${
                    m.me ? "border-[3px] border-slate-900 bg-yellow-200" : zone === "promote" ? "bg-emerald-50" : zone === "demote" ? "bg-rose-50" : ""
                  }`}
                >
                  <span className="w-7 text-center font-black tabular-nums">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                  <Avatar person={m} size={32} />
                  <span className="min-w-0 flex-1 truncate font-black">{displayName(m)}</span>
                  <span className="font-black tabular-nums">{m.xp} XP</span>
                  <span className="w-4 text-xs">{zone === "promote" ? "▲" : zone === "demote" ? "▼" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-center text-xs text-slate-500">遊ぶほどXPが入ります(1回のプレイで最大600XP)</p>
      </Panel>
      <ProfileModal code={profileCode} onClose={() => setProfileCode(null)} />
    </>
  );
}

/** 先週の結果を、週が変わって最初に開いたときだけ見せる */
function LastWeekResult({ week }: { week: string }) {
  const level = useEffectLevel();
  const rewards = useSocial((s) => s.inbox?.leagueRewards);
  const [seen, setSeen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SEEN_KEY);
    } catch {
      return null;
    }
  });
  const last = rewards?.at(-1);
  const open = Boolean(last && last.week < week && seen !== last.week);

  useEffect(() => {
    if (open) burstConfetti(level, { x: 0.5, y: 0.4 }, 1.5);
  }, [level, open]);

  const close = () => {
    if (!last) return;
    try {
      localStorage.setItem(SEEN_KEY, last.week);
    } catch {}
    setSeen(last.week);
  };

  if (!last) return null;
  const from = tierOf(last.tier);
  const to = tierOf(last.newTier);
  const message = last.newTier > last.tier ? `${to.name}リーグに昇格!` : last.newTier < last.tier ? `${to.name}リーグに降格…` : `${to.name}リーグに残留`;
  return (
    <Modal open={open} onClose={close}>
      <span className="text-lg font-black text-slate-500">先週の結果</span>
      <span className="text-5xl font-black">{last.rank}位</span>
      <span className="text-2xl font-black">
        {from.emoji} → {to.emoji}
      </span>
      <span className="rainbow-text text-2xl font-black">{message}</span>
      {last.gems > 0 && <span className="text-xl font-black text-sky-500">💎+{last.gems}</span>}
      <button type="button" onClick={close} className="pop-border w-full rounded-2xl bg-yellow-300 py-2 font-black">
        OK
      </button>
    </Modal>
  );
}
