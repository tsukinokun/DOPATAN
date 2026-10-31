"use client";

import { motion } from "framer-motion";
import { useEffectLevel } from "@/lib/fx/effects";

/**
 * 表示したときに 0 から伸びるバー。伸び終わると光が横切り、満タンなら1回弾む。
 * 値があとで変わったときは、その値までなめらかに伸びる。演出を減らす設定のときはすぐ最後の値を出す。
 */
export function AnimatedBar({
  ratio,
  className,
  delay = 0,
  height = "h-3",
  testId,
}: {
  ratio: number;
  className: string;
  delay?: number;
  height?: string;
  testId?: string;
}) {
  const quick = useEffectLevel() === "low";
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const full = clamped >= 1;
  const grow = 0.7;
  return (
    <motion.div
      className={`relative overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100 ${height}`}
      initial={false}
      animate={!quick && full ? { scale: [1, 1, 1.06, 1] } : undefined}
      transition={{ duration: grow + 0.4, delay, times: [0, 0.6, 0.8, 1] }}
      data-testid={testId}
    >
      <motion.div
        className={`relative h-full overflow-hidden ${className}`}
        initial={quick ? false : { width: 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: grow, delay, ease: [0.22, 1.2, 0.36, 1] }}
      >
        {/* 伸び終わると、溜まった部分の上を光が1回横切る */}
        {!quick && clamped > 0 && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            initial={{ x: "-110%" }}
            animate={{ x: "220%" }}
            transition={{ duration: 0.7, delay: delay + grow, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
