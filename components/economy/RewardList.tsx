"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import type { LedgerEvent } from "@/lib/economy/ledger";
import { sfx } from "@/lib/fx/audio";
import { Panel } from "@/components/ui";
import { useSettings } from "@/stores/settings";

const STEP_SECONDS = 0.35;

function iconFor(e: LedgerEvent): string {
  if (e.id.startsWith("ach:")) return "🏆";
  if (e.id.startsWith("mission:")) return "🎯";
  if (e.id.startsWith("master:")) return "🎓";
  return "🎁";
}

/** 結果画面で、受け取った報酬を1つずつ「チャリン」と出す */
export function RewardList({ events }: { events: LedgerEvent[] }) {
  useEffect(() => {
    if (!useSettings.getState().sound) return;
    const timers = events.map((_, i) => setTimeout(() => sfx.coin(), 400 + i * STEP_SECONDS * 1000));
    return () => timers.forEach(clearTimeout);
  }, [events]);

  if (events.length === 0) return null;
  const coins = events.reduce((sum, e) => sum + (e.coins ?? 0), 0);
  const gems = events.reduce((sum, e) => sum + (e.gems ?? 0), 0);

  return (
    <Panel className="flex flex-col gap-2" >
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">獲得した報酬</h2>
        <span className="font-black" data-testid="reward-total">
          {coins > 0 && <span className="mr-2">🪙+{coins}</span>}
          {gems > 0 && <span>💎+{gems}</span>}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {events.map((e, i) => (
          <motion.li
            key={e.id}
            initial={{ x: -30, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * STEP_SECONDS, type: "spring", stiffness: 500, damping: 20 }}
            className="flex items-center justify-between gap-2 rounded-xl bg-yellow-50 px-3 py-1 text-sm font-black"
          >
            <span className="min-w-0 truncate">
              {iconFor(e)} {e.label}
            </span>
            <span className="shrink-0">
              {e.coins ? `🪙+${e.coins}` : ""}
              {e.gems ? `💎+${e.gems}` : ""}
            </span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
}
