"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { useStoresHydrated } from "@/stores/hydration";

/** 保存データを読み込んでから中身を描く */
export function Hydrated({ children }: { children: ReactNode }) {
  const hydrated = useStoresHydrated();
  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="animate-bounce text-5xl">⚡</span>
      </div>
    );
  }
  return <>{children}</>;
}

const COLORS = {
  yellow: "bg-yellow-300 text-slate-900",
  white: "bg-white text-slate-900",
  pink: "bg-pink-400 text-white",
  mint: "bg-emerald-300 text-slate-900",
} as const;

export function PopButton({
  children,
  onClick,
  href,
  color = "yellow",
  className = "",
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  color?: keyof typeof COLORS;
  className?: string;
  testId?: string;
}) {
  const classes = `pop-border inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-black transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none ${COLORS[color]} ${className}`;
  const inner = (
    <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="contents">
      {children}
    </motion.span>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes} data-testid={testId}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} data-testid={testId}>
      {inner}
    </button>
  );
}

export function Panel({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`pop-border rounded-3xl bg-white/95 p-4 ${className}`} data-testid={testId}>
      {children}
    </section>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-[3px] border-slate-900 px-3 py-1 text-sm font-black transition-colors ${
        active ? "bg-slate-900 text-yellow-300" : "bg-white text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
