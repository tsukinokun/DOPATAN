"use client";

import { AnimatePresence, motion } from "framer-motion";
import { balance } from "@/lib/economy/ledger";
import { currentStreak, dateKey } from "@/lib/economy/rewards";
import { useWallet } from "@/stores/wallet";

/** コイン・ジェム・連続ログイン日数 */
export function CurrencyBar({ now }: { now: number }) {
  const ledger = useWallet((s) => s.ledger);
  const loginDates = useWallet((s) => s.loginDates);
  const { coins, gems } = balance(ledger);
  const streak = currentStreak(loginDates, dateKey(now));

  return (
    <div className="flex items-center gap-2">
      <Amount icon="🪙" value={coins} testId="coins" />
      <Amount icon="💎" value={gems} testId="gems" />
      {streak > 0 && (
        <span className="pop-border ml-auto rounded-full bg-orange-400 px-3 py-1 text-sm font-black text-white">
          🔥 {streak}日連続
        </span>
      )}
    </div>
  );
}

function Amount({ icon, value, testId }: { icon: string; value: number; testId: string }) {
  return (
    <span className="pop-border flex items-center gap-1 rounded-full bg-white px-3 py-1 font-black">
      <span aria-hidden>{icon}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          data-testid={testId}
          initial={{ y: -12, scale: 1.4, color: "#ec4899" }}
          animate={{ y: 0, scale: 1, color: "#0f172a" }}
          className="tabular-nums"
        >
          {value.toLocaleString()}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
