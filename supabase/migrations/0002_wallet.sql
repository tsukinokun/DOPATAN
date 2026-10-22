-- フェーズ3:コイン・ジェム・スキン・ミッションなどのウォレットを保存する列を追加する。
-- Supabase の SQL Editor に貼り付けて実行する(何度実行しても問題ない)。
alter table public.user_data add column if not exists wallet jsonb;
