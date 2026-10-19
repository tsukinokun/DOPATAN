export type ScoreBand = 600 | 730 | 860 | 990;

export const THEMES = {
  office: "オフィス",
  meeting: "会議",
  hr: "人事・採用",
  finance: "経理・金融",
  marketing: "営業・マーケ",
  travel: "出張・旅行",
  shopping: "買い物・サービス",
  manufacturing: "製造・物流",
} as const;

export type Theme = keyof typeof THEMES;

export const SCORE_BANDS: ScoreBand[] = [600, 730, 860, 990];

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb";

export const POS_LABEL: Record<PartOfSpeech, string> = {
  noun: "名",
  verb: "動",
  adjective: "形",
  adverb: "副",
};

/** 1つの意味(=1枚のカード)。多義語は意味ごとに別の WordSense になる。 */
export type WordSense = {
  /** "issue-1" のように英単語+意味番号 */
  id: string;
  word: string;
  pos: PartOfSpeech;
  ja: string;
  band: ScoreBand;
  theme: Theme;
  /** 本番画像ができるまでの仮イラスト */
  emoji: string;
  ipa: string;
  example: { en: string; ja: string };
  derivatives: string[];
  /** 和訳が近い単語同士は同じ問題の選択肢に並べない */
  synonymGroup?: string;
};

export type QuestionMode = "wordToPicture" | "pictureToWord";

export type EffectIntensity = "max" | "standard" | "low";
