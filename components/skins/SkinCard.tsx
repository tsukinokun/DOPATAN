"use client";

import { useState } from "react";
import { FillBar } from "@/components/fx/FillBar";
import { useEffectLevel } from "@/lib/fx/effects";
import type { FillPoint } from "@/lib/fx/fill";
import { LEVEL_COPIES, levelProgress, MAX_SKIN_LEVEL, PERK_LABEL, perkPercent, skinLevel, type Rarity, type Skin } from "@/lib/skins";

export const RARITY_STYLE: Record<Rarity, string> = {
  N: "bg-slate-200 text-slate-700",
  R: "bg-sky-300 text-sky-950",
  SR: "bg-amber-300 text-amber-950",
  SSR: "rainbow-bg text-white text-stroke",
};

/** ガチャのカプセルや光の色(レア度の予告に使う) */
export const RARITY_GLOW: Record<Rarity, string> = {
  N: "#e2e8f0",
  R: "#38bdf8",
  SR: "#fbbf24",
  SSR: "#ff3d7f",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`rounded-md border-2 border-slate-900 px-1.5 text-xs font-black ${RARITY_STYLE[rarity]}`}>
      {rarity}
    </span>
  );
}

/** スキンの見た目の小さな見本 */
export function SkinPreview({ skin, locked = false }: { skin: Skin; locked?: boolean }) {
  if (locked) {
    return <div className="grid h-full w-full place-items-center bg-slate-300 text-3xl font-black text-slate-500">?</div>;
  }
  if (skin.category === "background") {
    const { from, via, to, pattern } = skin.look;
    return (
      <div
        className="h-full w-full"
        style={{ background: `${pattern ? `${pattern}, ` : ""}linear-gradient(160deg, ${from}, ${via} 55%, ${to})` }}
      />
    );
  }
  if (skin.category === "effect") {
    return (
      <div className="flex h-full w-full flex-wrap items-center justify-center gap-1 bg-slate-900 p-1 text-2xl">
        {skin.look.emojis
          ? skin.look.emojis.map((e) => <span key={e}>{e}</span>)
          : skin.look.colors.map((c) => <span key={c} className="h-3 w-2 rotate-12 rounded-sm" style={{ background: c }} />)}
      </div>
    );
  }
  return <div className="grid h-full w-full place-items-center bg-indigo-100 text-3xl">🔊</div>;
}

/** レベルのバッジ。最大レベルは虹色 */
export function LevelBadge({ level }: { level: number }) {
  const max = level >= MAX_SKIN_LEVEL;
  return (
    <span
      className={`rounded-md border-2 border-slate-900 px-1.5 text-xs font-black ${max ? "rainbow-bg text-white text-stroke" : "bg-white"}`}
      data-testid="level-badge"
    >
      {max ? "Lv.MAX" : `Lv.${level}`}
    </span>
  );
}

/** 効果の説明。level を渡すとそのレベルでの値、渡さなければ Lv1 の値を出す */
export function PerkText({ skin, level = 1 }: { skin: Skin; level?: number }) {
  if (!skin.perk) return <span className="text-[11px] font-black text-slate-400">効果なし</span>;
  return (
    <span className="text-[11px] font-black text-emerald-700" data-testid="perk-text">
      {PERK_LABEL[skin.perk]} +{perkPercent(skin, level)}%
    </span>
  );
}

/** 枚数を、バーの位置(レベルと溜まり具合)にする。最大レベルは満タン */
function fillPoint(copies: number): FillPoint {
  const progress = levelProgress(copies);
  return { level: skinLevel(copies), ratio: progress ? progress.have / progress.need : 1 };
}

const skinLevelLabel = (level: number) => (level >= MAX_SKIN_LEVEL ? "Lv.MAX" : `Lv.${level}→${level + 1}`);

function skinLevelCount(level: number, ratio: number): string {
  if (level >= MAX_SKIN_LEVEL) return "MAX";
  const need = LEVEL_COPIES[level] - LEVEL_COPIES[level - 1];
  return `${Math.round(ratio * need)}/${need}`;
}

/**
 * 次のレベルまでの進み具合のバー。最大レベルなら満タンの虹色。
 * fromCopies を渡すと、その枚数から copies まで溜まっていく(ガチャの結果用)。
 */
export function LevelProgress({
  copies,
  fromCopies,
  delay,
  onLevelUp,
}: {
  copies: number;
  fromCopies?: number;
  delay?: number;
  onLevelUp?: (level: number) => void;
}) {
  return (
    <FillBar
      start={fillPoint(fromCopies ?? copies)}
      end={fillPoint(copies)}
      delay={delay}
      label={skinLevelLabel}
      count={skinLevelCount}
      maxLevel={MAX_SKIN_LEVEL}
      onLevelUp={onLevelUp}
      testId="level-progress"
      countTestId="level-progress-count"
    />
  );
}

/**
 * スキンのカード。copies(持っている枚数)を渡すと、レベルと次のレベルまでの進み具合も出す。
 * fromCopies を渡すと、バーがその枚数から溜まっていき、Lv バッジもレベルアップした瞬間に変わる。
 */
export function SkinCard({
  skin,
  locked = false,
  copies,
  fromCopies,
  fillDelay,
  footer,
}: {
  skin: Skin;
  locked?: boolean;
  copies?: number;
  fromCopies?: number;
  fillDelay?: number;
  footer?: React.ReactNode;
}) {
  const effect = useEffectLevel();
  const finalLevel = copies === undefined ? 0 : skinLevel(copies);
  const [shownLevel, setShownLevel] = useState<number | null>(() =>
    fromCopies !== undefined && effect !== "low" ? skinLevel(fromCopies) : null,
  );
  const level = shownLevel ?? finalLevel;
  return (
    <div className="pop-border flex flex-col overflow-hidden rounded-2xl bg-white" data-testid={`skin-${skin.id}`}>
      <div className="relative h-20">
        <SkinPreview skin={skin} locked={locked} />
        <span className="absolute left-1 top-1">
          <RarityBadge rarity={skin.rarity} />
        </span>
        {!locked && level > 0 && skin.perk && (
          <span className="absolute right-1 top-1">
            <LevelBadge level={level} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="text-sm font-black leading-tight">{locked ? "???" : skin.name}</span>
        {!locked && <span className="text-[11px] leading-tight text-slate-500">{skin.description}</span>}
        {skin.perk && <PerkText skin={skin} level={locked ? 1 : Math.max(1, level)} />}
        {!locked && skin.perk && copies !== undefined && finalLevel > 0 && (
          <LevelProgress copies={copies} fromCopies={fromCopies} delay={fillDelay} onLevelUp={setShownLevel} />
        )}
        {footer}
      </div>
    </div>
  );
}
