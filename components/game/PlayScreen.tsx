"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bgm, preloadVoice, sfx, speak, unlockAudio } from "@/lib/fx/audio";
import { burstConfetti, feverConfetti, useEffectLevel, vibrate } from "@/lib/fx/effects";
import { equippedPerks } from "@/lib/economy/perks";
import { pointsFor } from "@/lib/score";
import { skinCopies } from "@/lib/economy/ledger";
import { SessionEngine, type Question } from "@/lib/session";
import { filterScope, getWords } from "@/lib/words";
import { useProgress, type AnswerLog } from "@/stores/progress";
import { useSettings } from "@/stores/settings";
import { useSocial } from "@/stores/social";
import { useWallet } from "@/stores/wallet";
import { FEVER_EVERY, Hud } from "./Hud";
import { BigBanner, FeverOverlay, PauseDialog, ScorePopup } from "./Overlays";
import { QuestionBoard, type Feedback } from "./QuestionBoard";
import { SpellingBoard } from "./SpellingBoard";

/** 出題形式に合った盤面 */
function Board(props: React.ComponentProps<typeof QuestionBoard>) {
  return props.question.mode === "spelling" ? <SpellingBoard {...props} /> : <QuestionBoard {...props} />;
}

export const SESSION_MS = 90 * 1000;
const FEVER_MS = 8000;
const NEXT_DELAY_CORRECT = 650;
const NEXT_DELAY_WRONG = 1500;
const TIME_UP_DELAY = 1800;

type Phase = "countdown" | "playing" | "timeup";

