// public/icons/icon.svg から PWA 用の PNG アイコンを書き出す: node scripts/generate-icons.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url), "utf8");
const targets = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
  // maskable は周囲が切り取られるので余白をとる
  { file: "icon-maskable-512.png", size: 512, pad: 0.12 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const { file, size, pad } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:#7b2ff7">
       <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div>
     </body>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: pad === 0 });
}
await browser.close();
