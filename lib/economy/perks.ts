import { PERK_KINDS, perkPercent, skinLevel, skinOf, type PerkKind, type SkinCategory } from "@/lib/skins";
import type { Equipped } from "./walletData";

/** 効果の種類ごとの合計(%) */
export type Perks = Record<PerkKind, number>;

export const NO_PERKS: Perks = { coins: 0, xp: 0, score: 0, combo: 0 };

/** 装備中のスキンの効果を足し合わせる */
export function equippedPerks(equipped: Equipped, copies: ReadonlyMap<string, number>): Perks {
  const perks = { ...NO_PERKS };
  for (const category of Object.keys(equipped) as SkinCategory[]) {
    const skin = skinOf(category, equipped[category]);
    if (!skin.perk) continue;
    perks[skin.perk] += perkPercent(skin, skinLevel(copies.get(skin.id) ?? 0));
  }
  return perks;
}

export const hasPerks = (perks: Perks) => PERK_KINDS.some((k) => perks[k] > 0);

export function applyPercent(value: number, percent: number): number {
  return Math.round(value * (1 + percent / 100));
}
