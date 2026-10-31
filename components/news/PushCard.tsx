"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, pushEnabled, pushSupport, type PushSupport } from "@/lib/push/client";

type Status = PushSupport | "loading" | "on" | "off" | "denied" | "error";

/** スマホ通知のオン/オフと、使えないときの案内(お知らせ画面と設定画面で使う) */
export function PushCard() {
  // 画面に出すのはブラウザの中だけ(Hydrated の内側)なので、最初の状態はその場で決められる
  const [status, setStatus] = useState<Status>(() => {
    const support = pushSupport();
    if (support !== "supported") return support;
    return Notification.permission === "denied" ? "denied" : "loading";
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    void pushEnabled().then((on) => setStatus(on ? "on" : "off"));
  }, [status]);

  const turnOn = async () => {
    setBusy(true);
    try {
      setStatus((await enablePush()) === "enabled" ? "on" : "denied");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  const box = "pop-border flex flex-col gap-2 rounded-3xl bg-white p-4";
  const note = "text-xs leading-relaxed text-slate-600";
  return (
    <div className={box} data-testid="push-card" data-status={status}>
      <span className="font-black">🔔 スマホ通知</span>
      {status === "loading" && <p className={note}>確認しています…</p>}
      {status === "off" && (
        <>
          <p className={note}>イベントの開始(月曜の朝)と終了の前日、お知らせやプレゼントが届いたときにお知らせします。</p>
          <button
            type="button"
            disabled={busy}
            onClick={turnOn}
            data-testid="push-enable"
            className="pop-border rounded-2xl bg-yellow-300 py-2 font-black disabled:opacity-60"
          >
            🔔 通知をオンにする
          </button>
        </>
      )}
      {status === "on" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black text-emerald-600">✅ 通知はオンです</span>
          <button type="button" disabled={busy} onClick={turnOff} className="text-xs font-black text-slate-500 underline">
            オフにする
          </button>
        </div>
      )}
      {status === "denied" && (
        <p className={note}>通知がブロックされています。端末やブラウザの設定で、DOPATAN の通知を許可してください。</p>
      )}
      {status === "needs-install" && (
        <p className={note}>
          iPhone では、ホーム画面に追加した DOPATAN で通知を受け取れます。Safari の共有ボタン(□↑)から「ホーム画面に追加」を選び、追加したアイコンから開いてください(iOS 16.4以上)。
        </p>
      )}
      {status === "unsupported" && <p className={note}>このブラウザは通知に対応していません。</p>}
      {status === "not-configured" && <p className={note}>通知は準備中です。もうしばらくお待ちください。</p>}
      {status === "error" && <p className={note}>通知をオンにできませんでした。時間をおいてもう一度試してください。</p>}
    </div>
  );
}
