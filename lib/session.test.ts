import { describe, expect, it } from "vitest";
import { seededRng } from "./random";
import { SessionEngine, type Question } from "./session";
import { applyAnswer, choiceCountFor, type SenseProgress } from "./srs";
import { WORDS } from "./words";

function run(
  answers: (q: Question) => boolean,
  count: number,
  progress: Record<string, SenseProgress> = {},
) {
  const engine = new SessionEngine({
    allWords: WORDS,
    scope: WORDS,
    progress,
    modes: ["wordToPicture", "pictureToWord"],
    now: 0,
    rng: seededRng(42),
  });
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    const q = engine.next();
    questions.push(q);
    engine.answer(q, answers(q));
  }
  return questions;
}

describe("SessionEngine", () => {
  it("ramps a new word from 1 to 2 to 4 cards", () => {
    const questions = run(() => true, 30);
    const first = questions[0].target.id;
    const counts = questions
      .filter((q) => q.target.id === first)
      .map((q) => q.options.length);
    expect(counts.slice(0, 3)).toEqual([1, 2, 4]);
    expect(questions[0].isIntro).toBe(true);
    expect(questions[0].mode).toBe("wordToPicture");
  });

  it("asks a wrong answer again soon", () => {
    let failed: string | undefined;
    const questions = run((q) => {
      if (!failed && q.options.length === 4) {
        failed = q.target.id;
        return false;
      }
      return true;
    }, 40);
    const failIndex = questions.findIndex((q) => q.target.id === failed && q.options.length === 4);
    const retry = questions.slice(failIndex + 1).findIndex((q) => q.target.id === failed);
    expect(retry).toBeGreaterThanOrEqual(0);
    expect(retry).toBeLessThanOrEqual(4);
  });

  it("never introduces two senses of the same word in one session", () => {
    const questions = run(() => true, 200);
    const intros = questions.filter((q) => q.isIntro).map((q) => q.target.word);
    expect(new Set(intros).size).toBe(intros.length);
  });

  it("does not ask the same word twice in a row", () => {
    const questions = run((q) => q.step % 3 !== 0, 100);
    for (let i = 1; i < questions.length; i++) {
      expect(questions[i].target.id).not.toBe(questions[i - 1].target.id);
    }
  });

  it("starts with due reviews when the learner has history", () => {
    const progress: Record<string, SenseProgress> = {};
    for (const w of WORDS.slice(0, 5)) {
      progress[w.id] = { ...applyAnswer(applyAnswer(undefined, true, -1e9), true, -1e9) };
    }
    const questions = run(() => true, 6, progress);
    const reviewed = questions.filter((q) => progress[q.target.id]);
    expect(reviewed.length).toBeGreaterThan(0);
    expect(reviewed.every((q) => q.options.length === 4)).toBe(true);
  });
});

describe("srs", () => {
  it("maps exposures to card counts", () => {
    expect([0, 1, 2, 5].map(choiceCountFor)).toEqual([1, 2, 4, 4]);
  });

  it("resets the box on a wrong answer", () => {
    let p = applyAnswer(undefined, true, 0);
    p = applyAnswer(p, true, 0);
    p = applyAnswer(p, false, 0);
    expect(p.box).toBe(1);
    expect(p.wrong).toBe(1);
  });
});
