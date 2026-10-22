import w600 from "@/data/words/600.json";
import w730 from "@/data/words/730.json";
import w860 from "@/data/words/860.json";
import w990 from "@/data/words/990.json";
import type { WordSense } from "./types";

/** テスト用:全単語をまとめて同期的に読み込む(アプリでは lib/words.ts の loadWords を使う) */
export const ALL_WORDS: readonly WordSense[] = [w600, w730, w860, w990].flat() as WordSense[];
