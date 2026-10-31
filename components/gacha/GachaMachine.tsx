"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GachaResult } from "@/lib/economy/gacha";
import { sfx } from "@/lib/fx/audio";
import { burstConfetti, feverConfetti, useEffectLevel, vibrate } from "@/lib/fx/effects";
import { MAX_SKIN_LEVEL, RARITY_ORDER, type Rarity } from "@/lib/skins";
import { Ticker } from "@/components/fx/Ticker";
import { RARITY_GLOW, SkinCard } from "@/components/skins/SkinCard";
import { useSettings } from "@/stores/settings";

type Phase = "shake" | "flash" | "reveal";

const SHAKE_MS = 1400;
const FLASH_MS = 500;
const CARD_STEP_S = 0.18;
/** カードがめくれてからバーが溜まり始めるまで */
const fillDelay = (i: number) => i * CARD_STEP_S + 0.5;
/** バーが満タンまで溜まる時間(FillBar の stepSeconds と同じ) */
const FILL_S = 0.6;

function topRarity(results: GachaResult[]): Rarity {
  return results.reduce<Rarity>(
    (best, r) => (RARITY_ORDER.indexOf(r.skin.rarity) > RARITY_ORDER.indexOf(best) ? r.skin.rarity : best),
    "N",
  );
}

const playSound = (fn: () => void) => {
  if (useSettings.getState().sound) fn();
};

/**
 * ガチャの演出。カプセルが揺れ、光の色でレア度を予告し、SSR なら画面が白く光ってからカードがめくれる。
 * タップで演出を飛ばせる。
 */
export function GachaMachine({
  results,
  onClose,
  onAgain,
}: {
  results: GachaResult[];
  onClose: () => void;
  onAgain?: () => void;
}) {
  const level = useEffectLevel();
  const top = topRarity(results);
  const [phase, setPhase] = useState<Phase>("shake");
  const quick = level === "low";

  useEffect(() => {
    if (phase !== "shake") return;
    playSound(() => sfx.pickup());
    const tick = setInterval(() => playSound(() => sfx.pickup()), 300);
    const next = setTimeout(() => setPhase(top === "SSR" && !quick ? "flash" : "reveal"), quick ? 300 : SHAKE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [phase, quick, top]);

  useEffect(() => {
    if (phase === "flash") {
      playSound(() => sfx.fever());
      vibrate([60, 40, 200]);
      const next = setTimeout(() => setPhase("reveal"), FLASH_MS);
      return () => clearTimeout(next);
    }
    if (phase === "reveal") {
      const timers = results.map((r, i) =>
        setTimeout(
          () => {
            playSound(() => (r.skin.rarity === "N" ? sfx.coin() : sfx.correct(RARITY_ORDER.indexOf(r.skin.rarity) * 5)));
          },
          i * CARD_STEP_S * 1000,
        ),
      );
      if (top === "SSR") feverConfetti(level);
      else if (top === "SR") burstConfetti(level, { x: 0.5, y: 0.4 }, 1.5);
      return () => timers.forEach(clearTimeout);
    }
  }, [level, phase, results, top]);

  const skip = () => {
    if (phase !== "reveal") setPhase("reveal");
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-slate-950/85 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={skip}
      data-testid="gacha-overlay"
    >
      <AnimatePresence mode="wait">
        {phase === "shake" && (
          <motion.div
            key="capsule"
            className="relative my-auto grid h-48 w-48 shrink-0 place-items-center"
            exit={{ scale: 2.5, opacity: 0, transition: { duration: 0.25 } }}
          >
            <motion.div
              className="absolute inset-0 rounded-full blur-2xl"
              style={{ background: RARITY_GLOW[top] }}
              animate={{ opacity: [0.2, 0.9, 0.4, 1], scale: [0.8, 1.2, 1, 1.4] }}
              transition={{ duration: SHAKE_MS / 1000 }}
            />
            <motion.div
              className="pop-border relative h-36 w-36 overflow-hidden rounded-full"
              animate={quick ? {} : { rotate: [0, -12, 12, -18, 18, -24, 24, 0], scale: [1, 1, 1.05, 1.05, 1.1, 1.1, 1.2, 1.25] }}
              transition={{ duration: SHAKE_MS / 1000 }}
            >
              <div className="h-1/2 w-full" style={{ background: RARITY_GLOW[top] }} />
              <div className="h-1/2 w-full border-t-4 border-slate-900 bg-white" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "flash" && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-10 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: FLASH_MS / 1000 }}
        />
      )}

      {phase === "reveal" && (
        <div className="my-auto flex w-full max-w-2xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
          {top === "SSR" && <span className="rainbow-text text-5xl font-black">SSR!!</span>}
          <div
            className={`grid w-full gap-2 ${results.length === 1 ? "max-w-[12rem] grid-cols-1" : "grid-cols-3 sm:grid-cols-5"}`}
            data-testid="gacha-results"
          >
            {results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
                animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                transition={{ delay: i * CARD_STEP_S, type: "spring", stiffness: 300, damping: 18 }}
                style={{ filter: r.skin.rarity === "N" ? undefined : `drop-shadow(0 0 10px ${RARITY_GLOW[r.skin.rarity]})` }}
              >
                <SkinCard
                  skin={r.skin}
                  copies={r.copies}
                  fromCopies={r.duplicate ? r.copies - 1 : undefined}
                  fillDelay={fillDelay(i)}
                  footer={<ResultTag result={r} delay={fillDelay(i) + FILL_S} />}
                />
              </motion.div>
            ))}
          </div>
          <div className="flex gap-3">
            {onAgain && (
              <button type="button" onClick={onAgain} className="pop-border rounded-2xl bg-pink-400 px-6 py-3 font-black text-white">
                もう一回
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              data-testid="gacha-close"
              className="pop-border rounded-2xl bg-yellow-300 px-8 py-3 font-black"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** 結果カードの下の一言:新しく手に入れた / レベルアップ / 最大レベルで通貨が戻った */
function ResultTag({ result: r, delay }: { result: GachaResult; delay: number }) {
  if (!r.duplicate) {
    return (
      <span className="text-xs font-black text-pink-600" data-testid="gacha-tag-new">
        NEW!
      </span>
    );
  }
  if (r.level > r.levelBefore) {
    return (
      <motion.span
        className="text-[11px] font-black text-emerald-600"
        data-testid="gacha-tag-levelup"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, type: "spring", stiffness: 500, damping: 15 }}
      >
        Lv UP! {r.levelBefore}→{r.level >= MAX_SKIN_LEVEL ? "MAX" : r.level}
      </motion.span>
    );
  }
  if (r.levelBefore >= MAX_SKIN_LEVEL) {
    return (
      <span className="text-[11px] font-black text-slate-500" data-testid="gacha-tag-max">
        Lv.MAX {r.refund.coins ? "🪙+" : "💎+"}
        <Ticker value={r.refund.coins ?? r.refund.gems ?? 0} from={0} delay={delay - FILL_S} duration={0.5} className="text-amber-600" />
      </span>
    );
  }
  return (
    <span className="text-[11px] font-black text-slate-500" data-testid="gacha-tag-progress">
      かぶり +1
    </span>
  );
}
