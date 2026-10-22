import { describe, expect, it } from "vitest";
import { conflicts, pickDistractors } from "./distractors";
import { seededRng } from "./random";
import { ALL_WORDS as WORDS } from "./testWords";

const byId = (id: string) => WORDS.find((w) => w.id === id)!;

describe("pickDistractors", () => {
  it("never pairs senses of the same word or synonyms", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const target of WORDS) {
        const options = [target, ...pickDistractors(target, WORDS, 3, seededRng(seed))];
        expect(options).toHaveLength(4);
        for (let i = 0; i < options.length; i++) {
          for (let j = i + 1; j < options.length; j++) {
            expect(conflicts(options[i], options[j])).toBe(false);
          }
        }
      }
    }
  });

  it("treats polysemy, synonyms and same emoji as conflicts", () => {
    expect(conflicts(byId("issue-1"), byId("issue-2"))).toBe(true);
    expect(conflicts(byId("reserve-1"), byId("book-1"))).toBe(true);
    expect(conflicts(byId("postpone-1"), byId("delay-1"))).toBe(true);
    expect(conflicts(byId("issue-1"), byId("budget-1"))).toBe(false);
  });

  it("prefers distractors with the same part of speech", () => {
    const target = byId("postpone-1");
    const picked = pickDistractors(target, WORDS, 3, seededRng(1));
    expect(picked.every((w) => w.pos === "verb")).toBe(true);
  });
});

describe("word data", () => {
  it("has unique ids and complete fields", () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w.word && w.ja && w.emoji && w.ipa && w.example.en && w.example.ja).toBeTruthy();
    }
  });
});
