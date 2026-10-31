-- お知らせ欄とスマホ通知(Web Push)。既存のプロジェクトでは SQL Editor で1回実行する(何度実行しても大丈夫)。
-- 通知を送るのは Vercel の定期実行(app/api/push/daily)。service_role キーは使わず、
-- dopatan_private.push_config に入れた合言葉を知っているときだけ送り先を読めるようにする。

-- ---------------------------------------------------------------------------
-- お知らせ
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 2000),
  link text,
  -- true ならスマホにも通知する(翌朝7時にまとめて)
  notify boolean not null default false,
  starts_at timestamptz not null default dopatan_private.now(),
  expires_at timestamptz,
  created_at timestamptz not null default dopatan_private.now(),
  pushed_at timestamptz
);
alter table public.announcements enable row level security;

/** 公開中のお知らせ(ゲストも読める) */
create or replace function public.list_announcements() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'body', a.body, 'link', a.link,
    'startsAt', a.starts_at, 'expiresAt', a.expires_at
  ) order by a.starts_at desc), '[]'::jsonb)
  from public.announcements a
  where a.starts_at <= dopatan_private.now()
    and (a.expires_at is null or a.expires_at > dopatan_private.now())
$$;

-- ---------------------------------------------------------------------------
-- 通知の送り先(端末ごと。ゲストは user_id なし)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default dopatan_private.now(),
  updated_at timestamptz not null default dopatan_private.now()
);
alter table public.push_subscriptions enable row level security;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid_endpoint';
  end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        -- ゲストで登録した端末にあとからログインしたら、その人の端末にする(ログアウトしても消さない)
        user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id),
        updated_at = dopatan_private.now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql volatile security definer set search_path = ''
as $$ delete from public.push_subscriptions where endpoint = p_endpoint $$;

-- ---------------------------------------------------------------------------
-- 送信(合言葉が必要)
-- ---------------------------------------------------------------------------
create table if not exists dopatan_private.push_config (
  secret text primary key check (char_length(secret) >= 16)
);

alter table public.presents add column if not exists pushed_at timestamptz;

create or replace function dopatan_private.push_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = ''
as $$ select p_secret is not null and exists (select 1 from dopatan_private.push_config where secret = p_secret) $$;

/**
 * 今日送るもの:送り先の一覧と、まだ通知していない(notify の)お知らせ・プレゼント。
 * 返したお知らせとプレゼントは通知済みにする。合言葉が違えば何も返さない。
 */
create or replace function public.push_batch(p_secret text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t timestamptz := dopatan_private.now();
  news jsonb;
  gifts jsonb;
begin
  if not dopatan_private.push_secret_ok(p_secret) then
    return null;
  end if;

  with picked as (
    update public.announcements a set pushed_at = t
    where a.notify and a.pushed_at is null and a.starts_at <= t and (a.expires_at is null or a.expires_at > t)
    returning a.id, a.title, a.body, a.link, a.starts_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'link', link) order by starts_at), '[]'::jsonb)
  into news from picked;

  with picked as (
    update public.presents p set pushed_at = t
    where p.pushed_at is null and p.starts_at <= t and (p.expires_at is null or p.expires_at > t)
    returning p.id, p.title, p.user_id, p.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'userId', user_id) order by created_at), '[]'::jsonb)
  into gifts from picked;

  return jsonb_build_object(
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'userId', s.user_id))
      from public.push_subscriptions s), '[]'::jsonb),
    'announcements', news,
    'presents', gifts
  );
end;
$$;

/** もう届かない送り先(410 / 404)を消す */
create or replace function public.push_remove(p_secret text, p_endpoints text[]) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not dopatan_private.push_secret_ok(p_secret) then
    return;
  end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
end;
$$;

-- 権限:ゲスト(anon)も呼べる。送信用の2つは合言葉で守る
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'list_announcements()', 'save_push_subscription(text, text, text)', 'delete_push_subscription(text)',
    'push_batch(text)', 'push_remove(text, text[])'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to anon, authenticated', fn);
  end loop;
end;
$$;
revoke all on function dopatan_private.push_secret_ok(text) from public;
