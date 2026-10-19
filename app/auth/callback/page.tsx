"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PopButton } from "@/components/ui";
import { useAuth } from "@/stores/auth";

const TIMEOUT_MS = 10_000;

/**
 * Google やメール確認のリンクから戻ってくるページ。
 * URL の code は supabase-js が自動でログインに交換するので、ログイン済みになるのを待ってホームへ戻す。
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signedIn") {
      router.replace("/");
      return;
    }
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, "&"));
    const error = params.get("error_description");
    const timer = setTimeout(
      () => setFailed(error ?? "ログインを完了できませんでした。もう一度お試しください。"),
      error ? 0 : TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [router, status]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      {failed ? (
        <>
          <p className="text-lg font-black text-white text-stroke">{failed}</p>
          <PopButton href="/account">アカウント画面へ</PopButton>
        </>
      ) : (
        <>
          <span className="animate-bounce text-5xl">⚡</span>
          <p className="text-lg font-black text-white text-stroke">ログイン中…</p>
        </>
      )}
    </main>
  );
}
