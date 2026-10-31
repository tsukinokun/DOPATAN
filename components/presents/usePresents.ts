"use client";

import { useState } from "react";
import { APP_PRESENTS } from "@/lib/presents/catalog";
import { pendingPresents, type Present } from "@/lib/presents/presents";
import { useSocial } from "@/stores/social";
import { useWallet } from "@/stores/wallet";

/** まだ受け取っていないプレゼント(コードのもの+サーバーから届いたもの) */
export function usePendingPresents(): { pending: Present[]; now: number } {
  const [now] = useState(Date.now);
  const ledger = useWallet((s) => s.ledger);
  const serverPresents = useSocial((s) => s.serverPresents);
  return { pending: pendingPresents([...APP_PRESENTS, ...serverPresents], ledger, now), now };
}
