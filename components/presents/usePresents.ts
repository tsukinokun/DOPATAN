"use client";

import { useState } from "react";
import { eventPresents } from "@/lib/events";
import { APP_PRESENTS } from "@/lib/presents/catalog";
import { pendingPresents, type Present } from "@/lib/presents/presents";
import { useSocial } from "@/stores/social";
import { useWallet } from "@/stores/wallet";

/** まだ受け取っていないプレゼント(コードのもの+サーバーから届いたもの+イベントの報酬) */
export function usePendingPresents(): { pending: Present[]; now: number } {
  const [now] = useState(Date.now);
  const ledger = useWallet((s) => s.ledger);
  const serverPresents = useSocial((s) => s.serverPresents);
  const events = eventPresents(ledger, now);
  return { pending: pendingPresents([...APP_PRESENTS, ...serverPresents, ...events], ledger, now), now };
}
