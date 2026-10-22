"use client";

import { useState } from "react";
import { SkinCard } from "@/components/skins/SkinCard";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { ownedSkins } from "@/lib/economy/ledger";
import { ACHIEVEMENTS, achievementEventId } from "@/lib/economy/rewards";
import { setSoundSkin, sfx, unlockAudio } from "@/lib/fx/audio";
import { CATEGORY_LABEL, SKINS, skinOf, type SkinCategory, type SoundLook } from "@/lib/skins";
import { achievementContext, useWallet } from "@/stores/wallet";

export default function CollectionPage() {
  return (
    <Hydrated>
      <Collection />
    </Hydrated>
  );
}

function Collection() {
  const [tab, setTab] = useState<"skins" | "achievements">("skins");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <h1 className="text-3xl font-black text-white text-stroke">コレクション</h1>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["skins", "🎨 スキン"],
            ["achievements", "🏆 実績"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            data-testid={`collection-tab-${key}`}
            className={`pop-border rounded-2xl py-2 font-black ${tab === key ? "bg-slate-900 text-yellow-300" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "skins" ? <Skins /> : <Achievements />}
    </main>
  );
}

/** 効果音セットを一瞬だけ切り替えて鳴らす */
function preview(look: SoundLook, current: SoundLook) {
  unlockAudio();
  setSoundSkin(look);
  sfx.correct(4);
  setSoundSkin(current);
}

function Skins() {
  const ledger = useWallet((s) => s.ledger);
  const equipped = useWallet((s) => s.equipped);
  const equip = useWallet((s) => s.equip);
  const owned = ownedSkins(ledger);

  return (
    <>
      <p className="text-center text-sm font-black text-white text-stroke">
        {owned.size} / {SKINS.length} 種類を集めた
      </p>
      {(Object.keys(CATEGORY_LABEL) as SkinCategory[]).map((category) => {
        const current = skinOf(category, equipped[category]);
        return (
          <Panel key={category} className="flex flex-col gap-3">
            <h2 className="font-black">{CATEGORY_LABEL[category]}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SKINS.filter((s) => s.category === category).map((skin) => {
                const have = owned.has(skin.id);
                const isEquipped = current.id === skin.id;
                return (
                  <SkinCard
                    key={skin.id}
                    skin={skin}
                    locked={!have}
                    footer={
                      have && (
                        <div className="mt-auto flex gap-1">
                          <button
                            type="button"
                            disabled={isEquipped}
                            onClick={() => equip(category, skin.id)}
                            data-testid={`equip-${skin.id}`}
                            className={`flex-1 rounded-lg border-2 border-slate-900 py-1 text-xs font-black ${
                              isEquipped ? "bg-emerald-300" : "bg-yellow-300"
                            }`}
                          >
                            {isEquipped ? "装備中" : "装備する"}
                          </button>
                          {skin.category === "sound" && (
                            <button
                              type="button"
                              aria-label={`${skin.name} を試聴`}
                              onClick={() => preview(skin.look, skinOf("sound", equipped.sound).look)}
                              className="rounded-lg border-2 border-slate-900 px-2 text-xs"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      )
                    }
                  />
                );
              })}
            </div>
          </Panel>
        );
      })}
    </>
  );
}

function Achievements() {
  const state = useWallet();
  const ledger = state.ledger;
  const context = achievementContext(state);
  const unlocked = ACHIEVEMENTS.filter((a) => ledger[achievementEventId(a.id)]).length;

  return (
    <Panel className="flex flex-col gap-3">
      <p className="font-black">
        {unlocked} / {ACHIEVEMENTS.length} 個を達成
      </p>
      <ul className="flex flex-col gap-3" data-testid="achievements">
        {ACHIEVEMENTS.map((a) => {
          const done = Boolean(ledger[achievementEventId(a.id)]);
          const value = Math.min(a.value(context), a.target);
          return (
            <li key={a.id} className={`flex flex-col gap-1 ${done ? "" : "opacity-80"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-black">
                  {done ? "🏆" : "🔒"} {a.label}
                </span>
                <span className="text-sm font-black text-slate-500">{done ? "達成!" : `💎${a.gems}`}</span>
              </div>
              <span className="text-xs text-slate-500">{a.description}</span>
              <div className="h-2.5 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
                <div
                  className={`h-full ${done ? "bg-amber-400" : "bg-sky-400"}`}
                  style={{ width: `${(value / a.target) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
