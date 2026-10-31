"use client";

import type { AnyRun } from "@/lib/events";
import type { BingoStep } from "@/lib/events/bingo";
import type { BossStep } from "@/lib/events/boss";
import type { StampStep } from "@/lib/events/stamp";
import type { SugorokuStep } from "@/lib/events/sugoroku";
import { BingoCard, BossView, StampBook, SugorokuBoard } from "./Boards";

/** イベントの種類に合った盤面。step を渡すと、そのプレイの分だけ進む演出をする */
export function EventBoard({
  result,
  week,
  step,
  skip,
  onDone,
}: {
  result: AnyRun;
  week: string;
  step?: unknown;
  skip?: boolean;
  onDone?: () => void;
}) {
  const common = { week, skip, onDone };
  switch (result.id) {
    case "sugoroku":
      return <SugorokuBoard {...common} state={result.run.state} step={step as SugorokuStep | undefined} />;
    case "bingo":
      return <BingoCard {...common} state={result.run.state} step={step as BingoStep | undefined} />;
    case "boss":
      return <BossView {...common} state={result.run.state} step={step as BossStep | undefined} />;
    case "stamp":
      return <StampBook {...common} state={result.run.state} step={step as StampStep | undefined} />;
  }
}
