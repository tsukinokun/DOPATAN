"use client";

import { ALL_CLEAR_GEMS, dateKey, EMPTY_DAILY, MISSION_GEMS, missionEventId, missionsFor } from "@/lib/economy/rewards";
import { Panel } from "@/components/ui";
import { useWallet } from "@/stores/wallet";

/** 今日のミッション。報酬はプレイ終了時に自動で受け取る */
export function DailyMissions({ now }: { now: number }) {
  const today = dateKey(now);
  const daily = useWallet((s) => s.daily[today]) ?? EMPTY_DAILY;
  const ledger = useWallet((s) => s.ledger);
  const missions = missionsFor(today);
  const allClear = Boolean(ledger[missionEventId(today, "all")]);

  return (
    <Panel className="flex flex-col gap-3" >
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">今日のミッション</h2>
        <span className={`text-xs font-black ${allClear ? "text-emerald-600" : "text-slate-500"}`}>
          {allClear ? "全達成!" : `全達成で 💎+${ALL_CLEAR_GEMS}`}
        </span>
      </div>
      <ul className="flex flex-col gap-2" data-testid="missions">
        {missions.map((m) => {
          const value = Math.min(m.value(daily), m.target);
          const done = Boolean(ledger[missionEventId(today, m.id)]);
          return (
            <li key={m.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm font-black">
                <span>
                  {done ? "✅ " : ""}
                  {m.label}
                </span>
                <span className="text-slate-500">{done ? "受取済" : `💎${MISSION_GEMS}`}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
                <div
                  className={`h-full ${done ? "bg-emerald-400" : "bg-gradient-to-r from-yellow-300 to-pink-400"}`}
                  style={{ width: `${(value / m.target) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
