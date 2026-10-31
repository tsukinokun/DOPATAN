"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FillBar } from "@/components/fx/FillBar";
import { sfx } from "@/lib/fx/audio";
import { useEffectLevel, vibrate } from "@/lib/fx/effects";
import { cardFor, CELLS, completedLines, LINES, SIZE, type BingoState, type BingoStep } from "@/lib/events/bingo";
import { BOSSES, bossAt, TOTAL_HP, type BossState, type BossStep } from "@/lib/events/boss";
import { PAGE_SIZE, PAGES, TOTAL_STAMPS, type StampState, type StampStep } from "@/lib/events/stamp";
import {
  BOARD,
  FORWARD_SQUARES,
  FORWARD_STEPS,
  milestoneSquare,
  type SugorokuState,
  type SugorokuStep,
} from "@/lib/events/sugoroku";
import { useSettings } from "@/stores/settings";

const playSound = (fn: () => void) => {
  if (useSettings.getState().sound) fn();
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 盤面の共通の props。step を渡すと、そのプレイの分だけ進む演出をする。
 * skip が true になったら、すぐ最後の状態にして onDone を呼ぶ。
 */
type BoardProps<S, D> = { week: string; state: S; step?: D; skip?: boolean; onDone?: () => void };

/** 演出を進める共通の仕組み。cancel されたら止まる */
function useSequence(run: ((alive: () => boolean) => Promise<void>) | null, skip: boolean, onDone?: () => void) {
  const quick = useEffectLevel() === "low";
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDoneRef.current?.();
  };
  const [runRef] = useState(() => run);
  useEffect(() => {
    if (!runRef || quick || skip) {
      finish();
      return;
    }
    let alive = true;
    void runRef(() => alive).then(() => {
      if (alive) finish();
    });
    return () => {
      alive = false;
    };
  }, [quick, skip, runRef]);
  return quick || skip || !runRef;
}

// ---- すごろく ----

const COLS = 10;
const CELL = 34;

