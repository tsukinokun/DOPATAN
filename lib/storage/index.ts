import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * 保存先の窓口。フェーズ1は端末内(localStorage)だけ。
 * フェーズ2でここを Supabase との同期つきの実装に差し替える。
 */
const localStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // 容量超過やプライベートモードでは保存できないが、プレイは続けられる
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

export const appStorage = createJSONStorage(() => localStateStorage);
