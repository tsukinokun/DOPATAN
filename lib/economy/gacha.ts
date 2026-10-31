import type { Rng } from "@/lib/random";
import { DEFAULT_SKINS, MAX_SKIN_LEVEL, RARITY_ORDER, SKINS, skinLevel, type Rarity, type Skin } from "@/lib/skins";

export type GachaKind = "normal" | "rare";
export type Price = { coins?: number; gems?: number };

export type GachaDef = {
  name: string;
  single: Price;
  ten: Price;
  rates: Partial<Record<Rarity, number>>;
  /** 最大レベルのスキンが出たときに返す通貨 */
  refund: Partial<Record<Rarity, Price>>;
};

export const GACHAS: Record<GachaKind, GachaDef> = {
  normal: {
    name: "ノーマルガチャ",
    single: { coins: 100 },
    ten: { coins: 900 },
    rates: { N: 0.7, R: 0.25, SR: 0.05 },
    refund: { N: { coins: 20 }, R: { coins: 20 }, SR: { coins: 20 } },
  },
  rare: {
    name: "レアガチャ",
    single: { gems: 50 },
    ten: { gems: 450 },
    rates: { R: 0.6, SR: 0.32, SSR: 0.08 },
    refund: { R: { gems: 5 }, SR: { gems: 10 }, SSR: { gems: 20 } },
  },
};

const defaults = new Set(Object.values(DEFAULT_SKINS));

/** ガチャから出るスキン(初期スキンは出ない) */
export function poolOf(kind: GachaKind, rarity: Rarity): Skin[] {
  if (!GACHAS[kind].rates[rarity]) return [];
  return SKINS.filter((s) => s.rarity === rarity && !defaults.has(s.id));
}

/** 提供割合:スキン1つずつの確率 */
export function skinRates(kind: GachaKind): { skin: Skin; rate: number }[] {
  return RARITY_ORDER.flatMap((rarity) => {
    const pool = poolOf(kind, rarity);
    const rate = GACHAS[kind].rates[rarity] ?? 0;
    return pool.map((skin) => ({ skin, rate: rate / pool.length }));
  });
}

export type GachaResult = {
  skin: Skin;
  duplicate: boolean;
  /** 引く前と引いた後のレベル(新しく手に入れたときは 0 → 1) */
  levelBefore: number;
  level: number;
  refund: Price;
};

function rollRarity(kind: GachaKind, rng: Rng, minimum?: Rarity): Rarity {
  const entries = RARITY_ORDER.filter(
    (r) => GACHAS[kind].rates[r] && (!minimum || RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(minimum)),
  ).map((r) => [r, GACHAS[kind].rates[r]!] as const);
  const total = entries.reduce((sum, [, rate]) => sum + rate, 0);
  let x = rng() * total;
  for (const [rarity, rate] of entries) {
    if ((x -= rate) < 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

const isSrOrBetter = (r: Rarity) => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("SR");

/**
 * count 回引く。10連は SR 以上が最低1つ出る。
 * 持っているスキン(同じ10連の中で先に出たものも含む)は duplicate になり、レベルが上がる。
 * すでに最大レベルのスキンなら、代わりに通貨が一部返る。
 */
export function rollGacha(
  kind: GachaKind,
  count: 1 | 10,
  copies: ReadonlyMap<string, number>,
  rng: Rng,
): GachaResult[] {
  const rarities = Array.from({ length: count }, () => rollRarity(kind, rng));
  if (count === 10 && !rarities.some(isSrOrBetter)) {
    rarities[rarities.length - 1] = rollRarity(kind, rng, "SR");
  }
  const have = new Map(copies);
  return rarities.map((rarity) => {
    const pool = poolOf(kind, rarity);
    const skin = pool[Math.floor(rng() * pool.length)];
    const before = have.get(skin.id) ?? 0;
    have.set(skin.id, before + 1);
    const levelBefore = skinLevel(before);
    const maxed = levelBefore >= MAX_SKIN_LEVEL;
    return {
      skin,
      duplicate: before > 0,
      levelBefore,
      level: skinLevel(before + 1),
      refund: maxed ? (GACHAS[kind].refund[rarity] ?? {}) : {},
    };
  });
}

export function canAfford(price: Price, wallet: { coins: number; gems: number }): boolean {
  return (price.coins ?? 0) <= wallet.coins && (price.gems ?? 0) <= wallet.gems;
}
