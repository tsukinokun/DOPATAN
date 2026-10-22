"use client";

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
        {ACHIEVEMENTS.map((a) => {
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
              <div className="h-2.5 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
                <div
                  className={`h-full ${done ? "bg-amber-400" : "bg-sky-400"}`}
                  style={{ width: `${(value / a.target) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
