import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import images from "@/data/images.json";
import { audioFileName } from "./fx/audio";
import { ALL_WORDS } from "./testWords";
import { POS_LABEL, SCORE_BANDS, THEMES } from "./types";

/**
 * 単語データ(data/words/*.json)の検証。単語を増やすたびにここで間違いを見つける。
 * 絵と音声は scripts/build-images.mjs と scripts/tts/generate.py で作る。
 */
const publicFile = (path: string) => existsSync(new URL(`../public/${path}`, import.meta.url));
const emojiMap = images.emoji as Record<string, string>;
const illustrations = new Set<string>(images.illustrations as string[]);

describe("word data", () => {
  it("has unique, well-formed ids", () => {
    const ids = ALL_WORDS.map((w) => w.id);
    expect(ids.length).toBe(new Set(ids).size);
    for (const w of ALL_WORDS) expect(w.id, w.word).toMatch(/^[a-z0-9-]+-\d+$/);
  });

  it("has every field filled in with valid values", () => {
    for (const w of ALL_WORDS) {
      const where = `${w.id}`;
      expect(SCORE_BANDS, where).toContain(w.band);
      expect(Object.keys(THEMES), where).toContain(w.theme);
      expect(Object.keys(POS_LABEL), where).toContain(w.pos);
      expect(w.word.trim(), where).toBe(w.word);
      expect(w.ja.length, where).toBeGreaterThan(0);
      expect(w.ipa, where).toMatch(/^\/[^/]+\/$/);
      expect(w.example.en.length, where).toBeGreaterThan(5);
      expect(w.example.ja.length, where).toBeGreaterThan(3);
      expect(Array.isArray(w.derivatives), where).toBe(true);
    }
  });

  it("uses the word in its example sentence", () => {
    for (const w of ALL_WORDS) {
      // 活用形(issued, companies など)も許すため、先頭の数文字で確かめる
      const stem = w.word.toLowerCase().replace(/é/g, "e").slice(0, Math.max(3, Math.min(5, w.word.length - 1)));
      const sentence = w.example.en.toLowerCase().replace(/é/g, "e");
      expect(sentence.includes(stem), `${w.id}: ${w.example.en}`).toBe(true);
    }
  });

  it("gives different translations to different senses of a word", () => {
    const seen = new Map<string, string>();
    for (const w of ALL_WORDS) {
      const key = `${w.word}|${w.ja}`;
      expect(seen.has(key), `${w.id} と ${seen.get(key)} が同じ訳`).toBe(false);
      seen.set(key, w.id);
    }
  });

  it("only uses synonym groups that have at least two members", () => {
    const counts = new Map<string, number>();
    for (const w of ALL_WORDS) if (w.synonymGroup) counts.set(w.synonymGroup, (counts.get(w.synonymGroup) ?? 0) + 1);
    for (const [group, n] of counts) expect(n, `類義語グループ ${group}`).toBeGreaterThanOrEqual(2);
  });

  it("has a picture for every word", () => {
    for (const w of ALL_WORDS) {
      const ok = illustrations.has(w.id) || (emojiMap[w.emoji] !== undefined && publicFile(`emoji/${emojiMap[w.emoji]}.svg`));
      expect(ok, `${w.id} の絵(${w.emoji})が無い。scripts/build-images.mjs を実行するか、illustrations に描く`).toBe(true);
    }
    for (const id of illustrations) expect(publicFile(`illustrations/${id}.svg`), id).toBe(true);
  });

  it("has pronunciation audio for every word", () => {
    for (const w of ALL_WORDS) {
      expect(publicFile(`audio/${audioFileName(w.word)}.mp3`), `${w.word} の音声が無い。scripts/tts を実行する`).toBe(true);
    }
  });
});
