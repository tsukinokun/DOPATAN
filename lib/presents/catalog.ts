import type { Present } from "./presents";

/**
 * コードで配るプレゼント(全員向け・ゲストにも届く)。ここに足してデプロイすると届く。
 * id は一度配ったら変えないこと(変えると、もう一度受け取れてしまう)。
 * 特定の人に配りたいときは README の「プレゼントボックス」を参照(Supabase から配る)。
 */
export const APP_PRESENTS: readonly Present[] = [
  {
    id: "thanks-2026-11",
    source: "app",
    title: "いつも遊んでくれてありがとう!",
    message:
      "DOPATAN を遊んでくれてありがとうございます!これからも楽しく単語を覚えられるように、どんどんアップデートしていきます。感謝の気持ちを込めて、ジェムをお送りします。",
    gems: 100,
    expiresAt: null,
  },
];
