"use client";

import { useState, type FormEvent } from "react";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { NicknameForm } from "@/components/social/common";
import { displayName } from "@/lib/social/names";
import { useAuth, type SyncState } from "@/stores/auth";
import { useSocial } from "@/stores/social";

export default function AccountPage() {
  return (
    <Hydrated>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <PopButton href="/" color="white" className="px-3 py-2">
            ←
          </PopButton>
          <h1 className="text-3xl font-black text-white text-stroke">アカウント</h1>
        </header>
        <Account />
      </main>
    </Hydrated>
  );
}

const SYNC_LABEL: Record<SyncState, string> = {
  idle: "",
  syncing: "☁️ 同期中…",
  synced: "✅ クラウドに保存済み",
  error: "⚠️ 同期できませんでした(次の保存で再試行します)",
};

function Account() {
  const { status, email, syncState } = useAuth();

  if (status === "disabled") {
    return (
      <Panel>
        <p className="font-black">ログイン機能は準備中です。</p>
        <p className="mt-1 text-sm text-slate-600">今はゲストとして遊べます。記録はこの端末に保存されます。</p>
      </Panel>
    );
  }
  if (status === "loading") {
    return (
      <Panel>
        <p className="font-black">読み込み中…</p>
      </Panel>
    );
  }
  if (status === "signedIn") {
    return (
      <>
        <NicknamePanel />
        <Panel className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">ログイン中</p>
          <p className="break-all text-lg font-black" data-testid="account-email">
            {email ?? "(メールアドレスなし)"}
          </p>
          <p className="text-sm font-black">{SYNC_LABEL[syncState]}</p>
          <p className="text-xs text-slate-500">同じアカウントでログインすれば、PCでもスマホでも同じ記録で遊べます。</p>
          <PopButton color="white" onClick={() => void getSupabase()?.auth.signOut()} testId="sign-out">
            ログアウト
          </PopButton>
        </Panel>
      </>
    );
  }
  return <SignInForms />;
}

function NicknamePanel() {
  const profile = useSocial((s) => s.profile);
  const [saved, setSaved] = useState(false);
  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="font-black">ニックネーム</h2>
      {profile ? (
        <>
          <p className="text-sm text-slate-500">
            今の表示:{displayName(profile)}(フレンドコード {profile.friendCode})
          </p>
          <NicknameForm key={profile.nickname ?? ""} onDone={() => setSaved(true)} />
          {saved && <p className="text-sm font-black text-emerald-700">保存しました</p>}
        </>
      ) : (
        <p className="text-sm text-slate-500">読み込み中…</p>
      )}
    </Panel>
  );
}

/** Supabase の英語のエラーを日本語にする */
function toJapanese(message: string): string {
  if (/invalid login credentials/i.test(message)) return "メールアドレスかパスワードが違います。";
  if (/email not confirmed/i.test(message)) return "確認メールのリンクを開いてから、ログインしてください。";
  if (/already registered/i.test(message)) return "このメールアドレスは登録済みです。ログインしてください。";
  if (/password should be at least/i.test(message)) return "パスワードは6文字以上にしてください。";
  if (/failed to fetch|network/i.test(message)) return "通信できませんでした。電波の良い場所でやり直してください。";
  if (/rate limit/i.test(message)) return "試行回数が多すぎます。少し待ってからやり直してください。";
  return `エラーが起きました:${message}`;
}

function SignInForms() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/auth/callback`;

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await getSupabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setMessage({ text: toJapanese(error.message), error: true });
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const auth = getSupabase()!.auth;
    if (mode === "signUp") {
      const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
      if (error) setMessage({ text: toJapanese(error.message), error: true });
      else if (!data.session) setMessage({ text: "確認メールを送りました。メールのリンクを開くとログインできます。", error: false });
    } else {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: toJapanese(error.message), error: true });
    }
    setBusy(false);
  };

  return (
    <>
      <Panel className="flex flex-col gap-3">
        <p className="font-black">ログインすると記録がクラウドに保存され、PCとスマホで同じ記録で遊べます。</p>
        <p className="text-xs text-slate-500">ゲストで遊んだ記録は、ログインしたときに引き継がれます。</p>
        <PopButton color="white" onClick={() => void signInWithGoogle()} testId="google-sign-in">
          <span className="text-lg font-black text-blue-600">G</span> Googleでログイン
        </PopButton>
      </Panel>

      <Panel>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["signIn", "signUp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-xl border-[3px] border-slate-900 py-2 font-black ${
                  mode === m ? "bg-slate-900 text-yellow-300" : "bg-white"
                }`}
              >
                {m === "signIn" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border-[3px] border-slate-900 px-3 py-2 font-black"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            placeholder="パスワード(6文字以上)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border-[3px] border-slate-900 px-3 py-2 font-black"
          />
          <button
            type="submit"
            disabled={busy}
            className="pop-border rounded-2xl bg-yellow-300 py-3 text-lg font-black disabled:opacity-50"
          >
            {mode === "signIn" ? "メールでログイン" : "メールで登録"}
          </button>
          {message && (
            <p className={`text-sm font-black ${message.error ? "text-pink-600" : "text-emerald-700"}`}>{message.text}</p>
          )}
        </form>
      </Panel>

      <PopButton href="/" color="mint">
        ゲストのまま遊ぶ
      </PopButton>
    </>
  );
}
