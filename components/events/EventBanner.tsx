"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedBar } from "@/components/fx/AnimatedBar";
import { timeLeftLabel } from "@/lib/events/week";
import { useCurrentEvent } from "./useEvent";

/** ホームに出す今週のイベント */
export function EventBanner() {
  const { now, ev, result, rules } = useCurrentEvent();
  const progress = (rules.progress as (s: unknown, w: string) => { value: number; max: number; text: string })(
    result.run.state,
    ev.week,
  );
  return (
    <Link
      href="/event"
      data-testid="event-banner"
      className={`pop-border flex flex-col gap-2 rounded-3xl bg-gradient-to-r ${rules.color} p-4 transition-transform active:translate-x-1 active:translate-y-1`}
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="text-5xl"
          aria-hidden
          animate={{ rotate: [0, -12, 12, 0], y: [0, -4, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.5 }}
        >
          {rules.emoji}
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-black text-white text-stroke">今週のイベント</span>
          <span className="text-2xl font-black text-white text-stroke-lg">{rules.name}</span>
          <span className="truncate text-xs font-black text-slate-900">{rules.tagline}</span>
        </div>
        <span className="pop-border shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-black">⏰ {timeLeftLabel(ev.end, now)}</span>
      </div>
      <AnimatedBar ratio={progress.value / progress.max} className="bg-gradient-to-r from-yellow-300 to-pink-400" />
      <span className="text-right text-sm font-black text-white text-stroke" data-testid="event-banner-progress">
        {progress.text} ▶
      </span>
    </Link>
  );
}
