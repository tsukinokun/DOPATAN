"use client";

import { Hydrated, Panel, PopButton } from "@/components/ui";
import type { EffectIntensity, QuestionMode } from "@/lib/types";
import { useProgress } from "@/stores/progress";
import { useSettings, type Settings } from "@/stores/settings";

export default function SettingsPage() {
  return (
    <Hydrated>
      <SettingsView />
    </Hydrated>
  );
}

const INTENSITIES: { value: EffectIntensity; label: string }[] = [
  { value: "max", label: "最大" },
  { value: "standard", label: "標準" },
  { value: "low", label: "控えめ" },
];

const MODES: { value: QuestionMode | "listening" | "spelling"; label: string; ready: boolean }[] = [
  { value: "wordToPicture", label: "英単語 → 絵", ready: true },
  { value: "pictureToWord", label: "絵 → 英単語", ready: true },
  { value: "listening", label: "リスニング", ready: false },
  { value: "spelling", label: "つづり並べ替え", ready: false },
];

function SettingsView() {
  const settings = useSettings();
  const { update } = settings;

  const toggleMode = (mode: QuestionMode) => {
    const next = settings.modes.includes(mode)
      ? settings.modes.filter((m) => m !== mode)
      : [...settings.modes, mode];
    // 全部オフにはできない
    if (next.length > 0) update({ modes: next });
  };

  const reset = () => {
    if (!confirm("学習記録とスコアをすべて消しますか?")) return;
    useProgress.setState({ progress: {}, sessions: 0, bestScore: 0, bestCombo: 0, lastResult: null });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <h1 className="text-3xl font-black text-white text-stroke">設定</h1>
      </header>

      <Panel className="flex flex-col divide-y-2 divide-slate-200">
        <Toggle label="日本語を表示する" setting="showJapanese" settings={settings} testId="toggle-japanese" />
        <Toggle label="効果音" setting="sound" settings={settings} />
        <Toggle label="BGM" setting="bgm" settings={settings} />
        <Toggle label="振動(スマホ)" setting="vibration" settings={settings} />
      </Panel>

      <Panel className="flex flex-col gap-2">
        <h2 className="font-black">演出の強さ</h2>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map((i) => (
            <button
              key={i.value}
              type="button"
              aria-pressed={settings.effectIntensity === i.value}
              onClick={() => update({ effectIntensity: i.value })}
              className={`rounded-xl border-[3px] border-slate-900 py-2 font-black ${
                settings.effectIntensity === i.value ? "bg-slate-900 text-yellow-300" : "bg-white"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          端末の「視差効果を減らす」がオンのときは、自動で「控えめ」になります。
        </p>
      </Panel>

      <Panel className="flex flex-col gap-2">
        <h2 className="font-black">出題形式</h2>
        {MODES.map((m) => (
          <label key={m.value} className={`flex items-center gap-3 py-1 font-black ${m.ready ? "" : "opacity-40"}`}>
            <input
              type="checkbox"
              className="h-5 w-5 accent-pink-500"
              disabled={!m.ready}
              checked={m.ready && settings.modes.includes(m.value as QuestionMode)}
              onChange={() => toggleMode(m.value as QuestionMode)}
            />
            {m.label}
            {!m.ready && <span className="text-xs">(近日追加)</span>}
          </label>
        ))}
      </Panel>

      <Panel>
        <button type="button" onClick={reset} className="font-black text-pink-600">
          学習記録をリセット
        </button>
      </Panel>
    </main>
  );
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function Toggle({
  label,
  setting,
  settings,
  testId,
}: {
  label: string;
  setting: BooleanSetting;
  settings: Settings & { update: (patch: Partial<Settings>) => void };
  testId?: string;
}) {
  const on = settings[setting];
  return (
    <label className="flex items-center justify-between py-3 font-black">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid={testId}
        onClick={() => settings.update({ [setting]: !on })}
        className={`relative h-8 w-14 rounded-full border-[3px] border-slate-900 transition-colors ${
          on ? "bg-emerald-400" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full border-[3px] border-slate-900 bg-white transition-all ${
            on ? "left-7" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
