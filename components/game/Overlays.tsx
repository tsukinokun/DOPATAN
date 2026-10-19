"use client";

import { AnimatePresence, motion } from "framer-motion";

/** 画面中央にドンと出る文字 */
export function BigBanner({
  show,
  text,
  sub,
  className = "",
}: {
  show: boolean;
  text: string;
  sub?: string;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={text}
          className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.span
            initial={{ scale: 3, rotate: -15 }}
            animate={{ scale: 1, rotate: -4 }}
            exit={{ scale: 0.4 }}
            transition={{ type: "spring", stiffness: 500, damping: 14 }}
            className={`text-center text-7xl font-black text-stroke-lg sm:text-8xl ${className}`}
          >
            {text}
          </motion.span>
          {sub && (
            <motion.span
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-2 text-2xl font-black text-white text-stroke"
            >
              {sub}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** フィーバー中は画面のふちが虹色に光り、背景が流れる */
export function FeverOverlay({ active, intense }: { active: boolean; intense: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={`absolute inset-0 fever-bg ${intense ? "" : "opacity-60"}`} />
          <div className="absolute inset-0 fever-frame" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 正解したカードの上に浮かぶ得点 */
export function ScorePopup({ popup }: { popup: { id: number; x: number; y: number; text: string } | null }) {
  return (
    <AnimatePresence>
      {popup && (
        <motion.span
          key={popup.id}
          className="pointer-events-none fixed z-50 -translate-x-1/2 text-3xl font-black text-yellow-300 text-stroke"
          style={{ left: popup.x, top: popup.y }}
          initial={{ y: 0, opacity: 1, scale: 0.6 }}
          animate={{ y: -80, opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          {popup.text}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
