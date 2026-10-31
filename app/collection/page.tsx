"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Achievements } from "@/components/economy/Achievements";
import { SkinCard } from "@/components/skins/SkinCard";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { skinCopies, TICKET_KINDS, ticketBalance, type TicketKind } from "@/lib/economy/ledger";
import { TICKET_LABEL, usableTickets } from "@/lib/economy/tickets";
import { equippedPerks } from "@/lib/economy/perks";
import { setSoundSkin, sfx, unlockAudio } from "@/lib/fx/audio";
import {
  CATEGORY_LABEL,
  MAX_SKIN_LEVEL,
  PERK_KINDS,
  PERK_LABEL,
  SKINS,
  skinLevel,
  skinOf,
  type Skin,
  type SkinCategory,
  type SoundLook,
} from "@/lib/skins";
import { useSettings } from "@/stores/settings";
import { useWallet } from "@/stores/wallet";

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

const CATEGORIES = Object.keys(CATEGORY_LABEL) as SkinCategory[];
const TAB_LABEL: Record<SkinCategory, string> = { background: "🖼️ 背景", effect: "🎉 エフェクト", sound: "🔊 効果音" };

function Skins() {
  const ledger = useWallet((s) => s.ledger);
  const equipped = useWallet((s) => s.equipped);
  const equip = useWallet((s) => s.equip);
  const [category, setCategory] = useState<SkinCategory>("background");
  const copies = skinCopies(ledger);
  const current = skinOf(category, equipped[category]);
  const perks = equippedPerks(equipped, copies);
  const tickets = ticketBalance(ledger);
  const [ticketFor, setTicketFor] = useState<Skin | null>(null);
  /** チケットを使った直後のスキン(そのカードのバーが溜まる演出をする) */
  const [boost, setBoost] = useState<{ id: string; from: number; key: number } | null>(null);

  return (
    <>
      <p className="text-center text-sm font-black text-white text-stroke">
        {copies.size} / {SKINS.length} 種類を集めた
      </p>
      <Panel className="flex flex-col gap-2" testId="equipped-perks">
        <h2 className="font-black">装備中のスキン効果</h2>
        <div className="grid grid-cols-2 gap-1 text-sm font-black">
          {PERK_KINDS.map((k) => (
            <span key={k} className={`rounded-lg px-2 py-1 ${perks[k] > 0 ? "bg-emerald-100" : "bg-slate-100 text-slate-400"}`}>
              {PERK_LABEL[k]} +{perks[k]}%
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          かぶるとスキンのレベルが上がり、効果が強くなります。装備している3つの効果が合計されます。
        </p>
      </Panel>
      <Panel className="flex flex-col gap-1.5 py-3" testId="tickets">
        <h2 className="text-sm font-black">🎫 スキルチケット</h2>
        {TICKET_KINDS.some((k) => tickets[k] > 0) ? (
          <div className="flex flex-wrap gap-1.5">
            {TICKET_KINDS.filter((k) => tickets[k] > 0).map((k) => (
              <span key={k} className="rounded-lg border-2 border-slate-900 bg-yellow-50 px-2 text-xs font-black" data-testid={`ticket-${k}`}>
                {TICKET_LABEL[k]} ×{tickets[k]}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">イベントの報酬でもらえます。持っているスキンのかぶりを1枚増やせます。</p>
        )}
      </Panel>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => {
          const all = SKINS.filter((s) => s.category === c);
          const got = all.filter((s) => copies.has(s.id)).length;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              data-testid={`skin-tab-${c}`}
              className={`pop-border flex flex-col items-center rounded-2xl py-1.5 font-black ${
                category === c ? "bg-slate-900 text-yellow-300" : "bg-white"
              }`}
            >
              <span className="text-sm">{TAB_LABEL[c]}</span>
              <span className="text-[11px] tabular-nums opacity-80">
                {got}/{all.length}
              </span>
            </button>
          );
        })}
      </div>
      <Panel key={category} className="flex flex-col gap-3">
        <h2 className="font-black">{CATEGORY_LABEL[category]}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SKINS.filter((s) => s.category === category).map((skin) => {
            const have = copies.has(skin.id);
            const isEquipped = current.id === skin.id;
            const canTicket =
              have && skinLevel(copies.get(skin.id) ?? 0) < MAX_SKIN_LEVEL && usableTickets(tickets, skin).length > 0;
            const boosted = boost?.id === skin.id ? boost : null;
            return (
              <SkinCard
                key={boosted ? `${skin.id}-${boosted.key}` : skin.id}
                skin={skin}
                locked={!have}
                copies={copies.get(skin.id)}
                fromCopies={boosted?.from}
                fillDelay={0.2}
                footer={
                  !have ? (
                    skin.limited && <span className="text-[11px] font-black text-amber-600">🏆 イベント限定</span>
                  ) : (
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
                          data-sfx="off"
                          onClick={() => preview(skin.look, skinOf("sound", equipped.sound).look)}
                          className="rounded-lg border-2 border-slate-900 px-2 text-xs"
                        >
                          ▶
                        </button>
                      )}
                      {canTicket && (
                        <button
                          type="button"
                          aria-label={`${skin.name} にチケットを使う`}
                          onClick={() => setTicketFor(skin)}
                          data-testid={`ticket-open-${skin.id}`}
                          className="rounded-lg border-2 border-slate-900 bg-sky-200 px-1.5 text-xs"
                        >
                          🎫
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
      <AnimatePresence>
        {ticketFor && (
          <TicketDialog
            skin={ticketFor}
            tickets={tickets}
            onClose={() => setTicketFor(null)}
            onUse={(kind) => {
              const from = copies.get(ticketFor.id) ?? 0;
              if (useWallet.getState().spendTicket(kind, ticketFor.id)) {
                if (useSettings.getState().sound) sfx.coin();
                setBoost((b) => ({ id: ticketFor.id, from, key: (b?.key ?? 0) + 1 }));
              }
              setTicketFor(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** どのチケットを使うか選ぶ。万能チケットはもう一度押して確定する */
function TicketDialog({
  skin,
  tickets,
  onUse,
  onClose,
}: {
  skin: Skin;
  tickets: Record<TicketKind, number>;
  onUse: (kind: TicketKind) => void;
  onClose: () => void;
}) {
  const [confirmAny, setConfirmAny] = useState(false);
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-testid="ticket-dialog"
    >
      <motion.div
        className="pop-border flex w-full max-w-xs flex-col gap-3 rounded-3xl bg-white p-5"
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-center font-black">🎫 「{skin.name}」に使う</span>
        <span className="text-center text-xs text-slate-500">かぶりが1枚増えて、レベルに近づきます</span>
        {usableTickets(tickets, skin).map((k) => {
          const isAny = k === "ANY";
          return (
            <button
              key={k}
              type="button"
              onClick={() => (isAny && !confirmAny ? setConfirmAny(true) : onUse(k))}
              data-testid={`ticket-use-${k}`}
              className={`pop-border rounded-2xl py-2 font-black ${isAny ? (confirmAny ? "bg-pink-400 text-white" : "bg-violet-200") : "bg-yellow-300"}`}
            >
              {isAny && confirmAny ? "本当に万能チケットを使う" : `${TICKET_LABEL[k]}を使う(残り${tickets[k]})`}
            </button>
          );
        })}
        <button type="button" onClick={onClose} className="text-sm font-black text-slate-500">
          やめる
        </button>
      </motion.div>
    </motion.div>
  );
}
