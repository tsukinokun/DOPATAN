-- フェーズ4:ニックネーム・フレンド・招待・応援・週ごとのリーグ。
-- Supabase の SQL Editor に貼り付けて1回実行する。
-- テーブルへの書き込みはすべて下の関数(RPC)を通す。クライアントからの直接の書き込みは RLS で禁止する。

-- ---------------------------------------------------------------------------
-- 内部用(API には公開しない)
-- ---------------------------------------------------------------------------
create schema if not exists dopatan_private;
revoke all on schema dopatan_private from public;

/** 現在時刻。データベースに直接つないだ管理者だけが dopatan.now でずらせる(テスト用) */
create or replace function dopatan_private.now() returns timestamptz
language sql stable
as $$
  select case
    when session_user = 'postgres' and nullif(current_setting('dopatan.now', true), '') is not null
      then current_setting('dopatan.now', true)::timestamptz
    else pg_catalog.now()
  end
$$;

/** 日本時間の今日 */
create or replace function dopatan_private.today() returns date
language sql stable
as $$ select (dopatan_private.now() at time zone 'Asia/Tokyo')::date $$;

/** 日本時間の月曜0時で切り替わる週(その週の月曜日) */
create or replace function dopatan_private.current_week() returns date
language sql stable
as $$ select date_trunc('week', dopatan_private.now() at time zone 'Asia/Tokyo')::date $$;

/** 読み間違えやすい文字(0/O、1/I/L)を除いた8文字のフレンドコード */
create or replace function dopatan_private.new_friend_code() returns text
language plpgsql volatile
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- プロフィール:本名やメールから作った名前は公開できないので消し、ニックネームに置き換える
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists display_name;
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists friend_code text,
  add column if not exists invited_by uuid references public.profiles (id) on delete set null,
  add column if not exists invite_used_at timestamptz,
  add column if not exists stats jsonb not null default '{}'::jsonb,
  add column if not exists last_xp_at timestamptz;

update public.profiles set friend_code = dopatan_private.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
create unique index if not exists profiles_friend_code_key on public.profiles (friend_code);
create index if not exists profiles_nickname_idx on public.profiles (lower(nickname));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, friend_code)
  values (new.id, dopatan_private.new_friend_code())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ニックネームと公開用の数値だけなので、ログインしている人は誰のプロフィールでも読める
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: read all" on public.profiles;
create policy "profiles: read all" on public.profiles for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------
create table if not exists public.league_members (
  week date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier int not null check (tier between 0 and 9),
  group_id uuid not null,
  xp int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists league_members_group_idx on public.league_members (week, group_id);

create table if not exists public.league_rewards (
  week date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null,
  tier int not null,
  new_tier int not null,
  gems int not null,
  primary key (week, user_id)
);

create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee);

create table if not exists public.cheers (
  sender uuid not null references public.profiles (id) on delete cascade,
  receiver uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (sender, receiver, day)
);
create index if not exists cheers_receiver_idx on public.cheers (receiver, day);

create table if not exists public.referral_rewards (
  invitee uuid primary key references public.profiles (id) on delete cascade,
  inviter uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 招待された人が1回プレイすると、招待した人が報酬を受け取れるようになる
  unlocked_at timestamptz
);

alter table public.league_members enable row level security;
alter table public.league_rewards enable row level security;
alter table public.friendships enable row level security;
alter table public.cheers enable row level security;
alter table public.referral_rewards enable row level security;

-- 読むだけ。書き込みのポリシーは作らない(=関数からしか書けない)
drop policy if exists "league_members: read all" on public.league_members;
create policy "league_members: read all" on public.league_members for select to authenticated using (true);
drop policy if exists "league_rewards: read own" on public.league_rewards;
create policy "league_rewards: read own" on public.league_rewards for select to authenticated using (auth.uid() = user_id);
drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
drop policy if exists "cheers: read own" on public.cheers;
create policy "cheers: read own" on public.cheers for select to authenticated using (auth.uid() in (sender, receiver));
drop policy if exists "referral_rewards: read own" on public.referral_rewards;
create policy "referral_rewards: read own" on public.referral_rewards for select to authenticated
  using (auth.uid() in (inviter, invitee));

-- ---------------------------------------------------------------------------
-- 内部の処理
-- ---------------------------------------------------------------------------

