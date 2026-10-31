"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CurrencyBar } from "@/components/economy/CurrencyBar";
import { PopAmount } from "@/components/economy/RewardList";
import { usePendingPresents } from "@/components/presents/usePresents";
import { RewardChips } from "@/components/presents/RewardChips";
import { SkinCard } from "@/components/skins/SkinCard";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { skinCopies, TICKET_KINDS } from "@/lib/economy/ledger";
import { sfx } from "@/lib/fx/audio";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { expiryLabel, isUrgent, presentEventId, receivedPresents, type Present } from "@/lib/presents/presents";
import { getSkin } from "@/lib/skins";
import { useSettings } from "@/stores/settings";
import { useWallet } from "@/stores/wallet";

export default function PresentsPage() {
  return (
    <Hydrated>
      <Presents />
    </Hydrated>
  );
}

/** 受け取りダイアログに出す1件分。スキンは受け取る前後の枚数も持つ(レベルのバーを溜める演出用) */
type Received = { present: Present; skinFrom?: number; skinTo?: number };

function Presents() {
  const { pending, now } = usePendingPresents();
  const ledger = useWallet((s) => s.ledger);
  const [tab, setTab] = useState<"pending" | "received">("pending");
  const [received, setReceived] = useState<Received[] | null>(null);
  const level = useEffectLevel();

  const receive = (presents: Present[]) => {
    const before = skinCopies(useWallet.getState().ledger);
    const fresh = new Set(useWallet.getState().receivePresents(presents).map((e) => e.id));
    const items: Received[] = [];
    for (const present of presents) {
      if (!fresh.has(presentEventId(present))) continue;
      const skin = present.skin && getSkin(present.skin) ? present.skin : undefined;
      if (!skin) {
        items.push({ present });
        continue;
      }
      const from = before.get(skin) ?? 0;
      before.set(skin, from + 1);
      items.push({ present, skinFrom: from, skinTo: from + 1 });
    }
    if (items.length === 0) return;
    if (useSettings.getState().sound) sfx.coin();
    burstConfetti(level, { x: 0.5, y: 0.4 }, 1.2);
    setReceived(items);
  };

  const history = receivedPresents(ledger);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <h1 className="text-3xl font-black text-white text-stroke">プレゼント</h1>
      </header>

      <CurrencyBar now={now} />

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["pending", `🎁 未受け取り (${pending.length})`],
            ["received", "📜 受け取り済み"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            data-testid={`presents-tab-${key}`}
            className={`pop-border rounded-2xl py-2 font-black ${tab === key ? "bg-slate-900 text-yellow-300" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <>
          <button
            type="button"
            disabled={pending.length === 0}
            onClick={() => receive(pending)}
            data-testid="presents-receive-all"
            className="pop-border rounded-2xl bg-pink-400 py-3 text-lg font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            すべて受け取る
          </button>
          {pending.length === 0 ? (
            <Panel className="py-10 text-center font-black text-slate-500">プレゼントはありません</Panel>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {pending.map((p) => (
                  <motion.li
                    key={`${p.source}:${p.id}`}
                    layout
                    exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.25 } }}
                  >
                    <PresentCard present={p} now={now} onReceive={() => receive([p])} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      ) : history.length === 0 ? (
        <Panel className="py-10 text-center font-black text-slate-500">まだ受け取ったプレゼントはありません</Panel>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="presents-history">
          {history.map((e) => (
            <li key={e.id}>
              <Panel className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 font-black leading-tight">{e.label.replace(/^プレゼント:/, "")}</span>
                  <span className="shrink-0 text-xs font-black text-slate-500">{formatDate(e.at)} 受け取り</span>
                </div>
                <RewardChips coins={e.coins} gems={e.gems} xp={e.xp} skin={e.skin} tickets={e.tickets} />
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>{received && <ReceivedDialog items={received} onClose={() => setReceived(null)} />}</AnimatePresence>
    </main>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function PresentCard({ present: p, now, onReceive }: { present: Present; now: number; onReceive: () => void }) {
  const [open, setOpen] = useState(false);
  const expiry = expiryLabel(p.expiresAt, now);
  const long = (p.message?.length ?? 0) > 60;
  return (
    <Panel className="flex flex-col gap-2" testId={`present-${p.source}-${p.id}`}>
      <div className="flex items-start gap-3">
        <motion.span
          className="text-4xl"
          aria-hidden
          animate={{ rotate: [0, -10, 10, -6, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2.5 }}
        >
          🎁
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-black leading-tight">{p.title}</span>
          {p.message && (
            <p className={`whitespace-pre-wrap text-sm text-slate-600 ${long && !open ? "line-clamp-2" : ""}`}>{p.message}</p>
          )}
          {long && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-xs font-black text-sky-600">
              {open ? "とじる" : "もっと見る"}
            </button>
          )}
        </div>
      </div>
      <RewardChips coins={p.coins} gems={p.gems} xp={p.xp} skin={p.skin} tickets={p.tickets} />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-black ${isUrgent(p.expiresAt, now) ? "text-pink-600" : "text-slate-500"}`}>
          {expiry ? `⏰ ${expiry}` : "期限なし"}
        </span>
        <button
          type="button"
          onClick={onReceive}
          data-testid={`present-receive-${p.id}`}
          className="pop-border rounded-xl bg-yellow-300 px-5 py-1.5 font-black"
        >
          受け取る
        </button>
      </div>
    </Panel>
  );
}

