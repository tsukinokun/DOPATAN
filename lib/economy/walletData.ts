import type { SkinCategory } from "@/lib/skins";
import { mergeLedgers, type Ledger } from "./ledger";
import { mergeDaily, type DailyStats } from "./rewards";

export type Equipped = Record<SkinCategory, string | undefined>;

/** クラウドと同期するウォレットの中身 */
export type WalletData = {
  ledger: Ledger;
  daily: Record<string, DailyStats>;
  loginDates: string[];
  equipped: Equipped;
};

export const EMPTY_WALLET: WalletData = {
  ledger: {},
  daily: {},
  loginDates: [],
  equipped: { background: undefined, effect: undefined, sound: undefined },
};

/** 台帳と日付は重ね合わせ、集計は大きい方、装備は(設定と同じく)クラウド側を優先する */
export function mergeWallet(local: WalletData, remote: WalletData | null | undefined): WalletData {
  if (!remote) return local;
  return {
    ledger: mergeLedgers(local.ledger, remote.ledger ?? {}),
    daily: mergeDaily(local.daily, remote.daily ?? {}),
    loginDates: [...new Set([...local.loginDates, ...(remote.loginDates ?? [])])].sort(),
    equipped: { ...local.equipped, ...stripUndefined(remote.equipped ?? {}) },
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}
