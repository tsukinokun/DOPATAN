-- セキュリティの点検で見つかった点の修正。既存のプロジェクトでは SQL Editor で1回実行する(何度実行しても大丈夫)。

-- ---------------------------------------------------------------------------
-- 1. 通知の送り先は、実在するプッシュサービスの URL だけを受け付ける
--    (だれでも好きな URL を登録できると、送信が遅くなったり、知らない URL にリクエストを送らされたりする)
-- ---------------------------------------------------------------------------
create or replace function dopatan_private.is_push_endpoint(p_endpoint text) returns boolean
language sql immutable
as $$
  select p_endpoint is not null
    and char_length(p_endpoint) <= 1000
    and p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|web\.push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not dopatan_private.is_push_endpoint(p_endpoint) then
    raise exception 'invalid_endpoint';
  end if;
  -- 鍵は base64url(P-256 の公開鍵は 87〜88 文字、auth は 22〜24 文字)
  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{80,100}={0,2}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{16,32}={0,2}$' then
    raise exception 'invalid_keys';
  end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id),
        updated_at = dopatan_private.now();
end;
$$;

-- すでに登録された、プッシュサービス以外の送り先を消す
delete from public.push_subscriptions where not dopatan_private.is_push_endpoint(endpoint);

/** 送り先は1回に最大5,000件まで返す(古い順。毎日の送信が重くなりすぎないように) */
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
      from (select * from public.push_subscriptions order by updated_at desc limit 5000) s), '[]'::jsonb),
    'announcements', news,
    'presents', gifts
  );
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text) to anon, authenticated;
revoke all on function public.push_batch(text) from public;
grant execute on function public.push_batch(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. プロフィールの表は、直接は自分の行だけ読めるようにする
--    (ほかの人の情報は、search_profiles などの関数が必要な列だけ返す)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read all" on public.profiles;
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using (auth.uid() = id);