/** ログイン中のユーザー。プロフィールが無ければ作る */
create or replace function dopatan_private.me() returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  insert into public.profiles (id, friend_code) values (uid, dopatan_private.new_friend_code())
  on conflict (id) do nothing;
  return uid;
end;
$$;

create or replace function dopatan_private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  )
$$;

/** 順位ごとのリーグ報酬 */
create or replace function dopatan_private.league_gems(p_rank int) returns int
language sql immutable
as $$ select case when p_rank = 1 then 50 when p_rank = 2 then 30 when p_rank = 3 then 20 when p_rank <= 7 then 10 else 0 end $$;

/**
 * 今週のリーグに入れる。新しい週に初めて呼ばれたときは、先週の順位を確定して
 * 昇格(上位7人)・降格(下位5人)と報酬を決めてから、同じ段階の空いているグループに入れる。
 */
create or replace function dopatan_private.ensure_league(uid uuid) returns public.league_members
language plpgsql volatile security definer set search_path = ''
as $$
declare
  w date := dopatan_private.current_week();
  m public.league_members;
  prev public.league_members;
  my_rank int;
  group_size int;
  next_tier int := 0;
  g uuid;
begin
  select * into m from public.league_members where week = w and user_id = uid;
  if found then
    return m;
  end if;

  select * into prev from public.league_members where user_id = uid and week < w order by week desc limit 1;
  if found then
    next_tier := prev.tier;
    if prev.week = w - 7 then
      select count(*) + 1 into my_rank from public.league_members o
      where o.week = prev.week and o.group_id = prev.group_id
        and (o.xp > prev.xp or (o.xp = prev.xp and o.joined_at < prev.joined_at));
      select count(*) into group_size from public.league_members o
      where o.week = prev.week and o.group_id = prev.group_id;

      if prev.xp > 0 and my_rank <= 7 then
        next_tier := least(prev.tier + 1, 9);
      elsif prev.xp = 0 or my_rank > group_size - 5 then
        next_tier := greatest(prev.tier - 1, 0);
      end if;

      insert into public.league_rewards (week, user_id, rank, tier, new_tier, gems)
      values (prev.week, uid, my_rank, prev.tier, next_tier,
              case when prev.xp > 0 then dopatan_private.league_gems(my_rank) else 0 end)
      on conflict do nothing;
    end if;
  end if;

  -- 同じ段階のグループ分けが同時に走って31人以上にならないようにする
  perform pg_advisory_xact_lock(hashtext('league:' || w::text || ':' || next_tier::text));
  select group_id into g from public.league_members
  where week = w and tier = next_tier
  group by group_id
  having count(*) < 30
  order by min(joined_at)
  limit 1;
  if g is null then
    g := gen_random_uuid();
  end if;

  insert into public.league_members (week, user_id, tier, group_id, xp, joined_at)
  values (w, uid, next_tier, g, 0, dopatan_private.now())
  returning * into m;
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- API(ログインしている人だけが呼べる)
-- ---------------------------------------------------------------------------

create or replace function public.set_nickname(p_nickname text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  name text := btrim(p_nickname);
begin
  if char_length(name) < 2 or char_length(name) > 12 then
    raise exception 'invalid_nickname';
  end if;
  update public.profiles set nickname = name where id = uid;
end;
$$;

/** ランクやマスター数などの公開用の数値(自己申告。表示にだけ使う) */
create or replace function public.publish_stats(p_stats jsonb) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
begin
  if jsonb_typeof(p_stats) <> 'object' or length(p_stats::text) > 1000 then
    raise exception 'invalid_stats';
  end if;
  update public.profiles set stats = p_stats where id = uid;
end;
$$;

/** プロフィールとフレンドコードなど自分の情報 */
create or replace function public.my_profile() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
begin
  return (select jsonb_build_object('id', id, 'nickname', nickname, 'friendCode', friend_code, 'invitedBy', invited_by)
          from public.profiles where id = uid);
end;
$$;

/**
 * プレイ1回分の XP を今週のリーグに足す。1回あたり600まで、前回から150秒以上あけないと受け付けない。
 * 招待されて来た人の初めてのプレイなら、招待した人の報酬を受け取れるようにする。
 */
create or replace function public.submit_xp(p_xp int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  m public.league_members;
  last_at timestamptz;
  accepted int := least(greatest(coalesce(p_xp, 0), 0), 600);
  t timestamptz := dopatan_private.now();
begin
  select last_xp_at into last_at from public.profiles where id = uid for update;
  if last_at is not null and last_at > t - interval '150 seconds' then
    raise exception 'too_soon';
  end if;
  m := dopatan_private.ensure_league(uid);
  update public.league_members set xp = xp + accepted where week = m.week and user_id = uid returning * into m;
  update public.profiles set last_xp_at = t where id = uid;
  update public.referral_rewards set unlocked_at = t where invitee = uid and unlocked_at is null;
  return jsonb_build_object('accepted', accepted, 'weekXp', m.xp, 'tier', m.tier);
end;
$$;

/** 今週のリーグの自分のグループの順位表 */
create or replace function public.league_standings() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  m public.league_members := dopatan_private.ensure_league(uid);
begin
  return jsonb_build_object(
    'week', m.week,
    'tier', m.tier,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code,
          'xp', lm.xp, 'stats', p.stats, 'me', p.id = uid
        ) order by lm.xp desc, lm.joined_at)
      from public.league_members lm join public.profiles p on p.id = lm.user_id
      where lm.week = m.week and lm.group_id = m.group_id
    ), '[]'::jsonb)
  );
