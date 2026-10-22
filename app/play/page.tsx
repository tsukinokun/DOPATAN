"use client";

import { useLayoutEffect, useState } from "react";
import { PlayScreen } from "@/components/game/PlayScreen";
import { Hydrated } from "@/components/ui";

export default function PlayPage() {
  // Next は離れたページを消さずに隠して残す(Activity)。そのままだと、やめたゲームが続きから再開してしまう。
  // 画面が隠れるときに番号を進めて、次に開いたときは新しいゲームとして作り直す。
  const [run, setRun] = useState(0);
  useLayoutEffect(() => () => setRun((n) => n + 1), []);

  return (
    <Hydrated>
      <PlayScreen key={run} />
    </Hydrated>
  );
}
