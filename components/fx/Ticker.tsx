"use client";

import { animate, motion, useAnimationControls, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { useEffectLevel } from "@/lib/fx/effects";

const defaultFormat = (n: number) => n.toLocaleString();

/**
 * 数字が数えられて増え(減り)、数え終わると弾む。
 * from を渡すと、表示したときに from から value まで数える。あとで value が変わったときは、今の値から数える。
 * 演出を減らす設定のときは、すぐ最後の値を出す。
 */
export function Ticker({
  value,
  from,
  delay = 0,
  duration = 0.8,
  format = defaultFormat,
  bounce = true,
  className,
  testId,
}: {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  format?: (n: number) => string;
  bounce?: boolean;
  className?: string;
  testId?: string;
}) {
  const effect = useEffectLevel();
  const quick = effect === "low";
  const count = useMotionValue(quick ? value : (from ?? value));
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  const text = useTransform(count, (v) => formatRef.current(Math.round(v)));
  const controls = useAnimationControls();
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (quick) {
      count.set(value);
      return;
    }
    if (count.get() === value) return;
    const playback = animate(count, value, {
      duration,
      delay: isFirst ? delay : 0,
      ease: "easeOut",
      onComplete: () => {
        if (bounce) void controls.start({ scale: [1, 1.35, 1], transition: { duration: 0.35 } });
      },
    });
    return () => playback.stop();
  }, [bounce, controls, count, delay, duration, quick, value]);

  return (
    <motion.span animate={controls} className={`inline-block ${className ?? ""}`} data-testid={testId}>
      {text}
    </motion.span>
  );
}
