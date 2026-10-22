import type { LedgerEvent } from "@/lib/economy/ledger";
import { tierOf } from "./leagues";
import { displayName } from "./names";
import type { Inbox } from "./api";

export const INVITE_GEMS = 50;
export const CHEER_GEMS = 2;
/** 応援でジェムがもらえるのは、送る側・受け取る側それぞれ1日この回数まで */
export const CHEER_GEMS_PER_DAY = 5;

/** 1日ごとに、古い順で最初の CHEER_GEMS_PER_DAY 件だけを選ぶ */
function firstPerDay<T extends { day: string }>(items: T[]): T[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const n = counts.get(item.day) ?? 0;
    counts.set(item.day, n + 1);
    return n < CHEER_GEMS_PER_DAY;
  });
}

/**
 * サーバーの通知から、台帳に入れる報酬イベントを作る。
 * ID は内容から決まるので、何度作っても・どの端末で作っても同じになり、二重には受け取れない。
 */
export function rewardsFromInbox(inbox: Inbox, now: number): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const r of inbox.leagueRewards) {
    if (r.gems <= 0) continue;
    events.push({
      id: `league:${r.week}`,
      at: now,
      label: `リーグ報酬(${tierOf(r.tier).name} ${r.rank}位)`,
      gems: r.gems,
    });
  }
  if (inbox.invitedBy) {
    events.push({
      id: `invited:${inbox.invitedBy.id}`,
      at: now,
      label: `招待ボーナス(${displayName(inbox.invitedBy)}さんから)`,
      gems: INVITE_GEMS,
    });
  }
  for (const r of inbox.referrals) {
    if (!r.unlocked) continue;
    events.push({
      id: `invite:${r.invitee}`,
      at: now,
      label: `招待ボーナス(${displayName(r)}さんが参加)`,
      gems: INVITE_GEMS,
    });
  }
  for (const c of firstPerDay(inbox.cheersReceived)) {
    events.push({
      id: `cheer-from:${c.from}:${c.day}`,
      at: now,
      label: `応援をもらった(${displayName(c)}さん)`,
      gems: CHEER_GEMS,
    });
  }
  for (const c of firstPerDay(inbox.cheersSent)) {
    events.push({ id: `cheer-to:${c.to}:${c.day}`, at: now, label: "応援を送った", gems: CHEER_GEMS });
  }
  return events;
}
