"use client";

import { AnimatePresence, motion } from "framer-motion";

export const FEVER_EVERY = 10;

export function Hud({
  timeLeftMs,
  totalMs,
  score,
  combo,
  fever,
  onExit,
}: {
  timeLeftMs: number;
  totalMs: number;
  score: number;
  combo: number;
  fever: boolean;
  onExit: () => void;
}) {
  const ratio = Math.max(0, timeLeftMs / totalMs);
  const seconds = Math.ceil(timeLeftMs / 1000);
  const danger = seconds <= 10;
  const gauge = fever ? 1 : (combo % FEVER_EVERY) / FEVER_EVERY;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="一時停止"
          data-testid="pause"
          className="pop-border grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-slate-900"
        >
          ✕
        </button>
        <div className="pop-border relative h-5 flex-1 overflow-hidden rounded-full bg-white/80">
          <motion.div
            className={`h-full ${danger ? "bg-red-500" : "bg-gradient-to-r from-lime-300 to-emerald-400"}`}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ ease: "linear", duration: 0.2 }}
          />
        </div>
        <motion.span
          data-testid="timer"
          className={`w-10 text-right text-xl font-black tabular-nums ${danger ? "text-red-200" : "text-white"}`}
          animate={danger ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, repeat: danger ? Infinity : 0 }}
        >
          {seconds}
        </motion.span>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-black text-white/80">SCORE</span>
          <motion.span
            key={score}
            data-testid="score"
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="origin-left text-3xl font-black tabular-nums text-white text-stroke"
          >
            {score.toLocaleString()}
          </motion.span>
        </div>
        <ComboMeter combo={combo} fever={fever} />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs font-black ${fever ? "rainbow-text" : "text-white/80"}`}>FEVER</span>
        <div className="pop-border h-3 flex-1 overflow-hidden rounded-full bg-white/50">
          <motion.div
            className={`h-full ${fever ? "rainbow-bg" : "bg-gradient-to-r from-yellow-300 to-pink-400"}`}
            animate={{ width: `${gauge * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        </div>
      </div>
    </div>
  );
}

function ComboMeter({ combo, fever }: { combo: number; fever: boolean }) {
  return (
    <div className="flex h-14 items-end">
      <AnimatePresence mode="popLayout">
        {combo >= 2 && (
          <motion.div
            key={combo}
            data-testid="combo"
            initial={{ scale: 2.2, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 600, damping: 15 }}
            className="flex items-baseline gap-1"
          >
            <span className={`text-4xl font-black tabular-nums text-stroke ${fever ? "rainbow-text" : "text-yellow-300"}`}>
              {combo}
            </span>
            <span className="text-lg font-black text-white text-stroke">COMBO</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
