const ADJECTIVES = ["ドパミン", "爆速", "無敵", "眠れる", "伝説の", "覚醒した", "ガチ勢の", "ゆるふわ", "深夜の", "黄金の"];
const NOUNS = ["男爵", "侍", "パンダ", "勇者", "職人", "忍者", "ペンギン", "博士", "番長", "ねこ"];

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** ニックネーム未登録の人の名前。フレンドコードから決まるので、誰が見ても同じ名前になる */
export function randomName(seed: string): string {
  const h = hash(seed);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  return `${adjective}${noun}#${String(h % 10000).padStart(4, "0")}`;
}

export function displayName(person: { nickname: string | null; friendCode: string }): string {
  return person.nickname ?? randomName(person.friendCode);
}

/** 簡単な禁止語。完全ではないので、問題があれば通報などの仕組みを別に考える */
const BANNED = ["死ね", "殺す", "fuck", "shit", "ちんこ", "まんこ", "admin", "運営"];

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const value = raw.trim();
  const length = [...value].length;
  if (length < 2) return { ok: false, reason: "2文字以上にしてください" };
  if (length > 12) return { ok: false, reason: "12文字以内にしてください" };
  if (/[\u0000-\u001f<>]/.test(value)) return { ok: false, reason: "使えない文字が入っています" };
  const lower = value.toLowerCase();
  if (BANNED.some((w) => lower.includes(w))) return { ok: false, reason: "その名前は使えません" };
  return { ok: true, value };
}
