"use client";

import confetti from "canvas-confetti";
import { useSyncExternalStore } from "react";
import { useSettings } from "@/stores/settings";
import { skinOf, type EffectLook } from "@/lib/skins";
import type { EffectIntensity } from "@/lib/types";

let effectLook: EffectLook = skinOf("effect", undefined).look;
const emojiShapes = new Map<string, confetti.Shape>();

/** 装備中の正解エフェクト(SkinApplier が設定する) */
export function setEffectSkin(look: EffectLook): void {
  effectLook = look;
}

function shapesFor(look: EffectLook): confetti.Shape[] | undefined {
  if (!look.emojis) return undefined;
  return look.emojis.map((text) => {
    if (!emojiShapes.has(text)) emojiShapes.set(text, confetti.shapeFromText({ text, scalar: 2 }));
    return emojiShapes.get(text)!;
  });
}

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
  const shapes = shapesFor(effectLook);
  void confetti({
    // 絵文字は1つが大きいので数を減らす
    particleCount: Math.round(60 * scale * power * (shapes ? 0.5 : 1)),
    spread: 70 + 30 * power,
    startVelocity: 35 + 10 * power,
    origin,
    colors: effectLook.colors,
    shapes,
    scalar: shapes ? 2 : 1.1,
    flat: shapes ? true : undefined,
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