/** 受け取った中身が跳ねて出てくるダイアログ。スキンはレベルのバーが溜まる */
function ReceivedDialog({ items, onClose }: { items: Received[]; onClose: () => void }) {
  const total = (key: "coins" | "gems" | "xp") => items.reduce((n, { present }) => n + (present[key] ?? 0), 0);
  const coins = total("coins");
  const gems = total("gems");
  const xp = total("xp");
  const skins = items.filter((i) => i.skinTo !== undefined);
  const tickets = TICKET_KINDS.map((k) => [k, items.reduce((n, { present }) => n + (present.tickets?.[k] ?? 0), 0)] as const).filter(
    ([, n]) => n > 0,
  );
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-slate-950/80 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-testid="present-received-dialog"
    >
      <motion.div
        className="pop-border my-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-6 text-center"
        initial={{ scale: 0.4, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="rainbow-text text-2xl font-black">プレゼントを受け取りました!</span>
        <motion.span
          className="text-6xl"
          aria-hidden
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
          transition={{ duration: 0.5 }}
        >
          🎁
        </motion.span>
        <div className="flex flex-wrap justify-center gap-3 text-3xl font-black">
          {coins > 0 && <PopAmount delay={0.3}>🪙+{coins.toLocaleString()}</PopAmount>}
          {gems > 0 && (
            <PopAmount delay={0.45}>
              <span className="text-sky-500 text-stroke">💎+{gems.toLocaleString()}</span>
            </PopAmount>
          )}
          {xp > 0 && (
            <PopAmount delay={0.6}>
              <span className="text-amber-500">⭐+{xp.toLocaleString()}XP</span>
            </PopAmount>
          )}
        </div>
        {skins.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-2">
            {skins.map((i, n) => {
              const skin = getSkin(i.present.skin!)!;
              return (
                <SkinCard
                  key={`${i.present.id}-${n}`}
                  skin={skin}
                  copies={i.skinTo}
                  fromCopies={i.skinFrom ? i.skinFrom : undefined}
                  fillDelay={0.8 + n * 0.2}
                  footer={
                    <span className="text-xs font-black text-pink-600">{i.skinFrom ? "かぶり +1" : "NEW!"}</span>
                  }
                />
              );
            })}
          </div>
        )}
        {tickets.length > 0 && (
          <PopAmount delay={0.75}>
            <RewardChips tickets={Object.fromEntries(tickets)} />
          </PopAmount>
        )}
        <ul className="w-full text-left text-sm font-black text-slate-600">
          {items.map(({ present }) => (
            <li key={`${present.source}:${present.id}`} className="truncate">
              🎁 {present.title}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          data-testid="present-received-close"
          className="pop-border w-full rounded-2xl bg-yellow-300 py-3 text-xl font-black"
        >
          OK
        </button>
      </motion.div>
    </motion.div>
  );
}
