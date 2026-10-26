"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "@/lib/random";
import type { Question } from "@/lib/session";
import { PictureCard } from "./cards";
import type { Feedback } from "./QuestionBoard";
import { HandDemo } from "./Tutorial";

/** つづり並べ替えで間違えたときに onAnswer に渡す ID(正解の ID と一致しない) */
export const WRONG_SPELLING = "__wrong_spelling__";

type Props = {
  question: Question;
  showJapanese: boolean;
  feedback: Feedback | null;
  onAnswer: (chosenId: string, targetRect: DOMRect | undefined) => void;
  onPickup?: () => void;
  /** 一時停止中は操作を受け付けない */
  paused?: boolean;
  /** 遊び方の説明の直後は、指の動きを見せる */
  demo?: boolean;
};

/**
 * 絵と日本語を見て、バラバラの文字をタップして英単語を作る。PC ではキーボードでも打てる。
 * 1文字でも違う文字を選んだら、その時点で不正解にする。
 */
export function SpellingBoard({ question, showJapanese, feedback, onAnswer, onPickup, paused = false, demo = false }: Props) {
  const word = question.target.word.toLowerCase();
  const tiles = useMemo(
    () => shuffle([...word].map((letter, i) => ({ letter, key: i })), Math.random),
    [word],
  );
  const [used, setUsed] = useState<number[]>([]);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const locked = feedback !== null || paused;
  const typed = used.map((k) => tiles.find((t) => t.key === k)!.letter).join("");

  const press = (key: number) => {
    if (locked || used.includes(key)) return;
    const tile = tiles.find((t) => t.key === key)!;
    onPickup?.();
    if (tile.letter !== word[typed.length]) {
      setWrongKey(key);
      onAnswer(WRONG_SPELLING, undefined);
      return;
    }
    const next = [...used, key];
    setUsed(next);
    if (next.length === word.length) onAnswer(question.target.id, slotsRef.current?.getBoundingClientRect());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      const letter = e.key.toLowerCase();
      // 同じ文字が複数あるときは、まだ使っていないものから選ぶ。どれも無ければ違う文字として扱う
      const tile =
        tiles.find((t) => t.letter === letter && !used.includes(t.key)) ?? tiles.find((t) => !used.includes(t.key));
      if (!tile) return;
      if (tile.letter !== letter) {
        setWrongKey(tile.key);
        onAnswer(WRONG_SPELLING, undefined);
        return;
      }
      press(tile.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const revealed = feedback && !feedback.correct;
  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-6 px-4 pb-8 pt-4" data-testid="spelling-board" data-sfx="off">
      <div className="h-40 w-40">
        <PictureCard sense={question.target} showJapanese={showJapanese} size="lg" />
      </div>

      <div ref={slotsRef} className="flex flex-wrap justify-center gap-1.5" data-testid="spelling-slots">
        {[...word].map((letter, i) => {
          const filled = revealed ? letter : typed[i];
          return (
            <motion.span
              key={i}
              animate={filled ? { scale: [1.3, 1] } : { scale: 1 }}
              className={`grid h-11 w-9 place-items-center rounded-xl border-[3px] border-slate-900 text-2xl font-black sm:h-12 sm:w-10 ${
                revealed ? "bg-lime-300" : filled ? "bg-yellow-300" : "bg-white/70"
              }`}
            >
              {filled ?? ""}
            </motion.span>
          );
        })}
      </div>

      <div className="relative flex max-w-md flex-wrap justify-center gap-2">
        {demo && !locked && used.length === 0 && <HandDemo gesture="tap" />}
        {tiles.map((t) => (
          <motion.button
            key={t.key}
            type="button"
            disabled={locked || used.includes(t.key)}
            onClick={() => press(t.key)}
            data-testid={`tile-${t.letter}`}
            animate={wrongKey === t.key ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
            whileTap={{ scale: 0.9 }}
            className={`pop-border grid h-14 w-12 place-items-center rounded-2xl text-3xl font-black transition-opacity ${
              wrongKey === t.key ? "bg-red-400 text-white" : "bg-white"
            } ${used.includes(t.key) ? "opacity-20" : ""}`}
          >
            {t.letter}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
