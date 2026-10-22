"use client";

import { useEffect } from "react";
import { setSoundSkin } from "@/lib/fx/audio";
import { setEffectSkin } from "@/lib/fx/effects";
import { skinOf, type BackgroundLook } from "@/lib/skins";
import { useWallet } from "@/stores/wallet";

export function applyBackground(look: BackgroundLook, el: HTMLElement = document.documentElement): void {
  el.style.setProperty("--bg-from", look.from);
  el.style.setProperty("--bg-via", look.via);
  el.style.setProperty("--bg-to", look.to);
  el.style.setProperty("--bg-pattern", look.pattern ?? "none");
}

/** 装備中のスキンを、背景・紙吹雪・効果音に反映する */
export function SkinApplier() {
  const equipped = useWallet((s) => s.equipped);

  useEffect(() => {
    const background = skinOf("background", equipped.background);
    applyBackground(background.look);
    document.documentElement.dataset.background = background.id;
    setEffectSkin(skinOf("effect", equipped.effect).look);
    setSoundSkin(skinOf("sound", equipped.sound).look);
  }, [equipped]);

  return null;
}
