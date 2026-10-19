# DOPATAN

派手な演出で覚える、ドパガキ向け TOEIC 英単語アプリです。英単語を「絵と日本語」のカードにスワイプして答えます(Drops 方式)。Next.js で作った PWA で、スマホと PC の両方に対応しています。

## 遊び方

- 1回のプレイは3分です。
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
```

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
| `data/words/` | 単語データ(今はサンプル105語。絵は仮の絵文字) |

## ロードマップ

1. ✅ ゲームの中心部分(スワイプ、演出、SRS、日本語表示の切り替え、PWA)
2. ✅ Supabase でログインし、進み具合をクラウドに保存(Google / メール / ゲスト。Apple・X・LINE は後で追加)
3. コイン・ジェム、ガチャ、スキン、デイリーミッション、実績
4. XP・ランク、週ごとのリーグ制ランキング、フレンド
5. 単語を約4,000語に増やす。Gemini で画像、オープンソースの音声合成で発音を作る。リスニングとつづり並べ替えを追加する