export function PlayScreen() {
  const router = useRouter();
  const level = useEffectLevel();
  const showJapanese = useSettings((s) => s.showJapanese);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const finishSession = useProgress((s) => s.finishSession);

  const [engine] = useState(() => {
    const settings = useSettings.getState();
    return new SessionEngine({
      allWords: getWords(),
      scope: filterScope(getWords(), settings.bands, settings.themes),
      progress: useProgress.getState().progress,
      modes: settings.modes,
      now: Date.now(),
      rng: Math.random,
    });
  });

  // スキン効果はプレイ開始時のものを最後まで使う
  const [perks] = useState(() => {
    const { equipped, ledger } = useWallet.getState();
    return equippedPerks(equipped, skinCopies(ledger));
  });

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_MS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [fever, setFever] = useState(false);
  const [banner, setBanner] = useState<{ text: string; sub?: string; className?: string } | null>(null);
  const [popup, setPopup] = useState<{ id: number; x: number; y: number; text: string } | null>(null);
  const [paused, setPaused] = useState(false);

  const stats = useRef({ maxCombo: 0, correct: 0, wrong: 0, feverCount: 0, newWords: 0, answers: [] as AnswerLog[] });
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(SESSION_MS);
  const pausedRef = useRef(false);
  /** フィーバーが終わる残り時間。一時停止中に終わらないよう、壁時計ではなくゲームの時間で決める */
  const feverEndsAt = useRef<number | null>(null);
  const bgm = useRef<Bgm | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shake = useAnimationControls();

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const playSound = useCallback((fn: () => void) => {
    if (useSettings.getState().sound) fn();
  }, []);

  const showBanner = useCallback(
    (b: { text: string; sub?: string; className?: string }, ms = 900) => {
      setBanner(b);
      later(() => setBanner((cur) => (cur === b ? null : cur)), ms);
    },
    [later],
  );

  const presentQuestion = useCallback(
    (q: Question) => {
      setFeedback(null);
      setQuestion(q);
      preloadVoice(q.target.word);
      // リスニングは問題が出たらすぐ聞かせる(効果音の設定とは関係なく、聞かないと答えられないため)
      if (q.mode === "listening") speak(q.target.word);
      if (q.isIntro) {
        showBanner({ text: "NEW!", sub: "新しい単語", className: "rainbow-text" }, 800);
        playSound(() => {
          sfx.intro();
          speak(q.target.word);
        });
      }
    },
    [playSound, showBanner],
  );

  // 最初のタップで音を有効にする(/play を直接開いたとき用)
  useEffect(() => {
    const onPointer = () => unlockAudio();
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  const startBgm = useCallback(() => {
    const s = useSettings.getState();
    if (!s.sound || !s.bgm) return;
    bgm.current?.stop();
    bgm.current = new Bgm();
    bgm.current.start();
    bgm.current.setFever(feverEndsAt.current !== null);
  }, []);

  const startGame = useCallback(() => {
    showBanner({ text: "GO!!", className: "text-yellow-300" }, 600);
    setPhase("playing");
    presentQuestion(engine.next());
    if (!pausedRef.current) startBgm();
  }, [engine, presentQuestion, showBanner, startBgm]);

  const endGame = useCallback(() => {
    setPhase("timeup");
    bgm.current?.stop();
    playSound(() => sfx.timeUp());
    showBanner({ text: "TIME UP!", className: "text-pink-300" }, TIME_UP_DELAY);
    later(() => {
      const now = Date.now();
      finishSession({ score: scoreRef.current, ...stats.current, finishedAt: now });
      // 学習記録を更新した後に報酬を計算する(マスターした単語や実績の判定に使うため)
      const [sessionEvent] = useWallet.getState().recordSession({ ...stats.current, score: scoreRef.current }, now);
      // ログイン中なら今週のリーグに XP を送る(失敗してもゲームは続ける)
      void useSocial.getState().submitXp(sessionEvent.xp ?? 0).catch(() => {});
      router.push("/event/progress");
    }, TIME_UP_DELAY);
  }, [finishSession, later, playSound, router, showBanner]);

  // 3, 2, 1, GO!
  useEffect(() => {
    const ids = [3, 2, 1, 0].map((n, i) =>
      setTimeout(() => {
        setCountdown(n);
        playSound(() => sfx.countdown(n === 0));
        if (n === 0) startGame();
      }, i * 700),
    );
    return () => ids.forEach(clearTimeout);
  }, [playSound, startGame]);

  // タイマー(タブが裏にある間と、一時停止中は止める)
  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && !pausedRef.current) timeLeftRef.current = Math.max(0, timeLeftRef.current - (now - last));
      last = now;
      setTimeLeft(timeLeftRef.current);
      if (feverEndsAt.current !== null && timeLeftRef.current <= feverEndsAt.current) {
        feverEndsAt.current = null;
        setFever(false);
      }
      if (timeLeftRef.current === 0) {
        clearInterval(id);
        endGame();
      }
    }, 100);
    return () => clearInterval(id);
  }, [endGame, phase]);

  useEffect(() => {
    bgm.current?.setFever(fever);
  }, [fever]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      bgm.current?.stop();
    };
  }, []);

  const startFever = useCallback(() => {
    setFever(true);
    stats.current.feverCount++;
    showBanner({ text: "FEVER!!", sub: "スコア3倍", className: "rainbow-text" }, 1100);
    playSound(() => sfx.fever());
    feverConfetti(level);
    vibrate([40, 30, 40, 30, 120]);
    if (level !== "low") void shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
    feverEndsAt.current = Math.max(0, timeLeftRef.current - FEVER_MS);
  }, [level, playSound, shake, showBanner]);

  const handleAnswer = useCallback(
    (chosenId: string, rect: DOMRect | undefined) => {
      if (!question || feedback || phase !== "playing" || pausedRef.current) return;
      const correct = chosenId === question.target.id;
      engine.answer(question, correct);
      recordAnswer(question.target.id, correct);
      stats.current.answers.push({ senseId: question.target.id, correct });
      setFeedback({ chosenId, correct });

      if (correct) {
        stats.current.correct++;
        if (question.isIntro) stats.current.newWords++;
        const nextCombo = question.isIntro ? combo : combo + 1;
        const points = pointsFor(nextCombo, fever, question.isIntro, perks);
        scoreRef.current += points;
        setScore(scoreRef.current);
        setCombo(nextCombo);
        stats.current.maxCombo = Math.max(stats.current.maxCombo, nextCombo);
        playSound(() => {
          sfx.correct(nextCombo);
          setTimeout(() => speak(question.target.word), 120);
        });
        vibrate(25);
        if (rect) {
          burstConfetti(
            level,
            { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
            fever ? 1.5 : 0.6 + Math.min(nextCombo, 20) / 20,
          );
          setPopup({ id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, text: `+${points}` });
        }
        if (!question.isIntro && nextCombo > 0) {
          if (nextCombo % FEVER_EVERY === 0) startFever();
          else if (nextCombo % 5 === 0) {
            showBanner({ text: `${nextCombo} COMBO!`, className: "text-yellow-300" }, 700);
            playSound(() => sfx.comboMilestone());
          }
        }
      } else {
        stats.current.wrong++;
        setCombo(0);
        playSound(() => sfx.wrong());
        vibrate([70, 40, 70]);
        const amplitude = level === "max" ? 18 : level === "standard" ? 8 : 0;
        if (amplitude) {
          void shake.start({
            x: [0, -amplitude, amplitude, -amplitude / 2, amplitude / 2, 0],
            transition: { duration: 0.35 },
          });
        }
      }

      later(() => {
        if (timeLeftRef.current > 0) presentQuestion(engine.next());
      }, correct ? NEXT_DELAY_CORRECT : NEXT_DELAY_WRONG);
    },
    [combo, engine, feedback, fever, later, level, perks, phase, playSound, presentQuestion, question, recordAnswer, shake, showBanner, startFever],
  );

  const pause = useCallback(() => {
    if (phase === "timeup") return;
    pausedRef.current = true;
    setPaused(true);
    bgm.current?.stop();
  }, [phase]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    if (phase === "playing") startBgm();
  }, [phase, startBgm]);

  // スワイプ中にブラウザの「引っ張って更新」やスクロールが起きないよう、画面全体のタッチ操作を止める
  return (
    <motion.main animate={shake} className="relative flex min-h-dvh touch-none flex-col overscroll-none">
      <FeverOverlay active={fever} intense={level === "max"} />
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <Hud
          timeLeftMs={timeLeft}
          totalMs={SESSION_MS}
          score={score}
          combo={combo}
          fever={fever}
          onExit={pause}
        />
        {question && phase !== "countdown" && (
          <Board
            key={question.step}
            question={question}
            showJapanese={showJapanese}
            feedback={phase === "timeup" ? (feedback ?? { chosenId: "", correct: false }) : feedback}
            onAnswer={handleAnswer}
            onPickup={() => playSound(() => sfx.pickup())}
            paused={paused}
          />
        )}
      </div>
      <BigBanner
        show={phase === "countdown"}
        text={countdown === 0 ? "" : String(countdown)}
        className="text-white"
      />
      <BigBanner show={banner !== null} text={banner?.text ?? ""} sub={banner?.sub} className={banner?.className} />
      <ScorePopup popup={popup} />
      <PauseDialog open={paused} onResume={resume} onQuit={() => router.push("/")} />
    </motion.main>
  );
}
