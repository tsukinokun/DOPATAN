"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/social/common";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { socialApi, type ProfileDetail } from "@/lib/social/api";
import { displayName } from "@/lib/social/names";
import { INVITE_GEMS } from "@/lib/social/rewards";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { PENDING_INVITE_KEY, useSocial } from "@/stores/social";

export default function InvitePage() {
  return (
    <Hydrated>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4 py-6">
        <Invite />
      </main>
    </Hydrated>
  );
}

/** 招待リンク。コードを覚えておき、ログインしたら SocialSync が招待を受け取る */
function Invite() {
  const { code } = useParams<{ code: string }>();
  const status = useAuth((s) => s.status);
  const [inviter, setInviter] = useState<ProfileDetail | null | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(PENDING_INVITE_KEY, code);
    } catch {}
    const supabase = getSupabase();
    if (!supabase) return;
    socialApi
      .getProfile(supabase, code)
      .then(setInviter)
      .catch(() => setInviter(null));
  }, [code]);

  useEffect(() => {
    if (status === "signedIn") void useSocial.getState().acceptPendingInvite();
  }, [status]);

  return (
    <Panel className="flex flex-col items-center gap-3 text-center" >
      <span className="rainbow-text text-3xl font-black">招待が届きました!</span>
      {inviter && <Avatar person={inviter} size={72} />}
      <p className="text-lg font-black" data-testid="invite-from">
        {inviter ? `${displayName(inviter)}さんから` : "友だちから"}DOPATANへの招待です
      </p>
      <p className="font-black">
        登録すると<span className="text-sky-500">2人とも💎{INVITE_GEMS}</span>もらえて、すぐフレンドになれます
      </p>
      {status === "signedIn" ? (
        <PopButton href="/" className="w-full text-xl">
          ホームへ(招待を受け取りました)
        </PopButton>
      ) : (
        <>
          <PopButton href="/account" className="w-full text-xl" testId="invite-signup">
            登録して受け取る
          </PopButton>
          <PopButton href="/" color="white" className="w-full">
            まずはゲストで遊んでみる
          </PopButton>
          <p className="text-xs text-slate-500">あとでログインしても、7日以内なら招待を受け取れます</p>
        </>
      )}
    </Panel>
  );
}
