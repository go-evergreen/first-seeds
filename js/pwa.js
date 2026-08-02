/* Register freshness-first service worker for PWA installs */
(function () {
  if (!("serviceWorker" in navigator)) return;

  var refreshing = false;

  function register() {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(function (reg) {
        /* Look for a newer worker on load and when the tab becomes visible again */
        function ping() {
          try { reg.update(); } catch (e) {}
        }
        ping();
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") ping();
        });
        window.addEventListener("focus", ping);
        setInterval(ping, 5 * 60 * 1000);

        reg.addEventListener("updatefound", function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(function () {});
  }

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
