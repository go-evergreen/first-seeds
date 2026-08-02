/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — APP
   State, modes, onboarding, tour, navigation, live widgets,
   claim checker, export. Loads last.
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var CFG = window.FS.CONFIG;
  var SECTIONS = window.FS.SECTIONS;
  var RISKY = window.FS.RISKY;
  var RHYTHMS = CFG.rhythms;
  var DAY_NAMES = window.FS.DAY_NAMES;
  var Tree = window.FS.tree;
  var OB = CFG.onboarding || {};
  var MODES = CFG.modes || {};

  /* ── state ───────────────────────────────────────────── */
  function blankState() {
    return {
      data: {},
      done: {},
      active: "welcome",
      settings: { hubMode: "", partnerName: "" },
      tourDone: false
    };
  }

  var state = blankState();

  function loadState() {
    try {
      var raw = localStorage.getItem(CFG.storeKey);
      if (!raw && CFG.legacyStoreKey) {
        var legacy = localStorage.getItem(CFG.legacyStoreKey);
        if (legacy) {
          var old = JSON.parse(legacy);
          state.data = old.data || {};
          state.done = old.done || {};
          state.active = old.active || "welcome";
          /* v4 had no mode — force onboarding so they pick pace */
          state.settings = { hubMode: "", partnerName: "" };
          state.tourDone = false;
          save();
          return;
        }
      }
      if (raw) {
        var p = JSON.parse(raw);
        state.data = p.data || {};
        state.done = p.done || {};
        state.active = p.active || "welcome";
        state.settings = p.settings || { hubMode: "", partnerName: "" };
        if (!state.settings.hubMode) state.settings.hubMode = "";
        if (!state.settings.partnerName) state.settings.partnerName = "";
        state.tourDone = !!p.tourDone;
      }
    } catch (e) {}
  }

  function save() {
    try { localStorage.setItem(CFG.storeKey, JSON.stringify(state)); } catch (e) {}
  }

  loadState();

  /* ── mode helpers ────────────────────────────────────── */
  function isStarter() { return state.settings.hubMode === "starter"; }
  function isFull() { return state.settings.hubMode === "full"; }
  function modeChosen() { return isStarter() || isFull(); }

  function visibleSections() {
    var mode = state.settings.hubMode || "full";
    return SECTIONS.filter(function (s) {
      return !s.modes || s.modes.indexOf(mode) > -1;
    });
  }

  function sectionVisible(id) {
    var secs = visibleSections();
    for (var i = 0; i < secs.length; i++) if (secs[i].id === id) return true;
    return false;
  }

  /* Starter path: roots → grove → ground → tend → done
     Full path:    roots → grove → tree → ground → plant → tend → done */
  function nextAfter(id) {
    if (isStarter()) {
      return { roots: "grove", grove: "ground", ground: "tend", tend: "done" }[id];
    }
    return { roots: "grove", grove: "tree", tree: "ground", ground: "plant", plant: "tend", tend: "done" }[id];
  }

  function partnerName() {
    return ((state.settings.partnerName || "") + "").trim();
  }

  function firstName() {
    var n = partnerName();
    return n ? n.split(/\s+/)[0] : "";
  }

  /* ── growth math ─────────────────────────────────────── */
  var FIELD_UNITS = ["why", "moment", "said_yes", "warm", "warm_pick", "page_story", "seed_open", "seed_value", "seed_invite"];
  var MAX_UNITS = 16;

  function filledText(k) { return ((state.data[k] || "") + "").trim().length > 0; }

  function unitCount() {
    var n = 0;
    for (var i = 0; i < FIELD_UNITS.length; i++) {
      if (!filledText(FIELD_UNITS[i])) continue;
      /* starter doesn't need plant drafts for growth display — still count if filled */
      n++;
    }
    if (state.data.page_choice) n++;
    n += Math.min((state.data.rhythm || []).length, 3);
    n += Math.min(Tree.counts(Tree.ensure(state)).total, 3);
    return n;
  }

  function doneCount() {
    var secs = visibleSections();
    var n = 0;
    for (var i = 0; i < secs.length; i++) if (state.done[secs[i].id]) n++;
    return n;
  }

  function sectionTotal() {
    return visibleSections().length;
  }

  /* ── DOM refs ────────────────────────────────────────── */
  var nav = document.getElementById("nav");
  var railPlant = document.getElementById("railPlant");
  var finishPlant = document.getElementById("finishPlant");
  var caption = document.getElementById("plantCaption");
  var progressFill = document.getElementById("progressFill");

  function esc(t) { return (t + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function setOverlayOpen(open) {
    document.body.classList.toggle("overlay-open", !!open);
  }

  /* ── brand / config into DOM ─────────────────────────── */
  function renderBrand() {
    var eb = document.getElementById("brandEyebrow");
    var tg = document.getElementById("brandTagline");
    if (eb) eb.textContent = CFG.teamName;
    if (tg) tg.textContent = CFG.tagline;
    var so = document.getElementById("signoff");
    if (so) so.textContent = CFG.signoff;
    var starter = document.getElementById("starterText");
    if (starter) starter.textContent = CFG.dmStarter;
    var pc = CFG.pageOptions;
    var ct = document.getElementById("customTitle"), cd = document.getElementById("customDesc");
    var gt = document.getElementById("genericTitle"), gd = document.getElementById("genericDesc");
    if (ct) ct.textContent = pc.custom.title;
    if (cd) cd.textContent = pc.custom.desc;
    if (gt) gt.textContent = pc.generic.title;
    if (gd) gd.textContent = pc.generic.desc;

    /* onboarding static copy */
    setText("obWelcomeEyebrow", OB.welcomeEyebrow);
    setText("obWelcomeBody", (OB.welcomeBody || "").replace(/The Fresh Grove/g, CFG.teamDisplayName || "The Fresh Grove"));
    setText("onboardTitle", OB.welcomeTitle);
    setText("onboardingNext", OB.welcomeCta || "Let's go");
    setText("obNameEyebrow", OB.nameEyebrow);
    setText("obNameTitle", OB.nameTitle);
    setText("obNameHint", OB.nameHint);
    setText("obHypeLine", OB.hypeLine);
    setText("obModeEyebrow", OB.modeEyebrow);
    setText("obModeTitle", OB.modeTitle);
    setText("obModeLead", OB.modeLead);
    setText("onboardingNameNext", OB.nameCta || "Continue");

    var nameInput = document.getElementById("partnerNameInput");
    if (nameInput && OB.namePlaceholder) nameInput.placeholder = OB.namePlaceholder;

    if (MODES.starter) {
      setText("modePickStarterLabel", MODES.starter.label);
      setText("modePickStarterDesc", MODES.starter.desc);
    }
    if (MODES.full) {
      setText("modePickFullLabel", MODES.full.label);
      setText("modePickFullDesc", MODES.full.desc);
    }
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && text != null) el.textContent = text;
  }

  /* ── greetings / personalized copy ───────────────────── */
  function renderGreetings() {
    var name = firstName();
    var hello = document.getElementById("topbarHello");
    if (hello) {
      if (name) {
        hello.hidden = false;
        hello.textContent = "Hey " + name;
      } else {
        hello.hidden = true;
      }
    }

    var wh = document.getElementById("welcomeHeadline");
    if (wh) {
      wh.innerHTML = name
        ? ("Hey " + esc(name) + ".<br>Let's put down roots.")
        : "You said yes.<br>Let's put down roots.";
    }

    var pathNote = document.getElementById("welcomePathNote");
    if (pathNote) {
      if (isStarter()) {
        pathNote.innerHTML = "You're on <strong>Getting started</strong> — four calm steps. <strong>Roots</strong> grow every time you fill a box. Your <strong>sprout</strong> grows when you finish a section.";
      } else if (isFull()) {
        pathNote.innerHTML = "You're on the <strong>Full runway</strong> — six sections. <strong>Roots</strong> grow with every answer. Your <strong>sprout</strong> grows when you finish a section — and blooms at the end.";
      } else {
        pathNote.textContent = "";
      }
    }

    var rh = document.getElementById("rootsHeadline");
    if (rh) rh.textContent = name ? (name + " — plant your roots") : "Plant Your Roots";

    /* section numbers shift in starter (no tree/plant) */
    var groundNum = document.getElementById("groundNum");
    var tendNum = document.getElementById("tendNum");
    if (isStarter()) {
      if (groundNum) groundNum.textContent = "03";
      if (tendNum) tendNum.textContent = "04";
    } else {
      if (groundNum) groundNum.textContent = "04";
      if (tendNum) tendNum.textContent = "06";
    }

    renderFinishCopy();
  }

  function renderFinishCopy() {
    var name = firstName();
    var eyebrow = document.getElementById("finishEyebrow");
    var headline = document.getElementById("finishHeadline");
    var body = document.getElementById("finishBody");
    var levelUp = document.getElementById("levelUpBtn");

    if (isStarter()) {
      if (eyebrow) eyebrow.textContent = "ROOTS DOWN";
      if (headline) headline.textContent = name ? ("Nice work, " + name + ".") : "Nice work.";
      if (body) body.innerHTML = "You've got your story, your grove, your page, and a rhythm to carry you to October 1. That's a real foundation — and you did it before the doors opened. When you're ready for the dream team tree and Post Studio, unlock the Full runway anytime.";
      if (levelUp) levelUp.hidden = false;
    } else {
      if (eyebrow) eyebrow.textContent = "IN FULL BLOOM";
      if (headline) headline.textContent = name ? ("Look what you grew, " + name + ".") : "Look what you grew.";
      if (body) body.innerHTML = "You've got your story, your grove, your dream tree, your page, your first seeds, and a rhythm to carry you to launch. That's more than most people have on day <em>one</em> — and you did it before the doors even opened. Now keep showing up — and keep flipping those 🌱 to 🌳.";
      if (levelUp) levelUp.hidden = true;
    }
  }

  /* ── mode UI ─────────────────────────────────────────── */
  function applyModeClass() {
    document.body.classList.toggle("mode-starter", isStarter());
    document.body.classList.toggle("mode-full", isFull());
  }

  function updateModeUI() {
    applyModeClass();
    var badge = document.getElementById("modeBadge");
    if (badge) {
      if (isStarter()) {
        badge.hidden = false;
        badge.textContent = (MODES.starter && MODES.starter.badge) || "Getting started";
      } else if (isFull()) {
        badge.hidden = false;
        badge.textContent = (MODES.full && MODES.full.badge) || "Full runway";
      } else {
        badge.hidden = true;
      }
    }
    var starterBtn = document.getElementById("modeStarter");
    var fullBtn = document.getElementById("modeFull");
    if (starterBtn) starterBtn.classList.toggle("on", isStarter());
    if (fullBtn) fullBtn.classList.toggle("on", isFull());
    var hint = document.getElementById("hubModeHint");
    if (hint) {
      if (isStarter()) hint.textContent = "Calm 4-step path. Switch to Full runway anytime for the tree + Post Studio.";
      else if (isFull()) hint.textContent = "All six sections unlocked. Switch to Getting started for a simpler view — your progress stays.";
      else hint.textContent = "";
    }
    renderGreetings();
  }

  function setHubMode(mode, opts) {
    opts = opts || {};
    if (mode !== "starter" && mode !== "full") return;
    var prev = state.settings.hubMode;
    state.settings.hubMode = mode;
    /* if currently on a section hidden in new mode, bounce to welcome */
    if (state.active !== "welcome" && state.active !== "done" && !sectionVisible(state.active)) {
      state.active = "welcome";
    }
    save();
    updateModeUI();
    renderNav();
    renderPanels();
    renderPlant();
    refreshButtons();
    liveRefresh();
    if (opts.silent || prev === mode) return;
  }

  /* ── post studio ─────────────────────────────────────── */
  function renderSeedTypes() {
    var wrap = document.getElementById("seedTypes");
    if (!wrap) return;
    var open = state.data.seedTypeOpen || "";
    var html = "";
    var types = window.FS.SEED_TYPES;
    for (var i = 0; i < types.length; i++) {
      var st = types[i];
      var isOpen = open === st.id;
      html += '<div class="seed-card' + (isOpen ? " open" : "") + '">';
      html += '<button class="seed-head" data-seedtype="' + st.id + '">';
      html += '<span class="seed-icon">' + st.icon + '</span>';
      html += '<span class="seed-titles"><span class="seed-name">' + esc(st.name) + '</span><span class="seed-tag">' + esc(st.tagline) + '</span></span>';
      html += '<span class="seed-chev">' + (isOpen ? "−" : "+") + '</span>';
      html += '</button>';
      if (isOpen) {
        html += '<div class="seed-body">';
        html += '<div class="seed-block"><div class="seed-label">WHY IT WORKS</div><p>' + esc(st.psychology) + '</p></div>';
        html += '<div class="seed-block"><div class="seed-label">THE TEMPLATE</div><p>' + esc(st.template) + '</p></div>';
        html += '<div class="seed-block example"><div class="seed-label">WORKED EXAMPLE</div><p class="seed-example" id="seedEx_' + st.id + '">' + esc(st.example) + '</p><button class="copy-btn small" data-copy="seedEx_' + st.id + '">Copy it</button></div>';
        html += '<div class="seed-block rule"><div class="seed-label">THE CLASSY RULE</div><p>' + esc(st.classy_rule) + '</p></div>';
        html += '</div>';
      }
      html += '</div>';
    }
    wrap.innerHTML = html;
  }

  function renderHooks() {
    var wrap = document.getElementById("hookList");
    if (!wrap) return;
    var hooks = CFG.hookBank || [];
    var html = "";
    for (var i = 0; i < hooks.length; i++) {
      html += '<div class="hook-row"><span class="hook-text" id="hook_' + i + '">' + esc(hooks[i]) + '</span><button class="copy-btn small" data-copy="hook_' + i + '">Copy</button></div>';
    }
    wrap.innerHTML = html;
  }

  function renderNav() {
    var secs = visibleSections();
    var html = "";
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var cls = "nav-item" + (state.active === s.id ? " active" : "") + (state.done[s.id] ? " done" : "");
      html += '<button class="' + cls + '" data-goto="' + s.id + '"><span class="nav-dot">' + (state.done[s.id] ? "✓" : (i + 1)) + '</span><span><span class="nav-label">' + s.label + '</span><span class="nav-sub">' + s.sub + '</span></span></button>';
    }
    nav.innerHTML = html;
  }

  var lastUnits = -1;
  var lastSecs = -1;
  var captionTimer;

  function pulsePlant(kind) {
    if (!railPlant) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    railPlant.classList.remove("roots-pulse", "sprout-pulse");
    void railPlant.offsetWidth;
    railPlant.classList.add(kind === "sprout" ? "sprout-pulse" : "roots-pulse");
    setTimeout(function () {
      railPlant.classList.remove("roots-pulse", "sprout-pulse");
    }, 1000);
  }

  function highlightCaption(msg) {
    if (!caption) return;
    caption.textContent = msg;
    caption.classList.add("highlight");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(function () { caption.classList.remove("highlight"); }, 1600);
  }

  function renderPlant(opts) {
    opts = opts || {};
    var secs = doneCount(), units = unitCount(), total = sectionTotal();
    /* Map starter's 4 sections onto the same 0–6 visual plant stages */
    var visualSecs = isStarter() ? Math.round((secs / Math.max(total, 1)) * 6) : secs;
    if (isStarter() && secs === total && total > 0) visualSecs = 6;
    railPlant.innerHTML = window.FS.plantSVG(visualSecs, units, MAX_UNITS);
    if (finishPlant) finishPlant.innerHTML = window.FS.plantSVG(6, MAX_UNITS, MAX_UNITS);
    var pct = Math.round(((units / MAX_UNITS) * 0.5 + (secs / Math.max(total, 1)) * 0.5) * 100);
    progressFill.style.width = pct + "%";

    if (!opts.silent && lastUnits >= 0 && units > lastUnits) {
      pulsePlant("roots");
      highlightCaption("A root just grew 🌿");
    } else if (!opts.silent && lastSecs >= 0 && secs > lastSecs) {
      pulsePlant("sprout");
      highlightCaption("Your sprout just grew taller 🌱");
    } else if (!caption.classList.contains("highlight")) {
      caption.textContent =
        units === 0 ? "Nothing planted yet — fill a box to grow a root." :
        secs === 0 ? "Roots forming underground… (" + units + " answers). Finish a section to grow the sprout." :
        secs < total ? (secs + " of " + total + " sections · roots " + Math.round(units / MAX_UNITS * 100) + "% deep") :
        "In full bloom. You're ready. 🌱";
    }
    lastUnits = units;
    lastSecs = secs;
  }

  function renderPanels() {
    var panels = document.querySelectorAll(".panel");
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle("active", panels[i].id === "panel-" + state.active);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ── countdowns ──────────────────────────────────────── */
  function nextDate(m, d) {
    var now = new Date();
    var t = new Date(now.getFullYear(), m - 1, d);
    if (t < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      t = new Date(now.getFullYear() + 1, m - 1, d);
    }
    return t;
  }

  function daysUntilPre() {
    var now = new Date();
    var pre = nextDate(CFG.preRegDate.month, CFG.preRegDate.day);
    return Math.max(0, Math.ceil((pre - now) / 864e5));
  }

  function renderCountdowns() {
    var now = new Date();
    var pre = nextDate(CFG.preRegDate.month, CFG.preRegDate.day);
    var launch = nextDate(CFG.launchDate.month, CFG.launchDate.day);
    var d1 = Math.max(0, Math.ceil((pre - now) / 864e5));
    var d2 = Math.max(0, Math.ceil((launch - now) / 864e5));
    var el1 = document.getElementById("cdPre"), el2 = document.getElementById("cdLaunch");
    var l1 = document.getElementById("cdPreLabel"), l2 = document.getElementById("cdLaunchLabel");
    if (el1) el1.textContent = d1 === 0 ? "🎉" : d1;
    if (el2) el2.textContent = d2 === 0 ? "🎉" : d2;
    if (l1) l1.textContent = CFG.preRegDate.label;
    if (l2) l2.textContent = CFG.launchDate.label;
    var hypeDays = document.getElementById("obHypeDays");
    if (hypeDays) hypeDays.textContent = d1 === 0 ? "🎉" : String(d1);
  }

  /* ── completion rules ────────────────────────────────── */
  function groveNames() {
    return ((state.data.warm || "") + "").split("\n")
      .map(function (l) { return l.replace(/^\d+[\.\)]\s*/, "").trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  function canComplete(id) {
    if (id === "roots") return filledText("why") && filledText("moment") && filledText("said_yes");
    if (id === "grove") return groveNames().length >= 5 && filledText("warm_pick");
    if (id === "tree") {
      var c = Tree.counts(Tree.ensure(state));
      return c.total >= 3;
    }
    if (id === "ground") return !!state.data.page_choice && filledText("page_story");
    if (id === "plant") return filledText("seed_open") && filledText("seed_value") && filledText("seed_invite");
    if (id === "tend") return (state.data.rhythm || []).length >= 3;
    return false;
  }

  function readyLabel(btn, id) {
    if (isStarter() && btn.getAttribute("data-ready-starter")) return btn.getAttribute("data-ready-starter");
    if (isFull() && btn.getAttribute("data-ready-full")) return btn.getAttribute("data-ready-full");
    return btn.getAttribute("data-ready");
  }

  function refreshButtons() {
    var btns = document.querySelectorAll("[data-complete]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], id = b.getAttribute("data-complete"), ok = canComplete(id);
      b.classList.toggle("waiting", !ok);
      b.textContent = ok ? ((state.done[id] ? "✓ " : "") + readyLabel(b, id)) : b.getAttribute("data-wait");
    }
  }

  /* ── live widgets ────────────────────────────────────── */
  function renderStory() {
    var el = document.getElementById("storyPreview");
    if (!el) return;
    var w = (state.data.why || "").trim(), m = (state.data.moment || "").trim(), y = (state.data.said_yes || "").trim();
    if (!w && !m && !y) {
      el.innerHTML = '<span class="dim">Your story will assemble here as you write — three answers, one narrative.</span>';
      return;
    }
    var parts = [];
    parts.push(w ? esc(w) : '<span class="dim">[your why…]</span>');
    parts.push(m ? esc(m) : '<span class="dim">[your Ringana moment…]</span>');
    parts.push(y ? esc(y) : '<span class="dim">[why you said yes…]</span>');
    el.innerHTML = '"' + parts.join(" ") + '"';
  }

  var lastGroveCount = 0;
  var groveFlashTimer;

  function flashGroveTrees(forceAll) {
    var wrap = document.getElementById("groveTrees");
    var visual = document.querySelector(".grove-visual");
    if (!wrap) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var nodes = wrap.querySelectorAll(".gtree");
    if (!nodes.length) return;
    if (visual) {
      visual.classList.add("flashing");
      clearTimeout(groveFlashTimer);
      groveFlashTimer = setTimeout(function () { visual.classList.remove("flashing"); }, 450);
    }
    for (var i = 0; i < nodes.length; i++) {
      (function (node, delay) {
        setTimeout(function () {
          node.classList.remove("flash");
          void node.offsetWidth;
          node.classList.add("flash");
        }, forceAll ? delay : 0);
      })(nodes[i], forceAll ? (i % 8) * 40 : 0);
    }
  }

  function renderGrove(opts) {
    opts = opts || {};
    var names = groveNames();
    var count = document.getElementById("groveCount"), trees = document.getElementById("groveTrees"), hint = document.getElementById("groveHint");
    if (!count) return;
    var n = names.length;
    count.innerHTML = n === 0 ? "Your grove is empty soil — add your first name."
      : "<strong>" + n + "</strong> " + (n === 1 ? "tree" : "trees") + " in your grove";
    var hues = ["#6b8f6b", "#7ba07b", "#5f8a5f", "#87ab87"];
    var html = "";
    for (var i = 0; i < Math.min(n, 30); i++) {
      html += '<span class="gtree" title="' + esc(names[i]) + '">' + window.FS.miniTreeSVG(hues[i % 4]) + "</span>";
    }
    trees.innerHTML = html;
    hint.textContent = n === 0 ? "" :
      n < 5 ? "Keep going — even 5 warm names is a real start." :
      n < 15 ? "Nice. Aim for 15–25 when you can — who else would you actually tell?" :
      n <= 25 ? "That's a full grove. Quality over quantity from here." :
      "That's a forest! Focus your energy on the warmest 25.";

    if (opts.flash && n > 0) {
      /* re-apply flash after DOM rebuild */
      requestAnimationFrame(function () { flashGroveTrees(n > lastGroveCount); });
    }
    lastGroveCount = n;
  }

  function renderMiniPage() {
    var el = document.getElementById("miniHeadline");
    if (!el) return;
    var t = (state.data.page_story || "").trim();
    el.innerHTML = t ? esc(t) : '<span class="dim">Your opening line appears here — the first thing a visitor reads.</span>';
  }

  function runClaimCheck(key) {
    var el = document.querySelector('[data-check="' + key + '"]');
    if (!el) return;
    var text = (state.data[key] || "");
    if (!text.trim()) { el.innerHTML = ""; return; }
    var hits = [];
    for (var i = 0; i < RISKY.length; i++) if (RISKY[i].re.test(text)) hits.push(RISKY[i]);
    if (hits.length === 0) { el.innerHTML = '<span class="claim-ok">Reads clean ✓</span>'; return; }
    var html = "";
    for (var j = 0; j < hits.length; j++) html += '<span class="claim-flag">⚠ ' + esc(hits[j].word) + "</span>";
    html += '<span class="claim-note">' + esc(hits[0].tip) + (hits.length > 1 ? " (and " + (hits.length - 1) + " more to double-check)" : "") + "</span>";
    el.innerHTML = html;
  }

  function renderWeek() {
    var strip = document.getElementById("weekStrip");
    if (!strip) return;
    var sel = state.data.rhythm || [];
    var byDay = {};
    for (var i = 0; i < RHYTHMS.length; i++) {
      if (sel.indexOf(RHYTHMS[i].label) > -1 && RHYTHMS[i].day >= 0) byDay[RHYTHMS[i].day] = RHYTHMS[i];
    }
    var html = "";
    for (var d = 0; d < 7; d++) {
      var r = byDay[d];
      html += '<div class="day' + (r ? " lit" : "") + '"><div class="day-name">' + DAY_NAMES[d] + '</div><div class="day-icon">' + (r ? r.icon : "") + '</div><div class="day-what">' + (r ? r.short : "") + "</div></div>";
    }
    strip.innerHTML = html;
  }

  function markFilledStates() {
    var fields = document.querySelectorAll(".field[data-field]");
    for (var i = 0; i < fields.length; i++) {
      var k = fields[i].getAttribute("data-field");
      fields[i].classList.toggle("filled", filledText(k));
    }
  }

  function liveRefresh(opts) {
    opts = opts || {};
    renderStory();
    renderGrove({ flash: !!opts.groveFlash });
    renderMiniPage();
    renderWeek();
    markFilledStates();
    renderPlant(opts);
    refreshButtons();
  }

  /* ── leaf burst ──────────────────────────────────────── */
  function leafBurst(x, y) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var colors = ["#6b8f6b", "#7ba07b", "#e8c86a", "#c9a24b"];
    for (var i = 0; i < 10; i++) {
      var el = document.createElement("div");
      el.className = "leaf-p";
      var ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 70;
      el.style.setProperty("--dx", (Math.cos(ang) * dist) + "px");
      el.style.setProperty("--dy", (Math.sin(ang) * dist - 40) + "px");
      el.style.setProperty("--rot", (Math.random() * 540 - 270) + "deg");
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.innerHTML = '<svg viewBox="0 0 14 14" width="14" height="14"><path d="M7 1 C12 3 13 9 7 13 C1 9 2 3 7 1 Z" fill="' + colors[i % 4] + '"/></svg>';
      document.body.appendChild(el);
      setTimeout((function (n) { return function () { n.remove(); }; })(el), 1200);
    }
  }

  /* ── field wiring ────────────────────────────────────── */
  var flashTimers = {};
  function flash(section) {
    var el = document.querySelector('[data-flash="' + section + '"]');
    if (!el) return;
    el.classList.add("show");
    clearTimeout(flashTimers[section]);
    flashTimers[section] = setTimeout(function () { el.classList.remove("show"); }, 1400);
  }
  function sectionOf(el) {
    var p = el.closest(".panel");
    return p ? p.id.replace("panel-", "") : null;
  }

  var fields = document.querySelectorAll("[data-key]");
  for (var fi = 0; fi < fields.length; fi++) {
    (function (f) {
      var k = f.getAttribute("data-key");
      if (state.data[k]) f.value = state.data[k];
      var t;
      f.addEventListener("input", function () {
        state.data[k] = f.value;
        runClaimCheck(k);
        liveRefresh({ groveFlash: k === "warm" });
        clearTimeout(t);
        t = setTimeout(function () { save(); flash(sectionOf(f)); }, 500);
      });
    })(fields[fi]);
  }

  function renderChoices() {
    var cards = document.querySelectorAll("[data-choice]");
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], key = c.getAttribute("data-choice"), val = c.getAttribute("data-value");
      var sel = state.data[key] === val;
      c.classList.toggle("selected", sel);
      c.querySelector(".choice-radio").textContent = sel ? "✓" : "";
    }
  }

  var rhythmWrap = document.getElementById("rhythmList");
  function renderRhythms() {
    var sel = state.data.rhythm || [];
    var html = "";
    for (var i = 0; i < RHYTHMS.length; i++) {
      var on = sel.indexOf(RHYTHMS[i].label) > -1;
      html += '<button class="check' + (on ? " on" : "") + '" data-rhythm="' + i + '"><span class="check-box">' + (on ? "✓" : "") + '</span><span>' + RHYTHMS[i].icon + " " + esc(RHYTHMS[i].label) + "</span></button>";
    }
    rhythmWrap.innerHTML = html;
  }

  /* ── tree input handling ─────────────────────────────── */
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute("data-tname")) {
      Tree.setName(state, t.getAttribute("data-tname"), t.value);
      clearTimeout(flashTimers._tree);
      flashTimers._tree = setTimeout(function () {
        save(); flash("tree");
        var stats = document.getElementById("treeStats");
        if (stats) {
          var c = Tree.counts(Tree.ensure(state));
          stats.innerHTML =
            '<span class="tstat"><strong>' + c.total + '</strong> in your tree</span>' +
            '<span class="tstat hopeful-c">🌱 <strong>' + c.hopeful + '</strong> hopeful</span>' +
            '<span class="tstat committed-c">🌳 <strong>' + c.committed + '</strong> committed</span>' +
            (c.depth > 1 ? '<span class="tstat">' + c.depth + ' levels deep</span>' : '');
        }
      }, 500);
    }
  });

  /* ── onboarding ──────────────────────────────────────── */
  var onboardingStep = 0;

  function renderOnboardingStep() {
    var card = document.getElementById("onboardingCard");
    var dots = document.getElementById("onboardingDots");
    if (card) card.classList.toggle("onboarding-welcome", onboardingStep === 0);
    var panes = document.querySelectorAll("#onboarding .onboarding-pane");
    for (var i = 0; i < panes.length; i++) {
      panes[i].classList.toggle("on", parseInt(panes[i].getAttribute("data-onboard-step"), 10) === onboardingStep);
    }
    if (dots) {
      dots.innerHTML = "";
      for (var d = 0; d < 3; d++) {
        var iEl = document.createElement("i");
        if (d === onboardingStep) iEl.className = "on";
        dots.appendChild(iEl);
      }
    }
    if (onboardingStep === 1) {
      var input = document.getElementById("partnerNameInput");
      if (input) {
        input.value = partnerName();
        syncNameNext();
        setTimeout(function () { input.focus(); }, 50);
      }
    }
  }

  function syncNameNext() {
    var input = document.getElementById("partnerNameInput");
    var btn = document.getElementById("onboardingNameNext");
    if (!btn) return;
    var ok = input && input.value.trim().length > 0;
    btn.disabled = !ok;
  }

  function startOnboarding() {
    var wrap = document.getElementById("onboarding");
    if (!wrap || modeChosen()) return;
    onboardingStep = 0;
    renderOnboardingStep();
    wrap.classList.add("open");
    setOverlayOpen(true);
  }

  function completeOnboarding(mode) {
    var wrap = document.getElementById("onboarding");
    if (wrap) wrap.classList.remove("open");
    setHubMode(mode, { silent: true });
    state.active = "welcome";
    save();
    renderNav();
    renderPanels();
    if (!state.tourDone) startTour();
    else setOverlayOpen(false);
  }

  function wireOnboarding() {
    var wrap = document.getElementById("onboarding");
    if (!wrap || wrap.dataset.wired === "1") return;
    wrap.dataset.wired = "1";

    var nextBtn = document.getElementById("onboardingNext");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        onboardingStep = 1;
        renderOnboardingStep();
      });
    }

    var nameInput = document.getElementById("partnerNameInput");
    var nameNext = document.getElementById("onboardingNameNext");
    if (nameInput) {
      nameInput.addEventListener("input", syncNameNext);
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && nameInput.value.trim()) {
          e.preventDefault();
          if (nameNext) nameNext.click();
        }
      });
    }
    if (nameNext) {
      nameNext.addEventListener("click", function () {
        if (!nameInput || !nameInput.value.trim()) return;
        state.settings.partnerName = nameInput.value.trim();
        save();
        onboardingStep = 2;
        renderOnboardingStep();
      });
    }

    var picks = wrap.querySelectorAll("[data-hub-mode]");
    for (var i = 0; i < picks.length; i++) {
      picks[i].addEventListener("click", function (ev) {
        var btn = ev.currentTarget;
        completeOnboarding(btn.getAttribute("data-hub-mode"));
      });
    }
  }

  /* ── mini tour ───────────────────────────────────────── */
  var tourIdx = 0;

  function startTour() {
    var wrap = document.getElementById("tour");
    var tips = CFG.tour || [];
    if (!wrap || !tips.length) {
      state.tourDone = true;
      save();
      setOverlayOpen(false);
      return;
    }
    tourIdx = 0;
    renderTourStep();
    wrap.classList.add("open");
    setOverlayOpen(true);
  }

  function renderTourStep() {
    var tips = CFG.tour || [];
    var tip = tips[tourIdx];
    if (!tip) return;
    setText("tourTitle", tip.title);
    setText("tourBody", tip.body);
    var next = document.getElementById("tourNext");
    if (next) next.textContent = tourIdx >= tips.length - 1 ? "Start planting →" : "Next";
    var dots = document.getElementById("tourDots");
    if (dots) {
      dots.innerHTML = "";
      for (var i = 0; i < tips.length; i++) {
        var iEl = document.createElement("i");
        if (i === tourIdx) iEl.className = "on";
        dots.appendChild(iEl);
      }
    }
  }

  function finishTour() {
    var wrap = document.getElementById("tour");
    if (wrap) wrap.classList.remove("open");
    state.tourDone = true;
    save();
    setOverlayOpen(false);
    renderGreetings();
  }

  function wireTour() {
    var next = document.getElementById("tourNext");
    if (!next || next.dataset.wired === "1") return;
    next.dataset.wired = "1";
    next.addEventListener("click", function () {
      var tips = CFG.tour || [];
      if (tourIdx >= tips.length - 1) return finishTour();
      tourIdx++;
      renderTourStep();
    });
  }

  /* ── clicks ──────────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto],[data-complete],[data-choice],[data-rhythm],[data-copy],[data-tadd],[data-tstatus],[data-tdel],[data-seedtype],#exportBtn,#exportBtn2,#resetBtn,#modeStarter,#modeFull,#levelUpBtn");
    if (!t) return;

    if (t.id === "modeStarter") {
      setHubMode("starter");
      return;
    }
    if (t.id === "modeFull" || t.id === "levelUpBtn") {
      setHubMode("full");
      if (t.id === "levelUpBtn") {
        state.active = "welcome";
        save();
        renderNav();
        renderPanels();
      }
      return;
    }

    if (t.hasAttribute("data-seedtype")) {
      var sid = t.getAttribute("data-seedtype");
      state.data.seedTypeOpen = (state.data.seedTypeOpen === sid) ? "" : sid;
      save(); renderSeedTypes();
      return;
    }

    if (t.hasAttribute("data-goto")) {
      var goto = t.getAttribute("data-goto");
      if (goto !== "welcome" && goto !== "done" && !sectionVisible(goto)) return;
      state.active = goto;
      save(); renderNav(); renderPanels();
      return;
    }
    if (t.hasAttribute("data-complete")) {
      var id = t.getAttribute("data-complete");
      if (!canComplete(id)) return;
      var wasNew = !state.done[id];
      state.done[id] = true;
      state.active = nextAfter(id) || "done";
      save(); renderNav(); renderPlant(); renderPanels(); refreshButtons(); renderFinishCopy();
      if (wasNew) {
        var r = t.getBoundingClientRect();
        leafBurst(r.left + r.width / 2, r.top);
      }
      return;
    }
    if (t.hasAttribute("data-choice")) {
      state.data[t.getAttribute("data-choice")] = t.getAttribute("data-value");
      save(); renderChoices(); liveRefresh(); flash(sectionOf(t));
      return;
    }
    if (t.hasAttribute("data-rhythm")) {
      var r2 = RHYTHMS[parseInt(t.getAttribute("data-rhythm"), 10)].label;
      var sel = state.data.rhythm || [];
      var ix = sel.indexOf(r2);
      if (ix > -1) sel.splice(ix, 1); else sel.push(r2);
      state.data.rhythm = sel;
      save(); renderRhythms(); liveRefresh(); flash("tend");
      return;
    }
    if (t.hasAttribute("data-tadd")) {
      if (Tree.add(state, t.getAttribute("data-tadd"))) {
        save(); Tree.render(state); renderPlant(); refreshButtons(); flash("tree");
        var inputs = document.querySelectorAll(".tnode-name");
        for (var n = inputs.length - 1; n >= 0; n--) {
          if (!inputs[n].value) { inputs[n].focus(); break; }
        }
      }
      return;
    }
    if (t.hasAttribute("data-tstatus")) {
      if (Tree.toggleStatus(state, t.getAttribute("data-tstatus"))) {
        save(); Tree.render(state); renderPlant(); refreshButtons(); flash("tree");
      }
      return;
    }
    if (t.hasAttribute("data-tdel")) {
      if (Tree.remove(state, t.getAttribute("data-tdel"))) {
        save(); Tree.render(state); renderPlant(); refreshButtons(); flash("tree");
      }
      return;
    }
    if (t.hasAttribute("data-copy")) {
      var src = document.getElementById(t.getAttribute("data-copy"));
      if (src && navigator.clipboard) {
        var prevLabel = t.textContent;
        navigator.clipboard.writeText(src.textContent.trim()).then(function () {
          t.textContent = "Copied ✓"; t.classList.add("copied");
          setTimeout(function () { t.textContent = prevLabel; t.classList.remove("copied"); }, 1600);
        });
      }
      return;
    }
    if (t.id === "exportBtn" || t.id === "exportBtn2") { exportAnswers(); return; }
    if (t.id === "resetBtn") {
      if (confirm("Start over? This clears all your saved answers on this device.")) {
        try { localStorage.removeItem(CFG.storeKey); } catch (err) {}
        state = blankState();
        var fs = document.querySelectorAll("[data-key]");
        for (var j = 0; j < fs.length; j++) fs[j].value = "";
        var checks = document.querySelectorAll(".claim-check");
        for (var c2 = 0; c2 < checks.length; c2++) checks[c2].innerHTML = "";
        updateModeUI();
        renderNav(); renderPanels(); renderChoices(); renderRhythms(); renderSeedTypes(); Tree.render(state); liveRefresh();
        startOnboarding();
      }
      return;
    }
  });

  /* ── export ──────────────────────────────────────────── */
  function exportAnswers() {
    var d = state.data;
    var treeC = Tree.counts(Tree.ensure(state));
    var name = partnerName();
    var modeLabel = isStarter() ? "Getting started" : isFull() ? "Full runway" : "—";
    var lines = ["FIRST SEEDS — my launch runway"];
    if (name) lines.push("Partner: " + name);
    lines = lines.concat([
      "Mode: " + modeLabel,
      "saved " + new Date().toLocaleDateString(), "",
      "═══ 01 · MY ROOTS ═══",
      "My why:", d.why || "—", "",
      "My Ringana moment:", d.moment || "—", "",
      "Why I said yes:", d.said_yes || "—", "",
      "═══ 02 · MY GROVE (" + groveNames().length + " names) ═══",
      d.warm || "—", "",
      "My first five:", d.warm_pick || "—", ""
    ]);

    if (isFull() || (d.tree && d.tree.length)) {
      lines = lines.concat([
        "═══ 03 · MY TREE (" + treeC.total + " people · " + treeC.hopeful + " hopeful · " + treeC.committed + " committed) ═══"
      ]).concat(Tree.exportLines(state)).concat([""]);
    }

    lines = lines.concat([
      "═══ MY GROUND ═══",
      "Page choice: " + (d.page_choice === "custom" ? "Custom page" : d.page_choice === "generic" ? "Team template" : "—"), "",
      "My opening line:", d.page_story || "—", ""
    ]);

    if (isFull() || filledText("seed_open") || filledText("seed_value") || filledText("seed_invite")) {
      lines = lines.concat([
        "═══ MY STARTER TRIO (Post Studio) ═══",
        "My open loop 🔓:", d.seed_open || "—", "",
        "My give 🌿:", d.seed_value || "—", "",
        "My soft door 🚪:", d.seed_invite || "—", "",
        "(Cadence: four gives, one ask — the door posts last)", ""
      ]);
    }

    lines = lines.concat(["═══ MY RHYTHM ═══"])
      .concat((d.rhythm && d.rhythm.length ? d.rhythm.map(function (r) { return "• " + r; }) : ["—"]))
      .concat(["", "Pre-registration: October 1 · Launch: November 1", "You've got this. 🌱"]);

    var blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-first-seeds.txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  /* ── init ────────────────────────────────────────────── */
  renderBrand();
  wireOnboarding();
  wireTour();
  updateModeUI();
  renderNav();
  renderPanels();
  renderChoices();
  renderRhythms();
  renderSeedTypes();
  renderHooks();
  Tree.render(state);
  renderCountdowns();
  var keys = ["why", "moment", "said_yes", "page_story", "seed_open", "seed_value", "seed_invite"];
  for (var ki = 0; ki < keys.length; ki++) runClaimCheck(keys[ki]);
  liveRefresh();
  setInterval(renderCountdowns, 60000);

  if (!modeChosen()) {
    startOnboarding();
  } else if (!state.tourDone) {
    startTour();
  }
})();
