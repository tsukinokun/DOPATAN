import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { SyncedData } from "./merge";

const TABLE = "user_data";

/**
 * wallet 列は 0002_wallet.sql で追加する。まだ実行されていないデータベースでも
 * 学習記録の同期は続けられるよう、列が無ければ wallet を除いて読み書きする。
 */
let hasWalletColumn = true;

const isMissingWalletColumn = (error: PostgrestError) => /wallet/i.test(error.message);

/** クラウドの記録を読む。まだ行が無ければ null */
export async function loadRemote<S>(supabase: SupabaseClient, userId: string): Promise<SyncedData<S> | null> {
  const query = (columns: string) => supabase.from(TABLE).select(columns).eq("user_id", userId).maybeSingle();
  let { data, error } = await query(hasWalletColumn ? "progress, stats, settings, wallet" : "progress, stats, settings");
  if (error && hasWalletColumn && isMissingWalletColumn(error)) {
    hasWalletColumn = false;
    ({ data, error } = await query("progress, stats, settings"));
  }
  if (error) throw error;
  if (!data) return null;
  return { wallet: null, ...(data as object) } as SyncedData<S>;
}

export async function saveRemote<S>(supabase: SupabaseClient, userId: string, data: SyncedData<S>): Promise<void> {
  const upsert = (row: object) =>
    supabase.from(TABLE).upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() });
  // undefined の項目は送信されないので、wallet 列が無いときはこれで除ける
  const rest = { ...data, wallet: undefined };
  let { error } = await upsert(hasWalletColumn ? data : rest);
  if (error && hasWalletColumn && isMissingWalletColumn(error)) {
    hasWalletColumn = false;
    ({ error } = await upsert(rest));
  }
  if (error) throw error;
}
