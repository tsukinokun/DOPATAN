"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { speak } from "@/lib/fx/audio";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { POS_LABEL } from "@/lib/types";
import { getWords } from "@/lib/words";
import { RewardList } from "@/components/economy/RewardList";
import { WordImage } from "@/components/game/cards";
import { totalXp, type LedgerEvent } from "@/lib/economy/ledger";
import { levelFromXp, rankFor, xpForLevel } from "@/lib/economy/rewards";
import { FillBar } from "@/components/fx/FillBar";
import { Ticker } from "@/components/fx/Ticker";
import type { FillPoint } from "@/lib/fx/fill";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { useWallet } from "@/stores/wallet";
import { useProgress, type SessionResult } from "@/stores/progress";

export default function ResultPage() {
  return (
    <Hydrated>
      <Result />
    </Hydrated>
  );
}


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
  const rewards = useWallet((s) => s.lastRewards);
  const total = result.correct + result.wrong;
  const accuracy = total === 0 ? 0 : Math.round((result.correct / total) * 100);

  const byId = new Map(getWords().map((w) => [w.id, w]));
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
        <Ticker
          value={result.score}
          from={0}
          duration={1.2}
          testId="result-score"
          className="text-5xl font-black tabular-nums text-pink-500"
        />
        <div className="mt-2 grid w-full grid-cols-3 text-center">
          <Mini label="正解率" value={`${accuracy}%`} />
          <Mini label="最大コンボ" value={`${result.maxCombo}`} />
          <Mini label="フィーバー" value={`${result.feverCount}回`} />
        </div>
      </Panel>

      <XpGain events={rewards} />
      <LevelUp events={rewards} />
      <RewardList events={rewards} />

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
                <WordImage sense={w} />
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <span className="text-xl font-black">{value}</span>
    </div>
  );
}

const XP_FILL_DELAY_S = 0.5;
const XP_FILL_STEP_S = 0.7;
/** 経験値バーが溜まり終わってから大きな LEVEL UP を出す */
const LEVEL_UP_DELAY_S = 2;

function xpPoint(xp: number): FillPoint {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  return { level, ratio: (xp - from) / (xpForLevel(level + 1) - from) };
}

function xpCount(level: number, ratio: number): string {
  const need = xpForLevel(level + 1) - xpForLevel(level);
  return `${Math.round(ratio * need)} / ${need} XP`;
}

/** 今回もらった経験値で、レベルのバーが溜まっていく */
function XpGain({ events }: { events: LedgerEvent[] }) {
  const ledger = useWallet((s) => s.ledger);
  const gained = events.reduce((sum, e) => sum + (e.xp ?? 0), 0);
  if (gained === 0) return null;
  const total = totalXp(ledger);
  return (
    <Panel className="flex flex-col gap-3" testId="xp-bar">
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">経験値</h2>
        <span className="text-xl font-black text-amber-500">
          ⭐ +<Ticker value={gained} from={0} delay={XP_FILL_DELAY_S} duration={1.2} testId="xp-gained" className="tabular-nums" />
          XP
        </span>
      </div>
      <FillBar
        start={xpPoint(total - gained)}
        end={xpPoint(total)}
        delay={XP_FILL_DELAY_S}
        stepSeconds={XP_FILL_STEP_S}
        size="lg"
        label={(level) => <span data-testid="xp-level">Lv.{level}</span>}
        count={xpCount}
      />
      <span className="text-right text-xs font-black text-slate-500">
        次のレベルまで あと {xpForLevel(levelFromXp(total) + 1) - total} XP
      </span>
    </Panel>
  );
}

/** このプレイでレベルが上がったときだけ出る */
function LevelUp({ events }: { events: LedgerEvent[] }) {
  const ledger = useWallet((s) => s.ledger);
  const gained = events.reduce((sum, e) => sum + (e.xp ?? 0), 0);
  const total = totalXp(ledger);
  const before = levelFromXp(total - gained);
  const after = levelFromXp(total);
  if (gained === 0 || after <= before) return null;
  const rank = rankFor(after);
  const rankUp = rankFor(before).title !== rank.title;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: -3 }}
      transition={{ delay: LEVEL_UP_DELAY_S, type: "spring", stiffness: 300, damping: 12 }}
      className="pop-border flex flex-col items-center rounded-3xl bg-slate-900 py-3 text-center"
      data-testid="level-up"
    >
      <span className="rainbow-text text-4xl font-black">LEVEL UP!</span>
      <span className="text-xl font-black text-white">
        Lv.{before} → Lv.{after}
      </span>
      {rankUp && (
        <span className="text-lg font-black text-yellow-300">
          {rank.emoji} ランクアップ:{rank.title}
        </span>
      )}
    </motion.div>
  );
}
