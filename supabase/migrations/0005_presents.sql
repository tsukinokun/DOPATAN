-- プレゼントボックス:補填やイベント報酬を配る。
-- 受け取ったかどうかはクライアントの台帳(present:server:{id})で判定するので、ここでは配るものだけを持つ。
-- 既存のプロジェクトでは SQL Editor で1回実行する(何度実行しても大丈夫)。

create table if not exists public.presents (
  id uuid primary key default gen_random_uuid(),
  -- null なら全員向け
  user_id uuid references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  message text check (message is null or char_length(message) <= 1000),
  coins int not null default 0 check (coins >= 0),
  gems int not null default 0 check (gems >= 0),
  xp int not null default 0 check (xp >= 0),
  skin text,
  starts_at timestamptz not null default dopatan_private.now(),
  expires_at timestamptz,
  created_at timestamptz not null default dopatan_private.now()
);

create index if not exists presents_user_id_idx on public.presents (user_id);

-- 直接は読み書きさせない(読むのは my_presents だけ)
alter table public.presents enable row level security;

/** 自分が今受け取れるプレゼント(全員向け+自分向け、始まっていて期限が切れていないもの) */
create or replace function public.my_presents() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := dopatan_private.me();
  t timestamptz := dopatan_private.now();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'message', p.message,
      'coins', p.coins, 'gems', p.gems, 'xp', p.xp, 'skin', p.skin,
      'startsAt', p.starts_at, 'expiresAt', p.expires_at
    ) order by p.created_at)
    from public.presents p
    where (p.user_id is null or p.user_id = uid)
      and p.starts_at <= t
      and (p.expires_at is null or p.expires_at > t)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.my_presents() from public;
grant execute on function public.my_presents() to authenticated;

/**
 * SQL Editor から配るための関数。p_friend_code が null なら全員向け。
 * 例:select dopatan_private.send_present('ABCD1234', '補填', 'ご迷惑をおかけしました', 0, 50, 0, null, now() + interval '30 days');
 */
create or replace function dopatan_private.send_present(
  p_friend_code text,
  p_title text,
  p_message text default null,
  p_coins int default 0,
  p_gems int default 0,
  p_xp int default 0,
  p_skin text default null,
  p_expires_at timestamptz default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  target uuid;
  new_id uuid;
begin
  if p_friend_code is not null then
    select id into target from public.profiles where friend_code = upper(btrim(p_friend_code));
    if target is null then
      raise exception 'not_found';
    end if;
  end if;
  insert into public.presents (user_id, title, message, coins, gems, xp, skin, expires_at)
  values (target, p_title, p_message, coalesce(p_coins, 0), coalesce(p_gems, 0), coalesce(p_xp, 0), p_skin, p_expires_at)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function dopatan_private.send_present(text, text, text, int, int, int, text, timestamptz) from public;
