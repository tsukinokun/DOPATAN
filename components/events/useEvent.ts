"use client";

import { useState } from "react";
import { eventAt, EVENTS, playsOfWeek, simulate, type EventId, type WeekEvent } from "@/lib/events";
import { useWallet } from "@/stores/wallet";

/** 開発中だけ、URL の ?event=bingo で今週のイベントを差し替えられる */
export function eventOverride(): EventId | undefined {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return undefined;
  const id = new URLSearchParams(window.location.search).get("event");
  return id && id in EVENTS ? (id as EventId) : undefined;
}

/** 今週のイベントと、その進み具合 */
export function useCurrentEvent() {
  const [now] = useState(Date.now);
  const [override] = useState(eventOverride);
  const ledger = useWallet((s) => s.ledger);
  const ev: WeekEvent = eventAt(now, override);
  const plays = playsOfWeek(ledger, ev.start);
  return { now, ev, plays, result: simulate(ev.id, plays, ev.week), rules: EVENTS[ev.id], ledger };
}
