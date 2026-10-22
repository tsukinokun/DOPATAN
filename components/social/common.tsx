"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { totalXp } from "@/lib/economy/ledger";
import { levelFromXp, rankFor, xpForLevel } from "@/lib/economy/rewards";
import { skinOf } from "@/lib/skins";
import { socialApi, type PersonSummary, type ProfileDetail } from "@/lib/social/api";
import { tierOf } from "@/lib/social/leagues";
import { displayName, validateNickname } from "@/lib/social/names";
import { getSupabase } from "@/lib/supabase/client";
import { Panel, PopButton } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { useSocial } from "@/stores/social";
import { useWallet } from "@/stores/wallet";

/** ランク・レベルと、次のレベルまでの XP バー */
export function LevelBar() {
  const xp = totalXp(useWallet((s) => s.ledger));
  const level = levelFromXp(xp);
  const rank = rankFor(level);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return (
    <Panel className="flex items-center gap-3 py-3">
      <span className="text-4xl" aria-hidden>
        {rank.emoji}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="font-black">
            {rank.title} <span className="text-pink-500" data-testid="level">Lv.{level}</span>
          </span>
          <span className="text-xs font-black text-slate-500">
            あと {to - xp} XP
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-400 to-violet-500"
            initial={false}
            animate={{ width: `${((xp - from) / (to - from)) * 100}%` }}
          />
        </div>
      </div>
    </Panel>
  );
}

/** 背景スキンの色を使った丸いアイコン */
export function Avatar({ person, size = 40 }: { person: PersonSummary; size?: number }) {
  const { from, via, to } = skinOf("background", person.stats?.background).look;
  const name = displayName(person);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border-[3px] border-slate-900 font-black text-white text-stroke"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${via}, ${to})`, fontSize: size * 0.45 }}
      aria-hidden
    >
      {[...name][0]}
    </span>
  );
}

/** ログインしていないとき(またはログイン機能が無いとき)の案内 */
export function LoginRequired({ feature }: { feature: string }) {
  const status = useAuth((s) => s.status);
  return (
    <Panel className="flex flex-col items-center gap-3 text-center" >
      <span className="text-5xl">🔒</span>
      <p className="font-black" data-testid="login-required">
        {status === "disabled" ? `${feature}は準備中です` : `ログインすると${feature}に参加できます`}
      </p>
      {status !== "disabled" && <PopButton href="/account">ログインする</PopButton>}
    </Panel>
  );
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="pop-border flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ニックネームの登録・変更 */
export function NicknameForm({ onDone }: { onDone?: () => void }) {
  const profile = useSocial((s) => s.profile);
  const [value, setValue] = useState(profile?.nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const result = validateNickname(value);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setBusy(true);
    try {
      await useSocial.getState().setNickname(result.value);
      setError(null);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={20}
        placeholder="ニックネーム(2〜12文字)"
        data-testid="nickname-input"
        className="rounded-xl border-[3px] border-slate-900 px-3 py-2 font-black"
      />
      {error && <p className="text-sm font-black text-pink-600">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="pop-border rounded-2xl bg-yellow-300 py-2 font-black disabled:opacity-50"
      >
        保存する
      </button>
      <p className="text-xs text-slate-500">ランキングやフレンドに表示されます。本名は入れないでください。</p>
    </div>
  );
}

/** ニックネームが未登録なら、最初に登録してもらう */
export function NicknameGate() {
  const profile = useSocial((s) => s.profile);
  const [skipped, setSkipped] = useState(false);
  const open = profile !== null && profile.nickname === null && !skipped;
  return (
    <Modal open={open} onClose={() => setSkipped(true)}>
      <span className="text-2xl font-black">ニックネームを決めよう</span>
      <p className="text-sm text-slate-600">
        今は「{profile ? displayName(profile) : ""}」と表示されています。
      </p>
      <NicknameForm onDone={() => setSkipped(true)} />
      <button type="button" onClick={() => setSkipped(true)} className="text-sm font-black text-slate-500">
        あとで
      </button>
    </Modal>
  );
}

/** フレンドコードの人のプロフィール */
export function ProfileModal({ code, onClose }: { code: string | null; onClose: () => void }) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!code || !supabase) return;
    let cancelled = false;
    socialApi
      .getProfile(supabase, code)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => {});
    return () => {
      cancelled = true;
      setProfile(null);
    };
  }, [code]);

  const stats = profile?.stats ?? {};
  const level = stats.level ?? 1;
  const rank = rankFor(level);
  return (
    <Modal open={code !== null} onClose={onClose}>
      {!profile ? (
        <span className="animate-bounce text-4xl">⚡</span>
      ) : (
        <>
          <Avatar person={profile} size={72} />
          <span className="text-2xl font-black">{displayName(profile)}</span>
          <span className="font-black text-slate-600">
            {rank.emoji} {rank.title} Lv.{level}
          </span>
          <div className="grid w-full grid-cols-2 gap-2 text-sm font-black">
            <Stat label="リーグ" value={`${tierOf(profile.tier).emoji} ${tierOf(profile.tier).name}`} />
            <Stat label="今週のXP" value={`${profile.weekXp}`} />
            <Stat label="マスター" value={`${stats.mastered ?? 0}語`} />
            <Stat label="連続ログイン" value={`${stats.streak ?? 0}日`} />
          </div>
          <span className="text-xs text-slate-500">フレンドコード:{profile.friendCode}</span>
          <button type="button" onClick={onClose} className="pop-border w-full rounded-2xl bg-yellow-300 py-2 font-black">
            閉じる
          </button>
        </>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 px-2 py-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}

/** ホームに出す通知:サーバーから届いた報酬と、招待の結果 */
export function SocialNotices() {
  const rewards = useSocial((s) => s.newRewards);
  const inviteMessage = useSocial((s) => s.inviteMessage);
  const dismiss = useSocial((s) => s.dismissNotices);
  // ログインボーナスの画面と重ならないよう、そちらを閉じてから出す
  const bonusOpen = useWallet((s) => s.pendingBonus !== null);
  const open = !bonusOpen && (rewards.length > 0 || inviteMessage !== null);
  const gems = rewards.reduce((sum, e) => sum + (e.gems ?? 0), 0);
  return (
    <Modal open={open} onClose={dismiss}>
      <span className="rainbow-text text-3xl font-black">お知らせ</span>
      {inviteMessage && <p className="font-black">{inviteMessage}</p>}
      {rewards.length > 0 && (
        <>
          <span className="text-4xl font-black text-sky-500 text-stroke">💎+{gems}</span>
          <ul className="w-full text-left text-sm font-black text-slate-600">
            {rewards.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>{e.label}</span>
                <span className="shrink-0">💎{e.gems}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={dismiss}
        data-testid="social-notice-close"
        className="pop-border mt-2 w-full rounded-2xl bg-yellow-300 py-3 text-xl font-black"
      >
        OK
      </button>
    </Modal>
  );
}
