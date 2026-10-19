"use client";

import confetti from "canvas-confetti";
import { useSyncExternalStore } from "react";
import { useSettings } from "@/stores/settings";
import type { EffectIntensity } from "@/lib/types";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

/** OS の「視差効果を減らす」がオンなら、設定に関わらず控えめにする */
export function useEffectLevel(): EffectIntensity {
  const intensity = useSettings((s) => s.effectIntensity);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  return reduced ? "low" : intensity;
}

const PARTICLES: Record<EffectIntensity, number> = { max: 1, standard: 0.45, low: 0 };

export function burstConfetti(
  level: EffectIntensity,
  origin: { x: number; y: number },
  power = 1,
): void {
  const scale = PARTICLES[level];
  if (scale === 0) return;
  void confetti({
    particleCount: Math.round(60 * scale * power),
    spread: 70 + 30 * power,
    startVelocity: 35 + 10 * power,
    origin,
    colors: ["#ff3d7f", "#ffd23f", "#3ee6c1", "#7b5cff", "#2ec5ff"],
    scalar: 1.1,
    disableForReducedMotion: true,
  });
}

export function feverConfetti(level: EffectIntensity): void {
  if (level === "low") return;
  const count = level === "max" ? 4 : 2;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      burstConfetti(level, { x: i % 2 === 0 ? 0.1 : 0.9, y: 0.7 }, 1.6);
    }, i * 150);
  }
}

export function vibrate(pattern: number | number[]): void {
  if (!useSettings.getState().vibration) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
