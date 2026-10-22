// 単語をまとめて追加する: node scripts/add-words.mjs <band> <words.txt>
//
// 列は「|」区切り(1行1意味。# で始まる行と空行は無視):
//   英単語  品詞(n/v/adj/adv)  和訳  テーマ  絵文字  発音記号(/.../)  例文  例文の訳  派生語(; 区切り)  類義語グループ(任意)
//
// ID は「英単語-番号」で自動で付ける(同じ英単語の2つ目の意味は -2)。
// すでに同じ英単語・同じ和訳があれば追加しない(何度実行しても同じ結果になる)。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BANDS = ["600", "730", "860", "990"];
const POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };
const THEMES = ["office", "meeting", "hr", "finance", "marketing", "travel", "shopping", "manufacturing"];

const [band, tsvPath] = process.argv.slice(2);
if (!BANDS.includes(band) || !tsvPath) {
  console.error("使い方: node scripts/add-words.mjs <600|730|860|990> <words.txt>");
  process.exit(1);
}

const file = (b) => join(ROOT, "data", "words", `${b}.json`);
const all = Object.fromEntries(BANDS.map((b) => [b, JSON.parse(readFileSync(file(b), "utf8"))]));
const existing = Object.values(all).flat();
const slug = (word) => word.toLowerCase().replace(/é/g, "e").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const senseCount = new Map();
// 既存の ID は単語名と一致しないもの(supplies → supply-1 など)もあるので、ID の側から数える
for (const w of existing) {
  const [, base, n] = w.id.match(/^(.*)-(\d+)$/);
  senseCount.set(base, Math.max(senseCount.get(base) ?? 0, Number(n)));
}
const known = new Set(existing.map((w) => `${w.word}|${w.ja}`));

let added = 0;
const errors = [];
readFileSync(tsvPath, "utf8")
  .split("\n")
  .forEach((line, i) => {
    if (!line.trim() || line.startsWith("#")) return;
    const cols = line.split("|").map((c) => c.trim());
    const [word, pos, ja, theme, emoji, ipa, en, exJa, derivatives = "", synonymGroup = ""] = cols;
    const where = `${tsvPath}:${i + 1} ${word}`;
    if (cols.length < 8) return errors.push(`${where}: 列が足りない(${cols.length})`);
    if (!POS[pos]) return errors.push(`${where}: 品詞 ${pos}`);
    if (!THEMES.includes(theme)) return errors.push(`${where}: テーマ ${theme}`);
    if (!/^\/[^/]+\/$/.test(ipa)) return errors.push(`${where}: 発音記号 ${ipa}`);
    if (known.has(`${word}|${ja}`)) return;
    const n = (senseCount.get(slug(word)) ?? 0) + 1;
    senseCount.set(slug(word), n);
    known.add(`${word}|${ja}`);
    const entry = {
      id: `${slug(word)}-${n}`,
      word,
      pos: POS[pos],
      ja,
      band: Number(band),
      theme,
      emoji,
      ipa,
      example: { en, ja: exJa },
      derivatives: derivatives ? derivatives.split(";").map((d) => d.trim()).filter(Boolean) : [],
    };
    if (synonymGroup) entry.synonymGroup = synonymGroup;
    all[band].push(entry);
    added++;
  });

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const json = (list) => `[\n${list.map((w) => `  ${JSON.stringify(w)}`).join(",\n")}\n]\n`;
writeFileSync(file(band), json(all[band]));
console.log(`${band}点帯に ${added}語を追加(合計 ${all[band].length}語)`);
