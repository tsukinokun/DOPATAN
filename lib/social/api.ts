import type { SupabaseClient } from "@supabase/supabase-js";

/** 公開用の数値(publish_stats で自分が出したもの) */
export type PublicStats = {
  level?: number;
  mastered?: number;
  streak?: number;
  bestCombo?: number;
  background?: string;
};

export type PersonSummary = {
  id: string;
  nickname: string | null;
  friendCode: string;
  stats?: PublicStats;
};

export type MyProfile = { id: string; nickname: string | null; friendCode: string; invitedBy: string | null };
export type Standings = {
  week: string;
  tier: number;
  members: (PersonSummary & { xp: number; me: boolean })[];
};
export type FriendRow = PersonSummary & { weekXp: number; me: boolean; cheeredToday: boolean };
export type ProfileDetail = PersonSummary & { tier: number | null; weekXp: number; isFriend: boolean };

export type Inbox = {
  today: string;
  cheersReceived: { from: string; nickname: string | null; friendCode: string; day: string }[];
  cheersSent: { to: string; day: string }[];
  incomingRequests: PersonSummary[];
  outgoingRequests: PersonSummary[];
  leagueRewards: { week: string; rank: number; tier: number; newTier: number; gems: number }[];
  invitedBy: { id: string; nickname: string | null; friendCode: string } | null;
  referrals: { invitee: string; nickname: string | null; friendCode: string; unlocked: boolean }[];
};

/** サーバーのエラーコード(SQL の raise exception)を日本語にする */
const MESSAGES: Record<string, string> = {
  not_found: "そのコードの人が見つかりませんでした",
  self: "自分自身は指定できません",
  not_friends: "フレンドになってから応援できます",
  already_cheered: "今日はもう応援しました",
  already_used: "招待はもう使用済みです",
  expired: "招待ボーナスは登録から7日以内の人だけが受け取れます",
  invalid_nickname: "ニックネームは2〜12文字にしてください",
  too_soon: "少し時間をおいてから送ってください",
  not_signed_in: "ログインしてください",
};

export class SocialError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(supabase: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = Object.keys(MESSAGES).find((c) => error.message.includes(c)) ?? "unknown";
    throw new SocialError(code, MESSAGES[code] ?? `通信できませんでした(${error.message})`);
  }
  return data as T;
}

export const socialApi = {
  myProfile: (s: SupabaseClient) => call<MyProfile>(s, "my_profile"),
  setNickname: (s: SupabaseClient, nickname: string) => call<void>(s, "set_nickname", { p_nickname: nickname }),
  publishStats: (s: SupabaseClient, stats: PublicStats) => call<void>(s, "publish_stats", { p_stats: stats }),
  submitXp: (s: SupabaseClient, xp: number) =>
    call<{ accepted: number; weekXp: number; tier: number }>(s, "submit_xp", { p_xp: xp }),
  leagueStandings: (s: SupabaseClient) => call<Standings>(s, "league_standings"),
  sendFriendRequest: (s: SupabaseClient, code: string) =>
    call<"requested" | "accepted" | "already_friends">(s, "send_friend_request", { p_code: code }),
  respondFriendRequest: (s: SupabaseClient, requester: string, accept: boolean) =>
    call<void>(s, "respond_friend_request", { p_requester: requester, p_accept: accept }),
  removeFriend: (s: SupabaseClient, other: string) => call<void>(s, "remove_friend", { p_other: other }),
  searchProfiles: (s: SupabaseClient, query: string) => call<PersonSummary[]>(s, "search_profiles", { p_query: query }),
  getProfile: (s: SupabaseClient, code: string) => call<ProfileDetail | null>(s, "get_profile", { p_code: code }),
  friendStandings: (s: SupabaseClient) => call<FriendRow[]>(s, "friend_standings"),
  sendCheer: (s: SupabaseClient, to: string) => call<void>(s, "send_cheer", { p_to: to }),
  acceptInvite: (s: SupabaseClient, code: string) =>
    call<{ inviterId: string; nickname: string | null; friendCode: string }>(s, "accept_invite", { p_code: code }),
  inbox: (s: SupabaseClient) => call<Inbox>(s, "my_social_inbox"),
};