/** マスの番号(1〜BOARD)を、蛇行する盤面の位置にする。0 はスタート(盤面の外の左上) */
function squarePos(n: number): { x: number; y: number } {
  if (n <= 0) return { x: -CELL * 0.1, y: -CELL };
  const i = n - 1;
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return { x: col * CELL, y: row * CELL };
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function SugorokuBoard({ state, step, skip = false, onDone }: BoardProps<SugorokuState, SugorokuStep>) {
  const [pos, setPos] = useState(step ? step.from : state.position);
  const [dice, setDice] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const instant = useSequence(
    step
      ? async (alive) => {
          setRolling(true);
          playSound(() => sfx.pickup());
          await wait(900);
          if (!alive()) return;
          setRolling(false);
          setDice(step.dice);
          playSound(() => sfx.coin());
          await wait(400);
          for (let n = step.from + 1; n <= step.landed; n++) {
            if (!alive()) return;
            setPos(n);
            playSound(() => sfx.tap());
            await wait(180);
          }
          if (step.to > step.landed) {
            setBanner(`⏩ ${FORWARD_STEPS}マス進む!`);
            playSound(() => sfx.comboMilestone());
            await wait(600);
            for (let n = step.landed + 1; n <= step.to; n++) {
              if (!alive()) return;
              setPos(n);
              await wait(160);
            }
            setBanner(null);
          }
          await wait(300);
        }
      : null,
    skip,
    onDone,
  );
  const shown = instant ? state.position : pos;
  const shownDice = instant && step ? step.dice : dice;
  const rows = Math.ceil(BOARD / COLS);
  const rewardSquares = new Set(
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, BOARD].map((n) => milestoneSquare(n === BOARD ? "goal" : `sq${n}`)),
  );
  const token = squarePos(shown);

  return (
    <div className="flex flex-col items-center gap-3">
      {step && (
        <div className="flex h-16 items-center gap-2 text-6xl" data-testid="sugoroku-dice">
          {rolling
            ? step.dice.map((_, i) => (
                <motion.span key={i} animate={{ rotate: [0, 360], y: [0, -14, 0] }} transition={{ duration: 0.3, repeat: Infinity }}>
                  🎲
                </motion.span>
              ))
            : shownDice?.map((d, i) => (
                <motion.span key={i} initial={{ scale: 0.3 }} animate={{ scale: [0.3, 1.3, 1] }} transition={{ duration: 0.35 }}>
                  {DICE_FACES[d - 1]}
                </motion.span>
              ))}
          {shownDice && !rolling && (
            <span className="ml-2 text-2xl font-black text-white text-stroke">{shownDice.reduce((a, b) => a + b, 0)}マス!</span>
          )}
        </div>
      )}
      <div className="relative pt-9" style={{ width: COLS * CELL }}>
        <div className="relative" style={{ height: rows * CELL }}>
          {Array.from({ length: BOARD }, (_, i) => {
            const n = i + 1;
            const { x, y } = squarePos(n);
            const passed = n <= shown;
            const reward = rewardSquares.has(n);
            const forward = FORWARD_SQUARES.includes(n);
            return (
              <div
                key={n}
                className={`absolute grid place-items-center rounded-md border-2 border-slate-900 text-[10px] font-black ${
                  passed ? "bg-emerald-300" : reward ? "bg-yellow-200" : forward ? "bg-sky-200" : "bg-white"
                }`}
                style={{ left: x + 1, top: y + 1, width: CELL - 2, height: CELL - 2 }}
              >
                {n === BOARD ? "🏁" : reward ? (passed ? "✅" : "🎁") : forward ? "⏩" : n}
              </div>
            );
          })}
          <motion.div
            className="absolute z-10 grid place-items-center text-2xl"
            style={{ width: CELL, height: CELL }}
            initial={false}
            animate={{ left: token.x, top: token.y - 10, scale: [1, 1.25, 1] }}
            transition={{ duration: 0.16 }}
            data-testid="sugoroku-token"
          >
            🐣
          </motion.div>
        </div>
        <AnimatePresence>
          {banner && (
            <motion.div
              className="absolute inset-x-0 top-1/3 z-20 text-center text-3xl font-black text-yellow-300 text-stroke-lg"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              exit={{ opacity: 0 }}
            >
              {banner}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="font-black text-white text-stroke" data-testid="sugoroku-position">
        {shown} / {BOARD} マス
      </p>
    </div>
  );
}

// ---- ビンゴ ----

export function BingoCard({ week, state, step, skip = false, onDone }: BoardProps<BingoState, BingoStep>) {
  const card = cardFor(week);
  const before = step ? state.opened.map((o, i) => o && !step.newlyOpened.includes(i)) : state.opened;
  const [opened, setOpened] = useState(before);
  const [bingo, setBingo] = useState(false);
  const instant = useSequence(
    step && step.newlyOpened.length > 0
      ? async (alive) => {
          await wait(400);
          for (const i of step.newlyOpened) {
            if (!alive()) return;
            setOpened((o) => o.map((v, j) => v || j === i));
            playSound(() => sfx.correct(5));
            vibrate(30);
            await wait(450);
          }
          if (step.newLines.length > 0) {
            setBingo(true);
            playSound(() => sfx.fever());
            await wait(1200);
          }
        }
      : null,
    skip,
    onDone,
  );
  const shown = instant ? state.opened : opened;
  const lines = new Set(completedLines(shown).flatMap((l) => LINES[l]));
  return (
    <div className="relative w-full max-w-sm">
      <div className="pop-border grid gap-1.5 rounded-3xl bg-white p-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
        {card.slice(0, CELLS).map((m, i) => (
          <div
            key={m.id}
            className={`relative grid aspect-square place-items-center overflow-hidden rounded-xl border-2 border-slate-900 p-1 text-center text-[10px] font-black leading-tight ${
              lines.has(i) ? "bg-yellow-200" : m.total ? "bg-sky-50" : "bg-pink-50"
            }`}
            data-testid={`bingo-cell-${i}`}
            data-open={shown[i] ? "1" : "0"}
          >
            <span className="relative z-10">{m.label}</span>
            <AnimatePresence>
              {shown[i] && (
                <motion.span
                  className="absolute inset-0 grid place-items-center"
                  initial={instant || before[i] ? false : { scale: 2.5, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: -12, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 14 }}
                >
                  <span className="h-[86%] w-[86%] rounded-full border-[5px] border-rose-500/45 bg-rose-400/15" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {bingo && !instant && (
          <motion.div
            className="rainbow-text pointer-events-none absolute inset-0 grid place-items-center text-6xl font-black"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: [0, 1.4, 1], rotate: [-20, 10, -5] }}
            exit={{ opacity: 0 }}
          >
            BINGO!
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-2 text-center text-xs font-black text-white text-stroke">ピンクは1回で、青は今週の累計で達成するお題</p>
    </div>
  );
}

// ---- ボスバトル ----

const bossPoint = (damage: number) => {
  const b = bossAt(damage);
  return b.index >= BOSSES.length ? { level: BOSSES.length - 1, ratio: 1 } : { level: b.index, ratio: (b.hp - b.hpLeft) / b.hp };
};

export function BossView({ state, step, skip = false, onDone }: BoardProps<BossState, BossStep>) {
  const [bossIndex, setBossIndex] = useState(bossAt(step ? step.from : state.damage).index);
  const [hit, setHit] = useState(0);
  const instant = useSequence(
    step
      ? async (alive) => {
          await wait(300);
          for (let i = 0; i < 3; i++) {
            if (!alive()) return;
            setHit((h) => h + 1);
            playSound(() => sfx.wrong());
            vibrate(30);
            await wait(250);
          }
          await wait(Math.max(900, (bossAt(step.to).index - bossAt(step.from).index + 1) * 850));
        }
      : null,
    skip,
    onDone,
  );
  const index = Math.min(instant ? bossAt(state.damage).index : bossIndex, BOSSES.length - 1);
  const allDown = bossAt(state.damage).index >= BOSSES.length && (instant || bossIndex >= BOSSES.length - 1);
  const b = BOSSES[index];
  return (
    <div className="pop-border flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-slate-900 p-4">
      <div className="flex gap-1">
        {BOSSES.map((x, i) => (
          <span key={x.name} className={`text-xl ${i < index || allDown ? "opacity-40 grayscale" : ""}`}>
            {i < index || allDown ? "💀" : x.emoji}
          </span>
        ))}
      </div>
      <div className="relative grid h-32 w-32 place-items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${index}-${allDown}`}
            className="text-8xl"
            initial={{ scale: 0, y: -40 }}
            animate={allDown ? { scale: 0.8, rotate: 90, opacity: 0.5 } : { scale: 1, y: 0 }}
            exit={{ scale: 2, opacity: 0, rotate: 30, transition: { duration: 0.35 } }}
            data-testid="boss-emoji"
          >
            {allDown ? "💀" : b.emoji}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {hit > 0 && step && !instant && (
            <motion.span
              key={hit}
              className="absolute -top-2 text-3xl font-black text-yellow-300 text-stroke"
              initial={{ y: 10, opacity: 0, scale: 0.5 }}
              animate={{ y: -30, opacity: [0, 1, 1, 0], scale: 1.2 }}
              transition={{ duration: 0.8 }}
            >
              💥
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {step && (
        <motion.span
          className="text-3xl font-black text-rose-400 text-stroke"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ delay: instant ? 0 : 0.3 }}
          data-testid="boss-damage"
        >
          -{step.damage.toLocaleString()}
        </motion.span>
      )}
      <div className="w-full">
        <FillBar
          key={instant ? "instant" : "anim"}
          start={bossPoint(step && !instant ? step.from : state.damage)}
          end={bossPoint(state.damage)}
          delay={0.5}
          stepSeconds={0.8}
          size="lg"
          drain
          barClassName="bg-gradient-to-r from-rose-500 to-orange-400"
          levelUpText="撃破!"
          label={(level) => <span className="text-white">{BOSSES[level].name}</span>}
          count={(level, ratio) => `HP ${Math.round(BOSSES[level].hp * (1 - ratio)).toLocaleString()} / ${BOSSES[level].hp.toLocaleString()}`}
          onLevelUp={(level) => {
            setBossIndex(level);
            playSound(() => sfx.fever());
          }}
        />
      </div>
      <p className="text-xs font-black text-slate-300">
        合計ダメージ {state.damage.toLocaleString()} / {TOTAL_HP.toLocaleString()}
      </p>
    </div>
  );
}

// ---- スタンプラリー ----

export function StampBook({ state, step, skip = false, onDone }: BoardProps<StampState, StampStep>) {
  const [count, setCount] = useState(step ? step.from : state.stamps);
  const instant = useSequence(
    step && step.to > step.from
      ? async (alive) => {
          await wait(400);
          for (let n = step.from + 1; n <= step.to; n++) {
            if (!alive()) return;
            setCount(n);
            playSound(() => sfx.correct(3));
            vibrate(25);
            await wait(n % PAGE_SIZE === 0 ? 1000 : 500);
          }
        }
      : null,
    skip,
    onDone,
  );
  const shown = instant ? state.stamps : count;
  // 止まっているときは次に埋めるページ、演出中は今押しているスタンプのページを出す
  const page = step
    ? Math.min(PAGES - 1, Math.floor(Math.max(0, shown - 1) / PAGE_SIZE))
    : Math.min(PAGES - 1, Math.floor(shown / PAGE_SIZE));
  const fresh = (n: number) => !instant && step !== undefined && n > step.from;
  return (
    <div className="pop-border flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-amber-50 p-3">
      <div className="flex items-center justify-between font-black">
        <span>📖 {page + 1}ページ目</span>
        <span className="text-sm text-slate-500" data-testid="stamp-count">
          {shown} / {TOTAL_STAMPS} 個
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          className="grid grid-cols-5 gap-2"
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {Array.from({ length: PAGE_SIZE }, (_, i) => {
            const n = page * PAGE_SIZE + i + 1;
            const got = n <= shown;
            return (
              <div
                key={n}
                className="relative grid aspect-square place-items-center rounded-full border-2 border-dashed border-amber-400 text-[10px] font-black text-amber-400"
              >
                {n % 5 === 0 ? "🎁" : n}
                {got && (
                  <motion.span
                    className="absolute inset-0 grid place-items-center text-3xl"
                    initial={fresh(n) ? { scale: 2.5, rotate: -40, opacity: 0 } : false}
                    animate={{ scale: 1, rotate: -10, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 600, damping: 15 }}
                  >
                    💮
                  </motion.span>
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
