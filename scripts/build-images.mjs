// 単語の絵を用意する: node scripts/build-images.mjs
//
// 1. 単語データの emoji を Microsoft Fluent Emoji(Flat、MIT ライセンス)の SVG に対応づけ、
//    実際に使うものだけを public/emoji/<名前>.svg にコピーする
// 2. public/illustrations/<単語ID>.svg(自分で描いた絵)の一覧を作る
// 3. 対応表を data/images.json に書き出す(アプリはこれを見て絵を選ぶ)
//
// 素材の npm パッケージ(約120MB)は依存に入れず、初回だけ scratch フォルダに取ってくる。
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CACHE = process.env.ASSET_CACHE ?? join(tmpdir(), "dopatan-assets");
const PACKAGES = { fluent: "fluentui-emoji@1.3.0", names: "unicode-emoji-json@0.9.0" };

function fetchPackage(spec) {
  const dir = join(CACHE, spec.replace(/[@/]/g, "_"));
  if (!existsSync(join(dir, "package"))) {
    mkdirSync(dir, { recursive: true });
    const tgz = execFileSync("npm", ["pack", spec, "--silent"], { cwd: dir }).toString().trim().split("\n").pop();
    execFileSync("tar", ["xzf", tgz], { cwd: dir });
  }
  return join(dir, "package");
}

const fluentDir = join(fetchPackage(PACKAGES.fluent), "icons", "flat");
const names = JSON.parse(readFileSync(join(fetchPackage(PACKAGES.names), "data-by-emoji.json"), "utf8"));

const words = ["600", "730", "860", "990"].flatMap((band) =>
  JSON.parse(readFileSync(join(ROOT, "data", "words", `${band}.json`), "utf8")),
);

/** 絵文字 → Fluent のファイル名(見つからなければ null) */
function fluentFile(emoji) {
  const candidates = [emoji, emoji.replace(/️/g, ""), `${emoji}️`];
  for (const key of candidates) {
    const info = names[key];
    if (!info) continue;
    const slug = info.slug.replace(/_/g, "-");
    for (const file of [`${slug}.svg`, `${slug}-default.svg`]) {
      if (existsSync(join(fluentDir, file))) return { slug, file };
    }
  }
  return null;
}

const outDir = join(ROOT, "public", "emoji");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const emoji = {};
const missing = new Set();
for (const w of words) {
  if (emoji[w.emoji] !== undefined) continue;
  const found = fluentFile(w.emoji);
  if (!found) {
    missing.add(w.emoji);
    continue;
  }
  copyFileSync(join(fluentDir, found.file), join(outDir, `${found.slug}.svg`));
  emoji[w.emoji] = found.slug;
}

const illustrationsDir = join(ROOT, "public", "illustrations");
const illustrations = existsSync(illustrationsDir)
  ? readdirSync(illustrationsDir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(/\.svg$/, ""))
      .sort()
  : [];
const unknownIllustrations = illustrations.filter((id) => !words.some((w) => w.id === id));

writeFileSync(join(ROOT, "data", "images.json"), `${JSON.stringify({ emoji, illustrations }, null, 0)}\n`);

console.log(`Fluent の絵: ${Object.keys(emoji).length}種類 / 自分で描いた絵: ${illustrations.length}枚`);
if (missing.size > 0) console.log(`Fluent に無い絵文字(文字のまま表示): ${[...missing].join(" ")}`);
if (unknownIllustrations.length > 0) {
  console.error(`単語に無い ID の絵があります: ${unknownIllustrations.join(", ")}`);
  process.exit(1);
}
