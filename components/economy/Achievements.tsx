"use client";

import { AnimatedBar } from "@/components/fx/AnimatedBar";
import { Panel } from "@/components/ui";
import { ACHIEVEMENTS, achievementEventId } from "@/lib/economy/rewards";
import { achievementContext, useWallet } from "@/stores/wallet";

/** 実績の一覧と進み具合(コレクション画面とプロフィール画面で使う) */
export function Achievements() {
  const state = useWallet();
  const ledger = state.ledger;
  const context = achievementContext(state);
  const unlocked = ACHIEVEMENTS.filter((a) => ledger[achievementEventId(a.id)]).length;

  return (
    <Panel className="flex flex-col gap-3">
      <p className="font-black">
        {unlocked} / {ACHIEVEMENTS.length} 個を達成
      </p>
      <ul className="flex flex-col gap-3" data-testid="achievements">
        {ACHIEVEMENTS.map((a, i) => {
          const done = Boolean(ledger[achievementEventId(a.id)]);
          const value = Math.min(a.value(context), a.target);
          return (
            <li key={a.id} className={`flex flex-col gap-1 ${done ? "" : "opacity-80"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-black">
                  {done ? "🏆" : "🔒"} {a.label}
                </span>
                <span className="text-sm font-black text-slate-500">{done ? "達成!" : `💎${a.gems}`}</span>
              </div>
              <span className="text-xs text-slate-500">{a.description}</span>
              <AnimatedBar
                ratio={value / a.target}
                className={done ? "bg-amber-400" : "bg-sky-400"}
                height="h-2.5"
                delay={0.1 + i * 0.04}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
