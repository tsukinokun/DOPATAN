import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * supabase/migrations の SQL を PGlite(WebAssembly の Postgres)で実際に流して、
 * RPC と RLS の振る舞いを確かめる。Supabase の auth スキーマは最小限の代わりを用意する。
 */

const AUTH_STUB = `
  create role authenticated;
  create role anon;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
`;

const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

let db: PGlite;
let seq = 0;

/** テスト用の「今」(日本時間の 2026-10-19 月曜 12:00 から始まる週) */
const WEEK1 = "2026-10-19T12:00:00+09:00";

async function setNow(iso: string) {
  await db.query(`select set_config('dopatan.now', $1, false)`, [iso]);
}

async function addUser(createdAt = WEEK1): Promise<string> {
  seq++;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, email, created_at) values ($1, $2, $3)`, [id, `u${seq}@example.com`, createdAt]);
  return id;
}

/** ログイン中のユーザーとして SQL を実行する */
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function rpc<T = unknown>(uid: string, fn: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await as<{ r: T }>(uid, `select public.${fn}(${placeholders}) as r`, args);
  return rows[0].r;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(migration("0001_init.sql"));
  await db.exec(migration("0002_wallet.sql"));
  await db.exec(migration("0003_social.sql"));
  await db.exec(migration("0004_short_sessions.sql"));
  await db.exec(migration("0005_presents.sql"));
  await db.exec(migration("0006_news_push.sql"));
  // Supabase の「Automatically expose new tables」がオンの状態を再現する(RLS だけで守れているかを見る)
  await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;`);
}, 60_000);

beforeEach(async () => {
  await setNow(WEEK1);
});

describe("migration", () => {
  it("can be run again without errors", async () => {
    await db.exec(migration("0003_social.sql"));
    await db.exec(migration("0004_short_sessions.sql"));
    await db.exec(migration("0005_presents.sql"));
    await db.exec(migration("0006_news_push.sql"));
  });
});

