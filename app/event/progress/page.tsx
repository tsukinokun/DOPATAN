"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PopAmount } from "@/components/economy/RewardList";
import { EventBoard } from "@/components/events/EventBoard";
import { eventOverride } from "@/components/events/useEvent";
import { RewardChips } from "@/components/presents/RewardChips";
import { SkinCard } from "@/components/skins/SkinCard";
import { Hydrated } from "@/components/ui";
import { skinCopies } from "@/lib/economy/ledger";
import { eventAt, EVENTS, playsOfWeek, simulate } from "@/lib/events";
import { sfx } from "@/lib/fx/audio";
import { feverConfetti, useEffectLevel } from "@/lib/fx/effects";
import { getSkin } from "@/lib/skins";
import { useSettings } from "@/stores/settings";
import { useWallet } from "@/stores/wallet";

export default function EventProgressPage() {
  return (
    <Hydrated>
      <Progress />
    </Hydrated>
  );
}

/** 直前のプレイで、今週のイベントがどう進んだか(開いたときの台帳で固定する) */
function snapshot() {
  const { ledger, lastRewards } = useWallet.getState();
  const session = lastRewards.find((e) => e.id.startsWith("session:"));
  if (!session) return null;
  const ev = eventAt(session.at, eventOverride());
  const plays = playsOfWeek(ledger, ev.start);
  const index = plays.findIndex((p) => p.id === session.id);
  if (index < 0) return null;
  const before = simulate(ev.id, plays.slice(0, index), ev.week);
  const after = simulate(ev.id, plays.slice(0, index + 1), ev.week);
  const had = new Set(before.run.reached);
  const rules = EVENTS[ev.id];
  const milestones = new Map(rules.milestones(ev.week).map((m) => [m.id, m]));
  const fresh = after.run.reached.filter((id) => !had.has(id)).map((id) => milestones.get(id)!);
  return { ev, rules, after, step: after.run.details[index], fresh, copies: skinCopies(ledger) };
}

function Progress() {
  const router = useRouter();
  const level = useEffectLevel();
  const [data] = useState(snapshot);
  const [skip, setSkip] = useState(false);
  const [done, setDone] = useState(false);
  const final = data?.fresh.find((m) => m.final);

  useEffect(() => {
    if (!data) router.replace("/result");
  }, [data, router]);

  useEffect(() => {
    if (!done || !data || data.fresh.length === 0) return;
    if (useSettings.getState().sound) (final ? sfx.fever : sfx.coin)();
    if (final) feverConfetti(level);
  }, [data, done, final, level]);

  if (!data) return null;
  const { ev, rules, after, step, fresh, copies } = data;
  const limited = final ? getSkin(rules.limitedSkin) : undefined;

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center gap-4 px-4 py-6"
      onClick={() => setSkip(true)}
      data-testid="event-progress"
    >
      <motion.div
        className="flex flex-col items-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
      >
        <span className="text-sm font-black text-white text-stroke">今週のイベント</span>
        <h1 className="text-4xl font-black text-white text-stroke-lg">
          {rules.emoji} {rules.name}
        </h1>
      </motion.div>

      <EventBoard result={after} week={ev.week} step={step} skip={skip} onDone={() => setDone(true)} />

      <AnimatePresence>
        {done && fresh.length > 0 && (
          <motion.div
            className="pop-border flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-white p-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            data-testid="event-rewards"
          >
            <span className="rainbow-text text-center text-2xl font-black">🎁 報酬ゲット!</span>
            {fresh.map((m, i) => (
              <PopAmount key={m.id} delay={0.2 + i * 0.2}>
                <div className="flex flex-col gap-1 rounded-xl bg-yellow-50 px-2 py-1.5">
                  <span className="text-sm font-black">{m.label}</span>
                  <RewardChips {...m.reward} small />
                </div>
              </PopAmount>
            ))}
            {limited && (
              <div className="mx-auto w-36">
                <SkinCard skin={limited} copies={(copies.get(limited.id) ?? 0) || undefined} />
              </div>
            )}
            <span className="text-center text-xs font-black text-slate-500">プレゼントボックスに届きました</span>
          </motion.div>
        )}
      </AnimatePresence>

      {final && done && (
        <motion.span
          className="rainbow-text text-4xl font-black"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: [0, 1.4, 1], rotate: [-20, 10, -3] }}
        >
          完走おめでとう!
        </motion.span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push("/result");
        }}
        data-testid="event-next"
        className="pop-border mt-auto w-full max-w-sm rounded-2xl bg-yellow-300 py-3 text-xl font-black"
      >
        {done ? "次へ ▶" : "スキップ ▶"}
      </button>
    </main>
  );
}
