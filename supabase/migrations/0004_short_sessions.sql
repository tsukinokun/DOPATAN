-- 1回のプレイを90秒にしたので、XP を受け付ける間隔を150秒から80秒に縮める。
-- (カウントダウンと終了演出を含めると1回は約95秒かかるので、普通に遊ぶ分には引っかからない)
-- 何度流しても同じ結果になる。

/**
 * プレイ1回分の XP を今週のリーグに足す。1回あたり600まで、前回から80秒以上あけないと受け付けない。
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
  if last_at is not null and last_at > t - interval '80 seconds' then
    raise exception 'too_soon';
  end if;
  m := dopatan_private.ensure_league(uid);
  update public.league_members set xp = xp + accepted where week = m.week and user_id = uid returning * into m;
  update public.profiles set last_xp_at = t where id = uid;
  update public.referral_rewards set unlocked_at = t where invitee = uid and unlocked_at is null;
  return jsonb_build_object('accepted', accepted, 'weekXp', m.xp, 'tier', m.tier);
end;
$$;
