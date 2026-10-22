import type { Rarity, Skin } from "@/lib/skins";

export const RARITY_STYLE: Record<Rarity, string> = {
  N: "bg-slate-200 text-slate-700",
  R: "bg-sky-300 text-sky-950",
  SR: "bg-amber-300 text-amber-950",
  SSR: "rainbow-bg text-white text-stroke",
};

/** ガチャのカプセルや光の色(レア度の予告に使う) */
export const RARITY_GLOW: Record<Rarity, string> = {
  N: "#e2e8f0",
  R: "#38bdf8",
  SR: "#fbbf24",
  SSR: "#ff3d7f",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`rounded-md border-2 border-slate-900 px-1.5 text-xs font-black ${RARITY_STYLE[rarity]}`}>
      {rarity}
    </span>
  );
}

/** スキンの見た目の小さな見本 */
export function SkinPreview({ skin, locked = false }: { skin: Skin; locked?: boolean }) {
  if (locked) {
    return <div className="grid h-full w-full place-items-center bg-slate-300 text-3xl font-black text-slate-500">?</div>;
  }
  if (skin.category === "background") {
    const { from, via, to, pattern } = skin.look;
    return (
      <div
        className="h-full w-full"
        style={{ background: `${pattern ? `${pattern}, ` : ""}linear-gradient(160deg, ${from}, ${via} 55%, ${to})` }}
      />
    );
  }
  if (skin.category === "effect") {
    return (
      <div className="flex h-full w-full flex-wrap items-center justify-center gap-1 bg-slate-900 p-1 text-2xl">
        {skin.look.emojis
          ? skin.look.emojis.map((e) => <span key={e}>{e}</span>)
          : skin.look.colors.map((c) => <span key={c} className="h-3 w-2 rotate-12 rounded-sm" style={{ background: c }} />)}
      </div>
    );
  }
  return <div className="grid h-full w-full place-items-center bg-indigo-100 text-3xl">🔊</div>;
}

export function SkinCard({ skin, locked = false, footer }: { skin: Skin; locked?: boolean; footer?: React.ReactNode }) {
  return (
    <div className="pop-border flex flex-col overflow-hidden rounded-2xl bg-white" data-testid={`skin-${skin.id}`}>
      <div className="relative h-20">
        <SkinPreview skin={skin} locked={locked} />
        <span className="absolute left-1 top-1">
          <RarityBadge rarity={skin.rarity} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="text-sm font-black leading-tight">{locked ? "???" : skin.name}</span>
        {!locked && <span className="text-[11px] leading-tight text-slate-500">{skin.description}</span>}
        {footer}
      </div>
    </div>
  );
}