end;
$$;

/** フレンドコードで申請する。相手からの申請が来ていれば、そのまま承認する */
create or replace function public.send_friend_request(p_code text) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  target uuid;
begin
  select id into target from public.profiles where friend_code = upper(btrim(p_code));
  if target is null then
    raise exception 'not_found';
  elsif target = uid then
    raise exception 'self';
  elsif dopatan_private.are_friends(uid, target) then
    return 'already_friends';
  end if;
  if exists (select 1 from public.friendships where requester = target and addressee = uid) then
    update public.friendships set status = 'accepted' where requester = target and addressee = uid;
    return 'accepted';
  end if;
  insert into public.friendships (requester, addressee, status) values (uid, target, 'pending')
  on conflict do nothing;
  return 'requested';
end;
$$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
begin
  if p_accept then
    update public.friendships set status = 'accepted'
    where requester = p_requester and addressee = uid and status = 'pending';
  else
    delete from public.friendships where requester = p_requester and addressee = uid and status = 'pending';
  end if;
end;
$$;

/** フレンドを解除する(自分が送った申請の取り消しにも使う) */
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
begin
  delete from public.friendships
  where (requester = uid and addressee = p_other) or (requester = p_other and addressee = uid);
end;
$$;

/** ニックネームの部分一致で探す(最大20件) */
create or replace function public.search_profiles(p_query text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  q text := btrim(coalesce(p_query, ''));
begin
  if char_length(q) < 2 then
    return '[]'::jsonb;
  end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code, 'stats', p.stats))
    from (
      select * from public.profiles
      where id <> uid and nickname ilike '%' || q || '%'
      order by nickname
      limit 20
    ) p
  ), '[]'::jsonb);
end;
$$;

/** フレンドコードからプロフィールを見る(招待ページ・プロフィール画面) */
create or replace function public.get_profile(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code, 'stats', p.stats,
      'tier', (select tier from public.league_members where user_id = p.id order by week desc limit 1),
      'weekXp', coalesce((select xp from public.league_members
                          where user_id = p.id and week = dopatan_private.current_week()), 0),
      'isFriend', uid is not null and dopatan_private.are_friends(uid, p.id)
    )
    from public.profiles p where p.friend_code = upper(btrim(p_code))
  );
end;
$$;

/** フレンド(と自分)の今週の XP。フレンド内ランキングに使う */
create or replace function public.friend_standings() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  w date := dopatan_private.current_week();
  d date := dopatan_private.today();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code, 'stats', p.stats,
        'weekXp', coalesce(lm.xp, 0), 'me', p.id = uid,
        'cheeredToday', exists (select 1 from public.cheers c where c.sender = uid and c.receiver = p.id and c.day = d)
      ) order by coalesce(lm.xp, 0) desc, p.nickname)
    from public.profiles p
    left join public.league_members lm on lm.user_id = p.id and lm.week = w
    where p.id = uid or dopatan_private.are_friends(uid, p.id)
  ), '[]'::jsonb);
end;
$$;

