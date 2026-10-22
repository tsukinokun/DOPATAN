"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar, LoginRequired, NicknameGate, ProfileModal } from "@/components/social/common";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { sfx } from "@/lib/fx/audio";
import { burstConfetti, useEffectLevel } from "@/lib/fx/effects";
import { socialApi, type FriendRow, type PersonSummary } from "@/lib/social/api";
import { displayName } from "@/lib/social/names";
import { CHEER_GEMS, INVITE_GEMS } from "@/lib/social/rewards";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { useSettings } from "@/stores/settings";
import { useSocial } from "@/stores/social";

type Tab = "ranking" | "requests" | "add";

export default function FriendsPage() {
  return (
    <Hydrated>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <PopButton href="/" color="white" className="px-3 py-2">
            ←
          </PopButton>
          <h1 className="text-3xl font-black text-white text-stroke">フレンド</h1>
        </header>
        <Friends />
      </main>
    </Hydrated>
  );
}

function Friends() {
  const status = useAuth((s) => s.status);
  const incoming = useSocial((s) => s.inbox?.incomingRequests.length ?? 0);
  const [tab, setTab] = useState<Tab>("ranking");
  const [profileCode, setProfileCode] = useState<string | null>(null);

  if (status === "loading") return <Panel>読み込み中…</Panel>;
  if (status !== "signedIn") return <LoginRequired feature="フレンド" />;

  const tabs: [Tab, string][] = [
    ["ranking", "🏆 ランキング"],
    ["requests", `📨 申請${incoming > 0 ? `(${incoming})` : ""}`],
    ["add", "➕ 追加"],
  ];
  return (
    <>
      <NicknameGate />
      <div className="grid grid-cols-3 gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            data-testid={`friends-tab-${key}`}
            className={`pop-border rounded-2xl py-2 text-sm font-black ${tab === key ? "bg-slate-900 text-yellow-300" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "ranking" && <Ranking onOpen={setProfileCode} />}
      {tab === "requests" && <Requests onOpen={setProfileCode} />}
      {tab === "add" && <AddFriends onOpen={setProfileCode} />}
      <ProfileModal code={profileCode} onClose={() => setProfileCode(null)} />
    </>
  );
}

function Ranking({ onOpen }: { onOpen: (code: string) => void }) {
  const level = useEffectLevel();
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    socialApi
      .friendStandings(supabase)
      .then(setRows)
      .catch((e: Error) => setMessage(e.message));
  }, []);

  useEffect(load, [load]);

  const cheer = async (row: FriendRow, e: React.MouseEvent) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await socialApi.sendCheer(supabase, row.id);
      if (useSettings.getState().sound) sfx.coin();
      burstConfetti(level, { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }, 0.6);
      setRows((current) => current?.map((r) => (r.id === row.id ? { ...r, cheeredToday: true } : r)) ?? null);
      await useSocial.getState().refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "応援できませんでした");
    }
  };

  if (!rows) return <Panel>{message ?? "読み込み中…"}</Panel>;
  return (
    <Panel className="flex flex-col gap-2 px-2">
      <p className="px-2 text-sm font-black text-slate-500">今週のXP(月曜0時にリセット)</p>
      {message && <p className="px-2 text-sm font-black text-pink-600">{message}</p>}
      <ol className="flex flex-col gap-1" data-testid="friend-ranking">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${r.me ? "border-[3px] border-slate-900 bg-yellow-200" : ""}`}
          >
            <span className="w-7 text-center font-black">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
            <button type="button" onClick={() => onOpen(r.friendCode)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Avatar person={r} size={32} />
              <span className="truncate font-black">{displayName(r)}</span>
            </button>
            <span className="font-black tabular-nums">{r.weekXp} XP</span>
            {!r.me && (
              <button
                type="button"
                disabled={r.cheeredToday}
                onClick={(e) => void cheer(r, e)}
                aria-label={`${displayName(r)}さんを応援する`}
                className="rounded-full border-2 border-slate-900 bg-pink-300 px-2 py-0.5 text-sm font-black disabled:bg-slate-200 disabled:text-slate-400"
              >
                {r.cheeredToday ? "済" : "👏"}
              </button>
            )}
          </li>
        ))}
      </ol>
      {rows.length <= 1 && <p className="px-2 text-sm text-slate-500">「追加」タブからフレンドを増やそう!</p>}
      <p className="px-2 text-xs text-slate-500">👏応援すると、送った人も受け取った人も💎{CHEER_GEMS}(1日5回まで)</p>
    </Panel>
  );
}

