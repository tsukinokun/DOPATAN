"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Ticker } from "@/components/fx/Ticker";
import { Panel } from "@/components/ui";
import type { LedgerEvent } from "@/lib/economy/ledger";
import { sfx } from "@/lib/fx/audio";
import { useEffectLevel } from "@/lib/fx/effects";
import { useSettings } from "@/stores/settings";

const STEP_SECONDS = 0.35;
const FIRST_DELAY_SECONDS = 0.4;

function iconFor(e: LedgerEvent): string {
  if (e.id.startsWith("ach:")) return "🏆";
  if (e.id.startsWith("mission:")) return "🎯";
  if (e.id.startsWith("master:")) return "🎓";
  return "🎁";
}

const sum = (events: LedgerEvent[], key: "coins" | "gems" | "xp") => events.reduce((n, e) => n + (e[key] ?? 0), 0);

/** 跳ねて出てくる金額 */
function PopAmount({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.span
      className="inline-block"
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: [0, 1.45, 1], rotate: [-15, 8, 0] }}
      transition={{ delay, duration: 0.45, times: [0, 0.6, 1] }}
    >
      {children}
    </motion.span>
  );
}

/**
 * 結果画面で、受け取った報酬を1つずつ「チャリン」と出す。
 * 1つ出るたびに、上の合計がそこまで数えられて弾む。
 */
export function RewardList({ events }: { events: LedgerEvent[] }) {
  const quick = useEffectLevel() === "low";
  const [revealed, setRevealed] = useState(quick ? events.length : 0);

  useEffect(() => {
    const sound = useSettings.getState().sound;
    const timers = events.map((_, i) =>
      setTimeout(
        () => {
          if (sound) sfx.coin();
          setRevealed((n) => Math.max(n, i + 1));
        },
        (FIRST_DELAY_SECONDS + i * STEP_SECONDS) * 1000,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [events]);

  if (events.length === 0) return null;
  const shown = events.slice(0, revealed);
  const xp = sum(events, "xp");
  const coins = sum(events, "coins");
  const gems = sum(events, "gems");

  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">獲得した報酬</h2>
        <span className="font-black" data-testid="reward-total">
          {xp > 0 && (
            <span className="mr-2">
              ⭐+<Ticker value={sum(shown, "xp")} from={0} duration={0.3} />
              XP
            </span>
          )}
          {coins > 0 && (
            <span className="mr-2">
              🪙+<Ticker value={sum(shown, "coins")} from={0} duration={0.3} />
            </span>
          )}
          {gems > 0 && (
            <span>
              💎+<Ticker value={sum(shown, "gems")} from={0} duration={0.3} />
            </span>
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {events.map((e, i) => {
          const delay = FIRST_DELAY_SECONDS + i * STEP_SECONDS;
          return (
            <motion.li
              key={e.id}
              initial={{ x: -30, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{ delay, type: "spring", stiffness: 500, damping: 20 }}
              className="flex items-center justify-between gap-2 rounded-xl bg-yellow-50 px-3 py-1 text-sm font-black"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">
                  {iconFor(e)} {e.label}
                </span>
                {(e.bonusCoins || e.bonusXp) && (
                  <PopAmount delay={delay + 0.25}>
                    <span className="text-[11px] text-emerald-700" data-testid="skin-bonus">
                      ✨ スキン効果 {e.bonusCoins ? `🪙+${e.bonusCoins} ` : ""}
                      {e.bonusXp ? `⭐+${e.bonusXp}XP` : ""}
                    </span>
                  </PopAmount>
                )}
              </span>
              <span className="shrink-0">
                <PopAmount delay={delay + 0.1}>
                  {e.coins ? `🪙+${e.coins}` : ""}
                  {e.gems ? `💎+${e.gems}` : ""}
                </PopAmount>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </Panel>
  );
}
