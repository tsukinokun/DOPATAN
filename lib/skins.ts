export type SkinCategory = "background" | "effect" | "sound";
export type Rarity = "N" | "R" | "SR" | "SSR";

export const CATEGORY_LABEL: Record<SkinCategory, string> = {
  background: "背景",
  effect: "正解エフェクト",
  sound: "効果音",
};

export const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR"];

export type BackgroundLook = { from: string; via: string; to: string; pattern?: string };
export type EffectLook = { colors: string[]; emojis?: string[] };
export type SoundLook = {
  wave: OscillatorType;
  pitch: number;
  /** 効果音ごとに決めた元の波形を使う(初期の効果音セット) */
  original?: boolean;
  layer?: OscillatorType;
  sparkle?: boolean;
};

type SkinBase = { id: string; name: string; rarity: Rarity; description: string };
export type Skin =
  | (SkinBase & { category: "background"; look: BackgroundLook })
  | (SkinBase & { category: "effect"; look: EffectLook })
  | (SkinBase & { category: "sound"; look: SoundLook });

const dots = (color: string) => `radial-gradient(${color} 1.5px, transparent 1.5px) 0 0 / 22px 22px`;

export const SKINS: readonly Skin[] = [
  // 背景
  { id: "bg-default", category: "background", rarity: "N", name: "ドパミン", description: "いつもの紫ピンク", look: { from: "#7b2ff7", via: "#f107a3", to: "#ff9a3c" } },
  { id: "bg-mint", category: "background", rarity: "N", name: "ミントソーダ", description: "しゅわっと爽やか", look: { from: "#11998e", via: "#38ef7d", to: "#b2fefa", pattern: dots("#ffffff55") } },
  { id: "bg-sunset", category: "background", rarity: "N", name: "サンセット", description: "夕焼けビーチ", look: { from: "#ff512f", via: "#f09819", to: "#ffd452" } },
  { id: "bg-neon", category: "background", rarity: "R", name: "ネオン街", description: "眠らない街の光", look: { from: "#0f0c29", via: "#302b63", to: "#ff00cc", pattern: "repeating-linear-gradient(90deg, #00fff733 0 2px, transparent 2px 40px)" } },
  { id: "bg-sakura", category: "background", rarity: "R", name: "桜吹雪", description: "春の満開", look: { from: "#ffafbd", via: "#ffc3a0", to: "#fbc2eb", pattern: dots("#ffffffaa") } },
  { id: "bg-space", category: "background", rarity: "SR", name: "宇宙", description: "無重力で単語を覚える", look: { from: "#000428", via: "#1c1c6b", to: "#4b0082", pattern: `${dots("#ffffffcc")}, radial-gradient(#ffd23f 1px, transparent 1px) 11px 11px / 37px 37px` } },
  { id: "bg-money", category: "background", rarity: "SR", name: "札束の海", description: "脳汁と札束", look: { from: "#134e5e", via: "#2f8f4e", to: "#71b280", pattern: "repeating-linear-gradient(45deg, #ffffff22 0 12px, transparent 12px 24px)" } },
  { id: "bg-gold", category: "background", rarity: "SSR", name: "黄金郷", description: "すべてが金色に輝く", look: { from: "#8a6d1d", via: "#f7d774", to: "#fff3b0", pattern: "repeating-conic-gradient(from 0deg at 50% 0%, #ffffff33 0 6deg, transparent 6deg 12deg)" } },

  // 正解エフェクト
  { id: "fx-default", category: "effect", rarity: "N", name: "カラフル紙吹雪", description: "いつもの紙吹雪", look: { colors: ["#ff3d7f", "#ffd23f", "#3ee6c1", "#7b5cff", "#2ec5ff"] } },
  { id: "fx-hearts", category: "effect", rarity: "N", name: "ハート", description: "正解するたび恋に落ちる", look: { colors: ["#ff3d7f", "#ff8fab"], emojis: ["💖", "💕"] } },
  { id: "fx-stars", category: "effect", rarity: "N", name: "スター", description: "キラキラ", look: { colors: ["#ffd23f", "#fff3b0"], emojis: ["⭐", "✨"] } },
  { id: "fx-fire", category: "effect", rarity: "R", name: "炎上", description: "燃えるような連打", look: { colors: ["#ff512f", "#f09819"], emojis: ["🔥"] } },
  { id: "fx-sushi", category: "effect", rarity: "R", name: "寿司", description: "回る、降る", look: { colors: ["#ff8f6b", "#ffffff"], emojis: ["🍣", "🍤"] } },
  { id: "fx-money", category: "effect", rarity: "SR", name: "お札", description: "正解でお金が降ってくる", look: { colors: ["#2f8f4e", "#ffd23f"], emojis: ["💴", "💰"] } },
  { id: "fx-crown", category: "effect", rarity: "SR", name: "王冠", description: "単語の王", look: { colors: ["#ffd23f", "#7b5cff"], emojis: ["👑"] } },
  { id: "fx-gems", category: "effect", rarity: "SSR", name: "宝石の雨", description: "虹色の宝石が降り注ぐ", look: { colors: ["#2ec5ff", "#ff3d7f", "#3ee6c1"], emojis: ["💎", "🌈", "✨"] } },

  // 効果音
  { id: "snd-default", category: "sound", rarity: "N", name: "ピコピコ", description: "いつもの音", look: { wave: "square", pitch: 1, original: true } },
  { id: "snd-cute", category: "sound", rarity: "N", name: "かわいい", description: "ころころ高い音", look: { wave: "sine", pitch: 1.5 } },
  { id: "snd-arcade", category: "sound", rarity: "R", name: "アーケード", description: "ゲーセンの音", look: { wave: "sawtooth", pitch: 0.75 } },
  { id: "snd-laser", category: "sound", rarity: "SR", name: "レーザー", description: "ビュンビュン", look: { wave: "sawtooth", pitch: 1.25, layer: "square" } },
  { id: "snd-hyper", category: "sound", rarity: "SSR", name: "ハイパー", description: "音が重なってキラキラ", look: { wave: "triangle", pitch: 1, layer: "square", sparkle: true } },
];

export const DEFAULT_SKINS: Record<SkinCategory, string> = {
  background: "bg-default",
  effect: "fx-default",
  sound: "snd-default",
};

const byId = new Map(SKINS.map((s) => [s.id, s]));

export function getSkin(id: string): Skin | undefined {
  return byId.get(id);
}

/** 装備中のスキン(見つからなければ初期スキン)を種類つきで取り出す */
export function skinOf<C extends SkinCategory>(category: C, id: string | undefined): Extract<Skin, { category: C }> {
  const skin = id ? byId.get(id) : undefined;
  const found = skin?.category === category ? skin : byId.get(DEFAULT_SKINS[category])!;
  return found as Extract<Skin, { category: C }>;
}
