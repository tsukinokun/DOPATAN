import { RarityBadge } from "@/components/skins/SkinCard";
import { TICKET_KINDS, type Tickets } from "@/lib/economy/ledger";
import { TICKET_LABEL } from "@/lib/economy/tickets";
import { getSkin } from "@/lib/skins";

export type RewardContents = { coins?: number; gems?: number; xp?: number; skin?: string; tickets?: Tickets };

/** 報酬の中身のチップ(コイン・ジェム・経験値・チケット・スキン) */
export function RewardChips({ coins, gems, xp, skin, tickets, small = false }: RewardContents & { small?: boolean }) {
  const s = skin ? getSkin(skin) : undefined;
  const chip = `rounded-lg border-2 border-slate-900 bg-yellow-50 font-black ${small ? "px-1.5 text-[11px]" : "px-2 py-0.5 text-sm"}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {coins ? <span className={chip}>🪙 {coins.toLocaleString()}</span> : null}
      {gems ? <span className={chip}>💎 {gems.toLocaleString()}</span> : null}
      {xp ? <span className={chip}>⭐ {xp.toLocaleString()} XP</span> : null}
      {TICKET_KINDS.filter((k) => (tickets?.[k] ?? 0) > 0).map((k) => (
        <span key={k} className={chip}>
          🎫 {TICKET_LABEL[k]}
          {tickets![k]! > 1 ? ` ×${tickets![k]}` : ""}
        </span>
      ))}
      {s && (
        <span className={`${chip} flex items-center gap-1`}>
          <RarityBadge rarity={s.rarity} /> {s.name}
        </span>
      )}
    </div>
  );
}
