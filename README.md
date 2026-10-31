# DOPATAN

派手な演出で覚える、ドパガキ向け TOEIC 英単語アプリです。英単語を「絵と日本語」のカードにスワイプして答えます(Drops 方式)。Next.js で作った PWA で、スマホと PC の両方に対応しています。

## 遊び方

- 1回のプレイは90秒です。
- 新しい単語は、カード1枚の紹介から始まり、2枚、4枚と選択肢が増えます。
- 間違えた単語は、数問後にもう一度出題されます。
- 10コンボごとに FEVER になり、8秒間スコアが3倍になります。
- PC では、ドラッグの代わりに数字キー(1〜4)でも答えられます。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 単体テスト(Vitest)
npm run build && npm run e2e   # E2E テスト(Playwright、スマホ幅と PC 幅)
node scripts/generate-icons.mjs  # public/icons/icon.svg から PWA 用アイコンを書き出す
node scripts/build-images.mjs    # 単語の絵(Fluent Emoji)を public/emoji にコピーし data/images.json を作る
```

単語を増やしたときは、`node scripts/build-images.mjs` と発音音声の作成(`scripts/tts/README.md`)を実行してください。足りない絵や音声は `npm test`(`lib/wordData.test.ts`)が教えてくれます。

## ログインとクラウド保存(Supabase)

環境変数が無いときは、ゲスト専用(端末内に保存)で動きます。ログインを使えるようにする手順:

1. [supabase.com](https://supabase.com) で無料のプロジェクトを作ります。
2. SQL Editor に `supabase/migrations/0001_init.sql` を貼り付けて実行します。
3. Authentication → URL Configuration を設定します。
   - Site URL:`https://dopatan.vercel.app`
   - Redirect URLs:`https://dopatan.vercel.app/auth/callback` と `http://localhost:3000/auth/callback`
4. Google でのログインを有効にします。
   - Google Cloud Console で OAuth クライアント(種類はウェブ)を作ります。
   - 承認済みリダイレクト URI は `https://<project>.supabase.co/auth/v1/callback` です。
   - 発行された ID とシークレットを、Authentication → Providers → Google に貼ります。
5. Project URL と anon キーを、`.env.local` と Vercel の Environment Variables の両方に登録します(変数名は `.env.example` を参照)。**service_role キーは使いません。**

ゲストで遊んだ記録は、ログインしたときにクラウドの記録とマージされます。単語ごとに、たくさん出題された方を残します。

## 報酬とガチャ

- **コイン**:プレイが終わるともらえます(10 + 正解数×2 + 最大コンボ + フィーバー1回ごとに10)。ノーマルガチャを回せます。
- **ジェム**:ログインボーナス、デイリーミッション、単語のマスター、実績でもらえます。レアガチャを回せます。
- **ガチャ**:景品は見た目のスキン(背景・正解エフェクト・効果音)だけです。確率はガチャ画面の「提供割合」に表示します。
- **台帳方式**:残高は保存せず、増減の記録(`lib/economy/ledger.ts`)から計算します。一度きりの報酬は日付や内容から ID を決めるので、端末をまたいでも二重には受け取れません。
- **既存の Supabase プロジェクトの場合**:`supabase/migrations/0002_wallet.sql` を SQL Editor で1回実行すると、ウォレットもクラウドに保存されます。実行するまでは学習記録だけが同期されます。

## XP・リーグ・フレンド

- **XP とランク**:プレイ1回で XP(10 + 正解数×3 + 最大コンボ + フィーバー1回ごとに15、最大600)がたまり、レベルとランクが上がります。ゲストでも使えます。
- **週ごとのリーグ**(ログインした人だけ):日本時間の月曜0時に切り替わります。全10段階で、1グループ30人です。上位7人が昇格、下位5人が降格し、1〜7位はジェムがもらえます。定期実行のジョブは使わず、新しい週に初めてアクセスしたときに先週の結果を確定します。
- **フレンド**:フレンドコード・ニックネーム検索・招待リンク(`/invite/<コード>`)で追加できます。フレンド内ランキング、プロフィール、応援(1日1回、送った人も受け取った人も💎2)があります。招待すると2人とも💎50です。
- **不正対策**:週の XP は Postgres の関数(`supabase/migrations/0003_social.sql`)を通してだけ記録します。1回600まで、前回から150秒以上あける必要があります。テーブルへの直接の書き込みは RLS で禁止しています。
- **表示名**:本名やメールアドレスは公開しません。ニックネームが未登録の人は、フレンドコードから決まるランダムな名前で表示します。
- **既存の Supabase プロジェクトの場合**:`0003_social.sql` を SQL Editor で1回実行してください。
- **SQL のテスト**:`lib/social/sql.test.ts` が PGlite(WebAssembly の Postgres)でマイグレーションを実際に流して確かめます(`npm test` に含まれます)。

## 週替わりイベント

すごろく → ビンゴ → ボスバトル → スタンプラリーの順に、日本時間の月曜0時で切り替わります(ホームのバナーと `/event`)。プレイが終わるとイベントの画面(`/event/progress`)で進む演出が出て、そのあと結果画面に進みます。

