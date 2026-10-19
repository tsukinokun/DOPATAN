import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** ログイン機能が使えるか(環境変数が無ければゲスト専用で動く) */
export const isSupabaseEnabled = Boolean(url && anonKey);

/** ブラウザ用の Supabase クライアント。ゲスト専用のときやサーバー上では null */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseEnabled || typeof window === "undefined") return null;
  client ??= createClient(url!, anonKey!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
