import { RARITY_ORDER, type Skin } from "@/lib/skins";
import type { TicketKind } from "./ledger";

export const TICKET_LABEL: Record<TicketKind, string> = {
  N: "Nチケット",
  R: "Rチケット",
  SR: "SRチケット",
  SSR: "SSRチケット",
  ANY: "万能チケット",
};

/** そのチケットがスキンに使えるか(同じレア度か、万能) */
export const ticketFits = (kind: TicketKind, skin: Skin) => kind === "ANY" || kind === skin.rarity;

/** そのスキンに今使えるチケット(持っている分だけ)。レア度別を先に、万能を最後に並べる */
export function usableTickets(balance: Record<TicketKind, number>, skin: Skin): TicketKind[] {
  return ([...RARITY_ORDER, "ANY"] as TicketKind[]).filter((k) => balance[k] > 0 && ticketFits(k, skin));
}
