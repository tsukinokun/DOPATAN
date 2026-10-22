import { describe, expect, it } from "vitest";
import { EMPTY_WALLET } from "@/lib/economy/walletData";
import { mergeData, type SyncedData } from "./merge";

const p = (exposures: number, due: number) => ({ exposures, box: exposures, due, correct: exposures, wrong: 0 });

const local: SyncedData<{ showJapanese: boolean }> = {
  progress: { a: p(3, 100), b: p(1, 50), c: p(2, 10) },
  stats: { sessions: 4, bestScore: 900, bestCombo: 12 },
  settings: { showJapanese: true },
  wallet: null,
};

const remote: SyncedData<{ showJapanese: boolean }> = {
  progress: { a: p(5, 10), b: p(1, 80), d: p(1, 1) },
  stats: { sessions: 7, bestScore: 500, bestCombo: 20 },
  settings: { showJapanese: false },
  wallet: null,
};

describe("mergeData", () => {
  it("keeps the more practised record for each word", () => {
    const merged = mergeData(local, remote);
    expect(merged.progress.a.exposures).toBe(5);
    expect(merged.progress.b.due).toBe(80);
    expect(Object.keys(merged.progress).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("takes the best of each stat and prefers remote settings", () => {
    const merged = mergeData(local, remote);
    expect(merged.stats).toEqual({ sessions: 7, bestScore: 900, bestCombo: 20 });
    expect(merged.settings).toEqual({ showJapanese: false });
  });

  it("is idempotent", () => {
    const once = mergeData(local, remote);
    expect(mergeData(once, remote)).toEqual(once);
    expect(mergeData(once, once)).toEqual(once);
  });

  it("returns local data when the cloud has nothing yet", () => {
    expect(mergeData(local, null)).toBe(local);
    expect(mergeData(local, { ...remote, settings: null }).settings).toEqual(local.settings);
  });

  it("merges wallets so guest rewards and skins survive login", () => {
    const localWallet = {
      ...EMPTY_WALLET,
      ledger: { "login:d1": { id: "login:d1", at: 1, label: "", gems: 5 } },
      loginDates: ["d1"],
      equipped: { background: "bg-mint", effect: undefined, sound: undefined },
    };
    const remoteWallet = {
      ...EMPTY_WALLET,
      ledger: {
        "login:d1": { id: "login:d1", at: 2, label: "", gems: 5 },
        "gacha:x:0": { id: "gacha:x:0", at: 2, label: "", skin: "fx-fire" },
      },
      loginDates: ["d0"],
      equipped: { background: undefined, effect: "fx-fire", sound: undefined },
    };
    const merged = mergeData({ ...local, wallet: localWallet }, { ...remote, wallet: remoteWallet });
    expect(Object.keys(merged.wallet!.ledger).sort()).toEqual(["gacha:x:0", "login:d1"]);
    expect(merged.wallet!.loginDates).toEqual(["d0", "d1"]);
    expect(merged.wallet!.equipped).toEqual({ background: "bg-mint", effect: "fx-fire", sound: undefined });
    expect(mergeData(merged, { ...remote, wallet: remoteWallet })).toEqual(merged);
  });
});
