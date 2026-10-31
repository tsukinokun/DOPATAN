import type { Ledger, LedgerEvent } from "@/lib/economy/ledger";
import { getSkin } from "@/lib/skins";

/**
 * プレゼントボックスに届くもの。
 * app はコード(catalog.ts)に書いたもの、server は Supabase の presents テーブルから届いたもの。
 */
export type Present = {
  id: string;
  source: "app" | "server";
  title: string;
  message?: string;
  coins?: number;
  gems?: number;
  xp?: number;
  /** スキンの ID。持っていればかぶり扱いでレベルが上がる */
  skin?: string;
  /** 受け取れるようになる時刻(ミリ秒)。無ければすぐ */
  startsAt?: number;
  /** 受け取り期限(ミリ秒)。null か無ければ期限なし */
  expiresAt?: number | null;
};

const PREFIX = "present:";

/** 台帳のイベント ID。受け取ったかどうかはこの ID が台帳にあるかで決める */
export const presentEventId = (p: Pick<Present, "source" | "id">) => `${PREFIX}${p.source}:${p.id}`;

/** まだ受け取っていない、受け取れる期間中のプレゼント。期限が近い順、次に新しい順 */
export function pendingPresents(presents: readonly Present[], ledger: Ledger, now: number): Present[] {
  return presents
    .filter(
      (p) =>
        !ledger[presentEventId(p)] && (p.startsAt ?? 0) <= now && (p.expiresAt == null || p.expiresAt > now),
    )
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity) || (b.startsAt ?? 0) - (a.startsAt ?? 0));
}

/** 受け取ったときに台帳に入れるイベント。知らないスキンは入れない */
export function presentEvent(p: Present, now: number): LedgerEvent {
  const skin = p.skin && getSkin(p.skin) ? p.skin : undefined;
  return {
    id: presentEventId(p),
    at: now,
    label: `プレゼント:${p.title}`,
    ...(p.coins ? { coins: p.coins } : {}),
    ...(p.gems ? { gems: p.gems } : {}),
    ...(p.xp ? { xp: p.xp } : {}),
    ...(skin ? { skin } : {}),
  };
}

/** 受け取ったプレゼントの履歴(新しい順) */
export function receivedPresents(ledger: Ledger): LedgerEvent[] {
  return Object.values(ledger)
    .filter((e) => e.id.startsWith(PREFIX))
    .sort((a, b) => b.at - a.at);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 期限の表示。7日以内は残り時間、それより先は日付、期限なしは null */
export function expiryLabel(expiresAt: number | null | undefined, now: number): string | null {
  if (expiresAt == null) return null;
  const left = expiresAt - now;
  if (left <= DAY) return `あと${Math.max(1, Math.ceil(left / HOUR))}時間`;
  if (left <= 7 * DAY) return `あと${Math.ceil(left / DAY)}日`;
  const d = new Date(expiresAt);
  return `${d.getMonth() + 1}/${d.getDate()}まで`;
}

/** 期限が3日以内なら急ぎ(赤く出す) */
export const isUrgent = (expiresAt: number | null | undefined, now: number) =>
  expiresAt != null && expiresAt - now <= 3 * DAY;
