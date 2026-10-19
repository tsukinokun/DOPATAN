"use client";

import { PlayScreen } from "@/components/game/PlayScreen";
import { Hydrated } from "@/components/ui";

export default function PlayPage() {
  return (
    <Hydrated>
      <PlayScreen />
    </Hydrated>
  );
}
