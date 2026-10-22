"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CurrencyBar } from "@/components/economy/CurrencyBar";
import { GachaMachine } from "@/components/gacha/GachaMachine";
import { RarityBadge, RARITY_GLOW } from "@/components/skins/SkinCard";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { canAfford, GACHAS, skinRates, type GachaKind, type GachaResult, type Price } from "@/lib/economy/gacha";
import { balance } from "@/lib/economy/ledger";
import { unlockAudio } from "@/lib/fx/audio";
import { CATEGORY_LABEL } from "@/lib/skins";
import { useWallet } from "@/stores/wallet";

export default function GachaPage() {
  return (
    <Hydrated>
      <Gacha />
    </Hydrated>
  );
}

const priceLabel = (p: Price) => (p.coins ? `🪙${p.coins}` : `💎${p.gems}`);

function Gacha() {
  const [kind, setKind] = useState<GachaKind>("normal");
  const [last, setLast] = useState<{ id: number; count: 1 | 10; results: GachaResult[] } | null>(null);
  const [now] = useState(Date.now);
  const ledger = useWallet((s) => s.ledger);
  const wallet = balance(ledger);
  const def = GACHAS[kind];

  const pull = (count: 1 | 10) => {
    unlockAudio();
    const results = useWallet.getState().pull(kind, count, Math.random);
    if (results) setLast((prev) => ({ id: (prev?.id ?? 0) + 1, count, results }));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <h1 className="text-3xl font-black text-white text-stroke">ガチャ</h1>
      </header>

      <CurrencyBar now={now} />

      <div className="grid grid-cols-2 gap-2">
        {(["normal", "rare"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            data-testid={`gacha-tab-${k}`}
            className={`pop-border rounded-2xl py-2 font-black ${kind === k ? "bg-slate-900 text-yellow-300" : "bg-white"}`}
          >
            {GACHAS[k].name}
          </button>
        ))}
      </div>

      <Panel className="flex flex-col items-center gap-4">
        <MachineArt kind={kind} />
        <p className="text-center text-sm font-black text-slate-600">
          {kind === "normal" ? "プレイでもらえるコインで回せる" : "ジェムで回せる。SSR が出るのはこちらだけ!"}
          <br />
          10連は SR 以上が1つ確定
        </p>
        <div className="grid w-full grid-cols-2 gap-3">
          {([1, 10] as const).map((count) => {
            const price = count === 10 ? def.ten : def.single;
            const ok = canAfford(price, wallet);
            return (
              <button
                key={count}
                type="button"
                disabled={!ok}
                onClick={() => pull(count)}
                data-testid={`gacha-pull-${count}`}
                className="pop-border flex flex-col items-center rounded-2xl bg-yellow-300 py-3 font-black disabled:bg-slate-200 disabled:text-slate-400"
              >
                <span className="text-xl">{count === 1 ? "1回" : "10連"}</span>
                <span className="text-sm">{priceLabel(price)}</span>
                {!ok && <span className="text-[11px]">足りない…</span>}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <details>
          <summary className="cursor-pointer font-black">提供割合</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {skinRates(kind).map(({ skin, rate }) => (
              <li key={skin.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <RarityBadge rarity={skin.rarity} />
                  {skin.name}
                  <span className="text-xs text-slate-500">({CATEGORY_LABEL[skin.category]})</span>
                </span>
                <span className="tabular-nums">{(rate * 100).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            持っているスキンが出たときは、{kind === "normal" ? "コイン" : "ジェム"}が一部戻ってきます。
          </p>
        </details>
      </Panel>

      {last && (
        <GachaMachine
          key={last.id}
          results={last.results}
          onClose={() => setLast(null)}
          onAgain={
            canAfford(last.count === 10 ? def.ten : def.single, wallet) ? () => pull(last.count) : undefined
          }
        />
      )}
    </main>
  );
}

/** ガチャマシンの絵。中のカプセルがふわふわ動く */
function MachineArt({ kind }: { kind: GachaKind }) {
  const colors = kind === "normal" ? ["N", "R", "SR", "N", "R", "N"] : ["R", "SR", "SSR", "R", "SR", "R"];
  return (
    <div className="flex flex-col items-center">
      <div className="pop-border relative h-40 w-40 overflow-hidden rounded-full bg-sky-100/80">
        {colors.map((r, i) => (
          <motion.span
            key={i}
            className="absolute h-10 w-10 rounded-full border-[3px] border-slate-900"
            style={{
              background: `linear-gradient(${RARITY_GLOW[r as keyof typeof RARITY_GLOW]} 50%, white 50%)`,
              left: `${15 + (i % 3) * 25}%`,
              top: `${30 + Math.floor(i / 3) * 30}%`,
            }}
            animate={{ y: [0, -8, 0], rotate: [0, 20, -10, 0] }}
            transition={{ duration: 1.6 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <div className={`pop-border -mt-2 h-14 w-32 rounded-b-2xl ${kind === "normal" ? "bg-pink-400" : "bg-indigo-500"}`} />
    </div>
  );
}
