// インストールできるようにするための Service Worker と、スマホ通知(Web Push)の受け取り。
// オフライン対応は不要なので、キャッシュはせずネットワークにそのまま流す。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// サーバー(app/api/push/daily)から届いた通知を出す
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "DOPATAN", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "DOPATAN", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// 通知を押したら、開いている画面を前に出して移動する(無ければ開く)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => ("navigate" in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
