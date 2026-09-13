const CACHE = "ru-speak-v5";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// מוחק מטמון ישן, משתלט על הלשוניות הפתוחות ומרענן אותן —
// אחרת מכשיר שכבר ביקר באתר ימשיך לראות את הגרסה הישנה מהמטמון.
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) {
      if (typeof c.navigate === "function") { try { await c.navigate(c.url); } catch (err) {} }
    }
  })());
});

// דף האפליקציה: קודם מהרשת (כדי שעדכונים יגיעו), ורק אם אין אינטרנט — מהמטמון.
// שאר הקבצים: מהמטמון מיד, ומתרעננים ברקע.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isPage = req.mode === "navigate" || (req.destination === "document");
  if (isPage) {
    // cache: "reload" מדלג על מטמון ה-HTTP של הדפדפן —
    // GitHub Pages מבקש לשמור את הדף 10 דקות, ובלי זה עדכון לא מגיע מיד.
    e.respondWith(
      fetch(new Request(req.url, { cache: "reload", credentials: "same-origin" }))
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then(hit => hit || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
