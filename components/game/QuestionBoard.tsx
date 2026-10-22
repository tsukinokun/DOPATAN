"use client";

import { motion, type PanInfo } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { speak } from "@/lib/fx/audio";
import type { Question } from "@/lib/session";
import type { WordSense } from "@/lib/types";
import { PictureCard, WordChip, type CardState } from "./cards";

export type Feedback = { chosenId: string; correct: boolean };

type Props = {
  question: Question;
  showJapanese: boolean;
  feedback: Feedback | null;
  onAnswer: (chosenId: string, targetRect: DOMRect | undefined) => void;
  onPickup?: () => void;
};

/**
 * 上の「持ち上げるもの」を下の選択肢のどれかに重ねて答える(Drops 方式)。
 * PC では数字キー(1〜4)でも選べる。
 */
export function QuestionBoard({ question, showJapanese, feedback, onAnswer, onPickup }: Props) {
  const { target, options, mode, isIntro } = question;
  const targetRefs = useRef(new Map<string, HTMLElement>());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const locked = feedback !== null;

  const hitTest = useCallback((info: PanInfo): string | null => {
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;
    for (const [id, el] of targetRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  const answer = useCallback(
    (id: string) => onAnswer(id, targetRefs.current.get(id)?.getBoundingClientRect()),
    [onAnswer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        answer(options[index].id);
      } else if (options.length === 1 && (e.key === "Enter" || e.key === " ")) {
        answer(options[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, locked, options]);

  const stateFor = (sense: WordSense): CardState => {
    if (feedback) {
      if (sense.id === feedback.chosenId) return feedback.correct ? "correct" : "wrong";
      if (!feedback.correct && sense.id === target.id) return "reveal";
      return "idle";
    }
    return hoverId === sense.id ? "hover" : "idle";
  };

  const sourceHidden = feedback?.correct === true;
  /** 下の選択肢が絵か(英単語→絵、リスニング)、英単語か(絵→英単語) */
  const picturesBelow = mode !== "pictureToWord";
  const grid =
    options.length === 1 ? "grid-cols-1 max-w-[16rem]" : "grid-cols-2 max-w-xl";

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-6 px-4 pb-8 pt-4">
      <div className="relative flex min-h-40 w-full items-center justify-center">
        <motion.div
          key={question.step}
          data-testid="drag-source"
          drag={!locked}
          dragSnapToOrigin
          dragElastic={0.9}
          dragMomentum={false}
          whileDrag={{ scale: 1.12, rotate: -4, zIndex: 50 }}
          initial={{ scale: 0.3, opacity: 0, y: -30 }}
          animate={
            sourceHidden
              ? { scale: 0, opacity: 0, transition: { duration: 0.2 } }
              : { scale: 1, opacity: 1, y: 0 }
          }
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          onDragStart={onPickup}
          onDrag={(_, info) => setHoverId(hitTest(info))}
          onDragEnd={(_, info) => {
            setHoverId(null);
            const hit = hitTest(info);
            if (hit) answer(hit);
          }}
          onTap={mode === "listening" ? () => speak(target.word) : undefined}
          className={`relative cursor-grab touch-none active:cursor-grabbing ${
            mode === "pictureToWord" ? "h-40 w-40" : "min-w-44"
          }`}
        >
          {mode === "wordToPicture" && <WordChip sense={target} />}
          {mode === "pictureToWord" && <PictureCard sense={target} showJapanese={showJapanese} size="lg" />}
          {mode === "listening" && <SpeakerChip />}
          {isIntro && !locked && <SwipeHint />}
        </motion.div>
      </div>

      {/* 4枚の絵カードが縦に収まるよう、画面の高さに合わせて幅を抑える */}
      <div
        className={`grid w-full gap-4 ${grid}`}
        style={picturesBelow && options.length > 2 ? { maxWidth: "min(36rem, calc(100dvh - 24rem))" } : undefined}
      >
        {options.map((sense, i) => (
          <motion.div
            key={`${question.step}-${sense.id}`}
            ref={(el) => {
              if (el) targetRefs.current.set(sense.id, el);
              else targetRefs.current.delete(sense.id);
            }}
            data-testid={sense.id === target.id ? "drop-correct" : "drop-wrong"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              stateFor(sense) === "wrong"
                ? { scale: 1, opacity: 1, x: [0, -14, 14, -10, 10, 0] }
                : { scale: 1, opacity: 1, x: 0 }
            }
            transition={{ delay: feedback ? 0 : i * 0.05, type: "spring", stiffness: 420, damping: 20 }}
            className={`relative ${picturesBelow ? "aspect-square" : "h-24"}`}
          >
            {picturesBelow ? (
              <PictureCard
                sense={sense}
                showJapanese={showJapanese}
                state={stateFor(sense)}
                revealWord={stateFor(sense) === "reveal"}
                size={options.length === 1 ? "lg" : "md"}
              />
            ) : (
              <WordChip sense={sense} state={stateFor(sense)} />
            )}
            {options.length > 1 && (
              <span className="pointer-events-none absolute bottom-1 right-2 hidden text-xs font-black text-slate-900/40 sm:block">
                {i + 1}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** リスニングで持ち上げる「音」。タップするともう一度聞ける */
function SpeakerChip() {
  return (
    <div className="pop-border flex h-full w-full flex-col items-center justify-center rounded-3xl bg-white px-6 py-3" data-testid="speaker">
      <span className="text-5xl" aria-hidden>
        🔊
      </span>
      <span className="text-xs font-black text-slate-500">タップでもう一度</span>
    </div>
  );
}

function SwipeHint() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 text-4xl"
      animate={{ y: [0, 40, 0], opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    >
      👇
    </motion.div>
  );
}
