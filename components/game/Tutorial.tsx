"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { PopButton } from "@/components/ui";
import type { QuestionMode } from "@/lib/types";

type Step = { icon: string; text: string };

/** 出題形式ごとの遊び方。その形式が初めて出たときに見せる */
export const MODE_TUTORIALS: Record<QuestionMode, { icon: string; title: string; steps: Step[] }> = {
  wordToPicture: {
    icon: "🔤",
    title: "英単語 → 絵",
    steps: [
      { icon: "🔊", text: "上に英単語が出て、発音が流れます" },
      { icon: "👆", text: "英単語を指でつかんで、意味が合う絵の上まで動かして離そう" },
      { icon: "⭕", text: "正解するともう一度発音が流れます。続けて正解するとコンボ!" },
      { icon: "⌨️", text: "PC では 1〜4 のキーでも選べます" },
    ],
  },
  pictureToWord: {
    icon: "🖼️",
    title: "絵 → 英単語",
    steps: [
      { icon: "🖼️", text: "上に絵が出ます。どの英単語の絵か考えよう" },
      { icon: "👆", text: "絵を指でつかんで、合う英単語の上まで動かして離そう" },
      { icon: "🔊", text: "答えた後に、正しい英単語の発音が流れます" },
      { icon: "⌨️", text: "PC では 1〜4 のキーでも選べます" },
    ],
  },
  listening: {
    icon: "🎧",
    title: "リスニング",
    steps: [
      { icon: "🔊", text: "問題が出ると英単語が読み上げられます。よく聞こう" },
      { icon: "👆", text: "聞き逃したら 🔊 をタップすると、もう一度聞けます" },
      { icon: "🖼️", text: "🔊 を指でつかんで、聞こえた単語の絵の上まで動かして離そう" },
    ],
  },
  spelling: {
    icon: "✏️",
    title: "つづり並べ替え",
    steps: [
      { icon: "🖼️", text: "絵と日本語を見て、英単語を思い出そう(発音も流れます)" },
      { icon: "👆", text: "下のバラバラの文字を、先頭から順番にタップしよう" },
      { icon: "❌", text: "1文字でも違う文字を選ぶと、その場で不正解になります" },
      { icon: "⌨️", text: "PC ではキーボードで打ってもOK" },
    ],
  },
};

/** その形式の遊び方の説明。閉じるまでゲームは止まる。Enter / Esc でも閉じる */
export function TutorialDialog({ mode, onClose }: { mode: QuestionMode | null; onClose: () => void }) {
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const tutorial = mode ? MODE_TUTORIALS[mode] : null;
  return (
    <AnimatePresence>
      {tutorial && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/70 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
          data-testid="tutorial-dialog"
        >
          <motion.div
            className="pop-border flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 text-slate-900"
            initial={{ scale: 0.6, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            <div className="text-center">
              <p className="text-xs font-black text-pink-500">あそびかた</p>
              <p className="text-5xl" aria-hidden>
                {tutorial.icon}
              </p>
              <h2 id="tutorial-title" className="text-2xl font-black">
                {tutorial.title}
              </h2>
            </div>
            <ol className="flex flex-col gap-2">
              {tutorial.steps.map((step, i) => (
                <motion.li
                  key={step.text}
                  className="flex items-start gap-3 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.12 }}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-black text-yellow-300">
                    {i + 1}
                  </span>
                  <span className="text-xl leading-none" aria-hidden>
                    {step.icon}
                  </span>
                  <span>{step.text}</span>
                </motion.li>
              ))}
            </ol>
            <p className="text-center text-xs font-bold text-slate-500">⏸ この問題に答えるまで、時間は止まっています</p>
            <PopButton color="yellow" onClick={onClose} className="text-xl" testId="tutorial-ok">
              やってみる!
            </PopButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 説明を閉じた後、実際の盤面の上で指の動きを見せる。
 * drag: つかんで下の選択肢へ動かす / tapThenDrag: 🔊 をタップしてから動かす / tap: その場でタップ
 */
export function HandDemo({ gesture: kind }: { gesture: "drag" | "tapThenDrag" | "tap" }) {
  const animate =
    kind === "tap"
      ? { y: [0, 12, 0, 0], scale: [1, 0.85, 1, 1], opacity: 1 }
      : kind === "drag"
        ? { y: [0, 0, 150, 150], opacity: [0, 1, 1, 0], scale: [1, 0.85, 0.85, 1] }
        : { y: [0, 10, 0, 0, 150, 150], opacity: [0, 1, 1, 1, 1, 0], scale: [1, 0.85, 1, 0.85, 0.85, 1] };
  return (
    <motion.div
      aria-hidden
      data-testid="hand-demo"
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 -ml-5 text-5xl drop-shadow-[0_3px_0_rgba(15,23,42,0.6)]"
      initial={{ opacity: 0 }}
      animate={animate}
      transition={{ duration: kind === "tapThenDrag" ? 2.4 : 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
    >
      👆
    </motion.div>
  );
}
