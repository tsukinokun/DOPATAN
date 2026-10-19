"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { speak } from "@/lib/fx/audio";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { POS_LABEL } from "@/lib/types";
import { WORDS } from "@/lib/words";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { useProgress, type SessionResult } from "@/stores/progress";

export default function ResultPage() {
  return (
    <Hydrated>
      <Result />
    </Hydrated>
  );
}

const byId = new Map(WORDS.map((w) => [w.id, w]));

function Result() {
  const result = useProgress((s) => s.lastResult);
  if (!result) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4">
        <p className="text-xl font-black text-white">まだプレイ記録がありません</p>
        <PopButton href="/play">▶ PLAY</PopButton>
      </main>
    );
  }
  return <ResultView result={result} />;
}

function ResultView({ result }: { result: SessionResult }) {
  const level = useEffectLevel();
  const total = result.correct + result.wrong;
  const accuracy = total === 0 ? 0 : Math.round((result.correct / total) * 100);

  // 単語ごとに、そのセッションで1回でも間違えたかをまとめる
  const words = new Map<string, boolean>();
  for (const a of result.answers) words.set(a.senseId, (words.get(a.senseId) ?? true) && a.correct);

  useEffect(() => {
    if (result.newRecord) {
      burstConfetti(level, { x: 0.5, y: 0.3 }, 2);
    }
  }, [level, result.newRecord]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <motion.h1
        initial={{ scale: 2, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: -3, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 14 }}
        className="text-center text-5xl font-black text-yellow-300 text-stroke-lg"
      >
        RESULT
      </motion.h1>

      <Panel className="flex flex-col items-center gap-1">
        {result.newRecord && (
          <span className="rainbow-text text-2xl font-black" data-testid="new-record">
            NEW RECORD!!
          </span>
        )}
        <span className="text-xs font-black text-slate-500">SCORE</span>
        <CountUp value={result.score} />
        <div className="mt-2 grid w-full grid-cols-3 text-center">
          <Mini label="正解率" value={`${accuracy}%`} />
          <Mini label="最大コンボ" value={`${result.maxCombo}`} />
          <Mini label="フィーバー" value={`${result.feverCount}回`} />
        </div>
      </Panel>

      <div className="flex gap-3">
        <PopButton href="/play" className="flex-1 text-xl" testId="play-again">
          もう一回!
        </PopButton>
        <PopButton href="/" color="white" className="flex-1 text-xl">
          ホーム
        </PopButton>
      </div>

      <h2 className="mt-2 text-xl font-black text-white text-stroke">今回の単語</h2>
      <ul className="flex flex-col gap-3" data-testid="result-words">
        {[...words].map(([id, ok]) => {
          const w = byId.get(id);
          if (!w) return null;
          return (
            <li key={id}>
              <Panel className="flex gap-3">
                <span className="text-4xl" aria-hidden>
                  {w.emoji}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-xl font-black ${ok ? "text-slate-900" : "text-pink-600"}`}>
                      {ok ? "⭕" : "❌"} {w.word}
                    </span>
                    <span className="text-sm text-slate-500">{w.ipa}</span>
                    <button
                      type="button"
                      onClick={() => speak(w.word)}
                      aria-label={`${w.word} を再生`}
                      className="text-lg"
                    >
                      🔊
                    </button>
                  </div>
                  <span className="font-black">
                    <span className="mr-1 rounded bg-slate-900 px-1 text-xs text-white">{POS_LABEL[w.pos]}</span>
                    {w.ja}
                  </span>
                  <p className="text-sm text-slate-700">
                    {w.example.en}
                    <br />
                    <span className="text-slate-500">{w.example.ja}</span>
                  </p>
                  {w.derivatives.length > 0 && (
                    <p className="text-xs text-slate-500">派生語: {w.derivatives.join(" / ")}</p>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function CountUp({ value }: { value: number }) {
  const count = useMotionValue(0);
  const text = useTransform(count, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [count, value]);
  return (
    <motion.span data-testid="result-score" className="text-5xl font-black tabular-nums text-pink-500">
      {text}
    </motion.span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <span className="text-xl font-black">{value}</span>
    </div>
  );
}
