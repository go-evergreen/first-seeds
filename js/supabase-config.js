/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — SUPABASE CONFIG
   Paste your project URL + anon key from Supabase → Settings → API.
   Leave blank to use local bridge mode (same-browser demo / offline).
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

window.FS.SUPABASE = {
  /* e.g. "https://xxxx.supabase.co" */
  url: "",
  /* anon / public key only — never the service role key */
  anonKey: ""
};

window.FS.supabaseConfigured = function () {
  var c = window.FS.SUPABASE || {};
  return !!(c.url && c.anonKey && c.url.indexOf("http") === 0);
};
