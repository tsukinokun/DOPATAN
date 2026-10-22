"use client";

import { useEffect } from "react";
import { sfx } from "@/lib/fx/audio";
import { useSettings } from "@/stores/settings";

const CLICKABLE = 'button, a[href], [role="button"], [role="switch"], [role="tab"], summary, input[type="checkbox"], input[type="radio"]';

/**
 * アプリ中のボタンやリンクを押したときに効果音を鳴らす。
 * 1つずつ書かなくて済むよう、画面全体のクリックを見て鳴らす。
 * 自分の音を持つ部分(ゲームの盤面など)は data-sfx="off" を付けると鳴らさない。
 */
export function UiSounds() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!useSettings.getState().sound) return;
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el || el.closest('[data-sfx="off"]')) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      if (el.getAttribute("aria-disabled") === "true") return;

      const pressed = el.getAttribute("aria-pressed") ?? el.getAttribute("aria-checked");
      if (pressed !== null) {
        // クリックの処理より先に呼ばれるので、今の状態の反対が押した後の状態
        sfx.toggle(pressed !== "true");
      } else if (el instanceof HTMLInputElement) {
        sfx.toggle(!el.checked);
      } else if (el.textContent?.trim() === "←") {
        sfx.back();
      } else {
        sfx.tap();
      }
    };
    // キャプチャで受けて、画面が切り替わる前に鳴らす
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
