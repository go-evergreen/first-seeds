/* First Seeds — freshness-first service worker
   Strategy: network-first for app files so PWAs pick up deploys quickly.
   Offline: fall back to last good cache only if the network fails.
*/
const CACHE_VERSION = "fs-v145";
const CACHE_NAME = "first-seeds-" + CACHE_VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./lead.html",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () {
        /* Partial precache is fine — network-first covers the rest. */
        return null;
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key.indexOf("first-seeds-") === 0 && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isAppAsset(url) {
  try {
    var u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    var path = u.pathname;
    if (/\.(?:js|css|html|webmanifest|svg|png|ico|webp|jpg|jpeg)(\?|$)/i.test(path)) return true;
    if (path.endsWith("/") || /\/first-seeds\/?$/i.test(path)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = req.url;
  /* Never cache API / auth traffic */
  if (/supabase\.co/i.test(url) || /googleapis|gstatic/i.test(url)) return;

  if (!isAppAsset(url) && req.mode !== "navigate") return;

  event.respondWith(
    fetch(req)
      .then(function (networkRes) {
        if (networkRes && networkRes.ok) {
          var copy = networkRes.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return networkRes;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
      })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
