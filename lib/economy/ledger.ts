import { DEFAULT_SKINS } from "@/lib/skins";

/**
 * コイン・ジェム・スキンの増減の記録。残高は保存せず、毎回この台帳から計算する。
 * 一度きりの報酬は日付や内容から ID を決めるので、端末をまたいでも二重には受け取れない。
 */
export type LedgerEvent = {
  id: string;
  at: number;
  /** 画面に出す理由(例:「プレイ報酬」「ミッション達成:今日2回遊ぶ」) */
  label: string;
  coins?: number;
  gems?: number;
  skin?: string;
  /** プレイ報酬のときのフィーバー回数(実績の判定に使う) */
  fevers?: number;
};

export type Ledger = Record<string, LedgerEvent>;

export function balance(ledger: Ledger): { coins: number; gems: number } {
  let coins = 0;
  let gems = 0;
  for (const e of Object.values(ledger)) {
    coins += e.coins ?? 0;
    gems += e.gems ?? 0;
  }
  return { coins, gems };
}

export function ownedSkins(ledger: Ledger): Set<string> {
  const owned = new Set<string>(Object.values(DEFAULT_SKINS));
  for (const e of Object.values(ledger)) if (e.skin) owned.add(e.skin);
  return owned;
}

export function totalFevers(ledger: Ledger): number {
  return Object.values(ledger).reduce((sum, e) => sum + (e.fevers ?? 0), 0);
}

/** ID で重ね合わせる。何度合わせても結果は同じ */
export function mergeLedgers(a: Ledger, b: Ledger): Ledger {
  return { ...b, ...a };
}
