"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Ticker } from "@/components/fx/Ticker";
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

/** 残高。値が変わると前の値から数えて、数え終わると弾む(増えたらピンク、減ったら灰色に一瞬光る) */
function Amount({ icon, value, testId }: { icon: string; value: number; testId: string }) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState<{ key: number; up: boolean } | null>(null);
  if (prev !== value) {
    setFlash((f) => ({ key: (f?.key ?? 0) + 1, up: value > prev }));
    setPrev(value);
  }
  return (
    <span className="pop-border flex items-center gap-1 rounded-full bg-white px-3 py-1 font-black">
      <motion.span
        aria-hidden
        key={flash?.key ?? 0}
        className="inline-block"
        initial={flash ? { scale: 1.6, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 12 }}
      >
        {icon}
      </motion.span>
      <motion.span
        key={`v${flash?.key ?? 0}`}
        initial={flash ? { color: flash.up ? "#ec4899" : "#94a3b8" } : false}
        animate={{ color: "#0f172a" }}
        transition={{ duration: 1.2 }}
      >
        <Ticker value={value} testId={testId} className="tabular-nums" />
      </motion.span>
    </span>
  );
}