function PersonRow({ person, onOpen, children }: { person: PersonSummary; onOpen: (code: string) => void; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <button type="button" onClick={() => onOpen(person.friendCode)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Avatar person={person} size={36} />
        <span className="truncate font-black">{displayName(person)}</span>
      </button>
      {children}
    </li>
  );
}

function Requests({ onOpen }: { onOpen: (code: string) => void }) {
  const inbox = useSocial((s) => s.inbox);
  const respond = async (id: string, accept: boolean) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await socialApi.respondFriendRequest(supabase, id, accept);
    await useSocial.getState().refresh();
  };
  const cancel = async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await socialApi.removeFriend(supabase, id);
    await useSocial.getState().refresh();
  };
  if (!inbox) return <Panel>読み込み中…</Panel>;
  return (
    <>
      <Panel>
        <h2 className="font-black">届いた申請</h2>
        {inbox.incomingRequests.length === 0 && <p className="text-sm text-slate-500">まだありません</p>}
        <ul>
          {inbox.incomingRequests.map((p) => (
            <PersonRow key={p.id} person={p} onOpen={onOpen}>
              <button type="button" onClick={() => void respond(p.id, true)} className="rounded-lg border-2 border-slate-900 bg-emerald-300 px-2 py-1 text-sm font-black">
                承認
              </button>
              <button type="button" onClick={() => void respond(p.id, false)} className="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-sm font-black">
                拒否
              </button>
            </PersonRow>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-black">送った申請</h2>
        {inbox.outgoingRequests.length === 0 && <p className="text-sm text-slate-500">まだありません</p>}
        <ul>
          {inbox.outgoingRequests.map((p) => (
            <PersonRow key={p.id} person={p} onOpen={onOpen}>
              <button type="button" onClick={() => void cancel(p.id)} className="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-sm font-black">
                取り消す
              </button>
            </PersonRow>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function AddFriends({ onOpen }: { onOpen: (code: string) => void }) {
  const profile = useSocial((s) => s.profile);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSummary[] | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const inviteUrl = profile && typeof window !== "undefined" ? `${window.location.origin}/invite/${profile.friendCode}` : "";

  const request = async (friendCode: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const result = await socialApi.sendFriendRequest(supabase, friendCode);
      setMessage({
        text: result === "accepted" ? "フレンドになりました!" : result === "already_friends" ? "もうフレンドです" : "申請を送りました",
        error: false,
      });
      await useSocial.getState().refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "送れませんでした", error: true });
    }
  };

  const search = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      setResults(await socialApi.searchProfiles(supabase, query));
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "検索できませんでした", error: true });
    }
  };

  const share = async () => {
    const text = `DOPATANで一緒にTOEIC英単語やろう!このリンクから登録すると2人とも💎${INVITE_GEMS}もらえるよ`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "DOPATAN", text, url: inviteUrl });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
      setCopied(true);
    } catch {}
  };

  return (
    <>
      <Panel className="flex flex-col gap-2">
        <h2 className="font-black">友だちを招待する</h2>
        <p className="text-sm text-slate-600">
          招待リンクから登録してもらうと、<b>2人とも💎{INVITE_GEMS}</b>!(相手が1回遊ぶと、あなたにも届きます)
        </p>
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
          <span className="text-xs text-slate-500">あなたのフレンドコード</span>
          <span className="font-black tracking-widest" data-testid="my-friend-code">
            {profile?.friendCode ?? "…"}
          </span>
        </div>
        <button type="button" onClick={() => void share()} disabled={!profile} className="pop-border rounded-2xl bg-pink-400 py-2 font-black text-white">
          {copied ? "コピーしました!" : "📤 招待リンクを送る"}
        </button>
      </Panel>

      <Panel className="flex flex-col gap-2">
        <h2 className="font-black">フレンドコードで追加</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABCD2345"
            className="min-w-0 flex-1 rounded-xl border-[3px] border-slate-900 px-3 py-2 font-black tracking-widest"
          />
          <button type="button" onClick={() => void request(code)} disabled={code.length !== 8} className="rounded-xl border-[3px] border-slate-900 bg-yellow-300 px-3 font-black disabled:opacity-50">
            申請
          </button>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-2">
        <h2 className="font-black">ニックネームで探す</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
          className="flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="2文字以上"
            className="min-w-0 flex-1 rounded-xl border-[3px] border-slate-900 px-3 py-2 font-black"
          />
          <button type="submit" disabled={query.trim().length < 2} className="rounded-xl border-[3px] border-slate-900 bg-yellow-300 px-3 font-black disabled:opacity-50">
            検索
          </button>
        </form>
        {results && results.length === 0 && <p className="text-sm text-slate-500">見つかりませんでした</p>}
        <ul>
          {results?.map((p) => (
            <PersonRow key={p.id} person={p} onOpen={onOpen}>
              <button type="button" onClick={() => void request(p.friendCode)} className="rounded-lg border-2 border-slate-900 bg-yellow-300 px-2 py-1 text-sm font-black">
                申請
              </button>
            </PersonRow>
          ))}
        </ul>
      </Panel>
      {message && <p className={`text-center font-black text-stroke ${message.error ? "text-pink-200" : "text-white"}`}>{message.text}</p>}
    </>
  );
}