- **進み具合**:台帳のプレイ報酬(`session:*` の `stats`)から毎回計算します。サーバーの変更は無く、ゲストも遊べ、端末をまたいでも同じになります。ルールは `lib/events/` にあり、数字(マス数・HP・報酬)は定数で調整できます。目安は1日5回・1週間35回くらいで完走です。
- **お題の決まり**:遊び続ければ必ず達成できるもの(回数・正解数・コンボ・フィーバー・スコア・正解率)だけを使います。新しい単語・マスター・出題形式・スコア帯/テーマは、設定や学習の進み具合で達成できなくなるので使いません。
- **報酬**:プレゼントボックスに届きます(期限はイベント終了から7日)。完走報酬はイベント限定スキン(ガチャでは出ません)。
- **スキルチケット**:N / R / SR / SSR(同じレア度のスキンに使える)と万能の5種類。コレクションで、持っているスキンの 🎫 から使うと、かぶりが1枚増えます。
- **確認用**:開発中(`npm run dev`)だけ、URL に `?event=bingo` などを付けると今週のイベントを差し替えられます。

## プレゼントボックス

補填やイベント報酬を配る場所です(ホームの 🎁)。中身はコイン・ジェム・経験値・スキンを組み合わせられます(スキンは、持っていればかぶり扱いでレベルが上がります。経験値はリーグの週間 XP には入りません)。受け取ったかどうかは台帳の ID(`present:app:<id>` / `present:server:<id>`)で決まるので、端末をまたいでも二重には受け取れません。

- **全員に配る(ゲストにも届く)**:`lib/presents/catalog.ts` の `APP_PRESENTS` に足してデプロイします。`id` は一度配ったら変えないでください(変えると、もう一度受け取れてしまいます)。`startsAt`(受け取れるようになる時刻)と `expiresAt`(期限。`null` なら期限なし)はミリ秒で書きます。
- **特定の人に配る・デプロイせずに配る(ログイン中の人だけに届く)**:Supabase の SQL Editor で `dopatan_private.send_present` を呼びます。最初の引数はフレンドコードで、`null` にすると全員向けになります。

  ```sql
  -- 引数:フレンドコード, タイトル, メッセージ, コイン, ジェム, 経験値, スキンID, 期限
  select dopatan_private.send_present('ABCD1234', '補填', 'ご迷惑をおかけしました', 0, 50, 0, null, now() + interval '30 days');
  select dopatan_private.send_present(null, 'イベント報酬', null, 500, 0, 0, 'bg-gold', '2026-12-31 23:59+09');
  ```

  Table Editor で `presents` テーブルに行を足しても同じです(`user_id` が空なら全員向け)。
- **既存の Supabase プロジェクトの場合**:`supabase/migrations/0005_presents.sql` を SQL Editor で1回実行してください。実行するまでは、コードで配るプレゼントだけが届きます。

## 構成

| 場所 | 中身 |
| --- | --- |
| `app/` | 画面:ホーム、プレイ(`play`)、結果(`result`)、設定(`settings`)、PWA の設定(`manifest`) |
| `components/game/` | ゲーム画面:スワイプ判定(`QuestionBoard`)、HUD、演出 |
| `lib/session.ts` | 1回のプレイの出題順(紹介→2枚→4枚、間違えた単語の再出題、復習) |
| `lib/srs.ts` | 間隔反復(Leitner 方式) |
| `lib/distractors.ts` | ハズレ選択肢の選び方(多義語の別の意味・類義語・同じ絵を同時に出さない) |
| `lib/fx/` | 効果音・BGM(Web Audio で合成)、紙吹雪、振動 |
| `lib/storage/` | 端末内の保存(localStorage)、クラウドへの保存、マージ |
| `components/AuthSync.tsx` | ログイン状態を見張り、記録を同期する |
| `lib/economy/` | 台帳、ガチャ、報酬(ミッション・ログインボーナス・実績) |
| `lib/skins.ts` | スキンの一覧 |
| `stores/wallet.ts` | コイン・ジェム・スキン・ミッションの状態 |
| `lib/social/` | リーグ・フレンドの API、表示名、サーバー由来の報酬 |
| `stores/social.ts`、`components/social/` | フレンド・リーグの状態と画面の部品 |
| `lib/events/` | 週替わりイベントのルール(すごろく・ビンゴ・ボスバトル・スタンプラリー)と週の計算 |
| `lib/presents/` | プレゼントボックス(受け取りの判定、コードで配るプレゼントの一覧) |
| `supabase/migrations/` | データベースの定義(0001〜0005) |
| `data/words/` | 単語データ(スコア帯ごと。アプリは使うときに読み込む) |
| `public/emoji/`、`public/illustrations/` | 単語の絵。[Fluent Emoji](https://github.com/microsoft/fluentui-emoji)(MIT)と、自分で描いた SVG(こちらが優先) |
| `public/audio/` | 発音音声(Kokoro-82M で作成。無い単語はブラウザの読み上げを使う) |

## ロードマップ

1. ✅ ゲームの中心部分(スワイプ、演出、SRS、日本語表示の切り替え、PWA)
2. ✅ Supabase でログインし、進み具合をクラウドに保存(Google / メール / ゲスト。Apple・X・LINE は後で追加)
3. ✅ コイン・ジェム、ガチャ、スキン、デイリーミッション、実績
4. ✅ XP・ランク、週ごとのリーグ制ランキング、フレンド、招待、応援
5. ✅ 単語を約4,000語に(600点帯 1,201語・730点帯 1,192語・860点帯 1,004語・990点帯 590語)。✅ 絵(Fluent Emoji+自作SVG)、✅ 発音音声(Kokoro)、✅ リスニングとつづり並べ替え
