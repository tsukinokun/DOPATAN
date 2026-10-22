import { mergeWallet, type WalletData } from "@/lib/economy/walletData";
import type { SenseProgress } from "@/lib/srs";

export type Stats = { sessions: number; bestScore: number; bestCombo: number };

export type SyncedData<S> = {
  progress: Record<string, SenseProgress>;
  stats: Stats;
  /** クラウドにまだ設定が無いときは null */
  settings: S | null;
  /** 古いデータや、wallet 列を追加する前のデータでは null */
  wallet: WalletData | null;
};

/** 同じ単語なら、たくさん出題された方(=より新しい記録)を残す */
function pickProgress(a: SenseProgress, b: SenseProgress): SenseProgress {
  if (a.exposures !== b.exposures) return a.exposures > b.exposures ? a : b;
  return a.due >= b.due ? a : b;
}

/**
 * 端末の記録とクラウドの記録を合わせる。何度合わせても結果が変わらない(冪等)ようにする。
 * 設定はクラウド側を優先する(別の端末で変えた設定を引き継ぐため)。
 */
export function mergeData<S>(local: SyncedData<S>, remote: SyncedData<S> | null): SyncedData<S> {
  if (!remote) return local;
  const progress: Record<string, SenseProgress> = { ...remote.progress };
  for (const [id, p] of Object.entries(local.progress)) {
    progress[id] = progress[id] ? pickProgress(p, progress[id]) : p;
  }
  return {
    progress,
    stats: {
      sessions: Math.max(local.stats.sessions, remote.stats.sessions),
      bestScore: Math.max(local.stats.bestScore, remote.stats.bestScore),
      bestCombo: Math.max(local.stats.bestCombo, remote.stats.bestCombo),
    },
    settings: remote.settings ?? local.settings,
    wallet: local.wallet ? mergeWallet(local.wallet, remote.wallet) : remote.wallet,
  };
}
