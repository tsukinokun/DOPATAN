import images from "@/data/images.json";
import { POS_LABEL, type Theme, type WordSense } from "@/lib/types";

const THEME_COLORS: Record<Theme, string> = {
  office: "from-sky-300 to-cyan-200",
  meeting: "from-violet-300 to-fuchsia-200",
  hr: "from-amber-300 to-yellow-200",
  finance: "from-emerald-300 to-lime-200",
  marketing: "from-rose-300 to-pink-200",
  travel: "from-blue-300 to-indigo-200",
  shopping: "from-orange-300 to-amber-200",
  manufacturing: "from-teal-300 to-emerald-200",
};

export type CardState = "idle" | "hover" | "correct" | "wrong" | "reveal";

const STATE_RING: Record<CardState, string> = {
  idle: "",
  hover: "ring-8 ring-white scale-105",
  correct: "ring-8 ring-lime-300 scale-110",
  wrong: "ring-8 ring-red-500 opacity-70",
  reveal: "ring-8 ring-lime-300 animate-pulse",
};

const IMAGE_SIZE = { md: "h-14 w-14 sm:h-16 sm:w-16 text-5xl sm:text-6xl", lg: "h-20 w-20 sm:h-24 sm:w-24 text-7xl sm:text-8xl" };
const illustrations = new Set<string>(images.illustrations as string[]);
const emojiFiles = images.emoji as Record<string, string>;

/** 単語の絵。自分で描いた SVG → Fluent Emoji の SVG → 絵文字の文字、の順で使う */
export function WordImage({ sense, size = "md" }: { sense: WordSense; size?: "md" | "lg" }) {
  const src = illustrations.has(sense.id)
    ? `/illustrations/${sense.id}.svg`
    : emojiFiles[sense.emoji]
      ? `/emoji/${emojiFiles[sense.emoji]}.svg`
      : null;
  if (!src) {
    return (
      <span className={`grid select-none place-items-center leading-none drop-shadow-[3px_3px_0_rgba(0,0,0,0.25)] ${IMAGE_SIZE[size]}`} aria-hidden>
        {sense.emoji}
      </span>
    );
  }
  return (
    // 小さな SVG なので next/image の最適化は使わない
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className={`select-none drop-shadow-[3px_3px_0_rgba(0,0,0,0.25)] ${IMAGE_SIZE[size]}`}
    />
  );
}

/** 絵と日本語のカード */
export function PictureCard({
  sense,
  showJapanese,
  state = "idle",
  revealWord = false,
  size = "md",
}: {
  sense: WordSense;
  showJapanese: boolean;
  state?: CardState;
  /** 間違えたときに正解の英単語を見せる */
  revealWord?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={`pop-border relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-3xl bg-gradient-to-br p-2 transition-transform duration-150 ${THEME_COLORS[sense.theme]} ${STATE_RING[state]}`}
    >
      <WordImage sense={sense} size={size} />
      {showJapanese && (
        <span data-testid="card-ja" className="text-center text-sm font-black leading-tight text-slate-900 sm:text-base">
          <span className="mr-1 rounded-md bg-slate-900 px-1 text-[10px] text-white align-middle">
            {POS_LABEL[sense.pos]}
          </span>
          {sense.ja}
        </span>
      )}
      {revealWord && (
        <span className="absolute -top-4 rounded-full bg-lime-300 px-3 py-0.5 text-sm font-black text-slate-900 pop-border">
          {sense.word}
        </span>
      )}
    </div>
  );
}

/** 英単語のチップ。長い単語は途中で折り返さないよう文字を小さくする */
export function WordChip({ sense, state = "idle" }: { sense: WordSense; state?: CardState }) {
  const length = sense.word.length;
  const size =
    length > 12 ? "text-lg sm:text-2xl" : length > 9 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";
  return (
    <div
      className={`pop-border relative flex h-full w-full items-center justify-center rounded-3xl bg-white px-3 py-3 text-center transition-transform duration-150 ${STATE_RING[state]}`}
    >
      <span className={`whitespace-nowrap font-black tracking-wide text-slate-900 ${size}`}>{sense.word}</span>
      {state === "reveal" && (
        <span className="absolute -top-4 rounded-full bg-lime-300 px-3 py-0.5 text-sm font-black text-slate-900 pop-border">
          正解
        </span>
      )}
    </div>
  );
}
