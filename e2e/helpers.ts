import { expect, type Page } from "@playwright/test";
import w600 from "../data/words/600.json";
import w730 from "../data/words/730.json";
import w860 from "../data/words/860.json";
import w990 from "../data/words/990.json";

export const ALL_IDS: string[] = [w600, w730, w860, w990].flat().map((w) => w.id);

const ALL_MODES = ["wordToPicture", "pictureToWord", "listening", "spelling"];

/** 出題形式を絞った設定を、ページを開く前に保存しておく */
export async function useModes(page: Page, modes: string[]) {
  await page.addInitScript(({ m, all }) => {
    if (localStorage.getItem("dopatan-settings")) return;
    localStorage.setItem(
      "dopatan-settings",
      JSON.stringify({
        state: {
          showJapanese: true,
          effectIntensity: "low",
          sound: true,
          bgm: false,
          vibration: false,
          modes: m,
          bands: [],
          themes: [],
          seenTutorials: all,
        },
        version: 1,
      }),
    );
  }, { m: modes, all: ALL_MODES });
}


/** 遊び方の説明を見終わった状態にする(説明の間は時間が止まるため)。useModes と一緒には使わない */
export async function skipTutorials(page: Page) {
  await page.addInitScript((modes) => {
    if (localStorage.getItem("dopatan-settings")) return;
    localStorage.setItem("dopatan-settings", JSON.stringify({ state: { seenTutorials: modes }, version: 1 }));
  }, ALL_MODES);
}

/** 全単語を学習済み(しばらく復習不要)にし、指定した1語だけを今すぐ復習する状態にする */
export async function onlyReview(page: Page, dueId: string) {
  await page.addInitScript(
    ({ ids, due }) => {
      if (localStorage.getItem("dopatan-progress")) return;
      const progress: Record<string, unknown> = {};
      for (const id of ids) progress[id] = { exposures: 3, box: 3, due: id === due ? 0 : 1e15, correct: 3, wrong: 0 };
      localStorage.setItem(
        "dopatan-progress",
        JSON.stringify({ state: { progress, sessions: 1, bestScore: 0, bestCombo: 0, lastResult: null }, version: 0 }),
      );
    },
    { ids: ALL_IDS, due: dueId },
  );
}

/** ホームを開き、その日最初に出るログインボーナスを閉じる */
export async function openHome(page: Page) {
  await page.goto("/");
  const receive = page.getByTestId("login-bonus-receive");
  await receive.click({ timeout: 5000 }).catch(() => {});
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
}
