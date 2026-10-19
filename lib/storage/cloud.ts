import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncedData } from "./merge";

const TABLE = "user_data";

/** クラウドの記録を読む。まだ行が無ければ null */
export async function loadRemote<S>(supabase: SupabaseClient, userId: string): Promise<SyncedData<S> | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("progress, stats, settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as SyncedData<S> | null;
}

export async function saveRemote<S>(supabase: SupabaseClient, userId: string, data: SyncedData<S>): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() });
  if (error) throw error;
}
