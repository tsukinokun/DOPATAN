-- DOPATAN の初期スキーマ。Supabase の SQL Editor に貼り付けて実行する。

-- プロフィール(フェーズ4のランキング・フレンドで使う)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- 学習記録・統計・設定(1ユーザー1行)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{"sessions":0,"bestScore":0,"bestCombo":0}'::jsonb,
  settings jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

-- 自分の行だけ読み書きできる
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

create policy "user_data: read own" on public.user_data
  for select using (auth.uid() = user_id);
create policy "user_data: insert own" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "user_data: update own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_data: delete own" on public.user_data
  for delete using (auth.uid() = user_id);

-- 新しいユーザーが登録されたらプロフィールを作る
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
