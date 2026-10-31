"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Ticker } from "@/components/fx/Ticker";
import { sfx } from "@/lib/fx/audio";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { useSettings } from "@/stores/settings";
import { useWallet } from "@/stores/wallet";

/** その日初めて開いたときに出るログインボーナスの画面 */
export function LoginBonus() {
  const level = useEffectLevel();
  const bonus = useWallet((s) => s.pendingBonus);
  const dismiss = useWallet((s) => s.dismissBonus);

  useEffect(() => {
    useWallet.getState().checkIn(Date.now());
  }, []);

  useEffect(() => {
    if (bonus) burstConfetti(level, { x: 0.5, y: 0.45 }, 1.5);
  }, [bonus, level]);

  const receive = () => {
    if (useSettings.getState().sound) sfx.coin();
    dismiss();
  };

  const gems = bonus?.events.reduce((sum, e) => sum + (e.gems ?? 0), 0) ?? 0;

  return (
    <AnimatePresence>
      {bonus && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="login-bonus"
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="pop-border flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center"
          >
            <span className="rainbow-text text-3xl font-black">LOGIN BONUS!</span>
            <span className="text-lg font-black">🔥 {bonus.streak}日連続ログイン</span>
            <motion.span
              className="text-7xl"
              animate={{ y: [0, -14, 0], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              aria-hidden
            >
              💎
            </motion.span>
            <span className="text-4xl font-black text-sky-500 text-stroke">
              +<Ticker value={gems} from={0} delay={0.4} testId="login-bonus-gems" />
            </span>
            <ul className="w-full text-left text-sm font-black text-slate-600">
              {bonus.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{e.label}</span>
                  <span className="shrink-0">💎{e.gems}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={receive}
              data-testid="login-bonus-receive"
              className="pop-border mt-2 w-full rounded-2xl bg-yellow-300 py-3 text-xl font-black"
            >
              受け取る
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
