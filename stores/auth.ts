import { create } from "zustand";

export type AuthStatus = "disabled" | "loading" | "guest" | "signedIn";
export type SyncState = "idle" | "syncing" | "synced" | "error";

type AuthStore = {
  /** disabled = Supabase の環境変数が無くゲスト専用 */
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  syncState: SyncState;
  set: (patch: Partial<Omit<AuthStore, "set">>) => void;
};

export const useAuth = create<AuthStore>()((set) => ({
  status: "loading",
  userId: null,
  email: null,
  syncState: "idle",
  set: (patch) => set(patch),
}));
