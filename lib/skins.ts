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

/** スキンの効果。装備中のスキンの効果だけが足し合わされる */
export type PerkKind = "coins" | "xp" | "score" | "combo";

export const PERK_LABEL: Record<PerkKind, string> = {
  coins: "🪙 コイン",
  xp: "⭐ 経験値",
  score: "🎯 スコア",
  combo: "🔥 コンボスコア",
};

export const PERK_KINDS: PerkKind[] = ["coins", "xp", "score", "combo"];

type SkinBase = { id: string; name: string; rarity: Rarity; description: string; perk?: PerkKind };
export type Skin =
  | (SkinBase & { category: "background"; look: BackgroundLook })
  | (SkinBase & { category: "effect"; look: EffectLook })
  | (SkinBase & { category: "sound"; look: SoundLook });

const dots = (color: string) => `radial-gradient(${color} 1.5px, transparent 1.5px) 0 0 / 22px 22px`;

export const SKINS: readonly Skin[] = [
  // 背景
  { id: "bg-default", category: "background", rarity: "N", name: "ドパミン", description: "いつもの紫ピンク", look: { from: "#7b2ff7", via: "#f107a3", to: "#ff9a3c" } },
  { id: "bg-mint", perk: "coins", category: "background", rarity: "N", name: "ミントソーダ", description: "しゅわっと爽やか", look: { from: "#11998e", via: "#38ef7d", to: "#b2fefa", pattern: dots("#ffffff55") } },
  { id: "bg-sunset", perk: "xp", category: "background", rarity: "N", name: "サンセット", description: "夕焼けビーチ", look: { from: "#ff512f", via: "#f09819", to: "#ffd452" } },
  { id: "bg-neon", perk: "score", category: "background", rarity: "R", name: "ネオン街", description: "眠らない街の光", look: { from: "#0f0c29", via: "#302b63", to: "#ff00cc", pattern: "repeating-linear-gradient(90deg, #00fff733 0 2px, transparent 2px 40px)" } },
  { id: "bg-sakura", perk: "combo", category: "background", rarity: "R", name: "桜吹雪", description: "春の満開", look: { from: "#ffafbd", via: "#ffc3a0", to: "#fbc2eb", pattern: dots("#ffffffaa") } },
  { id: "bg-space", perk: "xp", category: "background", rarity: "SR", name: "宇宙", description: "無重力で単語を覚える", look: { from: "#000428", via: "#1c1c6b", to: "#4b0082", pattern: `${dots("#ffffffcc")}, radial-gradient(#ffd23f 1px, transparent 1px) 11px 11px / 37px 37px` } },
  { id: "bg-money", perk: "coins", category: "background", rarity: "SR", name: "札束の海", description: "脳汁と札束", look: { from: "#134e5e", via: "#2f8f4e", to: "#71b280", pattern: "repeating-linear-gradient(45deg, #ffffff22 0 12px, transparent 12px 24px)" } },
  { id: "bg-gold", perk: "coins", category: "background", rarity: "SSR", name: "黄金郷", description: "すべてが金色に輝く", look: { from: "#8a6d1d", via: "#f7d774", to: "#fff3b0", pattern: "repeating-conic-gradient(from 0deg at 50% 0%, #ffffff33 0 6deg, transparent 6deg 12deg)" } },
  { id: "bg-deepsea", perk: "xp", category: "background", rarity: "N", name: "深海", description: "静かに集中できる", look: { from: "#000046", via: "#1cb5e0", to: "#7fdbff", pattern: dots("#ffffff33") } },
  { id: "bg-matcha", perk: "combo", category: "background", rarity: "N", name: "抹茶ラテ", description: "ほっと一息", look: { from: "#3a6b35", via: "#9bc472", to: "#f3f9d2" } },
  { id: "bg-lava", perk: "score", category: "background", rarity: "R", name: "溶岩", description: "ぐつぐつ煮えたぎる", look: { from: "#1a0000", via: "#c31432", to: "#ff8c00", pattern: "repeating-radial-gradient(circle at 30% 120%, #ffd23f22 0 10px, transparent 10px 30px)" } },
  { id: "bg-candy", perk: "coins", category: "background", rarity: "R", name: "キャンディ", description: "あまくてポップ", look: { from: "#ff9a9e", via: "#fad0c4", to: "#a1c4fd", pattern: "repeating-linear-gradient(-45deg, #ffffff55 0 10px, transparent 10px 20px)" } },
  { id: "bg-aurora", perk: "combo", category: "background", rarity: "SR", name: "オーロラ", description: "夜空にゆらめく光", look: { from: "#0b1d3a", via: "#00c9a7", to: "#845ec2", pattern: dots("#ffffff88") } },
  { id: "bg-rainbow", perk: "score", category: "background", rarity: "SSR", name: "虹の橋", description: "七色の向こう側へ", look: { from: "#ff3d7f", via: "#ffd23f", to: "#2ec5ff", pattern: "repeating-linear-gradient(120deg, #ffffff33 0 14px, transparent 14px 28px)" } },

  // 正解エフェクト
  { id: "fx-default", category: "effect", rarity: "N", name: "カラフル紙吹雪", description: "いつもの紙吹雪", look: { colors: ["#ff3d7f", "#ffd23f", "#3ee6c1", "#7b5cff", "#2ec5ff"] } },
  { id: "fx-hearts", perk: "combo", category: "effect", rarity: "N", name: "ハート", description: "正解するたび恋に落ちる", look: { colors: ["#ff3d7f", "#ff8fab"], emojis: ["💖", "💕"] } },
  { id: "fx-stars", perk: "score", category: "effect", rarity: "N", name: "スター", description: "キラキラ", look: { colors: ["#ffd23f", "#fff3b0"], emojis: ["⭐", "✨"] } },
  { id: "fx-fire", perk: "combo", category: "effect", rarity: "R", name: "炎上", description: "燃えるような連打", look: { colors: ["#ff512f", "#f09819"], emojis: ["🔥"] } },
  { id: "fx-sushi", perk: "coins", category: "effect", rarity: "R", name: "寿司", description: "回る、降る", look: { colors: ["#ff8f6b", "#ffffff"], emojis: ["🍣", "🍤"] } },
  { id: "fx-money", perk: "coins", category: "effect", rarity: "SR", name: "お札", description: "正解でお金が降ってくる", look: { colors: ["#2f8f4e", "#ffd23f"], emojis: ["💴", "💰"] } },
  { id: "fx-crown", perk: "score", category: "effect", rarity: "SR", name: "王冠", description: "単語の王", look: { colors: ["#ffd23f", "#7b5cff"], emojis: ["👑"] } },
  { id: "fx-gems", perk: "score", category: "effect", rarity: "SSR", name: "宝石の雨", description: "虹色の宝石が降り注ぐ", look: { colors: ["#2ec5ff", "#ff3d7f", "#3ee6c1"], emojis: ["💎", "🌈", "✨"] } },
  { id: "fx-notes", perk: "xp", category: "effect", rarity: "N", name: "音符", description: "正解でリズムに乗る", look: { colors: ["#7b5cff", "#2ec5ff"], emojis: ["🎵", "🎶"] } },
  { id: "fx-paws", perk: "coins", category: "effect", rarity: "N", name: "肉球", description: "ぷにぷに", look: { colors: ["#ff8fab", "#ffffff"], emojis: ["🐾"] } },
  { id: "fx-flowers", perk: "xp", category: "effect", rarity: "R", name: "お花畑", description: "頭の中がお花畑", look: { colors: ["#ff8fab", "#ffd23f", "#3ee6c1"], emojis: ["🌸", "🌼", "🌷"] } },
  { id: "fx-thunder", perk: "score", category: "effect", rarity: "R", name: "雷", description: "ひらめきが落ちる", look: { colors: ["#ffd23f", "#2ec5ff"], emojis: ["⚡"] } },
  { id: "fx-rocket", perk: "xp", category: "effect", rarity: "SR", name: "ロケット", description: "スコアが打ち上がる", look: { colors: ["#ff512f", "#ffffff", "#2ec5ff"], emojis: ["🚀", "💫"] } },
  { id: "fx-meteor", perk: "combo", category: "effect", rarity: "SSR", name: "流星群", description: "願いを3回言う前に正解", look: { colors: ["#fff3b0", "#7b5cff", "#2ec5ff"], emojis: ["🌠", "☄️", "✨"] } },

  // 効果音
  { id: "snd-default", category: "sound", rarity: "N", name: "ピコピコ", description: "いつもの音", look: { wave: "square", pitch: 1, original: true } },
  { id: "snd-cute", perk: "xp", category: "sound", rarity: "N", name: "かわいい", description: "ころころ高い音", look: { wave: "sine", pitch: 1.5 } },
  { id: "snd-arcade", perk: "score", category: "sound", rarity: "R", name: "アーケード", description: "ゲーセンの音", look: { wave: "sawtooth", pitch: 0.75 } },
  { id: "snd-laser", perk: "combo", category: "sound", rarity: "SR", name: "レーザー", description: "ビュンビュン", look: { wave: "sawtooth", pitch: 1.25, layer: "square" } },
  { id: "snd-hyper", perk: "xp", category: "sound", rarity: "SSR", name: "ハイパー", description: "音が重なってキラキラ", look: { wave: "triangle", pitch: 1, layer: "square", sparkle: true } },
  { id: "snd-bell", perk: "coins", category: "sound", rarity: "N", name: "ベル", description: "チリンと澄んだ音", look: { wave: "sine", pitch: 2 } },
  { id: "snd-8bit", perk: "combo", category: "sound", rarity: "N", name: "8ビット", description: "なつかしのゲーム機", look: { wave: "square", pitch: 0.5 } },
  { id: "snd-musicbox", perk: "xp", category: "sound", rarity: "R", name: "オルゴール", description: "やさしく響く", look: { wave: "triangle", pitch: 2, sparkle: true } },
  { id: "snd-taiko", perk: "coins", category: "sound", rarity: "R", name: "和太鼓", description: "ドドンと低い音", look: { wave: "triangle", pitch: 0.5, layer: "sine" } },
  { id: "snd-synth", perk: "score", category: "sound", rarity: "SR", name: "シンセ", description: "分厚いシンセの音", look: { wave: "sawtooth", pitch: 1, layer: "triangle" } },
  { id: "snd-galaxy", perk: "coins", category: "sound", rarity: "SSR", name: "ギャラクシー", description: "宇宙に響くキラキラ音", look: { wave: "sine", pitch: 1.5, layer: "sawtooth", sparkle: true } },
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

// ---- レベルと効果 ----

export const MAX_SKIN_LEVEL = 5;
/** そのレベルになるのに必要な合計枚数(Lv1, Lv2, …)。上のレベルほど必要なかぶりが増える */
export const LEVEL_COPIES = [1, 2, 4, 7, 11] as const;

/** 持っている枚数からレベルを出す(持っていなければ 0) */
export function skinLevel(copies: number): number {
  let level = 0;
  for (const need of LEVEL_COPIES) if (copies >= need) level++;
  return level;
}

/** 次のレベルまであと何枚か(最大レベルなら null) */
export function copiesToNext(copies: number): number | null {
  const level = skinLevel(copies);
  if (level >= MAX_SKIN_LEVEL) return null;
  return LEVEL_COPIES[level] - copies;
}

/** Lv1 での効果の大きさ(%) */
export const PERK_BASE: Record<Rarity, number> = { N: 3, R: 5, SR: 8, SSR: 12 };

/** そのレベルでの効果の大きさ(%)。1レベル上がるごとに Lv1 の半分ずつ増える */
export function perkPercent(skin: Skin, level: number): number {
  if (!skin.perk || level <= 0) return 0;
  return Math.round(PERK_BASE[skin.rarity] * (1 + 0.5 * (Math.min(level, MAX_SKIN_LEVEL) - 1)));
}
