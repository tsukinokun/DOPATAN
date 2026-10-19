// インストール可能にするための最小限の Service Worker。
// オフライン対応は不要なので、キャッシュはせずネットワークにそのまま流す。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
