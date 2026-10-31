"use client";

import { EventBoard } from "@/components/events/EventBoard";
import { useCurrentEvent } from "@/components/events/useEvent";
import { RewardChips } from "@/components/presents/RewardChips";
import { SkinCard } from "@/components/skins/SkinCard";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import { skinCopies } from "@/lib/economy/ledger";
import { presentEventId } from "@/lib/presents/presents";
import { timeLeftLabel } from "@/lib/events/week";
import { getSkin } from "@/lib/skins";

export default function EventPage() {
  return (
    <Hydrated>
      <Event />
    </Hydrated>
  );
}

function Event() {
  const { now, ev, result, rules, ledger } = useCurrentEvent();
  const reached = new Set(result.run.reached);
  const milestones = rules.milestones(ev.week);
  const skin = getSkin(rules.limitedSkin)!;
  const copies = skinCopies(ledger).get(skin.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <div className="flex flex-col">
          <span className="text-xs font-black text-white text-stroke">今週のイベント・⏰ {timeLeftLabel(ev.end, now)}</span>
          <h1 className="text-3xl font-black text-white text-stroke" data-testid="event-title">
            {rules.emoji} {rules.name}
          </h1>
        </div>
      </header>

      <div className="flex justify-center">
        <EventBoard result={result} week={ev.week} />
      </div>

      <Panel className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-black">報酬</h2>
          <PopButton href="/presents" color="white" className="px-3 py-1 text-sm">
            🎁 プレゼントボックスへ
          </PopButton>
        </div>
        <p className="text-xs text-slate-500">報酬はプレゼントボックスに届きます(イベント終了から7日以内に受け取ってね)。</p>
        <ul className="flex flex-col gap-1.5" data-testid="event-milestones">
          {milestones.map((m) => {
            const got = reached.has(m.id);
            const received = Boolean(ledger[presentEventId({ source: "event", id: `${ev.week}:${m.id}` })]);
            return (
              <li
                key={m.id}
                className={`flex flex-col gap-1 rounded-xl border-2 border-slate-900 px-2 py-1.5 ${
                  m.final ? "bg-gradient-to-r from-yellow-100 to-pink-100" : got ? "bg-emerald-50" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-sm font-black">
                  <span>
                    {got ? "✅" : m.final ? "🏆" : "⬜"} {m.label}
                  </span>
                  <span className={`shrink-0 text-[11px] ${received ? "text-slate-400" : got ? "text-pink-600" : "text-slate-400"}`}>
                    {received ? "受け取り済み" : got ? "届いています!" : ""}
                  </span>
                </div>
                <RewardChips {...m.reward} small />
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="flex items-center gap-3">
        <div className="w-32 shrink-0">
          <SkinCard skin={skin} copies={copies} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-black">🏆 完走報酬の限定スキン</span>
          <span className="text-xs text-slate-500">
            ガチャでは手に入りません。同じイベントがまた来たときに完走すると、かぶりでレベルが上がります。
          </span>
        </div>
      </Panel>

      <Panel>
        <details>
          <summary className="cursor-pointer font-black">ルール</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {rules.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
            <li>イベントは毎週月曜0時(日本時間)に切り替わります。すごろく → ビンゴ → ボスバトル → スタンプラリーの順です。</li>
          </ul>
        </details>
      </Panel>
    </main>
  );
}
