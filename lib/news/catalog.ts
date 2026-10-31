import type { News } from "./news";

/**
 * コードに書くお知らせ(全員に出る。ゲストにも出る)。ここに足してデプロイすると載る。
 * スマホにも通知したいお知らせは、Supabase の announcements に notify = true で入れる(README 参照)。
 */
export const APP_NEWS: readonly News[] = [
  {
    id: "news-2026-11-launch",
    kind: "app",
    title: "お知らせ欄と通知ができました",
    body:
      "イベントの開始やアップデートのお知らせが、ここに届くようになりました。\n\n通知をオンにすると、イベントの開始(月曜の朝)や終了の前日、プレゼントが届いたときに、スマホにもお知らせします。\n\niPhone の場合は、Safari の共有ボタンから「ホーム画面に追加」した DOPATAN で通知を受け取れます。",
    at: Date.parse("2026-10-31T12:00:00+09:00"),
  },
];