/** フレンドに応援を送る(同じ相手には1日1回) */
create or replace function public.send_cheer(p_to uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
begin
  if not dopatan_private.are_friends(uid, p_to) then
    raise exception 'not_friends';
  end if;
  insert into public.cheers (sender, receiver, day) values (uid, p_to, dopatan_private.today());
exception when unique_violation then
  raise exception 'already_cheered';
end;
$$;

/**
 * 招待リンクから来た人が呼ぶ。登録から7日以内で、まだ招待を使っていない人だけ。
 * 招待した人とすぐフレンドになる。
 */
create or replace function public.accept_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  inviter public.profiles;
  me_row public.profiles;
  signed_up timestamptz;
begin
  select * into inviter from public.profiles where friend_code = upper(btrim(p_code));
  if inviter.id is null then
    raise exception 'not_found';
  elsif inviter.id = uid then
    raise exception 'self';
  end if;
  select * into me_row from public.profiles where id = uid for update;
  if me_row.invite_used_at is not null then
    raise exception 'already_used';
  end if;
  select created_at into signed_up from auth.users where id = uid;
  if signed_up < dopatan_private.now() - interval '7 days' then
    raise exception 'expired';
  end if;

  update public.profiles set invited_by = inviter.id, invite_used_at = dopatan_private.now() where id = uid;
  delete from public.friendships
  where (requester = uid and addressee = inviter.id) or (requester = inviter.id and addressee = uid);
  insert into public.friendships (requester, addressee, status) values (inviter.id, uid, 'accepted');
  insert into public.referral_rewards (invitee, inviter) values (uid, inviter.id) on conflict do nothing;
  return jsonb_build_object('inviterId', inviter.id, 'nickname', inviter.nickname, 'friendCode', inviter.friend_code);
end;
$$;

/**
 * 通知と、まだ台帳に入れていないかもしれない報酬の元データ。
 * 受け取り済みかどうかはクライアントの台帳の ID で判定する。
 */
create or replace function public.my_social_inbox() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  since date := dopatan_private.today() - 7;
begin
  perform dopatan_private.ensure_league(uid);
  return jsonb_build_object(
    'today', dopatan_private.today(),
    'cheersReceived', coalesce((
      select jsonb_agg(jsonb_build_object('from', c.sender, 'nickname', p.nickname, 'friendCode', p.friend_code, 'day', c.day)
                       order by c.created_at)
      from public.cheers c join public.profiles p on p.id = c.sender
      where c.receiver = uid and c.day >= since), '[]'::jsonb),
    'cheersSent', coalesce((
      select jsonb_agg(jsonb_build_object('to', c.receiver, 'day', c.day) order by c.created_at)
      from public.cheers c where c.sender = uid and c.day >= since), '[]'::jsonb),
    'incomingRequests', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code, 'stats', p.stats))
      from public.friendships f join public.profiles p on p.id = f.requester
      where f.addressee = uid and f.status = 'pending'), '[]'::jsonb),
    'outgoingRequests', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code))
      from public.friendships f join public.profiles p on p.id = f.addressee
      where f.requester = uid and f.status = 'pending'), '[]'::jsonb),
    'leagueRewards', coalesce((
      select jsonb_agg(jsonb_build_object('week', week, 'rank', rank, 'tier', tier, 'newTier', new_tier, 'gems', gems)
                       order by week)
      from public.league_rewards where user_id = uid), '[]'::jsonb),
    'invitedBy', (
      select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'friendCode', p.friend_code)
      from public.profiles me_p join public.profiles p on p.id = me_p.invited_by where me_p.id = uid),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object('invitee', r.invitee, 'nickname', p.nickname, 'friendCode', p.friend_code, 'unlocked', r.unlocked_at is not null))
      from public.referral_rewards r join public.profiles p on p.id = r.invitee
      where r.inviter = uid), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 権限:API の関数はログインしている人だけが呼べる
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'set_nickname(text)', 'publish_stats(jsonb)', 'my_profile()', 'submit_xp(int)', 'league_standings()',
    'send_friend_request(text)', 'respond_friend_request(uuid, boolean)', 'remove_friend(uuid)',
    'search_profiles(text)', 'get_profile(text)', 'friend_standings()', 'send_cheer(uuid)',
    'accept_invite(text)', 'my_social_inbox()'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
-- 招待ページはログイン前に開くので、招待した人の名前だけは誰でも見られるようにする
grant execute on function public.get_profile(text) to anon;
revoke all on all functions in schema dopatan_private from public;
