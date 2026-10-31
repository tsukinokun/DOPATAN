"use client";

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/fx/audio";
import { useEffectLevel } from "@/lib/fx/effects";
import { fillSteps, type FillPoint } from "@/lib/fx/fill";
import { useSettings } from "@/stores/settings";

const playSound = (fn: () => void) => {
  if (useSettings.getState().sound) fn();
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * start から end までバーが溜まっていく演出。レベルをまたぐと満タンで光って「LEVEL UP!」が出て、0 から続きが伸びる。
 * start と end が同じなら、ただのバーとして表示する。演出を減らす設定のときは最後の値をすぐ出す。
 */
export function FillBar({
  start,
  end,
  delay = 0,
  stepSeconds = 0.6,
  label,
  count,
  maxLevel,
  onLevelUp,
  size = "sm",
  testId,
  countTestId,
}: {
  start: FillPoint;
  end: FillPoint;
  /** 溜まり始めるまでの秒数 */
  delay?: number;
  /** 空から満タンまで溜まる秒数 */
  stepSeconds?: number;
  label: (level: number) => React.ReactNode;
  /** 右側に出す数字(例:「1/2」)。ratio は今見えている溜まり具合 */
  count?: (level: number, ratio: number) => React.ReactNode;
  /** このレベル以上は満タンの虹色にする */
  maxLevel?: number;
  onLevelUp?: (level: number) => void;
  size?: "sm" | "lg";
  testId?: string;
  countTestId?: string;
}) {
  const effect = useEffectLevel();
  // 演出の途中で props が変わっても最初の値で最後まで溜める
  const [steps] = useState(() => fillSteps(start, end));
  const [animated] = useState(() => effect !== "low" && (steps.length > 1 || steps[0].from !== steps[0].to));
  const last = steps[steps.length - 1];
  const [shown, setShown] = useState(() => (animated ? { level: steps[0].level, ratio: steps[0].from } : { level: last.level, ratio: last.to }));
  const [levelUps, setLevelUps] = useState(0);
  // 値が変わらないときも、表示したときに 0 から伸ばす(数字は最初から最後の値を出す)
  const [growIn] = useState(() => !animated && effect !== "low" && last.to > 0);
  const width = useMotionValue(growIn ? 0 : shown.ratio);
  const widthPercent = useTransform(width, (v) => `${v * 100}%`);
  const onLevelUpRef = useRef(onLevelUp);
  useEffect(() => {
    onLevelUpRef.current = onLevelUp;
  });

  useEffect(() => {
    if (!growIn) return;
    const controls = animate(width, last.to, { duration: 0.7, delay, ease: [0.22, 1.2, 0.36, 1] });
    return () => controls.stop();
  }, [delay, growIn, last.to, width]);

  useEffect(() => {
    if (!animated) return;
    let cancelled = false;
    let controls: ReturnType<typeof animate> | undefined;
    void (async () => {
      await wait(delay * 1000);
      for (const [i, step] of steps.entries()) {
        if (cancelled) return;
        if (i > 0) {
          width.set(0);
          setShown({ level: step.level, ratio: 0 });
          setLevelUps((n) => n + 1);
          onLevelUpRef.current?.(step.level);
          playSound(() => sfx.comboMilestone());
        } else {
          playSound(() => sfx.coin());
        }
        controls = animate(width, step.to, {
          duration: stepSeconds * Math.max(0.35, step.to - step.from),
          ease: i === steps.length - 1 ? "easeOut" : "easeIn",
        });
        await controls;
        if (cancelled) return;
        setShown({ level: step.level, ratio: step.to });
        if (i < steps.length - 1) await wait(150);
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [animated, delay, stepSeconds, steps, width]);

  const max = maxLevel !== undefined && shown.level >= maxLevel;
  const big = size === "lg";
  return (
    <div className="relative flex flex-col gap-0.5" data-testid={testId}>
      <div className={`flex items-baseline justify-between font-black text-slate-500 ${big ? "text-sm" : "text-[10px]"}`}>
        <span>{label(shown.level)}</span>
        {count && (
          <span className="tabular-nums" data-testid={countTestId}>
            {count(shown.level, shown.ratio)}
          </span>
        )}
      </div>
      <motion.div
        key={levelUps}
        className={`overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100 ${big ? "h-4" : "h-2.5"}`}
        initial={levelUps > 0 ? { boxShadow: "0 0 0 4px #fde047, 0 0 16px 6px #facc15" } : false}
        animate={{ boxShadow: "0 0 0 0px #fde04700, 0 0 0px 0px #facc1500" }}
        transition={{ duration: 0.7 }}
      >
        <motion.div className={`h-full rounded-full ${max ? "rainbow-bg" : "bg-emerald-400"}`} style={{ width: widthPercent }} />
      </motion.div>
      <AnimatePresence>
        {levelUps > 0 && (
          <motion.span
            key={levelUps}
            className={`rainbow-text pointer-events-none absolute inset-x-0 text-center font-black ${big ? "-top-5 text-2xl" : "-bottom-1 text-sm"}`}
            initial={{ scale: 0.4, opacity: 0, y: 6 }}
            animate={{ scale: [0.4, 1.3, 1], opacity: [0, 1, 1, 0], y: [6, -4, -8] }}
            transition={{ duration: 1.1, times: [0, 0.3, 1] }}
            data-testid="fill-level-up"
          >
            LEVEL UP!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
