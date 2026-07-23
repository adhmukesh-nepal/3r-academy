/* =========================================================================
   sw.js — service worker for offline + installability.
   Strategy:
     • app shell (html/css/js/icons)  → precached on install
     • same-origin GET (incl. /data/*.json) → stale-while-revalidate
     • page navigations → network-first, fall back to cache, then to "/"
   IMPORTANT: bump CACHE when you change any precached file so users update.
   ========================================================================= */
var CACHE = "3r-v29";
var CORE = [
  "/", "/index.html", "/book.html", "/chapter.html", "/flashcards.html", "/quiz.html", "/privacy.html",
  "/assets/app.css", "/assets/app.js", "/assets/config.js", "/assets/supabase.js", "/assets/auth.js", "/gate.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png",
  "/data/books.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // only handle same-origin

  // page navigations: network-first so content stays fresh, cache as fallback
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        // offline: try the exact URL, then the page by pathname (query ignored —
        // pages render from ?params), then the home shell.
        return caches.match(req).then(function (m) {
          return m || caches.match(url.pathname).then(function (m2) {
            return m2 || caches.match(url.pathname + "index.html") || caches.match("/");
          });
        });
      })
    );
    return;
  }

  // everything else (assets, data JSON): stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