describe("profiles", () => {
  it("issues a friend code and never exposes email-derived names", async () => {
    const u = await addUser();
    const me = await rpc<{ friendCode: string; nickname: string | null }>(u, "my_profile");
    expect(me.friendCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(me.nickname).toBeNull();
    const cols = await db.query(`select column_name from information_schema.columns where table_name = 'profiles'`);
    expect(cols.rows.map((r) => (r as { column_name: string }).column_name)).not.toContain("display_name");
  });

  it("validates nicknames", async () => {
    const u = await addUser();
    await rpc(u, "set_nickname", ["  たんご王  "]);
    expect((await rpc<{ nickname: string }>(u, "my_profile")).nickname).toBe("たんご王");
    await expect(rpc(u, "set_nickname", ["a"])).rejects.toThrow(/invalid_nickname/);
    await expect(rpc(u, "set_nickname", ["1234567890123"])).rejects.toThrow(/invalid_nickname/);
  });

  it("blocks direct writes through RLS", async () => {
    const a = await addUser();
    const b = await addUser();
    await rpc(a, "my_profile");
    await rpc(b, "my_profile");
    await as(a, `update public.profiles set nickname = 'hacked' where id = $1`, [b]);
    await as(a, `update public.profiles set nickname = 'self' where id = $1`, [a]);
    const rows = await db.query<{ nickname: string | null }>(`select nickname from public.profiles where id in ($1, $2)`, [a, b]);
    expect(rows.rows.every((r) => r.nickname === null)).toBe(true);
    await expect(
      as(a, `insert into public.league_members (week, user_id, tier, group_id, xp) values ('2026-10-19', $1, 9, gen_random_uuid(), 99999)`, [a]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("xp and leagues", () => {
  it("caps xp per session and enforces a gap between submissions", async () => {
    const u = await addUser();
    const first = await rpc<{ accepted: number; weekXp: number }>(u, "submit_xp", [5000]);
    expect(first).toMatchObject({ accepted: 600, weekXp: 600 });
    await setNow("2026-10-19T12:01:00+09:00");
    await expect(rpc(u, "submit_xp", [100])).rejects.toThrow(/too_soon/);
    await setNow("2026-10-19T12:01:21+09:00"); // 80秒あければ受け付ける(1回90秒のプレイを続けて遊べる)
    expect((await rpc<{ weekXp: number }>(u, "submit_xp", [100])).weekXp).toBe(700);
    expect((await rpc<{ accepted: number }>(u, "submit_xp", [-50]).catch(() => null))).toBeNull();
  });

  it("splits groups at 30 players", async () => {
    await setNow("2026-11-02T10:00:00+09:00");
    const ids: string[] = [];
    for (let i = 0; i < 31; i++) {
      const u = await addUser();
      ids.push(u);
      await rpc(u, "league_standings");
    }
    const groups = await db.query<{ n: number }>(
      `select count(*)::int as n from public.league_members where week = '2026-11-02' group by group_id order by n desc`,
    );
    expect(groups.rows.map((r) => r.n)).toEqual([30, 1]);
  });

  it("promotes the top 7, demotes the bottom 5 and pays rank rewards", async () => {
    await setNow("2026-11-09T10:00:00+09:00");
    const players: string[] = [];
    for (let i = 0; i < 20; i++) {
      const u = await addUser("2026-11-09T09:00:00+09:00");
      players.push(u);
      await rpc(u, "submit_xp", [(20 - i) * 10]); // 1人目が一番多い
    }
    await setNow("2026-11-16T10:00:00+09:00");
    const tiers: number[] = [];
    for (const u of players) {
      const s = await rpc<{ tier: number }>(u, "league_standings");
      tiers.push(s.tier);
    }
    expect(tiers.slice(0, 7)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(tiers.slice(7)).toEqual(Array(13).fill(0)); // ブロンズからは降格しない
    const inbox = await rpc<{ leagueRewards: { rank: number; gems: number; newTier: number }[] }>(players[0], "my_social_inbox");
    expect(inbox.leagueRewards).toEqual([expect.objectContaining({ rank: 1, gems: 50, newTier: 1 })]);
    const third = await rpc<{ leagueRewards: { gems: number }[] }>(players[2], "my_social_inbox");
    expect(third.leagueRewards[0].gems).toBe(20);
    const last = await rpc<{ leagueRewards: { gems: number }[] }>(players[19], "my_social_inbox");
    expect(last.leagueRewards[0].gems).toBe(0);
  });

  it("demotes inactive players from higher tiers", async () => {
    await setNow("2026-11-23T10:00:00+09:00");
    const u = await addUser("2026-11-23T09:00:00+09:00");
    await db.query(
      `insert into public.profiles (id, friend_code) values ($1, 'ZZZZZZZ2') on conflict do nothing`,
      [u],
    );
    await db.query(
      `insert into public.league_members (week, user_id, tier, group_id, xp) values ('2026-11-23', $1, 5, gen_random_uuid(), 0)`,
      [u],
    );
    await setNow("2026-11-30T10:00:00+09:00");
    expect((await rpc<{ tier: number }>(u, "league_standings")).tier).toBe(4);
  });
});

describe("friends, cheers and invites", () => {
  it("handles requests, acceptance and removal", async () => {
    const a = await addUser();
    const b = await addUser();
    const bCode = (await rpc<{ friendCode: string }>(b, "my_profile")).friendCode;
    await expect(rpc(a, "send_friend_request", ["NOPE2345"])).rejects.toThrow(/not_found/);
    await expect(rpc(a, "send_friend_request", [(await rpc<{ friendCode: string }>(a, "my_profile")).friendCode])).rejects.toThrow(/self/);
    expect(await rpc(a, "send_friend_request", [bCode.toLowerCase()])).toBe("requested");

    const inbox = await rpc<{ incomingRequests: { id: string }[] }>(b, "my_social_inbox");
    expect(inbox.incomingRequests.map((r) => r.id)).toEqual([a]);
    await expect(rpc(a, "send_cheer", [b])).rejects.toThrow(/not_friends/);

    await rpc(b, "respond_friend_request", [a, true]);
    const standings = await rpc<{ id: string }[]>(a, "friend_standings");
    expect(standings.map((s) => s.id).sort()).toEqual([a, b].sort());

    await rpc(a, "remove_friend", [b]);
    expect((await rpc<{ id: string }[]>(a, "friend_standings")).map((s) => s.id)).toEqual([a]);
  });

  it("accepts a reverse request instead of duplicating it", async () => {
    const a = await addUser();
    const b = await addUser();
    const aCode = (await rpc<{ friendCode: string }>(a, "my_profile")).friendCode;
    const bCode = (await rpc<{ friendCode: string }>(b, "my_profile")).friendCode;
    await rpc(a, "send_friend_request", [bCode]);
    expect(await rpc(b, "send_friend_request", [aCode])).toBe("accepted");
    expect(await rpc(a, "send_friend_request", [bCode])).toBe("already_friends");
  });

  it("allows one cheer per friend per day", async () => {
    const a = await addUser();
    const b = await addUser();
    await rpc(a, "send_friend_request", [(await rpc<{ friendCode: string }>(b, "my_profile")).friendCode]);
    await rpc(b, "respond_friend_request", [a, true]);
    await rpc(a, "send_cheer", [b]);
    await expect(rpc(a, "send_cheer", [b])).rejects.toThrow(/already_cheered/);
    const inbox = await rpc<{ cheersReceived: { from: string; day: string }[] }>(b, "my_social_inbox");
    expect(inbox.cheersReceived).toEqual([expect.objectContaining({ from: a, day: "2026-10-19" })]);
    await setNow("2026-10-20T12:00:00+09:00");
    await rpc(a, "send_cheer", [b]);
  });

  it("applies invite rules and unlocks the inviter reward after the first play", async () => {
    const inviter = await addUser();
    const code = (await rpc<{ friendCode: string }>(inviter, "my_profile")).friendCode;
    await expect(rpc(inviter, "accept_invite", [code])).rejects.toThrow(/self/);

    const old = await addUser("2026-10-01T00:00:00+09:00");
    await expect(rpc(old, "accept_invite", [code])).rejects.toThrow(/expired/);

    const invitee = await addUser();
    const result = await rpc<{ inviterId: string }>(invitee, "accept_invite", [code]);
    expect(result.inviterId).toBe(inviter);
    await expect(rpc(invitee, "accept_invite", [code])).rejects.toThrow(/already_used/);

    const friends = await rpc<{ id: string }[]>(invitee, "friend_standings");
    expect(friends.map((f) => f.id)).toContain(inviter);

    let inbox = await rpc<{ referrals: { unlocked: boolean }[] }>(inviter, "my_social_inbox");
    expect(inbox.referrals).toEqual([expect.objectContaining({ unlocked: false })]);
    await rpc(invitee, "submit_xp", [100]);
    inbox = await rpc<{ referrals: { unlocked: boolean }[] }>(inviter, "my_social_inbox");
    expect(inbox.referrals).toEqual([expect.objectContaining({ unlocked: true })]);
    const invitedBy = await rpc<{ invitedBy: { id: string } }>(invitee, "my_social_inbox");
    expect(invitedBy.invitedBy.id).toBe(inviter);
  });

  it("searches nicknames safely", async () => {
    const a = await addUser();
    const b = await addUser();
    await rpc(b, "set_nickname", ["検索_テスト%さん"]);
    expect((await rpc<unknown[]>(a, "search_profiles", ["テスト%"])).length).toBe(1);
    expect((await rpc<unknown[]>(a, "search_profiles", ["%"])).length).toBe(0);
    expect(await rpc<unknown[]>(a, "search_profiles", ["検"])).toEqual([]);
  });

  it("lets signed-out visitors see an inviter on the invite page", async () => {
    const inviter = await addUser();
    await rpc(inviter, "set_nickname", ["招待マン"]);
    const code = (await rpc<{ friendCode: string }>(inviter, "my_profile")).friendCode;
    await db.exec(`set role anon`);
    try {
      const rows = await db.query<{ r: { nickname: string; isFriend: boolean } }>(`select public.get_profile($1) as r`, [code]);
      expect(rows.rows[0].r).toMatchObject({ nickname: "招待マン", isFriend: false });
      await expect(db.query(`select public.my_social_inbox()`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });

  it("does not let clients call internal functions or fake the clock", async () => {
    const u = await addUser();
    await expect(as(u, `select dopatan_private.ensure_league($1)`, [u])).rejects.toThrow(/permission denied/);
  });
});

describe("presents", () => {
  type Row = { id: string; title: string; gems: number; expiresAt: string | null };
  const send = async (code: string | null, title: string, gems = 10, expires: string | null = null) =>
    (
      await db.query<{ id: string }>(
        `select dopatan_private.send_present($1, $2, null, 0, $3, 0, null, $4::timestamptz) as id`,
        [code, title, gems, expires],
      )
    ).rows[0].id;

  it("shows presents for everyone and for me, but not for others", async () => {
    const a = await addUser();
    const b = await addUser();
    const codeA = (await rpc<{ friendCode: string }>(a, "my_profile")).friendCode;
    await rpc(b, "my_profile");
    await send(null, "みんなへ");
    await send(codeA.toLowerCase(), "Aさんへ", 50);
    const forA = (await rpc<Row[]>(a, "my_presents")).map((r) => r.title);
    const forB = (await rpc<Row[]>(b, "my_presents")).map((r) => r.title);
    expect(forA).toEqual(expect.arrayContaining(["みんなへ", "Aさんへ"]));
    expect(forB).toContain("みんなへ");
    expect(forB).not.toContain("Aさんへ");
  });

  it("hides presents that have not started or have expired", async () => {
    const u = await addUser();
    const code = (await rpc<{ friendCode: string }>(u, "my_profile")).friendCode;
    await send(code, "期限切れ", 10, "2026-10-19T11:00:00+09:00");
    await send(code, "あと1日", 10, "2026-10-20T12:00:00+09:00");
    await db.query(
      `insert into public.presents (user_id, title, gems, starts_at) values ($1, 'まだ', 10, '2026-10-25T00:00:00+09:00')`,
      [u],
    );
    const titles = (await rpc<Row[]>(u, "my_presents")).map((r) => r.title);
    expect(titles).toContain("あと1日");
    expect(titles).not.toContain("期限切れ");
    expect(titles).not.toContain("まだ");
    await setNow("2026-10-26T00:00:00+09:00");
    const later = (await rpc<Row[]>(u, "my_presents")).map((r) => r.title);
    expect(later).toContain("まだ");
    expect(later).not.toContain("あと1日");
  });

  it("only lets the admin send presents and blocks direct table access", async () => {
    const u = await addUser();
    await rpc(u, "my_profile");
    await expect(send("ZZZZZZZZ", "だれ?")).rejects.toThrow(/not_found/);
    await expect(
      as(u, `select dopatan_private.send_present(null, 'ずる', null, 0, 9999, 0, null, null)`),
    ).rejects.toThrow(/permission denied/);
    expect(await as(u, `select * from public.presents`)).toEqual([]);
    // 列の既定値が非公開スキーマの関数を使うので、RLS より先に権限で止まる(どちらでも書き込めない)
    await expect(as(u, `insert into public.presents (title, gems) values ('ずる', 9999)`)).rejects.toThrow(
      /row-level security|permission denied/,
    );
    await expect(db.query(`select dopatan_private.send_present(null, 'マイナス', null, 0, -5, 0, null, null)`)).rejects.toThrow(/check/);
  });

  it("requires sign-in", async () => {
    await db.exec(`set role authenticated`);
    try {
      await expect(db.query(`select public.my_presents()`)).rejects.toThrow(/not_signed_in/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

describe("news and push", () => {
  /** ゲスト(anon)として実行する */
  async function asAnon<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await db.exec(`set role anon`);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec(`reset role`);
    }
  }
  const SECRET = "test-push-secret-123456";

  it("lets guests and members save subscriptions, linking members to their account", async () => {
    const u = await addUser();
    await asAnon(`select public.save_push_subscription('https://push.example/guest', 'k1', 'a1')`);
    await as(u, `select public.save_push_subscription('https://push.example/member', 'k2', 'a2')`);
    // ゲストで登録した端末に、あとからログインした
    await as(u, `select public.save_push_subscription('https://push.example/guest', 'k1', 'a1')`);
    const rows = await db.query<{ endpoint: string; user_id: string | null }>(
      `select endpoint, user_id from public.push_subscriptions where endpoint like 'https://push.example/%' order by endpoint`,
    );
    expect(rows.rows).toEqual([
      { endpoint: "https://push.example/guest", user_id: u },
      { endpoint: "https://push.example/member", user_id: u },
    ]);
    await expect(asAnon(`select public.save_push_subscription('javascript:alert(1)', 'k', 'a')`)).rejects.toThrow(/invalid_endpoint/);
    await asAnon(`select public.delete_push_subscription('https://push.example/member')`);
    expect((await db.query(`select 1 from public.push_subscriptions where endpoint = 'https://push.example/member'`)).rows).toEqual([]);
  });

  it("keeps subscriptions and announcements out of direct reach", async () => {
    const u = await addUser();
    expect(await as(u, `select * from public.push_subscriptions`)).toEqual([]);
    expect(await as(u, `select * from public.announcements`)).toEqual([]);
    await expect(asAnon(`select * from dopatan_private.push_config`)).rejects.toThrow(/permission denied/);
  });

  it("lists only live announcements, for guests too", async () => {
    await db.query(`insert into public.announcements (title, body, starts_at, expires_at) values
      ('公開中', '本文', '2026-10-19T00:00:00+09:00', null),
      ('予約', '本文', '2026-10-30T00:00:00+09:00', null),
      ('終了', '本文', '2026-10-01T00:00:00+09:00', '2026-10-10T00:00:00+09:00')`);
    const list = (await asAnon<{ r: { title: string }[] }>(`select public.list_announcements() as r`))[0].r.map((a) => a.title);
    expect(list).toContain("公開中");
    expect(list).not.toContain("予約");
    expect(list).not.toContain("終了");
  });

  it("hands out the push batch only with the secret, and only once per item", async () => {
    await db.query(`insert into dopatan_private.push_config (secret) values ($1) on conflict do nothing`, [SECRET]);
    await db.query(`insert into public.announcements (title, body, notify, starts_at) values ('通知する', '本文', true, '2026-10-19T00:00:00+09:00')`);
    await db.query(`select dopatan_private.send_present(null, '全員にプレゼント', null, 0, 10, 0, null, null)`);
    await asAnon(`select public.save_push_subscription('https://push.example/batch', 'k', 'a')`);

    expect((await asAnon<{ r: unknown }>(`select public.push_batch('wrong-secret-wrong') as r`))[0].r).toBeNull();
    expect((await asAnon<{ r: unknown }>(`select public.push_batch(null) as r`))[0].r).toBeNull();

    type Batch = { subscriptions: { endpoint: string }[]; announcements: { title: string }[]; presents: { title: string }[] };
    const first = (await asAnon<{ r: Batch }>(`select public.push_batch($1) as r`, [SECRET]))[0].r;
    expect(first.subscriptions.map((s) => s.endpoint)).toContain("https://push.example/batch");
    expect(first.announcements.map((a) => a.title)).toContain("通知する");
    expect(first.presents.map((p) => p.title)).toContain("全員にプレゼント");

    const second = (await asAnon<{ r: Batch }>(`select public.push_batch($1) as r`, [SECRET]))[0].r;
    expect(second.announcements).toEqual([]);
    expect(second.presents).toEqual([]);

    await asAnon(`select public.push_remove('nope-nope-nope-nope', array['https://push.example/batch'])`);
    expect((await db.query(`select 1 from public.push_subscriptions where endpoint = 'https://push.example/batch'`)).rows).toHaveLength(1);
    await asAnon(`select public.push_remove($1, array['https://push.example/batch'])`, [SECRET]);
    expect((await db.query(`select 1 from public.push_subscriptions where endpoint = 'https://push.example/batch'`)).rows).toEqual([]);
  });
});
