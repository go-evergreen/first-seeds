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
      settings: { hubMode: "", partnerName: "", partnerLastName: "", growthMoment: true, growthToast: true, weekStartsOn: "sunday" },
      tourDone: false
    };
  }

  var state = blankState();

  function ensureSettings() {
    if (!state.settings) state.settings = {};
    if (!state.settings.hubMode) state.settings.hubMode = "";
    if (!state.settings.partnerName) state.settings.partnerName = "";
    if (!state.settings.partnerLastName) state.settings.partnerLastName = "";
    if (typeof state.settings.growthMoment !== "boolean") state.settings.growthMoment = true;
    if (typeof state.settings.growthToast !== "boolean") state.settings.growthToast = true;
    if (state.settings.weekStartsOn !== "monday" && state.settings.weekStartsOn !== "sunday") {
      state.settings.weekStartsOn = "sunday";
    }
  }

  function calendarWeekStart() {
    return state.settings.weekStartsOn === "monday" ? 1 : 0;
  }

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
          state.settings = old.settings || { hubMode: "", partnerName: "" };
          state.tourDone = !!old.tourDone;
          if (!state.data.calendar) state.data.calendar = {};
          ensureSettings();
          migrateGrovePicks();
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
        state.tourDone = !!p.tourDone;
      }
      if (!state.data.calendar) state.data.calendar = {};
      if (state.active === "calendar") state.active = "tend";
      ensureSettings();
      migrateGrovePicks();
    } catch (e) {
      ensureSettings();
      migrateGrovePicks();
    }
  }

  function parseNameLines(text) {
    return ((text || "") + "").split("\n")
      .map(function (l) { return l.replace(/^\d+[\.\)]\s*/, "").trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  function migrateGrovePicks() {
    if (!state.data) state.data = {};
    if (!Array.isArray(state.data.customer_first)) {
      state.data.customer_first = parseNameLines(state.data.customer_pick).slice(0, 5);
    }
    if (!Array.isArray(state.data.warm_first)) {
      state.data.warm_first = parseNameLines(state.data.warm_pick).slice(0, 5);
    }
  }

  var cloudSyncTimer;
  function save(opts) {
    opts = opts || {};
    try { localStorage.setItem(CFG.storeKey, JSON.stringify(state)); } catch (e) {}
    clearTimeout(cloudSyncTimer);
    var push = function () {
      if (!window.FS.BridgeUI || !window.FS.BridgeUI.syncNow) return;
      Promise.resolve(window.FS.BridgeUI.syncNow()).catch(function (err) {
        console.warn("[First Seeds] cloud sync:", err);
      });
    };
    if (opts.immediate) push();
    else {
      cloudSyncTimer = setTimeout(push, 800);
    }
  }

  function flushSave() {
    save({ immediate: true });
  }

  /* Don’t lose the last Roots keystrokes if the tab/app closes mid-debounce. */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushSave();
  });
  window.addEventListener("pagehide", flushSave);

  loadState();

  /* ── mode helpers ────────────────────────────────────── */
  function isStarter() { return state.settings.hubMode === "starter"; }
  function isFull() { return state.settings.hubMode === "full"; }
  function usesCustomLanding() { return state.data.page_choice === "custom"; }
  function usesBuiltInLeadPage() { return state.data.page_choice === "generic"; }
  function leadPageReady() {
    var Cloud = window.FS.Cloud;
    var u = Cloud && Cloud.user ? Cloud.user() : null;
    return !!(u && u.lead_slug);
  }
  function leadSignedIn() {
    var Cloud = window.FS.Cloud;
    return !!(Cloud && Cloud.isSignedIn && Cloud.isSignedIn());
  }
  function leadPreviewSeen() {
    return !!state.data.lead_preview_seen;
  }
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

  /* Soft start: roots → share → ground → grove → done
     Full path:    roots → share → ground → grove → tree → plant → tend → done */
  function nextAfter(id) {
    if (isStarter()) {
      return { roots: "share", share: "ground", ground: "grove", grove: "done" }[id];
    }
    return { roots: "share", share: "ground", ground: "grove", grove: "tree", tree: "plant", plant: "tend", tend: "done" }[id];
  }

  function priorSectionId(id) {
    var secs = visibleSections();
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].id === id) return i === 0 ? null : secs[i - 1].id;
    }
    return null;
  }

  function sectionLabel(id) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return SECTIONS[i].label;
    return id;
  }

  function softUnlocked(id) {
    return !!(state.data.softUnlock && state.data.softUnlock[id]);
  }

  /* Prior modules must be truly finished — soft-unlock peek doesn't count as a chain link. */
  function sectionChainComplete(id) {
    if (!id) return true;
    if (id === "roots") return rootCount() >= ROOT_MAX;
    if (!state.done[id]) return false;
    return sectionChainComplete(priorSectionId(id));
  }

  function isContentSurface(id) {
    return id === "tend" || id === "calendar" || id === "curiosity-photos" ||
      id === "content-vault" || id === "content-stories" || id === "content-week";
  }

  function isModuleUnlocked(id) {
    if (isContentSurface(id) && !isFull()) return false;
    if (!id || id === "welcome" || id === "done" || id === "calendar" || id === "leader" || id === "know" || id === "tend" || id === "products" || id === "talk" || id === "curiosity-photos" || id === "content-vault" || id === "content-stories" || id === "content-week" || id === "leads") return true;
    if (!sectionVisible(id)) return false;
    if (softUnlocked(id)) return true;
    if (state.done[id]) return true;
    var prior = priorSectionId(id);
    if (!prior) return true;
    return sectionChainComplete(prior);
  }

  function ensureSoftUnlockMap() {
    if (!state.data.softUnlock) state.data.softUnlock = {};
  }

  function partnerName() {
    return ((state.settings.partnerName || "") + "").trim();
  }

  function partnerLastName() {
    return ((state.settings.partnerLastName || "") + "").trim();
  }

  /* If someone typed "First Last" into the first-name field before we asked for last name, split it. */
  function splitFullNameIfNeeded() {
    var first = partnerName();
    var last = partnerLastName();
    if (last || !first) return false;
    var parts = first.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    state.settings.partnerName = parts[0];
    state.settings.partnerLastName = parts.slice(1).join(" ");
    return true;
  }

  function firstName() {
    var n = partnerName();
    return n ? n.split(/\s+/)[0] : "";
  }

  /* ── growth math ────────────────────────────────────────
     Roots  = the 3 Roots answers (underground) — shown as Roots x/3
     Checks = checklist items outside Roots — shown as Checks x/y
     Bar    = overall progress including Roots (Growth %)
     ───────────────────────────────────────────────────── */
  var ROOT_FIELDS = ["why", "moment", "said_yes"];
  var ROOT_MAX = 3;
  var lastSprout = -1;

  function filledText(k) { return ((state.data[k] || "") + "").trim().length > 0; }
  function giveDraftFilled() {
    return filledText("seed_curtain") || filledText("seed_honest") || filledText("seed_values") || filledText("seed_value");
  }
  function anySeedDraft() {
    return filledText("seed_open") || giveDraftFilled() || filledText("seed_invite");
  }
  /* Old saves used one shared seed_value — park it under Behind the Scenes */
  if (filledText("seed_value") && !filledText("seed_curtain") && !filledText("seed_honest") && !filledText("seed_values")) {
    state.data.seed_curtain = state.data.seed_value;
  }

  function rootCount() {
    var n = 0;
    for (var i = 0; i < ROOT_FIELDS.length; i++) if (filledText(ROOT_FIELDS[i])) n++;
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

  function checklistProgress() {
    /* Count every visible required checklist item — not only the unlocked
       slice — so Growth % and plant stage never false-bloom mid-module. */
    var secs = visibleSections();
    var done = 0, total = 0, sproutDone = 0, sproutTotal = 0;
    for (var i = 0; i < secs.length; i++) {
      var items = checklistItems(secs[i].id);
      for (var j = 0; j < items.length; j++) {
        if (items[j].optional) continue;
        total++;
        if (items[j].done) done++;
        if (secs[i].id !== "roots") {
          sproutTotal++;
          if (items[j].done) sproutDone++;
        }
      }
    }
    return { done: done, total: total, sproutDone: sproutDone, sproutTotal: sproutTotal };
  }

  /* Drop sticky done flags when the work is no longer complete. */
  function reconcileDoneFlags() {
    var secs = visibleSections();
    var changed = false;
    for (var i = 0; i < secs.length; i++) {
      var id = secs[i].id;
      if (state.done[id] && !canComplete(id)) {
        state.done[id] = false;
        changed = true;
      }
    }
    return changed;
  }

  /* ── DOM refs ────────────────────────────────────────── */
  var nav = document.getElementById("nav");
  var homePlant = document.getElementById("homePlant");
  var finishPlant = document.getElementById("finishPlant");
  var caption = document.getElementById("plantCaption");
  var progressFill = document.getElementById("progressFill");

  function esc(t) { return (t + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function renderDmStarters() {
    var host = document.getElementById("dmStarters");
    if (!host) return;
    var list = CFG.dmStarters || [];
    if (!list.length && CFG.dmStarter) {
      list = [{ label: "Warm opener", text: CFG.dmStarter }];
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var id = "dmStarter_" + i;
      var label = list[i].label || ("Option " + (i + 1));
      html += '<div class="dm-option copy-card">';
      html += '<button type="button" class="dm-option-head copy-card-head" data-copy-toggle="' + id + '">';
      html += '<span class="dm-option-label">' + esc(label) + "</span>";
      html += '<span class="copy-card-chev">+</span></button>';
      html += '<div class="dm-option-body copy-card-body" id="' + id + '_body" hidden>';
      html += '<div class="starter-text" id="' + id + '">' + esc(list[i].text) + "</div>";
      html += '<button type="button" class="copy-btn small" data-copy="' + id + '">Copy it</button>';
      html += "</div></div>";
    }
    host.innerHTML = html;
  }

  function setOverlayOpen(open) {
    document.body.classList.toggle("overlay-open", !!open);
  }

  function anyBlockingOverlayOpen() {
    var ids = ["authOverlay", "howGrowOverlay", "lastNameOverlay", "onboarding", "tour"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.classList.contains("open")) return true;
    }
    return false;
  }

  function syncOverlayBodyLock() {
    setOverlayOpen(anyBlockingOverlayOpen());
  }
  window.FS.syncOverlayBodyLock = syncOverlayBodyLock;

  /* ── brand / config into DOM ─────────────────────────── */
  function renderBrand() {
    var eb = document.getElementById("brandEyebrow");
    var tg = document.getElementById("brandTagline");
    if (eb) eb.textContent = CFG.teamName;
    if (tg) tg.textContent = CFG.tagline;
    var so = document.getElementById("signoff");
    if (so) so.textContent = CFG.signoff;
    renderDmStarters();
    var coldTag = document.getElementById("coldOutreachTag");
    var coldBody = document.getElementById("coldOutreachBody");
    if (CFG.coldOutreach) {
      if (coldTag) coldTag.textContent = CFG.coldOutreach.tag;
      if (coldBody) coldBody.innerHTML = CFG.coldOutreach.body;
    }
    var pc = CFG.pageOptions;
    var ct = document.getElementById("customTitle"), cd = document.getElementById("customDesc");
    var gt = document.getElementById("genericTitle"), gd = document.getElementById("genericDesc");
    if (ct) ct.textContent = pc.custom.title;
    if (cd) cd.textContent = pc.custom.desc;
    if (gt) gt.textContent = pc.generic.title;
    if (gd) gd.textContent = pc.generic.desc;

    /* onboarding static copy */
    var team = CFG.teamDisplayName || "The Fresh Grove";
    function obCopy(text) {
      return (text || "").replace(/The Fresh Grove/g, team);
    }
    setText("obWelcomeEyebrow", OB.welcomeEyebrow);
    setText("obWelcomeBody", obCopy(OB.welcomeBody));
    setText("onboardTitle", OB.welcomeTitle);
    setText("onboardingNext", OB.welcomeCta || "Let's go");
    setText("obCircleEyebrow", OB.circleEyebrow);
    setText("obCircleTitle", OB.circleTitle);
    setText("obCircleBody", obCopy(OB.circleBody));
    setText("obCircleNote", obCopy(OB.circleNote));
    setText("onboardingCircleNext", OB.circleCta || "I'm in");
    setText("obNameEyebrow", OB.nameEyebrow);
    setText("obNameTitle", OB.nameTitle);
    setText("obNameHint", OB.nameHint);
    setText("obHypeLine", OB.hypeLine);
    setText("obAuthEyebrow", OB.authEyebrow);
    setText("obAuthTitle", OB.authTitle);
    setText("obAuthBody", obCopy(OB.authBody));
    setText("obAuthHint", obCopy(OB.authHint));
    var authCta = document.getElementById("onboardingSignInBtn");
    if (authCta && OB.authCta) authCta.textContent = OB.authCta;
    var authSkip = document.getElementById("onboardingSkipAuth");
    if (authSkip && OB.authSkip) authSkip.textContent = OB.authSkip;
    setText("obInstallEyebrow", OB.installEyebrow);
    setText("obInstallTitle", OB.installTitle);
    setText("obInstallLead", OB.installLead);
    var installNext = document.getElementById("onboardingInstallNext");
    if (installNext && OB.installCta) installNext.textContent = OB.installCta;
    var installSkip = document.getElementById("onboardingInstallSkip");
    if (installSkip && OB.installSkip) installSkip.textContent = OB.installSkip;
    var installConfirmLabel = document.querySelector("#onboardInstallConfirmWrap span");
    if (installConfirmLabel && OB.installConfirm) installConfirmLabel.textContent = OB.installConfirm;
    setText("obModeEyebrow", OB.modeEyebrow);
    setText("obModeTitle", OB.modeTitle);
    setText("obModeLead", OB.modeLead);
    setText("onboardingNameNext", OB.nameCta || "Continue");

    var nameInput = document.getElementById("partnerNameInput");
    if (nameInput && OB.namePlaceholder) nameInput.placeholder = OB.namePlaceholder;
    var lastInput = document.getElementById("partnerLastNameInput");
    if (lastInput && OB.lastNamePlaceholder) lastInput.placeholder = OB.lastNamePlaceholder;

    if (MODES.starter) {
      setText("modePickStarterTag", MODES.starter.tag || "Essentials");
      setText("modePickStarterLabel", MODES.starter.label);
      setText("modePickStarterDesc", MODES.starter.desc);
    }
    if (MODES.full) {
      setText("modePickFullTag", MODES.full.tag || "Everything");
      setText("modePickFullLabel", MODES.full.label);
      setText("modePickFullDesc", MODES.full.desc);
    }

    renderTermLibrary();
  }

  function renderTermLibrary() {
    var list = document.getElementById("hubTermList");
    if (!list) return;
    var terms = CFG.terms || [];
    var html = "";
    for (var i = 0; i < terms.length; i++) {
      html += '<div class="term-item">' +
        '<span class="term-name">' + esc(terms[i].term) + "</span>" +
        '<span class="term-def">' + esc(terms[i].def) + "</span>" +
        "</div>";
    }
    list.innerHTML = html;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && text != null) el.textContent = text;
  }

  /* ── greetings / personalized copy ───────────────────── */
  function renderGreetings() {
    var name = firstName();

    var wh = document.getElementById("welcomeHeadline");
    if (wh) {
      wh.innerHTML = name
        ? ("Hey " + esc(name) + ".<br>Watch it grow.")
        : "Watch it grow.";
    }

    var pathNote = document.getElementById("welcomePathNote");
    if (pathNote) {
      if (isStarter()) {
        pathNote.innerHTML = "Your plant lives here. Leads, Learn, and your path stay one tap away at the bottom. Content and Grove unlock on All in.";
      } else if (isFull()) {
        pathNote.innerHTML = "Your plant lives here. Content, Leads, Learn, Grove, and your path stay one tap away at the bottom.";
      } else {
        pathNote.innerHTML = "Your plant lives here. Pick Soft start or All in in Settings — then your path stays one tap away at the bottom.";
      }
    }

    var rh = document.getElementById("rootsHeadline");
    if (rh) rh.textContent = name ? (name + " — plant your roots") : "Plant Your Roots";

    /* section numbers follow Soft start / All in path (Content uses a word eyebrow, not 07) */
    var shareNum = document.getElementById("shareNum");
    var groundNum = document.getElementById("groundNum");
    var groveNum = document.getElementById("groveNum");
    var treeNum = document.getElementById("treeNum");
    var plantNum = document.getElementById("plantNum");
    if (shareNum) shareNum.textContent = "02";
    if (groundNum) groundNum.textContent = "03";
    if (isStarter()) {
      if (groveNum) groveNum.textContent = "04";
    } else {
      if (groveNum) groveNum.textContent = "04";
      if (treeNum) treeNum.textContent = "05";
      if (plantNum) plantNum.textContent = "06";
    }

    renderFinishCopy();
    renderTodayCard();
  }

  /* ── "What should I do today?" — one next move, no overwhelm ─ */
  function sectionStarted(id) {
    if (id === "roots") return filledText("why") || filledText("moment") || filledText("said_yes");
    if (id === "share") return favoriteCount() > 0 || talkOpened();
    if (id === "grove") {
      return customerNames().length > 0 || groveNames().length > 0
        || grovePicks("customer_first").length > 0 || grovePicks("warm_first").length > 0;
    }
    if (id === "tree") return Tree.counts(Tree.ensure(state)).total > 0;
    if (id === "ground") return !!state.data.page_choice || filledText("page_story");
    if (id === "plant") return anySeedDraft();
    if (id === "tend") {
      var marked = window.FS.Calendar && window.FS.Calendar.countMarked
        ? window.FS.Calendar.countMarked(state.data.calendar || {})
        : 0;
      return marked > 0;
    }
    return false;
  }

  function calendarWeekPulse() {
    if (!window.FS.Calendar) return { posted: 0, drafted: 0, total: 0, restToday: false };
    var cal = state.data.calendar || {};
    var plan = window.FS.Calendar.plan(CFG, cal, state.data, {
      cadence: state.data.calendarCadence === true,
      weekStart: calendarWeekStart()
    });
    var slice = window.FS.Calendar.weekSlice(plan, new Date(), state.data.calendarWeekOffset || 0, calendarWeekStart());
    var week = slice.days || [];
    var stats = window.FS.Calendar.weekStats(week);
    var today = window.FS.Calendar.ymd(new Date());
    var todaySlot = null;
    for (var i = 0; i < week.length; i++) if (week[i].date === today) todaySlot = week[i];
    var restToday = !!(todaySlot && todaySlot.suggested && todaySlot.suggested.reactive && !(todaySlot.items || []).length);
    return {
      posted: stats.posted,
      drafted: stats.drafted,
      total: stats.total,
      restToday: restToday,
      todayStatus: "todo"
    };
  }

  function pickTodayMove() {
    var name = firstName();
    var hey = name ? name : "friend";
    var secs = visibleSections();
    var tips = {
      roots: {
        title: "Plant one root.",
        body: "Ten quiet minutes. Answer the three Roots questions in your own words — messy is fine.",
        cta: sectionStarted("roots") ? "Finish your Roots →" : "Start with Roots →",
        why: "Everything you share later grows from this."
      },
      share: {
        title: "Pick your first few.",
        body: "Heart 2–3 products you’re looking forward to, then open Talking fresh once — so your story has real product knowledge behind it.",
        cta: sectionStarted("share") ? "Keep picking →" : "Open Pick Your First Few →",
        why: "A shortlist + one conversation guide beats a catalog quiz."
      },
      ground: {
        title: "Claim a patch of ground.",
        body: usesBuiltInLeadPage() && !leadPageReady()
          ? "You picked the First Seeds page — next, set up the link you'll share with interested people (sign in, save your URL, preview)."
          : "Pick First Seeds lead page or your own page, draft one warm opening line, and finish the steps that follow.",
        cta: sectionStarted("ground") ? "Finish your page steps →" : "Claim your ground →",
        why: "Curious people need one place to land."
      },
      grove: {
        title: "Map a few names.",
        body: isFull()
          ? "List people who'd love the products, then tap up to 5 first chats — they land on your Content calendar. Partners are optional if you're building."
          : "List people who'd love the products, then tap up to 5 first chats so you know who to reach out to first. Partners are optional if you're building.",
        cta: sectionStarted("grove") ? "Keep mapping your grove →" : "Open your grove →",
        why: "Affiliate-style or builder — customers first either way."
      },
      tree: {
        title: "Sketch your dream team.",
        body: "Add three people you'd love building with. Hopeful is fine — flip them to committed when they say yes.",
        cta: sectionStarted("tree") ? "Keep growing your tree →" : "Open Grow Your Tree →",
        why: "Seeing faces turns a vague list into real people."
      },
      plant: {
        title: "Draft in Post Studio.",
        body: "Open a post type, learn it, and draft inside it — a curiosity post, a helpful share, and a soft invite. No posting required yet.",
        cta: sectionStarted("plant") ? "Keep drafting →" : "Open Post Studio →",
        why: "Launch feels calmer when the words are already yours."
      },
      tend: {
        title: "Tend your content.",
        body: "Open week or month view. Edit a draft, grab a photo, or mark three days done. Nothing auto-posts.",
        cta: sectionStarted("tend") ? "Keep your content warm →" : "Open Content →",
        why: "A garden grows from showing up, not one big planting day."
      }
    };

    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (!state.done[s.id] && isModuleUnlocked(s.id)) {
        var tip = tips[s.id] || {
          title: "Keep going.",
          body: "Your next module is waiting — one small step.",
          cta: "Continue →",
          why: ""
        };
        return {
          title: tip.title,
          body: tip.body,
          why: tip.why,
          primary: { label: tip.cta, goto: s.id },
          secondary: state.done.roots
            ? (isFull()
              ? { label: "Or peek at Content", goto: "calendar" }
              : { label: "Or open Learn", goto: "know" })
            : null
        };
      }
    }

    /* Soft start runway complete — celebrate, then point into the rest of the app */
    if (isStarter()) {
      return {
        title: "Solid foundation.",
        body: "Amazing job growing a real base for your business. Soft start is done — lean on Learn and Leads, and unlock All in anytime for Content, Post Studio, and Grow Your Grove.",
        why: "Calm prep beats a scramble, " + hey + ".",
        primary: { label: "Unlock All in →", action: "fullMode" },
        secondary: { label: "Open Learn →", goto: "know" }
      };
    }

    var pulse = calendarWeekPulse();
    if (pulse.restToday && pulse.todayStatus === "todo") {
      return {
        title: "Rest counts.",
        body: "Today's a real-life / reply day on your calendar. Answer a comment, text one grove person, or just live your life.",
        why: "Consistency includes rest, " + hey + ".",
        primary: { label: "See today's calendar →", goto: "calendar" },
        secondary: { label: "Back to Sprout", goto: "welcome" }
      };
    }
    if (pulse.posted < 3 && pulse.total > 0) {
      return {
        title: "Share one true thing.",
        body: pulse.posted === 0
          ? "Your Sprout path is done — nice. Grab one gentle idea from Content and mark it Done when you share (or Skipped if today isn't the day)."
          : ("You've marked " + pulse.posted + " done this week. One more true post keeps the habit warm."),
        why: "No auto-post. Just a nudge so you don't go silent.",
        primary: { label: "Open Content →", goto: "calendar" },
        secondary: { label: "Notify my leader", goto: "done" }
      };
    }

    var Cloud = window.FS.Cloud;
    if (Cloud && Cloud.isSignedIn && Cloud.isSignedIn()) {
      return {
        title: "Solid foundation.",
        body: "Amazing job. Your runway is complete — keep Content warm with your focus products, check Grow Your Grove, and lean on Learn when someone asks.",
        why: "Showing up is the whole game, " + hey + ".",
        primary: { label: "Open Content →", goto: "calendar" },
        secondary: { label: "Grove →", goto: "leader" }
      };
    }

    return {
      title: "Solid foundation.",
      body: "Amazing job growing a real base for your business. Keep Content warm, lean on Learn, and sign in so your progress travels with you.",
      why: "October will feel different because of this.",
      primary: { label: "Open Content →", goto: "calendar" },
      secondary: { label: "Sign in / Account", action: "auth" }
    };
  }

  function renderTodayCard() {
    var card = document.getElementById("todayCard");
    if (!card) return;
    var move = pickTodayMove();
    var title = document.getElementById("todayTitle");
    var body = document.getElementById("todayBody");
    var why = document.getElementById("todayWhy");
    var actions = document.getElementById("todayActions");
    if (title) title.textContent = move.title;
    if (body) body.textContent = move.body;
    if (why) why.textContent = move.why || "";
    if (!actions) return;
    var html = "";
    if (move.primary) {
      if (move.primary.action === "auth") {
        html += '<button type="button" class="btn" id="todayAuthBtn">' + esc(move.primary.label) + "</button>";
      } else if (move.primary.action === "fullMode") {
        html += '<button type="button" class="btn" id="todayUnlockFull">' + esc(move.primary.label) + "</button>";
      } else {
        html += '<button type="button" class="btn" data-goto="' + esc(move.primary.goto) + '" id="todayPrimaryBtn">' +
          esc(move.primary.label) + "</button>";
      }
    }
    if (move.secondary) {
      if (move.secondary.action === "auth") {
        html += '<button type="button" class="btn-ghost" id="todayAuthBtn">' + esc(move.secondary.label) + "</button>";
      } else if (move.secondary.action === "fullMode") {
        html += '<button type="button" class="btn-ghost" id="todayUnlockFull">' + esc(move.secondary.label) + "</button>";
      } else {
        html += '<button type="button" class="btn-ghost" data-goto="' + esc(move.secondary.goto) + '">' +
          esc(move.secondary.label) + "</button>";
      }
    }
    actions.innerHTML = html;
  }

  function renderFinishCopy() {
    var name = firstName();
    var eyebrow = document.getElementById("finishEyebrow");
    var headline = document.getElementById("finishHeadline");
    var body = document.getElementById("finishBody");
    var levelUp = document.getElementById("levelUpBtn");
    var learnBtn = document.getElementById("finishLearnBtn");
    var contentBtn = document.getElementById("finishContentBtn");
    var nextCard = document.getElementById("finishNext");
    var nextBody = document.getElementById("finishNextBody");

    if (eyebrow) eyebrow.textContent = "SOLID FOUNDATION";
    if (headline) {
      headline.textContent = name
        ? ("You grew a solid foundation, " + name + ".")
        : "You grew a solid foundation.";
    }

    if (isStarter()) {
      if (body) {
        body.innerHTML = "Amazing job. Soft start is complete — your story, focus products, a page to share, and people to talk to. That’s a real base for your business. Now lean on the other resources in First Seeds.";
      }
      if (nextBody) {
        nextBody.textContent = "Open Learn for clear facts and Talking fresh. Use Leads when you’re ready to share a link. Unlock All in anytime for Content, Post Studio, and Grow Your Grove.";
      }
      if (levelUp) levelUp.hidden = false;
      if (contentBtn) contentBtn.hidden = true;
    } else {
      if (body) {
        body.innerHTML = "Amazing job. Your full Sprout path is complete — story, focus products, page, grove, dream team sketch, Post Studio drafts, and a Content habit. That’s a real base for your business. Now lean on the rest of First Seeds and keep showing up.";
      }
      if (nextBody) {
        nextBody.textContent = "Keep Content warm with your focus products. Check Grow Your Grove for partners. Lean on Learn whenever someone asks a hard question — and use Leads when you’re ready to share a link.";
      }
      if (levelUp) levelUp.hidden = true;
      if (contentBtn) contentBtn.hidden = false;
    }
    if (nextCard) nextCard.hidden = false;
    if (learnBtn) learnBtn.hidden = false;
    renderFinishShortlist();
  }

  /* ── mode UI ─────────────────────────────────────────── */
  function applyModeClass() {
    document.body.classList.toggle("mode-starter", isStarter());
    document.body.classList.toggle("mode-full", isFull());
  }

  function updateModeUI() {
    applyModeClass();
    var starterBtn = document.getElementById("modeStarter");
    var fullBtn = document.getElementById("modeFull");
    if (starterBtn) {
      starterBtn.textContent = (MODES.starter && MODES.starter.label) || "Soft start";
      starterBtn.classList.toggle("on", isStarter());
    }
    if (fullBtn) {
      fullBtn.textContent = (MODES.full && MODES.full.label) || "All in";
      fullBtn.classList.toggle("on", isFull());
    }
    var hint = document.getElementById("hubModeHint");
    if (hint) {
      if (isStarter()) hint.textContent = "Soft start keeps the path light: story, products that feel like you, page, grove, finish. Content and Grove unlock on All in.";
      else if (isFull()) hint.textContent = "Every runway section unlocked, plus Content and Grove in the bottom nav. Switch to Soft start for a simpler view — your progress stays.";
      else hint.textContent = "";
    }
    updateLeadPageSettingUI();
    renderGreetings();
  }

  function updateLeadPageSettingUI() {
    var builtIn = document.getElementById("leadPageBuiltIn");
    var custom = document.getElementById("leadPageCustom");
    var note = document.getElementById("leadPageSettingNote");
    if (builtIn) builtIn.classList.toggle("on", usesBuiltInLeadPage());
    if (custom) custom.classList.toggle("on", usesCustomLanding());
    if (note) {
      if (usesBuiltInLeadPage()) {
        note.textContent = "Leads tab is on. You’re using the in-app First Seeds lead page.";
      } else if (usesCustomLanding()) {
        note.textContent = "Leads tab is hidden while you use a custom-built page. Switch to In-app lead page anytime to turn it back on.";
      } else {
        note.textContent = "Choose the in-app First Seeds lead page, or a custom-built page (ask your Fresh Grove leader).";
      }
    }
  }

  function setPageChoice(value, opts) {
    opts = opts || {};
    if (value !== "generic" && value !== "custom") return;
    state.data.page_choice = value;
    if (value === "custom" && state.active === "leads") state.active = "ground";
    if (value === "generic" && opts.openLeads) state.active = "leads";
    if (value === "generic") syncPageStoryToLeadBlurb();
    save();
    updateLeadPageSettingUI();
    renderChoices();
    liveRefresh({ silent: true });
    renderNav();
    renderBottomNav();
    renderPanels();
  }

  function setHubMode(mode, opts) {
    opts = opts || {};
    if (mode !== "starter" && mode !== "full") return;
    var prev = state.settings.hubMode;
    state.settings.hubMode = mode;
    /* if currently on a section hidden in new mode, bounce to welcome */
    if (state.active === "leader" && mode === "starter") {
      state.active = "welcome";
    } else if (mode === "starter" && isContentSurface(state.active)) {
      state.active = "welcome";
    } else if (state.active !== "welcome" && state.active !== "done" && !sectionVisible(state.active)) {
      state.active = "welcome";
    }
    save();
    updateModeUI();
    renderNav();
    renderPanels();
    /* Mode change expands/shrinks the checklist — force a clean plant redraw */
    renderPlant({ silent: true, force: true });
    refreshButtons();
    liveRefresh({ silent: true });
    if (opts.silent || prev === mode) return;
  }

  /* ── post studio ─────────────────────────────────────── */
  function bindSeedDraftFields(root) {
    if (!root) return;
    var fields = root.querySelectorAll("[data-key]");
    for (var i = 0; i < fields.length; i++) {
      (function (f) {
        var k = f.getAttribute("data-key");
        if (state.data[k]) f.value = state.data[k];
        runClaimCheck(k);
        f.addEventListener("input", function () {
          state.data[k] = f.value;
          runClaimCheck(k);
          var beforeSprout = lastSprout;
          liveRefresh({ silent: true });
          if (checklistProgress().sproutDone > beforeSprout) {
            lastSprout = beforeSprout;
            renderPlant({ deferCelebrate: true });
          } else if (pendingGrowth) {
            clearTimeout(growthIdleTimer);
            growthIdleTimer = setTimeout(flushPendingGrowth, GROWTH_IDLE_MS);
          }
          clearTimeout(flashTimers._seedDraft);
          flashTimers._seedDraft = setTimeout(function () {
            save();
            flash("plant");
            renderModuleChecklists();
            refreshButtons();
          }, 500);
        });
        f.addEventListener("blur", function () {
          clearTimeout(flashTimers._seedDraft);
          flushSave();
          if (pendingGrowth) flushPendingGrowth();
        });
      })(fields[i]);
    }
  }

  function renderSeedTypes() {
    var wrap = document.getElementById("seedTypes");
    if (!wrap) return;
    /* Don't rebuild while they're typing/selecting in a draft — wipes selection. */
    var ae = document.activeElement;
    if (ae && wrap.contains(ae) && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT")) return;
    var open = state.data.seedTypeOpen || "";
    var html = "";
    var types = window.FS.SEED_TYPES;
    for (var i = 0; i < types.length; i++) {
      var st = types[i];
      var isOpen = open === st.id;
      var draftKey = st.draftKey;
      var hasDraft = draftKey && filledText(draftKey);
      html += '<div class="seed-card' + (isOpen ? " open" : "") + (hasDraft ? " drafted" : "") + '">';
      html += '<button type="button" class="seed-head" data-seedtype="' + st.id + '">';
      html += '<span class="seed-icon">' + st.icon + '</span>';
      html += '<span class="seed-titles"><span class="seed-name">' + esc(st.name) + '</span><span class="seed-tag">' + esc(st.tagline) + '</span></span>';
      html += '<span class="seed-chev">' + (isOpen ? "−" : "+") + '</span>';
      html += '</button>';
      if (isOpen) {
        html += '<div class="seed-body">';
        if (st.works_today) {
          html += '<div class="seed-block today"><div class="seed-label">WHY IT WORKS ON SOCIAL NOW</div><p>' + esc(st.works_today) + '</p></div>';
        }
        html += '<div class="seed-block"><div class="seed-label">WHY PEOPLE RESPOND</div><p>' + esc(st.psychology) + '</p></div>';
        html += '<div class="seed-block"><div class="seed-label">THE TEMPLATE</div><p>' + esc(st.template) + '</p></div>';
        html += '<div class="seed-block example"><div class="seed-label">WORKED EXAMPLE</div><p class="seed-example" id="seedEx_' + st.id + '">' + esc(st.example) + '</p><button type="button" class="copy-btn small" data-copy="seedEx_' + st.id + '">Copy it</button></div>';
        html += '<div class="seed-block rule"><div class="seed-label">THE CLASSY RULE</div><p>' + esc(st.classy_rule) + '</p></div>';
        if (draftKey) {
          html += '<div class="seed-block draft field" data-field="' + draftKey + '">';
          html += '<div class="seed-label">YOUR DRAFT</div>';
          html += '<p class="seed-draft-hint">' + esc(st.draftHint || "Write yours — pull from Roots when you can.") + '</p>';
          html += '<textarea data-key="' + draftKey + '" rows="3" placeholder="' + esc(st.draftPlaceholder || "") + '"></textarea>';
          html += '<span class="claim-check" data-check="' + draftKey + '"></span>';
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    wrap.innerHTML = html;
    bindSeedDraftFields(wrap);
  }

  function renderHooks() {
    var wrap = document.getElementById("hookList");
    if (!wrap) return;
    var hooks = (CFG.hookBank && CFG.hookBank.length)
      ? CFG.hookBank
      : ((window.FS.CONTENT && window.FS.CONTENT.openLoops) || []);
    var html = "";
    for (var i = 0; i < hooks.length; i++) {
      var h = hooks[i];
      var text = typeof h === "string" ? h : (h && h.body) || "";
      if (!text) continue;
      html += '<div class="hook-row"><span class="hook-text" id="hook_' + i + '">' + esc(text) + '</span><button class="copy-btn small" data-copy="hook_' + i + '">Copy</button></div>';
    }
    wrap.innerHTML = html;
  }

  function renderCopyShelf(wrapId, items, prefix) {
    var wrap = document.getElementById(wrapId);
    if (!wrap || !items) return;
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var id = prefix + "_" + (it.id || i);
      var title = it.title || it.icon || ("Option " + (i + 1));
      if (it.icon && it.title) title = it.icon + " " + it.title;
      html += '<div class="copy-card' + (it.open ? " open" : "") + '">';
      html += '<button type="button" class="copy-card-head" data-copy-toggle="' + id + '">';
      html += '<span class="copy-card-title">' + esc(title) + '</span>';
      html += '<span class="copy-card-chev">+</span></button>';
      html += '<div class="copy-card-body" id="' + id + '_body" hidden>';
      html += '<p class="copy-card-text" id="' + id + '">' + esc(it.body || "") + '</p>';
      html += '<button type="button" class="copy-btn small" data-copy="' + id + '">Copy</button>';
      html += '</div></div>';
    }
    wrap.innerHTML = html;
  }

  function renderContentBanks() {
    var C = window.FS.CONTENT;
    if (!C) return;
    renderCopyShelf("curiosityList", C.curiosity, "cur");
    renderCopyShelf("calendarCuriosityList", C.curiosity, "calcur");
    var intro = document.getElementById("productStoryIntro");
    if (intro && C.productStory) intro.textContent = C.productStory.intro;
    renderCopyShelf("productStoryList", C.productStory && C.productStory.posts, "prod");
    renderCopyShelf("businessStoryList", C.businessStory, "biz");
  }

  function renderKnowPanel() {
    var C = window.FS.CONTENT;
    if (!C) return;
    var pi = document.getElementById("pillarsIntro");
    if (pi) pi.textContent = C.pillarsIntro || "";
    var pillarsWrap = document.getElementById("pillarsList");
    if (pillarsWrap && C.pillars) {
      pillarsWrap.innerHTML = C.pillars.map(function (p) {
        return '<div class="fact-card pillar-card"><div class="fact-label">' + esc(p.icon + " " + p.title) +
          '</div><p>' + esc(p.body) + '</p></div>';
      }).join("");
    }
    var factsWrap = document.getElementById("funFactsList");
    if (factsWrap && C.funFacts) {
      factsWrap.innerHTML = C.funFacts.map(function (f) {
        return '<div class="fact-card"><div class="fact-label">' + esc(f.title) +
          '</div><p>' + esc(f.body) + '</p></div>';
      }).join("");
    }
    var prodKnow = document.getElementById("productKnowList");
    if (prodKnow && C.productStory && C.productStory.posts) {
      prodKnow.innerHTML = C.productStory.posts.map(function (p) {
        return '<div class="fact-card"><div class="fact-label">' + esc(p.icon + " " + p.title) +
          '</div><p>' + esc(p.body.replace(/^[^\n]+\n\n/, "")) + '</p></div>';
      }).join("");
    }
    var bizKnow = document.getElementById("businessKnowList");
    if (bizKnow && C.businessStory) {
      bizKnow.innerHTML = C.businessStory.map(function (p) {
        return '<div class="fact-card"><div class="fact-label">' + esc(p.icon + " " + p.title) +
          '</div><p>' + esc(p.body.replace(/^[^\n]+\n\n/, "")) + '</p></div>';
      }).join("");
    }
    var faqWrap = document.getElementById("faqList");
    if (faqWrap && C.faqs) {
      var openFaq = state.data.openFaq || "";
      faqWrap.innerHTML = C.faqs.map(function (f, i) {
        var id = "faq_" + i;
        var isOpen = openFaq === id;
        return '<div class="faq-item' + (isOpen ? " open" : "") + '" data-faq-item="' + id + '">' +
          '<button type="button" class="faq-q" data-faq="' + id + '">' + esc(f.q) +
          '<span class="faq-chev">' + (isOpen ? "−" : "+") + '</span></button>' +
          (isOpen ? '<div class="faq-a"><p id="' + id + '">' + esc(f.a) + '</p>' +
            '<button type="button" class="copy-btn small" data-copy="' + id + '">Copy answer</button></div>' : "") +
          '</div>';
      }).join("");
    }
  }

  function talkPlayCopy(m) {
    return (m.lines || []).map(function (ln) {
      return ln.who + ": " + ln.text;
    }).join("\n");
  }

  function renderTalkGuide(G) {
    var root = document.getElementById("talkGuideRoot");
    if (!root || !G) return;
    var openTalk = state.data.openTalk || "";
    var catMeta = {
      Warm: { emoji: "💬", label: "Warm moments", blurb: "Someone already lit up — keep the human feeling warm." },
      "Cold-ish": { emoji: "👋", label: "Cold-ish reach", blurb: "No prior chat yet — earn recognition before the ask." },
      Objection: { emoji: "🧭", label: "Objections", blurb: "A pushback is still a conversation. Decode what’s underneath." },
      Business: { emoji: "🤝", label: "Business curiosity", blurb: "Diagnose before you pitch the partner path." },
      Fade: { emoji: "🌙", label: "When it goes quiet", blurb: "One useful deposit — then let silence mean no." }
    };
    var catOrder = ["Warm", "Cold-ish", "Objection", "Business", "Fade"];
    var principleEmoji = ["🌅", "🔍", "🌿", "✨", "🎯", "🕊️"];

    var html = "";
    html += '<p class="body-p">' + esc(G.lede || "") + "</p>";
    if (G.thesis) {
      html += '<div class="talk-stats">';
      (G.thesis.stats || []).forEach(function (s) {
        html += '<div class="talk-stat"><div class="talk-stat-num">' + esc(s.num) +
          '</div><div class="talk-stat-lbl">' + esc(s.lbl) + "</div></div>";
      });
      html += "</div>";
      (G.thesis.paras || []).forEach(function (p) {
        html += '<p class="body-p">' + esc(p) + "</p>";
      });
      if (G.thesis.pull) {
        html += '<p class="talk-pull">' + esc(G.thesis.pull) + "</p>";
      }
    }
    if (G.principles && G.principles.length) {
      html += '<p class="talk-sec-label">The posture</p>';
      html += '<div class="fact-grid talk-principles">';
      G.principles.forEach(function (p, i) {
        var em = principleEmoji[i] || "•";
        html += '<div class="fact-card talk-principle-card">' +
          '<div class="talk-emoji-bubble" aria-hidden="true">' + em + "</div>" +
          '<div class="fact-label">' + esc(p.title) + "</div><p>" + esc(p.body) + "</p></div>";
      });
      html += "</div>";
    }
    if (G.moments && G.moments.length) {
      html += '<p class="talk-sec-label">In the moment</p>';
      html += '<p class="body-p">' + esc(G.momentsIntro || "") + "</p>";

      var byCat = {};
      G.moments.forEach(function (m) {
        var cat = m.cat || "Warm";
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(m);
      });
      var ordered = catOrder.slice();
      Object.keys(byCat).forEach(function (c) {
        if (ordered.indexOf(c) < 0) ordered.push(c);
      });
      if (!state.data.talkCatOpen || typeof state.data.talkCatOpen !== "object") {
        state.data.talkCatOpen = {};
      }
      var talkCatOpen = state.data.talkCatOpen;

      ordered.forEach(function (cat) {
        var list = byCat[cat];
        if (!list || !list.length) return;
        var meta = catMeta[cat] || { emoji: "💬", label: cat, blurb: "" };
        var catOpen = !!talkCatOpen[cat];
        var countLabel = list.length === 1 ? "1 moment" : list.length + " moments";
        html += '<section class="talk-cat-block' + (catOpen ? " is-open" : "") + '">';
        html += '<button type="button" class="talk-cat-head" data-talk-cat="' + esc(cat) + '" aria-expanded="' + (catOpen ? "true" : "false") + '">' +
          '<span class="talk-emoji-bubble talk-emoji-bubble-lg" aria-hidden="true">' + meta.emoji + "</span>" +
          '<span class="talk-cat-head-copy">' +
          '<span class="talk-cat-title">' + esc(meta.label) + "</span>" +
          (meta.blurb ? '<span class="talk-cat-blurb">' + esc(meta.blurb) + "</span>" : "") +
          '<span class="talk-cat-count">' + esc(countLabel) + "</span>" +
          "</span>" +
          '<span class="talk-cat-chev" aria-hidden="true">' + (catOpen ? "−" : "+") + "</span>" +
          "</button>";
        if (catOpen) {
          html += '<div class="faq-list talk-moments">';
          list.forEach(function (m) {
            var id = "talk_" + m.id;
            var isOpen = openTalk === id;
            html += '<div class="faq-item talk-moment-card' + (isOpen ? " open" : "") + '">';
            html += '<button type="button" class="faq-q" data-talk="' + id + '">' +
              '<span class="talk-emoji-bubble talk-emoji-bubble-sm" aria-hidden="true">' + meta.emoji + "</span>" +
              '<span class="talk-q-wrap">' + esc(m.q) + "</span>" +
              '<span class="faq-chev">' + (isOpen ? "−" : "+") + "</span></button>";
            if (isOpen) {
              html += '<div class="faq-a talk-moment-body">';
              html += '<div class="talk-why"><div class="talk-why-label">The mechanism</div><p>' +
                esc(m.mechanism) + "</p></div>";
              if (m.note) html += "<p>" + esc(m.note) + "</p>";
              html += '<div class="talk-play"><div class="talk-play-label">' + esc(m.playLabel || "The play") + "</div>";
              html += '<div class="talk-exchange">';
              (m.lines || []).forEach(function (ln) {
                var cls = ln.who === "You" ? "you" : "them";
                html += '<div class="talk-line ' + cls + '"><span class="talk-who">' + esc(ln.who) +
                  "</span><span>" + esc(ln.text) + "</span></div>";
              });
              html += "</div>";
              var copyId = id + "_play";
              html += '<p class="talk-play-copy" id="' + copyId + '" hidden>' + esc(talkPlayCopy(m)) + "</p>";
              html += '<button type="button" class="copy-btn small" data-copy="' + copyId + '">Copy the play</button>';
              html += "</div>";
              if (m.trap) {
                html += '<div class="talk-trap"><strong>The trap:</strong> ' + esc(m.trap) + "</div>";
              }
              html += "</div>";
            }
            html += "</div>";
          });
          html += "</div>";
        }
        html += "</section>";
      });
    }
    if (G.arc && G.arc.length) {
      html += '<p class="talk-sec-label">The full arc</p>';
      html += '<div class="talk-arc">';
      G.arc.forEach(function (s) {
        html += '<div class="talk-stage"><div class="talk-stage-n" aria-hidden="true">' + esc(s.n) +
          '</div><div class="talk-stage-body"><div class="fact-label">' + esc(s.title) +
          '</div><div class="talk-stage-goal">' + esc(s.goal) + "</div><p>" + esc(s.body) +
          "</p></div></div>";
      });
      html += "</div>";
    }
    if (G.redlines && G.redlines.length) {
      html += '<div class="callout compliance talk-redlines">';
      html += '<div class="callout-tag">Bright lines · non-negotiable</div>';
      html += '<div class="callout-body"><ul class="talk-rl-list">';
      G.redlines.forEach(function (r) {
        html += "<li><strong>" + esc(r.title) + "</strong> " + esc(r.body) + "</li>";
      });
      html += "</ul></div></div>";
    }
    if (G.closing) {
      html += '<p class="talk-closing">' + esc(G.closing) + "</p>";
    }
    root.innerHTML = html;
  }

  /* ── Product learning library ─────────────────────────── */
  function ensureProductBrowse() {
    if (!state.productBrowse) {
      state.productBrowse = { category: null, subcategory: null, productId: null, q: "", scope: "all" };
    }
    if (state.productBrowse.scope !== "favorites") state.productBrowse.scope = state.productBrowse.scope || "all";
    return state.productBrowse;
  }

  function ensureProductFavorites() {
    if (!state.data) state.data = {};
    if (!Array.isArray(state.data.productFavorites)) state.data.productFavorites = [];
    var favs = state.data.productFavorites;
    var glowIx = favs.indexOf("fresh-after-sun-tan-booster-golden-glow");
    if (glowIx > -1) {
      favs.splice(glowIx, 1);
      if (favs.indexOf("fresh-after-sun-tan-booster") < 0) favs.push("fresh-after-sun-tan-booster");
    }
    var tanIx = favs.indexOf("fresh-tinted-moisturiser-tan");
    if (tanIx > -1) {
      favs.splice(tanIx, 1);
      if (favs.indexOf("fresh-tinted-moisturiser") < 0) favs.push("fresh-tinted-moisturiser");
    }
    /* Drop favorites that are no longer visible (SPF, pocket, tooth gel, etc.). */
    for (var i = favs.length - 1; i >= 0; i--) {
      if (!productById(favs[i])) favs.splice(i, 1);
    }
    return favs;
  }

  function isProductFavorite(id) {
    return ensureProductFavorites().indexOf(id) > -1;
  }

  function favoriteCount() {
    var favs = ensureProductFavorites();
    var n = 0;
    for (var i = 0; i < favs.length; i++) {
      if (productById(favs[i])) n++;
    }
    return n;
  }

  function talkOpened() {
    return !!state.data.talk_opened;
  }

  function markTalkOpened() {
    if (state.data.talk_opened) return false;
    state.data.talk_opened = true;
    return true;
  }

  function toggleProductFavorite(id) {
    if (!id) return;
    var favs = ensureProductFavorites();
    var ix = favs.indexOf(id);
    if (ix > -1) favs.splice(ix, 1);
    else favs.push(id);
  }

  function syncFavHeartButtons(id) {
    if (!id) return;
    var on = isProductFavorite(id);
    var buttons = document.querySelectorAll('[data-prod-fav="' + id + '"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
      btn.textContent = on ? "♥" : "♡";
    }
    var scopeFav = document.querySelector('#productLibRoot [data-prod-scope="favorites"]');
    if (scopeFav) {
      var n = favoriteCount();
      scopeFav.textContent = "Favorites" + (n ? " · " + n : "");
    }
  }

  function favHeartBtn(id, extraClass) {
    var on = isProductFavorite(id);
    return '<button type="button" class="prod-fav-btn' + (on ? " on" : "") + (extraClass ? " " + extraClass : "") +
      '" data-prod-fav="' + esc(id) + '" aria-pressed="' + (on ? "true" : "false") +
      '" aria-label="' + (on ? "Remove from favorites" : "Add to favorites") + '">' +
      (on ? "♥" : "♡") + "</button>";
  }

  function productLib() {
    return window.FS.PRODUCT_LIB || { categories: [], products: [], disclaimer: "", sourceNote: "" };
  }

  function isSpfProduct(p) {
    if (!p) return true;
    var name = ((p.name || "") + " " + (p.id || "")).toLowerCase();
    /* After-sun stays — only hide true SPF / sunscreen SKUs (not related-product badge noise). */
    if (/after[\s-]*sun/.test(name)) return false;
    var sub = ((p.subcategory || "") + "").toLowerCase();
    if (sub === "sunscreen") return true;
    if (/\bspf\b|sunscreen/.test(name)) return true;
    if (sub === "sun" && !/after[\s-]*sun|tan booster/.test(name)) return true;
    return false;
  }

  /* Pocket sizes duplicate full-size formulas — keep one listing. */
  function isPocketSizeProduct(p) {
    if (!p) return true;
    var id = ((p.id || "") + "").toLowerCase();
    var name = ((p.name || "") + "").toLowerCase();
    return /(^|-)pocket($|-)/.test(id) || /\bpocket\b/.test(name);
  }

  function parentIdForPocket(p) {
    if (!p || !p.id) return "";
    var id = p.id;
    /* fresh-sunscreen-pocket-spf-25 → fresh-sunscreen-spf-25 (if present) or drop */
    if (/^(.+)-pocket(-spf-\d+)?$/i.test(id)) {
      return id.replace(/-pocket/i, "");
    }
    if (/^(.+)-pocket$/i.test(id)) return id.replace(/-pocket$/i, "");
    return "";
  }

  var pocketParentCache = null;
  function productsWithPocketSize() {
    if (pocketParentCache) return pocketParentCache;
    var map = {};
    var all = productLib().products || [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (!isPocketSizeProduct(p)) continue;
      var parent = parentIdForPocket(p);
      if (parent) map[parent] = true;
      /* Also mark known full-size ids when SPF suffix differs */
      if (p.id === "fresh-toner-calm-pocket") map["fresh-toner-calm"] = true;
      if (p.id === "fresh-deodorant-pocket") map["fresh-deodorant"] = true;
      if (p.id === "fresh-hand-balm-pocket") map["fresh-hand-balm"] = true;
    }
    pocketParentCache = map;
    return map;
  }

  function hasPocketSize(productOrId) {
    var id = typeof productOrId === "string" ? productOrId : (productOrId && productOrId.id);
    return !!(id && productsWithPocketSize()[id]);
  }

  function isHiddenLibraryProduct(p) {
    if (!p) return true;
    if (isSpfProduct(p)) return true;
    if (isPocketSizeProduct(p)) return true;
    if (p.id === "fresh-baby-tooth-gel") return true;
    /* Golden glow shares packaging art with regular after sun — one card + note. */
    if (p.id === "fresh-after-sun-tan-booster-golden-glow") return true;
    /* Tan shade shares the tinted moisturiser story — one card + note. */
    if (p.id === "fresh-tinted-moisturiser-tan") return true;
    return false;
  }

  function hasGoldenGlowOption(productOrId) {
    var id = typeof productOrId === "string" ? productOrId : (productOrId && productOrId.id);
    return id === "fresh-after-sun-tan-booster";
  }

  function hasTanTintOption(productOrId) {
    var id = typeof productOrId === "string" ? productOrId : (productOrId && productOrId.id);
    return id === "fresh-tinted-moisturiser";
  }

  function visibleProducts() {
    return (productLib().products || []).filter(function (p) { return !isHiddenLibraryProduct(p); });
  }

  function isHiddenSunSub(subId) {
    var id = ((subId || "") + "").toLowerCase();
    /* No SPF line in the US library yet — hide empty sun-care browse chips. */
    return id === "sunscreen" || id === "tooth";
  }

  /* Concern / ingredient aliases so “acne” also finds impure / blemish copy. */
  var PRODUCT_SEARCH_GROUPS = [
    {
      keys: ["acne", "blemish", "blemishes", "impure", "impurities", "pimple", "pimples", "comedone", "comedones", "blackhead", "whitehead"],
      terms: ["acne", "impure", "impurities", "blemish", "blemishes", "blemished", "pimple", "comedone", "comedones", "blackhead"]
    },
    {
      keys: ["wrinkle", "wrinkles", "aging", "ageing", "antiaging", "anti-aging", "anti-ageing", "fine lines"],
      terms: ["wrinkle", "wrinkles", "anti-wrinkle", "ageing", "aging", "fine lines", "collagen", "firming", "firm"]
    },
    {
      keys: ["sensitive", "redness", "reddened", "irritat", "calm"],
      terms: ["sensitive", "reddened", "redness", "irritat", "sooth", "calm"]
    },
    {
      keys: ["dry", "dehydrated", "hydration", "moisture", "hydrating"],
      terms: ["dry", "dehydrated", "hydrat", "moisture", "moisturis", "moisturiz"]
    },
    {
      keys: ["oily", "oiliness", "sebum", "shine"],
      terms: ["oily", "oiliness", "sebum", "shine", "matt"]
    },
    {
      keys: ["pores", "pore"],
      terms: ["pore", "pores", "refine"]
    },
    {
      keys: ["gut", "digestive", "digestion", "bloating"],
      terms: ["gut", "digest", "biotic", "bloating", "d-gest"]
    },
    {
      keys: ["energy", "sport", "workout", "performance"],
      terms: ["energy", "sport", "performance", "training", "workout"]
    },
    {
      keys: ["hair", "scalp", "volume"],
      terms: ["hair", "scalp", "volume", "beauty & hair"]
    },
    {
      keys: ["baby", "diaper", "bum"],
      terms: ["baby", "diaper", "bum", "little ones"]
    },
    {
      keys: ["vitamin c", "vit c", "ascorbic"],
      terms: ["vitamin c", "ascorb", "ascorbic"]
    },
    {
      keys: ["hyaluronic", "ha", "hyaluron"],
      terms: ["hyaluronic", "hyaluron", "sodium hyaluronate"]
    },
    {
      keys: ["niacinamide", "vitamin b3", "b3"],
      terms: ["niacinamide", "vitamin b3"]
    },
    {
      keys: ["retinol", "bakuchiol"],
      terms: ["retinol", "bakuchiol", "vitamin a"]
    }
  ];

  var productHaystackCache = null;
  var productSearchTimer = null;
  var productResultKey = "";
  var productLibSearchWired = false;

  function productSearchHaystack(p) {
    if (!p || !p.id) return "";
    if (!productHaystackCache) productHaystackCache = {};
    if (productHaystackCache[p.id]) return productHaystackCache[p.id];
    var badges = (p.badges || []).filter(function (b) {
      return !/\bspf\b|sunscreen/i.test(b || "");
    });
    var hay = [
      p.name, p.tagline, p.summary, p.heroIngredients, p.ingredientsNote,
      p.application, (p.claims || []).join(" "), (p.forWho || []).join(" "),
      p.step, p.subcategory, p.category, badges.join(" ")
    ].join(" ").toLowerCase();
    productHaystackCache[p.id] = hay;
    return hay;
  }

  function expandProductSearchTerms(q) {
    var raw = ((q || "") + "").trim().toLowerCase();
    if (!raw) return [];
    var out = [raw];
    var seen = {};
    seen[raw] = true;
    function add(t) {
      t = (t || "").toLowerCase();
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push(t);
    }
    function hitsKey(key) {
      if (!key) return false;
      if (raw === key) return true;
      /* Short aliases (ha, b3) — exact query only, avoid “shampoo” → hyaluronic. */
      if (key.length <= 2) return false;
      if (key.indexOf(" ") >= 0) return raw.indexOf(key) >= 0;
      if (key.length >= 4 && raw.indexOf(key) >= 0) return true;
      if (key.indexOf(raw) === 0 && raw.length >= 4) return true;
      return false;
    }
    PRODUCT_SEARCH_GROUPS.forEach(function (g) {
      var hit = false;
      for (var i = 0; i < g.keys.length; i++) {
        if (hitsKey(g.keys[i])) { hit = true; break; }
      }
      if (!hit) return;
      (g.terms || []).forEach(add);
    });
    return out;
  }

  function productMatchesQuery(p, q) {
    var raw = ((q || "") + "").trim().toLowerCase();
    if (!raw) return true;
    var hay = productSearchHaystack(p);
    if (hay.indexOf(raw) >= 0) return true;
    var expanded = expandProductSearchTerms(raw);
    for (var i = 0; i < expanded.length; i++) {
      if (hay.indexOf(expanded[i]) >= 0) return true;
    }
    /* Multi-word: every token must match (literal or via aliases). */
    var tokens = raw.split(/\s+/).filter(function (t) { return t.length > 1; });
    if (tokens.length > 1) {
      return tokens.every(function (tok) {
        if (hay.indexOf(tok) >= 0) return true;
        return expandProductSearchTerms(tok).some(function (t) {
          return hay.indexOf(t) >= 0;
        });
      });
    }
    return false;
  }

  function productById(id) {
    var list = visibleProducts();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function categoryById(id) {
    var cats = productLib().categories || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i];
    return null;
  }

  function categorySubs(cat) {
    if (!cat || !cat.subs) return [];
    var products = visibleProducts();
    return cat.subs.filter(function (s) {
      if (isHiddenSunSub(s.id)) return false;
      for (var i = 0; i < products.length; i++) {
        if (products[i].category === cat.id && products[i].subcategory === s.id) return true;
      }
      return false;
    });
  }

  function cleanProdSquares(text) {
    return String(text || "")
      .replace(/[\u25A0\u25A1\u25AA\u25AB\u25FC\u25FB\u25FE\u25FD\u25A0]/g, "")
      .replace(/■/g, "")
      .replace(/(\d)[\s\u00a0\u202f\u2009\u200a]+%/g, "$1%")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  function cleanForWhoList(list) {
    return (list || []).map(function (s) {
      return cleanProdSquares(s);
    }).filter(function (t) {
      if (!t) return false;
      /* Drop invented / inferred audience tags — keep Ringana site categories only */
      if (/per product story|per product copy/i.test(t)) return false;
      return true;
    }).map(function (t) {
      return t
        .replace(/\s*\((site category|site tag)\)\s*/gi, "")
        .replace(/sensitive\s*\/\s*reddened\s*skin/gi, "Sensitive skin")
        .replace(/sensitive,?\s*reddened\s*skin/gi, "Sensitive skin")
        .trim();
    }).filter(Boolean);
  }

  function forWhoDisplayList(list) {
    var out = [];
    var seen = {};
    cleanForWhoList(list).forEach(function (c) {
      if (/pregnancy|breastfeed/i.test(c)) return;
      var label = shortenForWhoChip(c) || c;
      if (!label || /pregnancy|breastfeed/i.test(label)) return;
      var key = label.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(label);
    });
    return out;
  }

  /* Short, useful chips under the product blurb — never pregnancy/breastfeeding. */
  function shortenForWhoChip(raw) {
    var t = (raw || "").trim();
    if (!t) return "";
    if (/pregnancy|breastfeed/i.test(t)) return "";
    var map = [
      [/food supplement\s*[—\-].*adults.*/i, "Adults · food supplement"],
      [/beauty-from-within.*/i, "Beauty from within"],
      [/gut\s*\/\s*digestive.*/i, "Gut wellness"],
      [/omega-3.*/i, "Omega-3 support"],
      [/mood\s*\/\s*mental.*/i, "Mood & focus"],
      [/immune-season.*/i, "Immune support"],
      [/sport\s*\/\s*energy.*/i, "Sport & energy"],
      [/training\s*\/\s*performance.*/i, "Training & performance"],
      [/hands needing.*/i, "Hands"],
      [/feet or legs.*/i, "Feet & legs"],
      [/body skin needing.*/i, "Body moisture"],
      [/fresh baby line.*/i, "Baby care"],
      [/developed with baby.*/i, "For little ones"],
      [/fresh hair care.*/i, "Hair care"],
      [/damaged, dyed, or dry hair/i, "Damaged / dry hair"],
      [/fine hair looking for volume/i, "Fine hair · volume"],
      [/intensive hair treatment.*/i, "Hair treatment"],
      [/sensitive\s*\/\s*reddened.*/i, "Sensitive skin"],
      [/sensitive,?\s*reddened.*/i, "Sensitive skin"],
      [/impure skin/i, "Blemish-prone"],
      [/combination skin/i, "Combination"],
      [/oily skin/i, "Oily"],
      [/dry skin/i, "Dry"],
      [/mature skin/i, "Mature"],
      [/normal skin/i, "Normal"],
      [/all skin types/i, "All skin types"],
      [/men.?s face care/i, "Men’s face care"],
      [/daily underarm care/i, "Daily deodorant"],
      [/diaper-area care/i, "Diaper area"],
      [/sun\s*\/\s*environmental.*/i, "Environmental support"],
      [/beauty &\s*hair from within/i, "Beauty & hair within"],
      [/\s+interest$/i, ""]
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(t)) {
        if (map[i][1] === "") return t.replace(map[i][0], "").trim();
        return map[i][1];
      }
    }
    return t.replace(/\s+interest$/i, "").trim();
  }

  function productHeroChips(p) {
    var out = [];
    var seen = {};
    function add(label) {
      label = (label || "").trim();
      if (!label || /pregnancy|breastfeed/i.test(label)) return;
      var key = label.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(label);
    }
    cleanForWhoList(p && p.forWho).forEach(function (c) {
      add(shortenForWhoChip(c));
    });
    /* Fill gaps with clear product-type chips from the catalog */
    if (out.length < 3 && p.step) add(p.step);
    if (out.length < 3) {
      var sub = ((p.subcategory || "") + "").toLowerCase();
      var subLabel = {
        cleansers: "Cleansing",
        toners: "Toning",
        serums: "Serums",
        creams: "Creams",
        "eye-care": "Eye care",
        "masks-exfoliants": "Masks & exfoliants",
        boosters: "ADDS boosters",
        treatments: "Treatments",
        "lip-care": "Lip care",
        "body-milk": "Body milk",
        deodorant: "Deodorant",
        sun: "After-sun",
        wash: "Body wash",
        hands: "Hand care",
        "feet-legs": "Feet & legs",
        soap: "Soap",
        oil: "Body oil",
        caps: "CAPS",
        drinks: "Drinks",
        packs: "PACKS",
        sport: "SPORT",
        beyond: "BEYOND"
      };
      if (subLabel[sub]) add(subLabel[sub]);
    }
    if (out.length < 2) {
      var catLabel = {
        skincare: "Face care",
        body: "Body care",
        hair: "Hair care",
        baby: "Baby care",
        supplements: "Supplements"
      };
      if (catLabel[p.category]) add(catLabel[p.category]);
    }
    if (hasPocketSize(p)) add("Pocket size");
    if (hasGoldenGlowOption(p)) add("Golden glow option");
    if (hasTanTintOption(p)) add("Tan option");
    return out.slice(0, 5);
  }

  function realNotForList(list) {
    return (list || []).map(function (s) { return cleanProdSquares(s); }).filter(function (t) {
      if (!t) return false;
      if (/no discrete|not listed on the public|check full INCI|who it.?s not for.? section/i.test(t)) return false;
      return true;
    });
  }

  function splitIngredientsDump(raw) {
    var t = cleanProdSquares(raw);
    var out = { ingredients: "", usageExtra: "", important: "" };
    if (!t) return out;

    var impParts = t.split(/\bIMPORTANT INFORMATION\b/i);
    if (impParts.length > 1) {
      out.important = impParts.slice(1).join(" ").replace(/^[:\s]+/, "").trim();
      t = impParts[0].trim();
    }

    var recParts = t.split(/\bRECOMMENDED CONSUMPTION\b/i);
    if (recParts.length > 1) {
      out.usageExtra = recParts.slice(1).join(" ").replace(/^[:\s]+/, "").trim();
      t = recParts[0].trim();
    }

    var ingIdx = t.search(/\bINGREDIENTS\b\s*:?/i);
    if (ingIdx >= 0) {
      t = t.slice(ingIdx).replace(/^INGREDIENTS\b\s*:?\s*/i, "").trim();
    } else {
      t = t.replace(/^INGREDIENTS\b\s*:?\s*/i, "").trim();
    }

    /* Drop packaging disclaimer that often trails the INCI list */
    t = t.replace(/\n?\s*A product[\u2019']s ingredients may change[\s\S]*$/i, "").trim();

    out.ingredients = t;
    return out;
  }

  function prodAcc(title, bodyHtml, open) {
    if (!bodyHtml) return "";
    return '<details class="prod-acc"' + (open ? " open" : "") + ">" +
      "<summary>" + esc(title) + "</summary>" +
      '<div class="prod-acc-body">' + bodyHtml + "</div></details>";
  }

  function productsInScope(browse) {
    var list = visibleProducts();
    var q = ((browse && browse.q) || "").trim().toLowerCase();
    var favOnly = browse && browse.scope === "favorites";
    return list.filter(function (p) {
      if (favOnly && !isProductFavorite(p.id)) return false;
      if (!favOnly) {
        if (browse.category && p.category !== browse.category) return false;
        if (browse.subcategory && p.subcategory !== browse.subcategory) return false;
        if (browse.subcategory && isHiddenSunSub(browse.subcategory)) return false;
      }
      if (!q) return true;
      return productMatchesQuery(p, q);
    });
  }

  function productImageUrl(id) {
    var map = window.FS.PRODUCT_IMAGES || {};
    return map[id] || "";
  }

  function productThumbHtml(id, cls) {
    var src = productImageUrl(id);
    if (!src) return '<span class="prod-thumb prod-thumb-empty' + (cls ? " " + cls : "") + '" aria-hidden="true"></span>';
    return '<img class="prod-thumb' + (cls ? " " + cls : "") + '" src="' + esc(src) + '" alt="" width="56" height="56" loading="lazy" decoding="async">';
  }

  function parseHeroIngredients(raw) {
    var text = cleanProdSquares(raw || "").trim();
    if (!text) return [];
    var blocks = text.split(/\n\s*\n+/);
    var items = [];
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block || block === ".") continue;
      var nl = block.indexOf("\n");
      if (nl > 0 && nl < 100) {
        var name = block.slice(0, nl).trim();
        var blurb = block.slice(nl + 1).trim();
        if (!name && !blurb) continue;
        if (name === ".") continue;
        items.push({ name: name, blurb: blurb });
      } else {
        items.push({ name: "", blurb: block });
      }
    }
    return items;
  }

  function heroIngredientsHtml(raw) {
    var items = parseHeroIngredients(raw);
    if (!items.length) return "";
    var html = '<ul class="prod-hero-list">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += "<li>";
      if (it.name) html += "<strong>" + esc(it.name) + "</strong>";
      if (it.blurb) html += (it.name ? " " : "") + "<span>" + esc(it.blurb) + "</span>";
      html += "</li>";
    }
    html += "</ul>";
    return html;
  }

  function productCardHero(p) {
    var items = parseHeroIngredients(p.heroIngredients || "");
    if (!items.length) return "";
    var names = [];
    for (var i = 0; i < items.length && names.length < 3; i++) {
      if (items[i].name) names.push(items[i].name);
      else if (items[i].blurb) {
        var short = items[i].blurb;
        if (short.length > 70) short = short.slice(0, 67).replace(/\s+\S*$/, "") + "…";
        names.push(short);
      }
    }
    if (!names.length) return "";
    var line = names.join(" · ");
    if (items.length > names.length) line += " · +";
    if (line.length > 110) line = line.slice(0, 107).replace(/\s+\S*$/, "") + "…";
    return line;
  }

  function renderProductListRows(items) {
    if (!items.length) {
      var browse = ensureProductBrowse();
      if (browse.scope === "favorites" && !browse.q && favoriteCount() < 1) {
        return '<p class="prod-empty">No favorites yet. Browse All and tap the heart on products you’re looking forward to.</p>';
      }
      if (browse.q) {
        return '<p class="prod-empty">No products match that search in this view. Try another word, or clear search.</p>';
      }
      if (browse.scope === "favorites") {
        return '<p class="prod-empty">No favorites match that search. Clear search or heart a few more in All.</p>';
      }
      return '<p class="prod-empty">No products match that search in this view. Try another word, or clear search.</p>';
    }
    return '<div class="prod-list">' + items.map(function (p) {
      var hero = productCardHero(p);
      var pocket = hasPocketSize(p);
      var glow = hasGoldenGlowOption(p);
      var tan = hasTanTintOption(p);
      return '<div class="prod-row">' +
        productThumbHtml(p.id, "prod-thumb-row") +
        '<button type="button" class="prod-row-open" data-prod-open="' + esc(p.id) + '">' +
        '<span class="prod-row-name">' + esc(p.name) + "</span>" +
        (pocket ? '<span class="prod-row-pocket">Pocket size available</span>' : "") +
        (glow ? '<span class="prod-row-pocket">Golden glow option</span>' : "") +
        (tan ? '<span class="prod-row-pocket">Tan option</span>' : "") +
        (hero ? '<span class="prod-row-hero"><em>Heroes</em> ' + esc(hero) + "</span>" : "") +
        "</button>" +
        favHeartBtn(p.id, "prod-fav-row") +
        "</div>";
    }).join("") + "</div>";
  }

  function renderProductDetail(p) {
    var cat = categoryById(p.category);
    var forWho = forWhoDisplayList(p.forWho);
    var notFor = realNotForList(p.notFor);
    var ing = splitIngredientsDump(p.ingredientsNote);
    var howTo = cleanProdSquares(p.application || "");
    if (ing.usageExtra) {
      howTo = howTo ? (howTo + "\n\n" + ing.usageExtra) : ing.usageExtra;
    }
    var claims = (p.claims || []).map(function (c) { return cleanProdSquares(c); }).filter(Boolean);
    var topClaim = claims.length ? claims[0] : "";
    var img = productImageUrl(p.id);
    var pocket = hasPocketSize(p);
    var glow = hasGoldenGlowOption(p);
    var tan = hasTanTintOption(p);

    var browse = ensureProductBrowse();
    var fromFavorites = browse.scope === "favorites";
    var returnTo = browse.returnTo && browse.returnTo.panel ? browse.returnTo : null;
    var html = "";
    html += '<div class="prod-nav-bar">';
    if (returnTo) {
      html += '<button type="button" class="prod-pill on" data-prod-nav="return">← ' + esc(returnTo.label || "Back") + "</button>";
      html += '<button type="button" class="prod-pill" data-prod-nav="hub">All products</button>';
    } else if (fromFavorites) {
      html += '<button type="button" class="prod-pill on" data-prod-nav="favorites">← Favorites</button>';
      html += '<button type="button" class="prod-pill" data-prod-nav="hub">All products</button>';
    } else {
      html += (cat
        ? '<button type="button" class="prod-pill on" data-prod-nav="cat" data-prod-cat="' + esc(p.category) + '">← ' + esc(cat.label) + "</button>"
        : "") +
        '<button type="button" class="prod-pill" data-prod-nav="hub">All products</button>';
    }
    html += favHeartBtn(p.id, "prod-fav-detail") + "</div>";

    html += '<article class="prod-detail-hero">';
    html += '<div class="prod-detail-top">';
    if (img) {
      html += '<img class="prod-thumb prod-thumb-detail" src="' + esc(img) + '" alt="" width="112" height="112" loading="eager" decoding="async">';
    } else {
      html += '<span class="prod-thumb prod-thumb-empty prod-thumb-detail" aria-hidden="true"></span>';
    }
    html += '<div class="prod-detail-top-copy">';
    html += '<div class="prod-detail-kicker">' + esc((cat ? cat.label : "") + (p.step ? " · " + p.step : "")) + "</div>";
    html += '<h1 class="prod-detail-title">' + esc(p.name) + "</h1>";
    if (p.tagline) html += '<p class="prod-detail-tagline">' + esc(p.tagline) + "</p>";
    if (pocket) {
      html += '<span class="prod-detail-pocket">Pocket size available</span>';
    }
    if (glow) {
      html += '<span class="prod-detail-pocket">Golden glow option</span>';
    }
    if (tan) {
      html += '<span class="prod-detail-pocket">Tan option</span>';
    }
    html += "</div></div>";
    if (glow) {
      html += '<p class="prod-detail-variant-note">Same after-sun care with a <strong>Golden glow</strong> option — erythrulose plus red algae for a subtle self-tan, with a soft golden shimmer from mineral pearl pigments. Packaging looks the same; pick golden glow when you want that extra glow.</p>';
    }
    if (tan) {
      html += '<p class="prod-detail-variant-note">Same tinted care in a deeper <strong>Tan</strong> shade — mix the two for a custom match as your skin tone shifts with the seasons. Packaging looks the same; pick tan when you want more depth.</p>';
    }
    if (p.summary) html += '<p class="prod-detail-summary">' + esc(cleanProdSquares(p.summary)) + "</p>";
    var heroChips = productHeroChips(p);
    if (heroChips.length) {
      html += '<div class="prod-detail-chips" aria-label="Good for">';
      heroChips.forEach(function (c) {
        html += '<span class="prod-detail-chip">' + esc(c) + "</span>";
      });
      html += "</div>";
    }
    if (topClaim) {
      html += '<blockquote class="prod-detail-claim">' +
        '<span class="prod-detail-claim-label">From the studies</span>' +
        '<p>' + esc(topClaim) + "</p>" +
        "</blockquote>";
    }
    html += "</article>";

    html += '<div class="prod-acc-stack">';
    if (p.heroIngredients) {
      html += prodAcc("Hero ingredients", heroIngredientsHtml(p.heroIngredients), true);
    }
    if (claims.length) {
      html += prodAcc(
        "Study / performance notes",
        "<ul>" + claims.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") +
          '</ul><p class="prod-acc-note">As published on the ringana.com product page. Not a guarantee of individual results.</p>',
        !topClaim
      );
    }
    if (forWho.length) {
      html += prodAcc("Who it’s for", "<ul>" + forWho.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>");
    }
    if (notFor.length) {
      html += prodAcc(
        "Who it’s not for / cautions",
        "<ul>" + notFor.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>"
      );
    }
    if (howTo) {
      html += prodAcc("How to use", "<p>" + esc(howTo) + "</p>");
    }
    if (ing.ingredients) {
      html += prodAcc("Ingredients", "<p>" + esc(ing.ingredients) + "</p>");
    }
    if (ing.important) {
      html += prodAcc("Important information", "<p>" + esc(ing.important) + "</p>");
    }
    html += "</div>";

    html += '<p class="prod-source">Source: <a href="' + esc(p.sourceUrl) + '" target="_blank" rel="noopener noreferrer">View on ringana.com</a></p>';
    return html;
  }

  function productSearchMetaText(browse, scoped) {
    var favScope = browse && browse.scope === "favorites";
    return scoped.length + " product" + (scoped.length === 1 ? "" : "s") +
      (browse.q ? " matching “" + browse.q + "”" : (favScope ? " favorited" : " to explore"));
  }

  function productBrowseBodyHtml(browse, scoped) {
    var lib = productLib();
    var favScope = browse.scope === "favorites";
    var html = "";
    if (favScope) {
      html += renderProductListRows(scoped);
    } else if (!browse.category && !browse.q) {
      html += '<div class="prod-cat-grid">';
      (lib.categories || []).forEach(function (c) {
        var n = visibleProducts().filter(function (p) { return p.category === c.id; }).length;
        if (!n) return;
        html += '<button type="button" class="prod-cat-card" data-prod-nav="cat" data-prod-cat="' + esc(c.id) + '">' +
          '<span class="prod-cat-card-count">' + n + "</span>" +
          '<span class="prod-cat-card-label">' + esc(c.label) + "</span>" +
          '<span class="prod-cat-card-blurb">' + esc(c.blurb) + "</span></button>";
      });
      html += "</div>";
    } else if (!browse.category && browse.q) {
      html += renderProductListRows(scoped);
    } else {
      var catObj = categoryById(browse.category);
      var subs = categorySubs(catObj);
      if (subs.length && !browse.q) {
        html += '<div class="prod-sub-row" id="prodSubRow">';
        html += '<button type="button" class="prod-pill' + (!browse.subcategory ? " on" : "") + '" data-prod-nav="cat" data-prod-cat="' + esc(browse.category) + '" data-prod-sub="">All</button>';
        subs.forEach(function (s) {
          html += '<button type="button" class="prod-pill' + (browse.subcategory === s.id ? " on" : "") +
            '" data-prod-nav="cat" data-prod-cat="' + esc(browse.category) + '" data-prod-sub="' + esc(s.id) + '">' +
            esc(s.label) + "</button>";
        });
        html += "</div>";
      }
      html += renderProductListRows(scoped);
    }
    if (lib.disclaimer) {
      html += '<p class="prod-disclaimer">' + esc(lib.disclaimer) + "</p>";
    }
    return html;
  }

  function productResultsSignature(browse, scoped) {
    var ids = [];
    for (var i = 0; i < scoped.length; i++) ids.push(scoped[i].id);
    return [
      browse.scope || "all",
      browse.category || "",
      browse.subcategory || "",
      browse.q || "",
      ids.join(",")
    ].join("|");
  }

  function updateProductBrowseResults() {
    var meta = document.getElementById("prodSearchMeta");
    var body = document.getElementById("prodBrowseBody");
    if (!meta && !body) return;
    var browse = ensureProductBrowse();
    var scoped = productsInScope(browse);
    if (meta) meta.textContent = productSearchMetaText(browse, scoped);
    var key = productResultsSignature(browse, scoped);
    if (body && key !== productResultKey) {
      productResultKey = key;
      body.innerHTML = productBrowseBodyHtml(browse, scoped);
    }
  }

  function wireProductLibrarySearch() {
    if (productLibSearchWired) return;
    var root = document.getElementById("productLibRoot");
    if (!root) return;
    productLibSearchWired = true;
    root.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || t.id !== "productSearch") return;
      ensureProductBrowse().q = t.value || "";
      if (productSearchTimer) clearTimeout(productSearchTimer);
      productSearchTimer = setTimeout(function () {
        productSearchTimer = null;
        updateProductBrowseResults();
      }, 120);
    });
  }

  function renderProductLibrary() {
    var root = document.getElementById("productLibRoot");
    if (!root) return;
    wireProductLibrarySearch();
    var lib = productLib();
    var browse = ensureProductBrowse();
    if (browse.subcategory && isHiddenSunSub(browse.subcategory)) browse.subcategory = null;
    if (browse.category && browse.subcategory) {
      var earlySubs = categorySubs(categoryById(browse.category));
      var subOk = false;
      for (var esi = 0; esi < earlySubs.length; esi++) {
        if (earlySubs[esi].id === browse.subcategory) { subOk = true; break; }
      }
      if (!subOk) browse.subcategory = null;
    }
    var html = "";
    var favN = favoriteCount();
    var favScope = browse.scope === "favorites";
    var scopeRow =
      '<div class="prod-scope-row" role="tablist" aria-label="Product library view">' +
      '<button type="button" class="prod-pill' + (!favScope ? " on" : "") + '" data-prod-scope="all" role="tab" aria-selected="' + (!favScope ? "true" : "false") + '">All</button>' +
      '<button type="button" class="prod-pill' + (favScope ? " on" : "") + '" data-prod-scope="favorites" role="tab" aria-selected="' + (favScope ? "true" : "false") + '">Favorites' +
      (favN ? " · " + favN : "") + "</button>" +
      "</div>";

    if (browse.productId) {
      var detail = productById(browse.productId);
      if (!detail) {
        browse.productId = null;
      } else {
        root.innerHTML = renderProductDetail(detail);
        return;
      }
    }

    /* View mode lives at the top — away from category/subcategory filter chips */
    html += scopeRow;

    if (!favScope && browse.category) {
      html += '<div class="prod-nav-bar"><button type="button" class="prod-pill on" data-prod-nav="hub">← All products</button></div>';
    }

    if (favScope) {
      html += '<h1 class="prod-head-title">Your favorites</h1>';
      html += '<p class="prod-head-sub">Products you’re looking forward to — heart a few more anytime from All.</p>';
    } else if (!browse.category) {
      html += '<h1 class="prod-head-title">Learn the products</h1>';
      html += '<p class="prod-head-sub">' + esc(lib.sourceNote || "Browse by category — searchable and ready to learn.") + "</p>";
    } else {
      var cat = categoryById(browse.category);
      html += '<h1 class="prod-head-title">' + esc(cat ? cat.label : browse.category) + "</h1>";
      html += '<p class="prod-head-sub">' + esc(cat ? cat.blurb : "") + "</p>";
    }

    html += '<label class="sr-only" for="productSearch">Search products</label>';
    html += '<input type="search" id="productSearch" class="prod-search" placeholder="Search ingredients, names, skin concerns…" value="' + esc(browse.q || "") + '" autocomplete="off" enterkeyhint="search" spellcheck="false">';
    var scoped = productsInScope(browse);
    productResultKey = productResultsSignature(browse, scoped);
    html += '<p class="prod-search-meta" id="prodSearchMeta">' + esc(productSearchMetaText(browse, scoped)) + "</p>";
    html += '<div id="prodBrowseBody">' + productBrowseBodyHtml(browse, scoped) + "</div>";

    root.innerHTML = html;
  }

  function favoriteProducts() {
    var favs = ensureProductFavorites();
    var out = [];
    for (var i = 0; i < favs.length; i++) {
      var p = productById(favs[i]);
      if (p) out.push(p);
    }
    return out;
  }

  /* Shared shortlist for Pick Your First Few, finish, and Content. */
  function renderFocusShortlist(opts) {
    opts = opts || {};
    var list = document.getElementById(opts.listId);
    if (!list) return;
    var products = favoriteProducts();
    if (!products.length) {
      var empty = opts.empty || "Heart a few products in Learn — they’ll show up here.";
      var html = '<span class="dim">' + esc(empty) + "</span>";
      if (opts.emptyCta && opts.emptyGoto) {
        html += '<p class="share-fav-hint"><button type="button" class="focus-shortlist-cta" data-goto="' +
          esc(opts.emptyGoto) + '">' + esc(opts.emptyCta) + "</button></p>";
      }
      list.innerHTML = html;
      return;
    }
    var items;
    if (opts.tapOpen) {
      items = products.map(function (p) {
        return '<li><button type="button" class="focus-shortlist-item" data-prod-open="' +
          esc(p.id) + '"' +
          (opts.returnPanel
            ? ' data-prod-return="' + esc(opts.returnPanel) + '" data-prod-return-label="' + esc(opts.returnLabel || "Back") + '"'
            : "") +
          ">" + esc(p.name) + "</button></li>";
      }).join("");
    } else {
      items = products.map(function (p) {
        return "<li>" + esc(p.name) + "</li>";
      }).join("");
    }
    list.innerHTML = '<ul class="focus-shortlist-ul">' + items + "</ul>" +
      (opts.hint ? '<p class="share-fav-hint">' + esc(opts.hint) + "</p>" : "");
  }

  function renderShareFavPreview() {
    var n = favoriteCount();
    var hint = n < 2
      ? "Heart at least one more — 2–3 is the sweet spot."
      : n > 3
        ? "Nice shortlist. You can trim anytime in Learn → Favorites."
        : "Solid shortlist. Open Talking fresh when you’re ready.";
    renderFocusShortlist({
      listId: "shareFavList",
      empty: "Heart a few products in Learn — they’ll show up here.",
      emptyGoto: "products",
      emptyCta: "Open products →",
      hint: hint,
      tapOpen: true,
      returnPanel: "share",
      returnLabel: "Pick Your First Few"
    });
  }

  function renderContentShortlist() {
    renderFocusShortlist({
      listId: "contentFavList",
      empty: "Heart a few products in Learn — they’ll show up here when you plan posts.",
      emptyGoto: "products",
      emptyCta: "Open products · heart favorites →",
      hint: "Focus here when you plan posts — tap a name to reopen it in Learn.",
      tapOpen: true,
      returnPanel: "tend",
      returnLabel: "Content"
    });
  }

  function renderFinishShortlist() {
    renderFocusShortlist({
      listId: "finishFavList",
      empty: "Heart a few products in Learn — your focus shortlist will land here.",
      emptyGoto: "products",
      emptyCta: "Open products →",
      hint: "These are yours to lean on when you talk or create.",
      tapOpen: true,
      returnPanel: "done",
      returnLabel: "Finish"
    });
  }

  function refreshAllShortlists() {
    renderShareFavPreview();
    renderContentShortlist();
    renderFinishShortlist();
  }

  function renderNav() {
    var secs = visibleSections();
    var html = "";
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var locked = !isModuleUnlocked(s.id);
      var cls = "nav-item" +
        (state.active === s.id ? " active" : "") +
        (state.done[s.id] ? " done" : "") +
        (locked ? " locked" : "");
      var dot = state.done[s.id] ? "✓" : (locked ? "🔒" : String(i + 1));
      var sub = locked ? "Locked · finish previous first" : s.sub;
      html += '<button class="' + cls + '" data-goto="' + s.id + '"' +
        (locked ? ' aria-disabled="true"' : "") +
        '><span class="nav-dot">' + dot + '</span><span><span class="nav-label">' +
        s.label + '</span><span class="nav-sub">' + esc(sub) + "</span></span></button>";
    }
    nav.innerHTML = html;
  }

  function hideLockToast() {
    var el = document.getElementById("lockToast");
    if (el) el.hidden = true;
  }

  function showLockToast(targetId) {
    var el = document.getElementById("lockToast");
    if (!el) return;
    var prior = priorSectionId(targetId);
    var priorName = prior ? sectionLabel(prior) : "the previous module";
    el.hidden = false;
    el.innerHTML =
      '<div class="lock-toast-inner">' +
      "<p>That module unlocks after you finish <strong>" + esc(priorName) + "</strong>.</p>" +
      '<div class="lock-toast-actions">' +
      '<button type="button" class="btn" data-goto="' + esc(prior || "roots") + '">Go finish it →</button>' +
      '<button type="button" class="btn-ghost" data-soft-unlock="' + esc(targetId) + '">Open anyway</button>' +
      '<button type="button" class="lock-toast-x" id="lockToastClose" aria-label="Dismiss">×</button>' +
      "</div></div>";
  }

  function checklistItems(id) {
    if (id === "roots") {
      return [
        { done: filledText("why"), label: "Your why" },
        { done: filledText("moment"), label: "Your moment" },
        { done: filledText("said_yes"), label: "Why you said yes" }
      ];
    }
    if (id === "share") {
      var favs = favoriteCount();
      return [
        { done: favs >= 2, label: "Favorite 2–3 products (" + favs + " saved)" },
        { done: talkOpened(), label: "Open Talking fresh once" }
      ];
    }
    if (id === "grove") {
      var c = customerNames().length;
      var cp = grovePicks("customer_first").length;
      var need = Math.min(5, Math.max(c, 0));
      var n = groveNames().length;
      var wp = grovePicks("warm_first").length;
      return [
        { done: c >= 5, label: "At least 5 customer names (" + c + "/5)" },
        { done: c >= 5 && cp >= need && need > 0, label: "Tap first customer chats (" + cp + "/" + (need || 5) + ")" },
        /* Optional — shown for builders, never inflate Growth denominator */
        { done: n >= 1, label: "Partner names (optional) · " + n, optional: true },
        { done: wp > 0, label: "Partner first chats (optional) · " + wp + "/5", optional: true }
      ];
    }
    if (id === "tree") {
      var named = 0;
      (function walk(arr) {
        for (var i = 0; i < arr.length; i++) {
          if ((arr[i].name || "").trim()) named++;
          walk(arr[i].children || []);
        }
      })(Tree.ensure(state));
      return [
        { done: named >= 3, label: "Sketch at least 3 people on your tree (" + named + "/3)" }
      ];
    }
    if (id === "ground") {
      var customPage = usesCustomLanding();
      var items = [
        { done: !!state.data.page_choice, label: "Pick a page option" },
        { done: filledText("page_story"), label: "Draft your opening line" },
        /* Always count lead-setup slots so Soft↔custom↔in-app doesn't
           resize Growth % or plant stage mid-progress. Custom page marks
           them complete; in-app lead page requires the real steps. */
        {
          done: customPage || leadSignedIn(),
          label: customPage
            ? "Lead page account (using your own page)"
            : "Sign in for your lead page"
        },
        {
          done: customPage || leadPageReady(),
          label: customPage
            ? "Share link (using your own page)"
            : "Save the link you'll share"
        }
      ];
      if (usesBuiltInLeadPage()) {
        items.push({ done: leadPreviewSeen(), label: "Preview your lead page", optional: true });
      }
      return items;
    }
    if (id === "plant") {
      return [
        { done: filledText("seed_open"), label: "Curiosity post draft" },
        { done: giveDraftFilled(), label: "Helpful share (behind the scenes, honest note, or values)" },
        { done: filledText("seed_invite"), label: "Soft invite draft" }
      ];
    }
    if (id === "tend") {
      var Cal = window.FS.Calendar;
      var posted = Cal && Cal.countPosted ? Cal.countPosted(state.data.calendar || {}) : 0;
      var drafted = Cal && Cal.countDrafted ? Cal.countDrafted(state.data.calendar || {}) : 0;
      var started = drafted + posted;
      return [
        {
          done: started >= 1,
          label: "Start one calendar card — add from the vault or ＋ Add, then save a draft"
        },
        {
          done: posted >= 3,
          label: "Mark 3 cards Done after you post them (" + posted + "/3)"
        }
      ];
    }
    return [];
  }

  function renderModuleChecklists() {
    var secs = visibleSections();
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var panel = document.getElementById("panel-" + s.id);
      if (!panel) continue;
      var box = panel.querySelector("[data-module-check]");
      if (!box) {
        box = document.createElement("div");
        box.className = "module-check";
        box.setAttribute("data-module-check", s.id);
        var after = panel.querySelector(".sec-sub") || panel.querySelector("h1") || panel.querySelector(".sec-num");
        if (after) after.insertAdjacentElement("afterend", box);
        else panel.insertBefore(box, panel.firstChild);
      }
      var items = checklistItems(s.id);
      if (!items.length) {
        box.hidden = true;
        continue;
      }
      box.hidden = false;
      var required = [];
      for (var r = 0; r < items.length; r++) if (!items[r].optional) required.push(items[r]);
      var doneN = 0;
      for (var j = 0; j < required.length; j++) if (required[j].done) doneN++;
      var all = required.length > 0 && doneN === required.length;
      var html = '<div class="module-check-head">' +
        '<span class="module-check-tag">MODULE CHECKLIST</span>' +
        '<span class="module-check-count' + (all ? " on" : "") + '">' + doneN + " of " + required.length + " done</span>" +
        "</div><ul class=\"module-check-list\">";
      for (var k = 0; k < items.length; k++) {
        html += '<li class="' + (items[k].done ? "is-done" : "") + (items[k].optional ? " is-optional" : "") + '">' +
          '<span class="module-check-mark" aria-hidden="true">' + (items[k].done ? "✓" : "○") + "</span>" +
          esc(items[k].label) + "</li>";
      }
      html += "</ul>";
      if (!isModuleUnlocked(s.id)) {
        html += '<p class="module-check-lock">Locked until you finish ' +
          esc(sectionLabel(priorSectionId(s.id) || "roots")) +
          ". Tap <strong>Open anyway</strong> on the lock message if you need a peek.</p>";
      }
      box.innerHTML = html;
    }
  }

  function openHubMenu() {
    var menu = document.getElementById("hubMenu");
    if (!menu) return;
    syncGrowthSettingsUI();
    syncWeekStartSettingsUI();
    syncSettingsNameUI();
    menu.hidden = false;
    document.body.classList.add("hub-menu-open");
    renderBottomNav();
  }

  function closeHubMenu() {
    var menu = document.getElementById("hubMenu");
    if (!menu) return;
    menu.hidden = true;
    document.body.classList.remove("hub-menu-open");
    renderBottomNav();
  }

  function renderBottomNav() {
    var bar = document.getElementById("bottomNav");
    if (!bar) return;
    var hideLeads = usesCustomLanding();
    var leadsBtn = bar.querySelector('[data-tab="leads"]');
    if (leadsBtn) leadsBtn.hidden = hideLeads;
    if (hideLeads && state.active === "leads") {
      state.active = "ground";
      save();
      var panels = document.querySelectorAll(".panel");
      for (var pi = 0; pi < panels.length; pi++) {
        panels[pi].classList.toggle("active", panels[pi].id === "panel-ground");
      }
      renderNav();
    }
    var tab = "";
    if (state.active === "tend" || state.active === "calendar" || state.active === "curiosity-photos" || state.active === "content-vault" || state.active === "content-stories" || state.active === "content-week") tab = "content";
    else if (state.active === "know" || state.active === "products" || state.active === "talk") tab = "know";
    else if (state.active === "leader") tab = "team";
    else if (state.active === "leads") tab = "leads";
    else if (state.active === "welcome" || state.active === "done") tab = "home";
    var tourWrap = document.getElementById("tour");
    var tourOpen = !!(tourWrap && tourWrap.classList.contains("open"));
    var btns = bar.querySelectorAll(".bottom-nav-btn");
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].getAttribute("data-tab");
      var isOn = !!tab && t === tab;
      btns[i].classList.toggle("on", isOn);
      /* Drop leftover coachmark / sticky focus so only one tab looks selected */
      if (!tourOpen) btns[i].classList.remove("tour-target-on");
      if (!isOn && document.activeElement === btns[i]) btns[i].blur();
    }
    var settingsBtn = document.getElementById("settingsNavBtn");
    if (settingsBtn) settingsBtn.classList.toggle("on", document.body.classList.contains("hub-menu-open"));
  }

  function renderGroundLeadSetup() {
    var setup = document.getElementById("groundLeadSetup");
    var note = document.getElementById("groundCustomNote");
    if (setup) setup.hidden = !usesBuiltInLeadPage();
    if (note) note.hidden = !usesCustomLanding();
    if (!usesBuiltInLeadPage()) return;
    var signed = leadSignedIn();
    var ready = leadPageReady();
    var previewed = leadPreviewSeen();
    var steps = {
      signin: signed,
      link: ready,
      preview: previewed
    };
    Object.keys(steps).forEach(function (key) {
      var el = document.querySelector('[data-lead-step="' + key + '"]');
      if (el) el.classList.toggle("is-done", !!steps[key]);
    });
    var cta = document.getElementById("groundLeadCta");
    if (cta) {
      if (!signed) cta.textContent = "Sign in & set up the link I'll share →";
      else if (!ready) cta.textContent = "Claim my share link →";
      else cta.textContent = "Open Leads · preview again →";
    }
  }

  var knowSearchTimer = null;
  var knowSearchSnapshot = null;

  function knowSectionSearchBlob(sec) {
    var parts = [(sec.textContent || "")];
    var C = window.FS.CONTENT || {};
    if (sec.id === "know-faqs" && C.faqs) {
      C.faqs.forEach(function (f) {
        parts.push(f.q || "");
        parts.push(f.a || "");
      });
    }
    if (sec.id === "know-pillars" && C.pillars) {
      C.pillars.forEach(function (p) {
        parts.push(p.title || "");
        parts.push(p.body || "");
      });
    }
    if (sec.id === "know-facts" && C.funFacts) {
      C.funFacts.forEach(function (f) {
        parts.push(f.title || "");
        parts.push(f.body || "");
      });
    }
    if (sec.id === "know-product" && C.productStory && C.productStory.posts) {
      C.productStory.posts.forEach(function (p) {
        parts.push(p.title || "");
        parts.push(p.body || "");
      });
    }
    if (sec.id === "know-business" && C.businessStory) {
      C.businessStory.forEach(function (p) {
        parts.push(p.title || "");
        parts.push(p.body || "");
      });
    }
    return parts.join(" ").toLowerCase();
  }

  function firstMatchingFaqId(q) {
    var C = window.FS.CONTENT || {};
    if (!q || !C.faqs) return "";
    for (var i = 0; i < C.faqs.length; i++) {
      var blob = ((C.faqs[i].q || "") + " " + (C.faqs[i].a || "")).toLowerCase();
      if (blob.indexOf(q) > -1) return "faq_" + i;
    }
    return "";
  }

  function filterKnowSearch() {
    var input = document.getElementById("knowSearch");
    var empty = document.getElementById("knowSearchEmpty");
    if (!input) return;
    var q = (input.value || "").trim().toLowerCase();
    var secs = document.querySelectorAll("#panel-know .know-acc");
    var shown = 0;

    if (q && !knowSearchSnapshot) {
      knowSearchSnapshot = { open: {}, openFaq: state.data.openFaq || "" };
      for (var s0 = 0; s0 < secs.length; s0++) {
        knowSearchSnapshot.open[secs[s0].id] = !!secs[s0].open;
      }
    }

    if (!q) {
      if (knowSearchSnapshot) {
        for (var s1 = 0; s1 < secs.length; s1++) {
          var secRestore = secs[s1];
          if (knowSearchSnapshot.open[secRestore.id] !== undefined) {
            secRestore.open = knowSearchSnapshot.open[secRestore.id];
          }
          secRestore.hidden = false;
        }
        if ((state.data.openFaq || "") !== knowSearchSnapshot.openFaq) {
          state.data.openFaq = knowSearchSnapshot.openFaq;
          renderKnowPanel();
        }
        knowSearchSnapshot = null;
      } else {
        for (var s2 = 0; s2 < secs.length; s2++) secs[s2].hidden = false;
      }
      if (empty) empty.hidden = true;
      return;
    }

    var faqHit = firstMatchingFaqId(q);
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      var blob = knowSectionSearchBlob(sec);
      var match = blob.indexOf(q) > -1;
      sec.hidden = !match;
      if (match) {
        shown++;
        sec.open = true;
      }
    }
    if (faqHit && state.data.openFaq !== faqHit) {
      state.data.openFaq = faqHit;
      renderKnowPanel();
      /* Re-hide non-matching sections after FAQ re-render */
      var secs2 = document.querySelectorAll("#panel-know .know-acc");
      for (var j = 0; j < secs2.length; j++) {
        var sec2 = secs2[j];
        var match2 = knowSectionSearchBlob(sec2).indexOf(q) > -1;
        sec2.hidden = !match2;
        if (match2) sec2.open = true;
      }
    }
    if (empty) empty.hidden = shown > 0;
  }

  function wireKnowSearch() {
    var input = document.getElementById("knowSearch");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    input.setAttribute("spellcheck", "false");
    input.setAttribute("enterkeyhint", "search");
    input.addEventListener("input", function () {
      if (knowSearchTimer) clearTimeout(knowSearchTimer);
      knowSearchTimer = setTimeout(function () {
        knowSearchTimer = null;
        filterKnowSearch();
      }, 120);
    });
  }

  function renderHomeRunway() {
    var wrap = document.getElementById("homeRunway");
    if (!wrap) return;
    var secs = visibleSections();
    var html = "";
    var nextOpen = null;
    for (var n = 0; n < secs.length; n++) {
      if (!state.done[secs[n].id] && isModuleUnlocked(secs[n].id)) {
        nextOpen = secs[n].id;
        break;
      }
    }
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var locked = !isModuleUnlocked(s.id);
      var done = !!state.done[s.id];
      var isNext = !done && !locked && s.id === nextOpen;
      var cls = "home-step" +
        (done ? " done" : "") +
        (locked ? " locked" : "") +
        (isNext ? " next" : "");
      var status = done ? "Done" : (locked ? "Locked · finish the step above first" : (isNext ? "Up next" : "Ready when you are"));
      html += '<button type="button" class="' + cls + '" data-goto="' + s.id + '"' +
        (locked ? ' aria-disabled="true"' : "") + ">" +
        '<span class="home-step-num" aria-hidden="true">' + (done ? "✓" : String(i + 1)) + "</span>" +
        '<span class="home-step-main">' +
        '<span class="home-step-label">' + esc(s.label) + "</span>" +
        '<span class="home-step-sub">' + esc(s.sub) + "</span>" +
        '<span class="home-step-status">' + esc(status) + "</span>" +
        "</span></button>";
    }
    wrap.innerHTML = html;
  }

  var lastRoots = -1;
  var lastSecs = -1;
  var captionTimer;

  function pulsePlant(kind) {
    if (!homePlant) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    homePlant.classList.remove("roots-pulse", "sprout-pulse");
    void homePlant.offsetWidth;
    homePlant.classList.add(kind === "sprout" ? "sprout-pulse" : "roots-pulse");
    setTimeout(function () {
      homePlant.classList.remove("roots-pulse", "sprout-pulse");
    }, 1000);
  }

  var growthMomentTimer = null;
  var growthToastTimer = null;

  function showGrowthToast(msg) {
    var el = document.getElementById("growthToast");
    if (!el || !msg) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(growthToastTimer);
    growthToastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  function closeGrowthMoment() {
    var wrap = document.getElementById("growthMoment");
    if (!wrap) return;
    wrap.classList.remove("open");
    wrap.hidden = true;
    clearTimeout(growthMomentTimer);
    growthMomentTimer = null;
  }

  function openGrowthMoment(msg, kind, prev, next) {
    var wrap = document.getElementById("growthMoment");
    var slot = document.getElementById("growthMomentPlant");
    var lab = document.getElementById("growthMomentMsg");
    var tip = document.getElementById("growthMomentTip");
    if (!wrap || !slot || !lab) return;
    var prevStage = plantVisualStage(prev.sprout, prev.sproutTotal);
    var nextStage = plantVisualStage(next.sprout, next.sproutTotal);
    slot.classList.remove("roots-pulse", "sprout-pulse");
    slot.innerHTML = window.FS.plantSVG(prevStage, prev.roots, ROOT_MAX, "m0_");
    lab.textContent = msg;
    var firstTip = !state.data.growthMomentTipSeen;
    if (tip) {
      tip.hidden = !firstTip;
      if (firstTip) {
        state.data.growthMomentTipSeen = true;
        save();
      }
    }
    wrap.hidden = false;
    wrap.classList.add("open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        slot.innerHTML = window.FS.plantSVG(nextStage, next.roots, ROOT_MAX, "m1_");
        if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          slot.classList.add(kind === "sprout" ? "sprout-pulse" : "roots-pulse");
        }
      });
    });
    clearTimeout(growthMomentTimer);
    growthMomentTimer = setTimeout(closeGrowthMoment, firstTip ? 3200 : 2400);
  }

  function celebrateGrowth(kind, msg, prev, next) {
    if (state.settings.growthMoment !== false) {
      openGrowthMoment(msg, kind, prev, next);
    } else if (state.settings.growthToast !== false) {
      showGrowthToast(msg);
    }
  }

  var pendingGrowth = null;
  var growthIdleTimer = null;
  var GROWTH_IDLE_MS = 1600;
  var lastSproutTotal = -1;

  function growthMessage(kind, roots, sproutDone, sproutTotal) {
    if (kind === "roots") {
      return roots >= ROOT_MAX
        ? "Root " + ROOT_MAX + " in — next checklist items sprout above ground."
        : "Root " + roots + " of " + ROOT_MAX + " grew underground.";
    }
    return sproutTotal > 0 && sproutDone >= sproutTotal
      ? "Full bloom — you finished the growth checklist."
      : "Checklist item done — your sprout grew (" + sproutDone + "/" + sproutTotal + ").";
  }

  function clearPendingGrowth() {
    clearTimeout(growthIdleTimer);
    growthIdleTimer = null;
    pendingGrowth = null;
  }

  function flushPendingGrowth() {
    if (!pendingGrowth) {
      clearTimeout(growthIdleTimer);
      growthIdleTimer = null;
      return;
    }
    var p = pendingGrowth;
    clearPendingGrowth();
    var roots = rootCount();
    var progress = checklistProgress();
    var next = { roots: roots, sprout: progress.sproutDone, sproutTotal: progress.sproutTotal };
    var kind = next.sprout > p.prev.sprout ? "sprout" : "roots";
    var msg = growthMessage(kind, next.roots, next.sprout, next.sproutTotal);
    pulsePlant(kind);
    highlightCaption(msg);
    celebrateGrowth(kind, msg, p.prev, next);
  }

  function queueGrowthCelebration(kind, msg, prev, next) {
    if (!pendingGrowth) {
      pendingGrowth = { kind: kind, msg: msg, prev: prev, next: next };
    } else {
      pendingGrowth.kind = kind;
      pendingGrowth.msg = msg;
      pendingGrowth.next = next;
    }
    clearTimeout(growthIdleTimer);
    growthIdleTimer = setTimeout(flushPendingGrowth, GROWTH_IDLE_MS);
  }

  function syncGrowthSettingsUI() {
    var moment = document.getElementById("optGrowthMoment");
    var toast = document.getElementById("optGrowthToast");
    if (moment) moment.checked = state.settings.growthMoment !== false;
    if (toast) toast.checked = state.settings.growthToast !== false;
  }

  function syncWeekStartSettingsUI() {
    var sun = document.getElementById("weekStartSun");
    var mon = document.getElementById("weekStartMon");
    var isMon = state.settings.weekStartsOn === "monday";
    if (sun) sun.classList.toggle("on", !isMon);
    if (mon) mon.classList.toggle("on", isMon);
  }

  function setWeekStartsOn(value) {
    var next = value === "monday" ? "monday" : "sunday";
    if (state.settings.weekStartsOn === next) return;
    state.settings.weekStartsOn = next;
    save();
    syncWeekStartSettingsUI();
    renderPanels();
  }

  function wireWeekStartSettings() {
    var sun = document.getElementById("weekStartSun");
    var mon = document.getElementById("weekStartMon");
    if (sun && !sun.dataset.bound) {
      sun.dataset.bound = "1";
      sun.addEventListener("click", function () { setWeekStartsOn("sunday"); });
    }
    if (mon && !mon.dataset.bound) {
      mon.dataset.bound = "1";
      mon.addEventListener("click", function () { setWeekStartsOn("monday"); });
    }
  }

  function wireGrowthSettings() {
    var moment = document.getElementById("optGrowthMoment");
    var toast = document.getElementById("optGrowthToast");
    if (moment && !moment.dataset.bound) {
      moment.dataset.bound = "1";
      moment.addEventListener("change", function () {
        state.settings.growthMoment = !!moment.checked;
        save();
      });
    }
    if (toast && !toast.dataset.bound) {
      toast.dataset.bound = "1";
      toast.addEventListener("change", function () {
        state.settings.growthToast = !!toast.checked;
        save();
      });
    }
    var hit = document.getElementById("growthMomentHit");
    var card = document.querySelector(".growth-moment-card");
    if (hit && !hit.dataset.bound) {
      hit.dataset.bound = "1";
      hit.addEventListener("click", closeGrowthMoment);
    }
    if (card && !card.dataset.bound) {
      card.dataset.bound = "1";
      card.addEventListener("click", closeGrowthMoment);
    }
  }

  function syncSettingsNameUI() {
    var first = document.getElementById("settingsFirstName");
    var last = document.getElementById("settingsLastName");
    if (first) first.value = partnerName();
    if (last) last.value = partnerLastName();
    var msg = document.getElementById("settingsNameMsg");
    if (msg) msg.textContent = "";
  }

  function wireSettingsName() {
    var btn = document.getElementById("settingsNameSave");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async function () {
      var firstEl = document.getElementById("settingsFirstName");
      var lastEl = document.getElementById("settingsLastName");
      var msg = document.getElementById("settingsNameMsg");
      var first = firstEl ? firstEl.value.trim() : "";
      var last = lastEl ? lastEl.value.trim() : "";
      if (!first) {
        if (msg) msg.textContent = "Add your first name.";
        return;
      }
      if (!last) {
        if (msg) msg.textContent = "Add your last name too — it helps on the team tree.";
        return;
      }
      state.settings.partnerName = first;
      state.settings.partnerLastName = last;
      /* Avoid "Jessica Smith" + last "Smith" staying doubled in first name */
      var fl = first.toLowerCase();
      var ll = last.toLowerCase();
      if (fl.endsWith(" " + ll)) {
        state.settings.partnerName = first.slice(0, first.length - last.length).trim();
      }
      save({ immediate: true });
      renderGreetings();
      syncSettingsNameUI();
      try {
        var Cloud = howGrowCloud();
        if (Cloud && Cloud.isSignedIn()) {
          await Cloud.updateProfile({ display_name: partnerName(), last_name: last });
          await Cloud.pushProgress({
            active: state.active,
            data: state.data,
            done: state.done,
            calendar: state.data.calendar || {},
            cheers: state.cheers || [],
            settings: state.settings,
            tourDone: state.tourDone
          });
        }
        if (msg) msg.textContent = "Saved.";
      } catch (e) {
        if (msg) msg.textContent = "Saved on this device. Cloud update can retry next sync.";
      }
    });
  }

  function highlightCaption(msg) {
    if (!caption) return;
    caption.textContent = msg;
    caption.classList.add("highlight");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(function () { caption.classList.remove("highlight"); }, 1600);
  }

  function plantCaptionFor(roots, sproutDone, sproutTotal) {
    if (sproutDone === 0) {
      if (roots === 0) return "Seed on the dirt. Answer the three Roots blurbs to grow underground.";
      if (roots < ROOT_MAX) return "Roots growing · " + roots + " of " + ROOT_MAX + ". Each checklist item after Roots sprouts the plant.";
      return "Roots are in. Finish a check above ground to grow your sprout.";
    }
    if (sproutTotal > 0 && sproutDone >= sproutTotal) return "Full bloom — every check is done.";
    return sproutDone + " of " + sproutTotal + " checks done — each one grows your sprout.";
  }

  function plantVisualStage(sproutDone, sproutTotal) {
    if (sproutDone <= 0) return 0;
    if (sproutTotal > 0 && sproutDone >= sproutTotal) return 6;
    if (sproutTotal <= 1) return Math.min(5, Math.max(1, sproutDone));
    /* Stages 1–5 map across the full runway checklist (not a partial slice) */
    var stage = Math.ceil((sproutDone / sproutTotal) * 5);
    return Math.max(1, Math.min(5, stage));
  }

  function renderPlant(opts) {
    opts = opts || {};
    var roots = rootCount();
    var progress = checklistProgress();
    var sproutDone = progress.sproutDone;
    var sproutTotal = progress.sproutTotal;
    var visualSecs = plantVisualStage(sproutDone, sproutTotal);
    var plantKey = visualSecs + ":" + roots + ":" + sproutDone + ":" + sproutTotal;

    var grewRoots = !opts.silent && lastRoots >= 0 && roots > lastRoots;
    var grewSprout = !opts.silent && lastSprout >= 0 && sproutDone > lastSprout;
    var prevSnap = {
      roots: Math.max(0, lastRoots),
      sprout: Math.max(0, lastSprout),
      sproutTotal: lastSproutTotal >= 0 ? lastSproutTotal : sproutTotal
    };
    var nextSnap = { roots: roots, sprout: sproutDone, sproutTotal: sproutTotal };

    if (homePlant) {
      if (opts.force || homePlant.dataset.plantKey !== plantKey) {
        homePlant.dataset.plantKey = plantKey;
        homePlant.innerHTML = window.FS.plantSVG(visualSecs, roots, ROOT_MAX, "h_");
      }
    }
    if (finishPlant) finishPlant.innerHTML = window.FS.plantSVG(6, ROOT_MAX, ROOT_MAX, "f_");

    var pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    if (progressFill) progressFill.style.width = pct + "%";
    var track = document.getElementById("progressTrack");
    if (track) track.setAttribute("aria-valuenow", String(pct));
    var label = document.getElementById("progressLabel");
    if (label) label.textContent = "Growth " + pct + "%";
    var homePct = document.getElementById("homePctLabel");
    if (homePct) homePct.textContent = pct + "%";

    var statRoots = document.getElementById("statRoots");
    var statMods = document.getElementById("statModules");
    if (statRoots) statRoots.innerHTML = "<em>Roots</em> " + roots + "/" + ROOT_MAX;
    if (statMods) statMods.innerHTML = "<em>Checks</em> " + sproutDone + "/" + sproutTotal;

    if (grewRoots) {
      var rootMsg = growthMessage("roots", roots, sproutDone, sproutTotal);
      if (opts.deferCelebrate) {
        if (caption) caption.textContent = plantCaptionFor(roots, sproutDone, sproutTotal);
        queueGrowthCelebration("roots", rootMsg, prevSnap, nextSnap);
      } else {
        clearPendingGrowth();
        pulsePlant("roots");
        highlightCaption(rootMsg);
        celebrateGrowth("roots", rootMsg, prevSnap, nextSnap);
      }
    } else if (grewSprout) {
      var sproutMsg = growthMessage("sprout", roots, sproutDone, sproutTotal);
      if (opts.deferCelebrate) {
        if (caption) caption.textContent = plantCaptionFor(roots, sproutDone, sproutTotal);
        queueGrowthCelebration("sprout", sproutMsg, prevSnap, nextSnap);
      } else {
        clearPendingGrowth();
        pulsePlant("sprout");
        highlightCaption(sproutMsg);
        celebrateGrowth("sprout", sproutMsg, prevSnap, nextSnap);
      }
    } else if (caption && !caption.classList.contains("highlight")) {
      caption.textContent = plantCaptionFor(roots, sproutDone, sproutTotal);
    }
    lastRoots = roots;
    lastSprout = sproutDone;
    lastSproutTotal = sproutTotal;
    lastSecs = typeof doneCount === "function" ? doneCount() : visualSecs;
  }

  function settleViewTop() {
    /* Never steal focus while typing or while a sheet/overlay is open —
       blur/scroll kills iOS text selection mid-copy. */
    if (
      document.body.classList.contains("cal-sheet-open") ||
      document.body.classList.contains("overlay-open") ||
      document.body.classList.contains("hub-menu-open") ||
      document.body.classList.contains("curio-lightbox-open")
    ) return;
    if (document.querySelector(".cheer-sheet:not([hidden])")) return;
    var ae = document.activeElement;
    if (ae) {
      var tag = (ae.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input" || ae.isContentEditable) return;
    }
    try {
      if (ae && ae.blur) ae.blur();
    } catch (e) {}
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function renderPanels() {
    var panels = document.querySelectorAll(".panel");
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle("active", panels[i].id === "panel-" + state.active);
    }
    var mainContent = document.getElementById("mainContent");
    if (mainContent) {
      mainContent.classList.toggle("content-wide", state.active === "tend" || state.active === "calendar");
    }
    settleViewTop();
    renderModuleChecklists();
    renderContentBanks();
    renderBottomNav();
    renderHomeRunway();
    if (state.active === "know") {
      renderKnowPanel();
      wireKnowSearch();
      filterKnowSearch();
    }
    if (state.active === "talk") {
      if (markTalkOpened()) {
        save();
        liveRefresh({ silent: true });
      }
      renderTalkGuide((window.FS.CONTENT || {}).talkGuide);
    }
    if (state.active === "products") {
      renderProductLibrary();
    }
    if (state.active === "share") {
      renderShareFavPreview();
    }
    if (state.active === "done") {
      renderFinishCopy();
    }
    if (state.active === "curiosity-photos" && window.FS.BridgeUI && window.FS.BridgeUI.renderCuriosityPhotos) {
      window.FS.BridgeUI.renderCuriosityPhotos();
    }
    if (state.active === "content-stories") {
      if (!state.data.vaultBrowse) state.data.vaultBrowse = {};
      if (!state.data.vaultBrowse.vault) state.data.vaultBrowse.vault = { q: "", format: "", promoting: "", lane: "all" };
      state.data.vaultBrowse.vault.format = "story";
      state.active = "content-vault";
      save();
    }
    if (state.active === "content-vault" && window.FS.BridgeUI && window.FS.BridgeUI.renderContentVault) {
      window.FS.BridgeUI.renderContentVault();
    }
    if (state.active === "content-week" && window.FS.BridgeUI && window.FS.BridgeUI.renderContentWeek) {
      window.FS.BridgeUI.renderContentWeek();
    }
    if (state.active !== "curiosity-photos" && window.FS.BridgeUI && window.FS.BridgeUI.closeCuriosityLightbox) {
      window.FS.BridgeUI.closeCuriosityLightbox();
    }
    if (state.active === "plant") {
      renderSeedTypes();
    }
    if (state.active === "tend") {
      renderHooks();
      renderContentBanks();
      renderContentShortlist();
    }
    if (window.FS.BridgeUI) {
      if (state.active === "calendar" || state.active === "tend") window.FS.BridgeUI.renderCalendar();
      if (state.active === "leader") window.FS.BridgeUI.renderLeader();
      if (state.active === "leads" && window.FS.BridgeUI.renderLeads) window.FS.BridgeUI.renderLeads();
      if (state.active === "welcome") window.FS.BridgeUI.renderPulse();
      if (window.FS.BridgeUI.refreshIncomingMessages) window.FS.BridgeUI.refreshIncomingMessages();
      else if (window.FS.BridgeUI.renderLeaderNoteBanner) window.FS.BridgeUI.renderLeaderNoteBanner();
    }
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

  function setRoadmapOpen(open) {
    var wrap = document.getElementById("cdRoadmap");
    var hit = document.getElementById("cdRoadmapHit");
    if (!wrap || !hit) return;
    wrap.classList.toggle("is-open", !!open);
    hit.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function wireRoadmapHover() {
    var wrap = document.getElementById("cdRoadmap");
    var hit = document.getElementById("cdRoadmapHit");
    if (!wrap || !hit || hit.dataset.bound) return;
    hit.dataset.bound = "1";
    hit.addEventListener("click", function (e) {
      if (window.matchMedia("(hover: hover)").matches) return;
      e.preventDefault();
      setRoadmapOpen(!wrap.classList.contains("is-open"));
    });
    document.addEventListener("click", function (e) {
      if (!wrap.classList.contains("is-open")) return;
      if (wrap.contains(e.target)) return;
      setRoadmapOpen(false);
    });
  }

  /* ── completion rules ────────────────────────────────── */
  function listNames(key) {
    return parseNameLines(state.data[key] || "");
  }

  function groveNames() { return listNames("warm"); }
  function customerNames() { return listNames("customers"); }

  function grovePicks(key) {
    if (!Array.isArray(state.data[key])) state.data[key] = [];
    return state.data[key];
  }

  function pruneGrovePicks(lane) {
    var names = lane === "warm" ? groveNames() : customerNames();
    var key = lane === "warm" ? "warm_first" : "customer_first";
    var set = {};
    names.forEach(function (n) { set[n.toLowerCase()] = n; });
    var next = grovePicks(key).filter(function (n) { return set[(n || "").toLowerCase()]; })
      .map(function (n) { return set[(n || "").toLowerCase()]; });
    /* de-dupe */
    var seen = {}, out = [];
    next.forEach(function (n) {
      var k = n.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(n);
    });
    state.data[key] = out.slice(0, 5);
    return state.data[key];
  }

  function toggleGrovePick(lane, name) {
    name = (name || "").trim();
    if (!name) return;
    var key = lane === "warm" ? "warm_first" : "customer_first";
    var list = grovePicks(key).slice();
    var ix = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].toLowerCase() === name.toLowerCase()) { ix = i; break; }
    }
    if (ix > -1) list.splice(ix, 1);
    else if (list.length < 5) list.push(name);
    state.data[key] = list;
    syncGroveCalendar();
  }

  function syncGroveCalendar() {
    if (!window.FS.Calendar || !window.FS.Calendar.syncGroveOutreach) return;
    if (!state.data.calendar) state.data.calendar = {};
    var people = [];
    grovePicks("customer_first").forEach(function (n) {
      people.push({ name: n, lane: "customers" });
    });
    grovePicks("warm_first").forEach(function (n) {
      people.push({ name: n, lane: "warm" });
    });
    window.FS.Calendar.syncGroveOutreach(state.data.calendar, people, state.data);
    if (window.FS.BridgeUI && (state.active === "calendar" || state.active === "tend")) {
      window.FS.BridgeUI.renderCalendar();
    }
  }

  function canComplete(id) {
    if (id === "roots") return filledText("why") && filledText("moment") && filledText("said_yes");
    if (id === "share") return favoriteCount() >= 2 && talkOpened();
    if (id === "grove") {
      var c = customerNames();
      var picks = grovePicks("customer_first");
      var set = {};
      c.forEach(function (n) { set[n.toLowerCase()] = true; });
      var valid = picks.filter(function (n) { return set[(n || "").toLowerCase()]; });
      var need = Math.min(5, c.length);
      return c.length >= 5 && valid.length >= need && need > 0;
    }
    if (id === "tree") {
      var named = 0;
      (function walk(arr) {
        for (var i = 0; i < arr.length; i++) {
          if ((arr[i].name || "").trim()) named++;
          walk(arr[i].children || []);
        }
      })(Tree.ensure(state));
      return named >= 3;
    }
    if (id === "ground") {
      if (!state.data.page_choice || !filledText("page_story")) return false;
      if (usesBuiltInLeadPage() && !leadPageReady()) return false;
      return true;
    }
    if (id === "plant") return filledText("seed_open") && giveDraftFilled() && filledText("seed_invite");
    if (id === "tend") {
      var Cal = window.FS.Calendar;
      var posted = Cal && Cal.countPosted ? Cal.countPosted(state.data.calendar || {}) : 0;
      return posted >= 3;
    }
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
      if (ok) {
        b.textContent = (state.done[id] ? "✓ " : "") + readyLabel(b, id);
      } else if (id === "ground") {
        if (!state.data.page_choice) b.textContent = "Pick a page option first";
        else if (!filledText("page_story")) b.textContent = "Draft your opening line";
        else if (usesBuiltInLeadPage() && !leadSignedIn()) b.textContent = "Sign in to set up your lead page";
        else if (usesBuiltInLeadPage() && !leadPageReady()) b.textContent = "Save the link you'll share";
        else b.textContent = b.getAttribute("data-wait");
      } else if (id === "share") {
        if (favoriteCount() < 2) b.textContent = "Heart at least 2 products in Learn";
        else if (!talkOpened()) b.textContent = "Open Talking fresh once";
        else b.textContent = b.getAttribute("data-wait");
      } else if (id === "tend") {
        var CalWait = window.FS.Calendar;
        var postedWait = CalWait && CalWait.countPosted ? CalWait.countPosted(state.data.calendar || {}) : 0;
        if (postedWait < 3) b.textContent = "Mark 3 cards Done after you post (" + postedWait + "/3)";
        else b.textContent = b.getAttribute("data-wait");
      } else {
        b.textContent = b.getAttribute("data-wait");
      }
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
  var lastCustomerCount = 0;
  var groveFlashTimers = {};

  function flashGroveTrees(wrapId, forceAll) {
    var wrap = document.getElementById(wrapId || "groveTrees");
    if (!wrap) return;
    var visual = wrap.closest(".grove-visual");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var nodes = wrap.querySelectorAll(".gtree");
    if (!nodes.length) return;
    if (visual) {
      visual.classList.add("flashing");
      clearTimeout(groveFlashTimers[wrapId]);
      groveFlashTimers[wrapId] = setTimeout(function () { visual.classList.remove("flashing"); }, 450);
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

  function renderNameLane(opts) {
    opts = opts || {};
    var names = opts.names || [];
    var count = document.getElementById(opts.countId);
    var trees = document.getElementById(opts.treesId);
    var hint = document.getElementById(opts.hintId);
    if (!count) return;
    var n = names.length;
    var empty = opts.empty || "Empty soil — add your first name.";
    var unit = opts.unit || "names";
    count.innerHTML = n === 0 ? empty
      : "<strong>" + n + "</strong> " + (n === 1 ? unit.replace(/s$/, "") : unit) + (opts.suffix || "");
    if (hint) {
      var hints = opts.hints || {};
      hint.textContent = n === 0 ? "" :
        n < 5 ? (hints.low || "Keep going — even 5 names is a real start.") :
        n < 15 ? (hints.mid || "Nice. Aim for 15–25 when you can.") :
        n <= 25 ? (hints.full || "That's a full list. Quality over quantity from here.") :
        (hints.over || "That's a forest! Focus on the warmest 25.");
    }

    var prev = opts.getPrev ? opts.getPrev() : 0;
    if (trees) {
      var key = String(n);
      if (trees.dataset.groveKey !== key) {
        trees.dataset.groveKey = key;
        var hues = opts.hues || ["#abb09a", "#c5c9b8", "#9aa08a", "#b8bca8"];
        var html = "";
        var sproutFn = window.FS.miniSproutSVG || window.FS.miniTreeSVG;
        for (var i = 0; i < Math.min(n, 30); i++) {
          html += '<span class="gtree" title="' + esc(names[i]) + '">' + sproutFn(hues[i % hues.length]) + "</span>";
        }
        trees.innerHTML = html;
        if (opts.flash && n > prev && n > 0) {
          requestAnimationFrame(function () { flashGroveTrees(opts.treesId, true); });
        }
      }
    }
    if (opts.setPrev) opts.setPrev(n);
  }

  function renderPickList(lane) {
    var names = lane === "warm" ? groveNames() : customerNames();
    var picks = pruneGrovePicks(lane);
    var wrap = document.getElementById(lane === "warm" ? "warmPicksWrap" : "customerPicksWrap");
    var list = document.getElementById(lane === "warm" ? "warmPickList" : "customerPickList");
    var meta = document.getElementById(lane === "warm" ? "warmPickMeta" : "customerPickMeta");
    if (!wrap || !list) return;
    if (!names.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      if (meta) meta.textContent = "";
      return;
    }
    wrap.hidden = false;
    var selected = {};
    picks.forEach(function (n) { selected[n.toLowerCase()] = true; });
    var atMax = picks.length >= 5;
    var html = "";
    names.forEach(function (name, idx) {
      var on = !!selected[name.toLowerCase()];
      var disabled = !on && atMax;
      html += '<button type="button" class="grove-chip' + (on ? " on" : "") + '"'
        + ' data-grove-pick="' + lane + '" data-grove-idx="' + idx + '"'
        + (on ? ' aria-pressed="true"' : ' aria-pressed="false"')
        + (disabled ? " disabled" : "")
        + ">" + esc(name) + "</button>";
    });
    list.innerHTML = html;
    if (meta) {
      if (lane === "customers") {
        if (picks.length) {
          meta.textContent = isFull()
            ? picks.length + " of 5 first chats selected · landing on your Content calendar"
            : picks.length + " of 5 first chats selected · your first outreach list";
        } else {
          meta.textContent = "Tap the easiest people to share a product story with first.";
        }
      } else {
        if (picks.length) {
          meta.textContent = isFull()
            ? picks.length + " partner chats selected · also on your Content calendar"
            : picks.length + " partner chats selected · optional outreach list";
        } else {
          meta.textContent = "Optional — tap anyone you'd start a mission chat with.";
        }
      }
    }
  }

  function renderGrove(opts) {
    opts = opts || {};
    pruneGrovePicks("warm");
    pruneGrovePicks("customers");
    renderNameLane({
      names: customerNames(),
      countId: "customerCount",
      treesId: "customerTrees",
      hintId: "customerHint",
      empty: "Customer soil is empty — who would love the products?",
      unit: "customer names",
      suffix: " who'd love the products",
      hints: {
        low: "Keep going — even 5 product-curious names is a real start.",
        mid: "Nice. Who else asks about what you use, drink, or put on your skin?",
        full: "Solid customer map — tap your first chats below.",
        over: "Plenty of leads — quality chats beat a long list."
      },
      hues: ["#d9a93f", "#e8c86a", "#c9a04a", "#f0d06a"],
      flash: !!opts.customerFlash,
      getPrev: function () { return lastCustomerCount; },
      setPrev: function (n) { lastCustomerCount = n; }
    });
    renderNameLane({
      names: groveNames(),
      countId: "groveCount",
      treesId: "groveTrees",
      hintId: "groveHint",
      empty: "Optional — skip if you're sharing more like an affiliate for now.",
      unit: "partner names",
      suffix: " who might grow with you",
      hints: {
        low: "Nice start. Add more only if you're building with people.",
        mid: isFull()
          ? "Solid optional list — tap first chats if you want them on the calendar."
          : "Solid optional list — tap first chats if you want a short outreach list.",
        full: "That's a full partner list. Quality over quantity from here.",
        over: "Focus on the warmest handful — partners are optional."
      },
      hues: ["#abb09a", "#c5c9b8", "#9aa08a", "#b8bca8"],
      flash: !!opts.flash,
      getPrev: function () { return lastGroveCount; },
      setPrev: function (n) { lastGroveCount = n; }
    });
    renderPickList("customers");
    renderPickList("warm");
  }

  var syncLeadBlurbTimer = null;

  function syncPageStoryToLeadBlurb() {
    if (!usesBuiltInLeadPage()) return;
    var story = ((state.data.page_story || "") + "").trim().slice(0, 280);
    var hint = document.getElementById("pageStoryHint");
    if (hint) {
      hint.textContent = "Pull straight from your Roots. This line also fills the intro on your in-app lead page — watch the preview below.";
    }
    var input = document.getElementById("leadsBlurbInput");
    if (input && document.activeElement !== input) input.value = story;

    var Cloud = window.FS.Cloud;
    if (!Cloud || !Cloud.isSignedIn || !Cloud.isSignedIn()) {
      state.data._synced_page_story = story;
      return;
    }
    var user = Cloud.user() || {};
    var current = ((user.lead_blurb || "") + "").trim();
    var prevSynced = ((state.data._synced_page_story || "") + "").trim();
    /* Keep auto-fill going until they customize the intro to something else in Leads settings */
    if (current && current !== prevSynced && current !== story) return;
    state.data._synced_page_story = story;
    clearTimeout(syncLeadBlurbTimer);
    syncLeadBlurbTimer = setTimeout(function () {
      if (!usesBuiltInLeadPage()) return;
      Cloud.setLeadBlurb(story).then(function () {
        var input = document.getElementById("leadsBlurbInput");
        if (input && document.activeElement !== input) input.value = story;
      }).catch(function () {});
    }, 700);
  }

  function renderMiniPage() {
    var el = document.getElementById("miniHeadline");
    if (!el) return;
    var t = (state.data.page_story || "").trim();
    el.innerHTML = t
      ? esc(t)
      : '<span class="dim">Your opening line appears here — the first personal thing a visitor reads.</span>';
    var brand = document.getElementById("miniBrandName");
    if (brand) brand.textContent = firstName() || "you";
    var hint = document.getElementById("pageStoryHint");
    if (hint) {
      hint.textContent = usesBuiltInLeadPage()
        ? "Pull straight from your Roots. This line also fills the intro on your in-app lead page — watch the preview below."
        : "Pull straight from your Roots. Your why, in one warm sentence. Watch it appear on the preview below.";
    }
  }

  function runClaimCheck(key) {
    var el = document.querySelector('[data-check="' + key + '"]');
    if (!el) return;
    var text = (state.data[key] || "");
    var trimmed = text.trim();
    if (!trimmed) { el.innerHTML = ""; return; }
    var hits = [];
    for (var i = 0; i < RISKY.length; i++) if (RISKY[i].re.test(text)) hits.push(RISKY[i]);
    if (hits.length) {
      var html = "";
      for (var j = 0; j < hits.length; j++) html += '<span class="claim-flag">⚠ ' + esc(hits[j].word) + "</span>";
      html += '<span class="claim-note">' + esc(hits[0].tip) + (hits.length > 1 ? " (and " + (hits.length - 1) + " more to double-check)" : "") + "</span>";
      el.innerHTML = html;
      return;
    }
    /* Don't celebrate “clean” — only warn when risky claim words show up */
    if (trimmed.length < 12) { el.innerHTML = ""; return; }
    el.innerHTML = "";
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
      var len = ((state.data[k] || "") + "").trim().length;
      fields[i].classList.toggle("filled", len >= 24);
    }
  }

  function liveRefresh(opts) {
    opts = opts || {};
    if (reconcileDoneFlags()) save();
    renderStory();
    renderGrove({ flash: !!opts.groveFlash, customerFlash: !!opts.customerFlash });
    renderMiniPage();
    renderWeek();
    markFilledStates();
    renderPlant(opts);
    refreshButtons();
    renderModuleChecklists();
    renderTodayCard();
    renderHomeRunway();
    renderGroundLeadSetup();
    renderBottomNav();
    refreshAllShortlists();
  }

  /* ── leaf burst ──────────────────────────────────────── */
  function leafBurst(x, y) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var colors = ["#abb09a", "#c5c9b8", "#f0d06a", "#d9a93f"];
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
      var isLongWrite = f.tagName === "TEXTAREA";
      f.addEventListener("input", function () {
        state.data[k] = f.value;
        runClaimCheck(k);
        var beforeRoots = lastRoots;
        var beforeSprout = lastSprout;
        var groveFlash = false;
        var customerFlash = false;
        if (k === "warm") {
          groveFlash = groveNames().length !== lastGroveCount;
        }
        if (k === "customers") {
          customerFlash = customerNames().length !== lastCustomerCount;
        }
        if (k === "warm" || k === "customers") {
          pruneGrovePicks(k === "warm" ? "warm" : "customers");
        }
        liveRefresh({ groveFlash: groveFlash, customerFlash: customerFlash, silent: true });
        if (k === "page_story") syncPageStoryToLeadBlurb();
        /* Pulse when roots or sprout checklist progress actually advances */
        if (rootCount() > beforeRoots || checklistProgress().sproutDone > beforeSprout) {
          lastRoots = beforeRoots;
          lastSprout = beforeSprout;
          renderPlant({ deferCelebrate: isLongWrite });
        } else if (isLongWrite && pendingGrowth) {
          /* keep resetting idle timer while they keep typing */
          clearTimeout(growthIdleTimer);
          growthIdleTimer = setTimeout(flushPendingGrowth, GROWTH_IDLE_MS);
        }
        clearTimeout(t);
        t = setTimeout(function () {
          if (k === "warm" || k === "customers") syncGroveCalendar();
          save();
          flash(sectionOf(f));
        }, 500);
      });
      f.addEventListener("blur", function () {
        clearTimeout(t);
        if (k === "warm" || k === "customers") syncGroveCalendar();
        flushSave();
        if (isLongWrite && pendingGrowth) flushPendingGrowth();
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
    renderGroundLeadSetup();
    renderBottomNav();
  }

  function renderRhythms() {
    var rhythmWrap = document.getElementById("rhythmList");
    if (!rhythmWrap) return;
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
        save();
        flash("tree");
        var c = Tree.counts(Tree.ensure(state));
        var stats = document.getElementById("treeStats");
        if (stats) {
          stats.innerHTML = c.total
            ? ("<strong>" + c.total + "</strong> · 🌱 " + c.hopeful + " · 🌳 " + c.committed)
            : "";
        }
        renderModuleChecklists();
        refreshButtons();
        var beforeSprout = lastSprout;
        liveRefresh({ silent: true });
        if (checklistProgress().sproutDone > beforeSprout) {
          lastSprout = beforeSprout;
          renderPlant({});
        }
      }, 400);
    }
  });

  /* ── onboarding ──────────────────────────────────────── */
  var onboardingStep = 0;
  var ONBOARD_STEPS = 6;
  var ONBOARD_THEMES = [
    "onboarding-welcome",
    "onboarding-circle",
    "onboarding-name",
    "onboarding-auth",
    "onboarding-install",
    "onboarding-mode"
  ];
  var installPlatform = "";
  var deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  function cloudSignedIn() {
    return !!(window.FS.Cloud && window.FS.Cloud.isSignedIn && window.FS.Cloud.isSignedIn());
  }

  function isRunningAsInstalledApp() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }

  function guessInstallPlatform() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }

  function advanceToInstallStep() {
    onboardingStep = 4;
    renderOnboardingStep();
  }

  function advanceToModeStep() {
    onboardingStep = 5;
    renderOnboardingStep();
  }

  function installGuideHtml(platform) {
    var head = '<p class="onboard-install-do">Do this now — before you continue</p>';
    var switchNote =
      '<p class="onboard-install-switch">' +
      "<strong>Then leave this browser.</strong> Close this tab, open First Seeds from your Home Screen icon, and keep going there. " +
      "If you fill things out here and later open the icon, it can look like you’re starting over — and your Roots answers may be missing." +
      "</p>";
    if (platform === "ios") {
      return head +
        '<ol class="onboard-install-steps">' +
        "<li>Open this page in <strong>Safari</strong> (not Chrome, and not inside Instagram or Texts).</li>" +
        "<li>Tap the <strong>Share</strong> button " +
        '<span class="onboard-install-glyph" aria-hidden="true">□↑</span> ' +
        "at the bottom of Safari (or top on iPad).</li>" +
        '<li class="onboard-install-key">Scroll and tap <strong>Add to Home Screen</strong>.</li>' +
        "<li>Tap <strong>Add</strong> in the top right — you should see a First Seeds icon on your Home Screen.</li>" +
        '<li class="onboard-install-key">Close Safari. Open First Seeds from that new icon and finish setup there.</li>' +
        "</ol>" +
        switchNote +
        '<p class="onboard-install-note">If you don’t see “Add to Home Screen,” scroll the share sheet all the way down. Already signed in? Use the same email in the app if it asks again.</p>';
    }
    if (platform === "android") {
      var installBtn = deferredInstallPrompt
        ? '<button type="button" class="btn overlay-btn" id="onboardInstallPromptBtn" style="margin-bottom:12px">Install First Seeds →</button>'
        : "";
      return head + installBtn +
        '<ol class="onboard-install-steps">' +
        "<li>Use <strong>Chrome</strong> on your phone (best results).</li>" +
        "<li>Tap the <strong>⋮</strong> menu (top right).</li>" +
        '<li class="onboard-install-key">Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>' +
        "<li>Confirm — then look for the First Seeds icon on your Home Screen.</li>" +
        '<li class="onboard-install-key">Close Chrome. Open First Seeds from that icon and finish setup there.</li>' +
        "</ol>" +
        switchNote +
        '<p class="onboard-install-note">On some Androids it says “Install” in the address bar instead of the menu. Already signed in? Use the same email in the app if it asks again.</p>';
    }
    /* desktop */
    var deskBtn = deferredInstallPrompt
      ? '<button type="button" class="btn overlay-btn" id="onboardInstallPromptBtn" style="margin-bottom:12px">Install First Seeds →</button>'
      : "";
    return head + deskBtn +
      '<ol class="onboard-install-steps">' +
      '<li class="onboard-install-key">In <strong>Chrome</strong> or <strong>Edge</strong>, click the install icon in the address bar (a screen / ⊕), or menu → <strong>Install First Seeds</strong>.</li>' +
      "<li>On a Mac with Safari: <strong>File → Add to Dock</strong> (or Share → Add to Dock).</li>" +
      "<li>After it’s installed, open First Seeds from the app / Dock icon — don’t keep going only in this browser tab.</li>" +
      "<li>Phone is usually better day-to-day — you can install there later from the same link.</li>" +
      "</ol>" +
      switchNote +
      '<p class="onboard-install-note">Once it’s installed (or you’ve decided to do it on your phone later), use the buttons below.</p>';
  }

  function syncInstallNextEnabled() {
    var next = document.getElementById("onboardingInstallNext");
    var confirm = document.getElementById("onboardInstallConfirm");
    var skip = document.getElementById("onboardingInstallSkip");
    if (!next) return;
    if (isRunningAsInstalledApp() || installPlatform === "standalone") {
      next.disabled = false;
      return;
    }
    var confirmed = !!(confirm && confirm.checked);
    next.disabled = !installPlatform || !confirmed;
    if (skip) skip.hidden = false;
  }

  function selectInstallPlatform(platform) {
    installPlatform = platform || "";
    state.data.installPlatform = installPlatform;
    save();
    var choices = document.querySelectorAll("#onboardInstallChoices [data-install-platform]");
    for (var i = 0; i < choices.length; i++) {
      choices[i].classList.toggle("on", choices[i].getAttribute("data-install-platform") === installPlatform);
    }
    var guide = document.getElementById("onboardInstallGuide");
    var confirmWrap = document.getElementById("onboardInstallConfirmWrap");
    var confirm = document.getElementById("onboardInstallConfirm");
    var next = document.getElementById("onboardingInstallNext");
    if (guide) {
      guide.hidden = !installPlatform;
      guide.innerHTML = installPlatform ? installGuideHtml(installPlatform) : "";
      var promptBtn = document.getElementById("onboardInstallPromptBtn");
      if (promptBtn) {
        promptBtn.addEventListener("click", async function () {
          if (!deferredInstallPrompt) return;
          try {
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
          } catch (e) {}
          deferredInstallPrompt = null;
          promptBtn.hidden = true;
          if (confirm) {
            confirm.checked = true;
            syncInstallNextEnabled();
          }
        });
      }
    }
    if (confirmWrap) confirmWrap.hidden = !installPlatform;
    if (confirm && !installPlatform) confirm.checked = false;
    if (next && OB) {
      next.textContent = isRunningAsInstalledApp()
        ? (OB.installCta || "Continue →")
        : (OB.installOpenCta || OB.installCta || "I'll open it from Home Screen →");
    }
    var installMsg = document.getElementById("onboardingInstallMsg");
    if (installMsg) installMsg.textContent = "";
    syncInstallNextEnabled();
  }

  function renderOnboardingStep() {
    var card = document.getElementById("onboardingCard");
    var dots = document.getElementById("onboardingDots");
    if (card) {
      for (var t = 0; t < ONBOARD_THEMES.length; t++) {
        card.classList.toggle(ONBOARD_THEMES[t], t === onboardingStep);
      }
    }
    var panes = document.querySelectorAll("#onboarding .onboarding-pane");
    for (var i = 0; i < panes.length; i++) {
      panes[i].classList.toggle("on", parseInt(panes[i].getAttribute("data-onboard-step"), 10) === onboardingStep);
    }
    if (dots) {
      dots.innerHTML = "";
      for (var d = 0; d < ONBOARD_STEPS; d++) {
        var iEl = document.createElement("i");
        if (d === onboardingStep) iEl.className = "on";
        else if (d < onboardingStep) iEl.className = "done";
        dots.appendChild(iEl);
      }
    }
    if (onboardingStep === 2) {
      var input = document.getElementById("partnerNameInput");
      var lastInput = document.getElementById("partnerLastNameInput");
      if (input) input.value = partnerName();
      if (lastInput) lastInput.value = partnerLastName();
      syncNameNext();
      setTimeout(function () {
        syncNameNext();
        if (input) input.focus();
      }, 50);
      /* Autofill can fill after paint without firing input */
      setTimeout(syncNameNext, 400);
    }
    if (onboardingStep === 3) {
      var emailIn = document.getElementById("onboardingEmail");
      var passIn = document.getElementById("onboardingPassword");
      var msg = document.getElementById("onboardingAuthMsg");
      var title = document.getElementById("obAuthTitle");
      var eyebrow = document.getElementById("obAuthEyebrow");
      var body = document.getElementById("obAuthBody");
      if (msg) msg.textContent = "";
      if (cloudSignedIn()) {
        advanceToInstallStep();
        return;
      }
      if (hasLocalRootsProgress()) {
        if (eyebrow) eyebrow.textContent = "Welcome back";
        if (title) title.textContent = "Sign in to keep going";
        if (body) {
          body.textContent = "Your Roots answers stay on this device — sign in so they also save to your account if the app closes.";
        }
      }
      if (passIn) passIn.setAttribute("autocomplete", "current-password");
      if (emailIn) setTimeout(function () { emailIn.focus(); }, 50);
    }
    if (onboardingStep === 4) {
      if (isRunningAsInstalledApp()) {
        var guide = document.getElementById("onboardInstallGuide");
        var lead = document.getElementById("obInstallLead");
        var next = document.getElementById("onboardingInstallNext");
        var choices = document.getElementById("onboardInstallChoices");
        var confirmWrap = document.getElementById("onboardInstallConfirmWrap");
        if (lead) lead.textContent = "Nice — you’re already using First Seeds as an app on this device.";
        if (choices) choices.hidden = true;
        if (confirmWrap) confirmWrap.hidden = true;
        if (guide) {
          guide.hidden = false;
          guide.innerHTML = '<p class="onboard-install-note" style="margin:0">You’re set. Continue to pick how deep you want your runway.</p>';
        }
        if (next) {
          next.disabled = false;
          next.textContent = "Continue →";
        }
        installPlatform = "standalone";
        return;
      }
      var choiceWrap = document.getElementById("onboardInstallChoices");
      if (choiceWrap) choiceWrap.hidden = false;
      var guessed = state.data.installPlatform || guessInstallPlatform();
      selectInstallPlatform(guessed);
    }
  }

  function syncNameNext() {
    var input = document.getElementById("partnerNameInput");
    var last = document.getElementById("partnerLastNameInput");
    var btn = document.getElementById("onboardingNameNext");
    if (!btn) return;
    var ok = !!(input && String(input.value || "").trim() && last && String(last.value || "").trim());
    btn.disabled = !ok;
  }

  var onboardingReplay = false;

  function hasLocalRootsProgress() {
    return !!(
      filledText("why") ||
      filledText("moment") ||
      filledText("said_yes") ||
      partnerName()
    );
  }

  function dismissOnboardingIfModeChosen() {
    if (!modeChosen()) return false;
    var wrap = document.getElementById("onboarding");
    if (wrap && wrap.classList.contains("open")) {
      wrap.classList.remove("open");
      syncOverlayBodyLock();
    }
    return true;
  }

  function startOnboarding(opts) {
    opts = opts || {};
    var wrap = document.getElementById("onboarding");
    if (!wrap) return;
    /* Normal boot only shows onboarding until a path is chosen; Settings replay bypasses that. */
    if (!opts.replay && modeChosen()) return;
    onboardingReplay = !!opts.replay;
    if (opts.replay) {
      onboardingStep = 0;
      var conf = document.getElementById("onboardInstallConfirm");
      if (conf) conf.checked = false;
      var confirmWrap = document.getElementById("onboardInstallConfirmWrap");
      if (confirmWrap) confirmWrap.hidden = true;
    } else if (partnerName() && cloudSignedIn()) {
      onboardingStep = 4;
    } else if (partnerName() || hasLocalRootsProgress()) {
      /* Welcome-back: skip intro fluff; land on name or sign-in so Roots text isn’t “restarted”. */
      onboardingStep = partnerName() ? 3 : 2;
    } else {
      onboardingStep = 0;
    }
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
    var wasReplay = onboardingReplay;
    onboardingReplay = false;
    offerHowGrowAfterOnboarding = !wasReplay;
    if (!wasReplay && !state.tourDone) startTour();
    else if (wasReplay) {
      /* Settings → Replay welcome also restarts the app feature tour. */
      startTour();
    } else {
      syncOverlayBodyLock();
      setTimeout(maybeOfferHowIGrow, 250);
    }
  }

  function replayOnboardingFromSettings() {
    closeHubMenu();
    startOnboarding({ replay: true });
  }

  /* ── How I Grow support profile ─────────────────────── */
  var HOW_GROW_DRAFT_KEY = "firstSeeds_how_i_grow_draft_v1";
  var HOW_GROW_STEP_KEY = "firstSeeds_how_i_grow_step_v1";
  var HOW_GROW_TOTAL = 11;
  var howGrowStep = 0;
  var howGrowAnswers = {};
  var howGrowAdvanceTimer = null;
  var offerHowGrowAfterOnboarding = false;

  function howGrowCloud() {
    return window.FS && window.FS.Cloud;
  }

  function readHowGrowDraft() {
    try { return JSON.parse(localStorage.getItem(HOW_GROW_DRAFT_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }

  function writeHowGrowDraft() {
    try { localStorage.setItem(HOW_GROW_DRAFT_KEY, JSON.stringify(howGrowAnswers)); } catch (e) {}
  }

  function persistHowGrowResumeStep(step) {
    var n = Math.max(0, Math.min(HOW_GROW_TOTAL, step | 0));
    try { localStorage.setItem(HOW_GROW_STEP_KEY, String(n)); } catch (e) {}
    if (state.data) state.data.howGrowResumeStep = n;
  }

  function inferHowGrowResumeStep() {
    var s;
    for (s = 1; s <= HOW_GROW_TOTAL; s++) {
      if (!validateHowGrowStep(s)) return s;
    }
    if (!(howGrowAnswers.surprises && howGrowAnswers.surprises.length) && !howGrowAnswers.surprise_other) return 8;
    if (!howGrowAnswers.one_year_vision) return 9;
    if (!howGrowAnswers.leader_note) return 10;
    return HOW_GROW_TOTAL;
  }

  function readHowGrowResumeStep() {
    var fromState = state.data && parseInt(state.data.howGrowResumeStep, 10);
    if (fromState >= 1 && fromState <= HOW_GROW_TOTAL) return fromState;
    try {
      var stored = parseInt(localStorage.getItem(HOW_GROW_STEP_KEY) || "0", 10);
      if (stored >= 1 && stored <= HOW_GROW_TOTAL) return stored;
    } catch (e) {}
    return inferHowGrowResumeStep();
  }

  function howGrowInput(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function collectHowGrowText() {
    howGrowAnswers.struggling_support = howGrowInput("howGrowStruggling");
    howGrowAnswers.surprise_other = howGrowInput("howGrowSurpriseOther");
    howGrowAnswers.one_year_vision = howGrowInput("howGrowOneYear");
    howGrowAnswers.leader_note = howGrowInput("howGrowLeaderNote");
    howGrowAnswers.little_joys = {
      snack: howGrowInput("howGrowSnack"),
      drink: howGrowInput("howGrowDrink"),
      birthday: howGrowInput("howGrowBirthday"),
      color: howGrowInput("howGrowColor"),
      hobby: howGrowInput("howGrowHobby"),
      travel: howGrowInput("howGrowTravel"),
      pets: howGrowInput("howGrowPets"),
      anything_else: howGrowInput("howGrowAnything")
    };
    writeHowGrowDraft();
  }

  function normalizeHowGrowAnswers(answers) {
    var a = answers || {};
    var recognitionAliases = {
      "Public celebration": "I love being celebrated publicly",
      "Small group recognition": "A small group is perfect",
      "Private recognition": "A private message means more",
      "No spotlight": "Please don’t put me in the spotlight"
    };
    ["encouragement", "recognition", "surprises"].forEach(function (key) {
      if (typeof a[key] === "string" && a[key]) a[key] = [a[key]];
    });
    if (Array.isArray(a.recognition)) {
      a.recognition = a.recognition.map(function (item) {
        return recognitionAliases[item] || item;
      });
    }
    return a;
  }

  function paintHowGrowForm() {
    howGrowAnswers = normalizeHowGrowAnswers(howGrowAnswers);
    var singleGroups = document.querySelectorAll("[data-how-grow-group]");
    for (var i = 0; i < singleGroups.length; i++) {
      var key = singleGroups[i].getAttribute("data-how-grow-group");
      var buttons = singleGroups[i].querySelectorAll("[data-how-grow-value]");
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].classList.toggle("on", howGrowAnswers[key] === buttons[b].getAttribute("data-how-grow-value"));
      }
    }
    var multiGroups = document.querySelectorAll("[data-how-grow-multi]");
    for (var m = 0; m < multiGroups.length; m++) {
      var multiKey = multiGroups[m].getAttribute("data-how-grow-multi");
      var selected = Array.isArray(howGrowAnswers[multiKey]) ? howGrowAnswers[multiKey] : [];
      var multiButtons = multiGroups[m].querySelectorAll("[data-how-grow-value]");
      for (var mb = 0; mb < multiButtons.length; mb++) {
        var value = multiButtons[mb].getAttribute("data-how-grow-value");
        var rank = selected.indexOf(value);
        multiButtons[mb].classList.toggle("on", rank >= 0);
        if (rank >= 0) multiButtons[mb].setAttribute("data-rank", String(rank + 1));
        else multiButtons[mb].removeAttribute("data-rank");
      }
    }
    var fields = {
      howGrowStruggling: howGrowAnswers.struggling_support,
      howGrowSurpriseOther: howGrowAnswers.surprise_other,
      howGrowOneYear: howGrowAnswers.one_year_vision,
      howGrowLeaderNote: howGrowAnswers.leader_note,
      howGrowSnack: howGrowAnswers.little_joys && howGrowAnswers.little_joys.snack,
      howGrowDrink: howGrowAnswers.little_joys && howGrowAnswers.little_joys.drink,
      howGrowBirthday: howGrowAnswers.little_joys && howGrowAnswers.little_joys.birthday,
      howGrowColor: howGrowAnswers.little_joys && howGrowAnswers.little_joys.color,
      howGrowHobby: howGrowAnswers.little_joys && howGrowAnswers.little_joys.hobby,
      howGrowTravel: howGrowAnswers.little_joys && howGrowAnswers.little_joys.travel,
      howGrowPets: howGrowAnswers.little_joys && howGrowAnswers.little_joys.pets,
      howGrowAnything: howGrowAnswers.little_joys && howGrowAnswers.little_joys.anything_else
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = fields[id] || "";
    });
    var hint = document.getElementById("howGrowEncouragementHint");
    if (hint) {
      var picked = Array.isArray(howGrowAnswers.encouragement) ? howGrowAnswers.encouragement.length : 0;
      hint.textContent = picked >= 2
        ? "That’s your 1st and 2nd — tap one to remove it, then hit Next."
        : picked === 1
          ? "Nice — tap a 2nd if you want, then hit Next."
          : "Tap your 1st pick, then your 2nd if you have one.";
    }
  }

  function clearHowGrowAdvance() {
    if (howGrowAdvanceTimer) {
      clearTimeout(howGrowAdvanceTimer);
      howGrowAdvanceTimer = null;
    }
  }

  function showHowGrowStep(step) {
    clearHowGrowAdvance();
    howGrowStep = Math.max(0, Math.min(HOW_GROW_TOTAL, step));
    if (howGrowStep > 0) persistHowGrowResumeStep(howGrowStep);
    var panes = document.querySelectorAll("#howGrowOverlay [data-how-grow-step]");
    for (var i = 0; i < panes.length; i++) {
      panes[i].classList.toggle("on", parseInt(panes[i].getAttribute("data-how-grow-step"), 10) === howGrowStep);
    }
    var progress = document.getElementById("howGrowProgress");
    var label = document.getElementById("howGrowStepLabel");
    var fill = document.getElementById("howGrowProgressFill");
    if (progress) {
      progress.hidden = howGrowStep === 0;
      if (label) label.textContent = howGrowStep + " of " + HOW_GROW_TOTAL;
      if (fill) fill.style.width = Math.round((howGrowStep / HOW_GROW_TOTAL) * 100) + "%";
    }
    var card = document.querySelector("#howGrowOverlay .how-grow-card");
    if (card) card.scrollTop = 0;
  }

  async function openHowIGrow(skipIntro) {
    var Cloud = howGrowCloud();
    if (!Cloud || !Cloud.isSignedIn()) {
      var auth = document.getElementById("authOpenBtn");
      if (auth) auth.click();
      return;
    }
    howGrowAnswers = normalizeHowGrowAnswers(readHowGrowDraft());
    var completed = false;
    try {
      var saved = await Cloud.loadSupportPreferences();
      if (saved && saved.answers) howGrowAnswers = normalizeHowGrowAnswers(Object.assign({}, howGrowAnswers, saved.answers));
      completed = !!(saved && saved.completed_at);
    } catch (e) {}
    var ctx = null;
    try { ctx = await Cloud.mySupportContext(); } catch (e) {}
    var intro = document.getElementById("howGrowIntro");
    var leaderName = ctx && (ctx.invited_by_name || ctx.sponsor_name);
    if (intro) {
      intro.textContent = leaderName
        ? leaderName + " would love to know how to best support you on this journey."
        : "Your leader would love to know how to best support you on this journey.";
    }
    paintHowGrowForm();
    var resume = readHowGrowResumeStep();
    if (!completed && resume >= 1) {
      showHowGrowStep(resume);
    } else {
      showHowGrowStep(skipIntro ? 1 : 0);
    }
    var overlay = document.getElementById("howGrowOverlay");
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add("open");
      setOverlayOpen(true);
    }
  }

  function closeHowIGrow(opts) {
    clearHowGrowAdvance();
    if (!opts || !opts.skipDraftSave) {
      collectHowGrowText();
      if (howGrowStep > 0) {
        persistHowGrowResumeStep(howGrowStep);
        save();
      }
    }
    var overlay = document.getElementById("howGrowOverlay");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.hidden = true;
    }
    syncOverlayBodyLock();
    setTimeout(maybeOfferLastName, 350);
  }

  function validateHowGrowStep(step) {
    var required = {
      1: "learning_style",
      2: "question_style",
      4: "accountability",
      5: "support_frequency",
      6: "encouragement",
      7: "recognition"
    };
    var key = required[step];
    if (!key) return true;
    var value = howGrowAnswers[key];
    if (!value || (Array.isArray(value) && !value.length)) return false;
    return true;
  }

  function validateHowGrowRequired() {
    return [1, 2, 4, 5, 6, 7].every(validateHowGrowStep);
  }

  async function refreshHowGrowReminder() {
    var reminders = document.querySelectorAll("[data-how-grow-reminder]");
    var Cloud = howGrowCloud();
    if (!reminders.length) return;
    if (!Cloud || !Cloud.isSignedIn()) {
      for (var h = 0; h < reminders.length; h++) reminders[h].hidden = true;
      return;
    }
    var saved = null;
    try { saved = await Cloud.loadSupportPreferences(); } catch (e) {}
    var complete = !!(saved && saved.completed_at);
    for (var i = 0; i < reminders.length; i++) {
      reminders[i].hidden = complete;
      if (!complete) {
        reminders[i].innerHTML =
          '<div><strong>🌱 How I Grow</strong><span>Help your leader support you in a way that feels like you.</span></div>' +
          '<button type="button" class="btn-ghost" data-open-how-grow>Fill out my support map →</button>';
      }
    }
    var edit = document.getElementById("editHowIGrowBtn");
    if (edit) edit.textContent = complete ? "Edit How I Grow" : "Start How I Grow";
  }

  async function maybeOfferHowIGrow() {
    if (!offerHowGrowAfterOnboarding) return;
    offerHowGrowAfterOnboarding = false;
    var Cloud = howGrowCloud();
    if (!Cloud || !Cloud.isSignedIn()) return;
    try {
      var saved = await Cloud.loadSupportPreferences();
      if (saved && saved.completed_at) return;
      var ctx = await Cloud.mySupportContext();
      if (!ctx || !(ctx.invited_by_id || ctx.sponsor_id)) return;
      openHowIGrow(false);
    } catch (e) {}
  }

  function lastNameMissing() {
    if (partnerLastName()) return false;
    var Cloud = howGrowCloud();
    var user = Cloud && Cloud.user ? Cloud.user() : null;
    if (user && String(user.last_name || "").trim()) return false;
    return true;
  }

  function closeLastNamePrompt() {
    var overlay = document.getElementById("lastNameOverlay");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.hidden = true;
    }
    syncOverlayBodyLock();
  }

  function openLastNamePrompt() {
    var overlay = document.getElementById("lastNameOverlay");
    var input = document.getElementById("lastNamePromptInput");
    var saveBtn = document.getElementById("lastNameSave");
    var msg = document.getElementById("lastNameMsg");
    if (!overlay) return;
    splitFullNameIfNeeded();
    if (partnerLastName()) save();
    if (msg) msg.textContent = "";
    if (input) {
      input.value = partnerLastName();
      if (saveBtn) saveBtn.disabled = !input.value.trim();
    }
    overlay.hidden = false;
    overlay.classList.add("open");
    setOverlayOpen(true);
    setTimeout(function () {
      if (input) {
        /* Autofill often fills without firing input — re-check after paint */
        if (saveBtn) saveBtn.disabled = !input.value.trim();
        input.focus();
      }
    }, 50);
    setTimeout(function () {
      if (input && saveBtn) saveBtn.disabled = !input.value.trim();
    }, 400);
  }

  var lastNamePromptSkipped = false;

  async function maybeOfferLastName() {
    try {
      var Cloud = howGrowCloud();
      if (!Cloud || !Cloud.isSignedIn()) return;
      splitFullNameIfNeeded();
      if (!lastNameMissing()) return;
      if (lastNamePromptSkipped) return;
      var howGrow = document.getElementById("howGrowOverlay");
      if (howGrow && howGrow.classList.contains("open")) return;
      var tourEl = document.getElementById("tour");
      if (tourEl && tourEl.classList.contains("open")) return;
      var onboard = document.getElementById("onboarding");
      if (onboard && onboard.classList.contains("open")) return;
      var auth = document.getElementById("authOverlay");
      if (auth && auth.classList.contains("open")) return;
      var already = document.getElementById("lastNameOverlay");
      if (already && already.classList.contains("open")) return;
      openLastNamePrompt();
    } catch (e) {}
  }
  window.FS.maybeOfferLastName = maybeOfferLastName;

  function wireLastNamePrompt() {
    var overlay = document.getElementById("lastNameOverlay");
    if (!overlay || overlay.dataset.wired === "1") return;
    overlay.dataset.wired = "1";
    var input = document.getElementById("lastNamePromptInput");
    var saveBtn = document.getElementById("lastNameSave");
    var later = document.getElementById("lastNameLater");
    var closeBtn = document.getElementById("lastNameClose");
    var msg = document.getElementById("lastNameMsg");
    function syncSave() {
      if (saveBtn && input) saveBtn.disabled = !String(input.value || "").trim();
    }
    if (input) {
      ["input", "change", "blur", "keyup"].forEach(function (ev) {
        input.addEventListener(ev, syncSave);
      });
      /* Chrome/Safari autofill often skips input events */
      input.addEventListener("animationstart", function (e) {
        if (e.animationName === "onAutoFillStart" || e.animationName === "autofill") syncSave();
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && input.value.trim() && saveBtn && !saveBtn.disabled) {
          e.preventDefault();
          saveBtn.click();
        }
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        syncSave();
        var last = input ? input.value.trim() : "";
        if (!last) return;
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        if (msg) msg.textContent = "";
        var first = partnerName();
        /* Don't keep a duplicated surname sitting in the first-name field */
        if (first) {
          var fl = first.toLowerCase();
          var ll = last.toLowerCase();
          if (fl.endsWith(" " + ll)) {
            state.settings.partnerName = first.slice(0, first.length - last.length).trim();
          }
        }
        state.settings.partnerLastName = last;
        save({ immediate: true });
        renderGreetings();
        try {
          var Cloud = howGrowCloud();
          if (Cloud && Cloud.isSignedIn()) {
            var patch = { last_name: last };
            var pn = partnerName();
            if (pn) patch.display_name = pn;
            await Cloud.updateProfile(patch);
            await Cloud.pushProgress({
              active: state.active,
              data: state.data,
              done: state.done,
              calendar: state.data.calendar || {},
              cheers: state.cheers || [],
              settings: state.settings,
              tourDone: state.tourDone
            });
          }
          lastNamePromptSkipped = false;
          closeLastNamePrompt();
        } catch (e) {
          if (msg) {
            msg.textContent = "Saved on this device. Cloud sync can retry next time you’re online.";
          }
          closeLastNamePrompt();
        } finally {
          syncSave();
        }
      });
    }
    function skipForNow() {
      lastNamePromptSkipped = true;
      closeLastNamePrompt();
    }
    if (later) later.addEventListener("click", skipForNow);
    if (closeBtn) closeBtn.addEventListener("click", skipForNow);
  }

  function wireHowIGrow() {
    var overlay = document.getElementById("howGrowOverlay");
    if (!overlay || overlay.dataset.wired === "1") return;
    overlay.dataset.wired = "1";
    overlay.addEventListener("click", async function (e) {
      var t = e.target.closest("[data-how-grow-value],[data-how-grow-next],[data-how-grow-back],#howGrowStart,#howGrowLater,#howGrowClose,#howGrowSubmit");
      if (!t) return;
      if (t.hasAttribute("data-how-grow-value")) {
        var group = t.closest("[data-how-grow-group],[data-how-grow-multi]");
        if (!group) return;
        var value = t.getAttribute("data-how-grow-value");
        var isSingle = group.hasAttribute("data-how-grow-group");
        if (isSingle) {
          howGrowAnswers[group.getAttribute("data-how-grow-group")] = value;
        } else {
          var key = group.getAttribute("data-how-grow-multi");
          var list = Array.isArray(howGrowAnswers[key]) ? howGrowAnswers[key].slice() : [];
          var found = list.indexOf(value);
          if (found >= 0) list.splice(found, 1);
          else {
            var max = parseInt(group.getAttribute("data-max"), 10) || 99;
            if (list.length >= max) {
              var hint = document.getElementById("howGrowEncouragementHint");
              if (hint) hint.textContent = "You’ve ranked two — tap one to remove it first.";
              return;
            }
            list.push(value);
          }
          howGrowAnswers[key] = list;
        }
        writeHowGrowDraft();
        paintHowGrowForm();
        if (isSingle && howGrowStep > 0 && howGrowStep < HOW_GROW_TOTAL) {
          clearHowGrowAdvance();
          howGrowAdvanceTimer = setTimeout(function () {
            howGrowAdvanceTimer = null;
            showHowGrowStep(howGrowStep + 1);
          }, 280);
        }
        return;
      }
      if (t.id === "howGrowStart") { showHowGrowStep(1); return; }
      if (t.id === "howGrowLater" || t.id === "howGrowClose") {
        state.data.howGrowDeferred = true;
        save();
        closeHowIGrow();
        refreshHowGrowReminder();
        return;
      }
      if (t.hasAttribute("data-how-grow-back")) {
        collectHowGrowText();
        showHowGrowStep(howGrowStep - 1);
        return;
      }
      if (t.hasAttribute("data-how-grow-next")) {
        collectHowGrowText();
        if (!validateHowGrowStep(howGrowStep)) {
          alert(howGrowStep === 6
            ? "Pick at least one kind of encouragement before continuing."
            : howGrowStep === 7
              ? "Pick at least one recognition preference before continuing."
              : "Choose an answer before continuing.");
          return;
        }
        showHowGrowStep(howGrowStep + 1);
        return;
      }
      if (t.id === "howGrowSubmit") {
        collectHowGrowText();
        if (!validateHowGrowRequired()) {
          alert("A few choice questions are still unanswered.");
          return;
        }
        var msg = document.getElementById("howGrowMsg");
        try {
          t.disabled = true;
          if (msg) msg.textContent = "Sharing your support map…";
          await howGrowCloud().saveSupportPreferences(howGrowAnswers, true);
          state.data.howGrowDeferred = false;
          persistHowGrowResumeStep(0);
          save();
          if (msg) msg.textContent = "Shared! Your leader can now see how to best support you.";
          setTimeout(function () {
            closeHowIGrow({ skipDraftSave: true });
            try { localStorage.removeItem(HOW_GROW_DRAFT_KEY); } catch (e) {}
            try { localStorage.removeItem(HOW_GROW_STEP_KEY); } catch (e) {}
            refreshHowGrowReminder();
          }, 900);
        } catch (err) {
          if (msg) msg.textContent = (err && err.message) || "Could not save your answers.";
        } finally {
          t.disabled = false;
        }
      }
    });
    overlay.addEventListener("input", function () {
      collectHowGrowText();
    });
    document.addEventListener("click", function (e) {
      var open = e.target.closest("[data-open-how-grow],#editHowIGrowBtn");
      if (!open) return;
      if (open.id === "editHowIGrowBtn") closeHubMenu();
      openHowIGrow(true);
    });
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

    var circleNext = document.getElementById("onboardingCircleNext");
    if (circleNext) {
      circleNext.addEventListener("click", function () {
        onboardingStep = 2;
        renderOnboardingStep();
      });
    }

    var nameInput = document.getElementById("partnerNameInput");
    var lastNameInput = document.getElementById("partnerLastNameInput");
    var nameNext = document.getElementById("onboardingNameNext");
    function bindNameSync(el) {
      if (!el) return;
      ["input", "change", "blur", "keyup"].forEach(function (ev) {
        el.addEventListener(ev, syncNameNext);
      });
    }
    bindNameSync(nameInput);
    bindNameSync(lastNameInput);
    if (nameInput) {
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && nameInput.value.trim()) {
          e.preventDefault();
          if (lastNameInput) lastNameInput.focus();
        }
      });
    }
    if (lastNameInput) {
      lastNameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && nameInput && nameInput.value.trim() && lastNameInput.value.trim()) {
          e.preventDefault();
          if (nameNext) nameNext.click();
        }
      });
    }
    if (nameNext) {
      nameNext.addEventListener("click", function () {
        syncNameNext();
        if (!nameInput || !nameInput.value.trim()) return;
        if (!lastNameInput || !lastNameInput.value.trim()) return;
        state.settings.partnerName = nameInput.value.trim();
        state.settings.partnerLastName = lastNameInput.value.trim();
        save();
        onboardingStep = 3;
        renderOnboardingStep();
      });
    }

    var signInBtn = document.getElementById("onboardingSignInBtn");
    var createBtn = document.getElementById("onboardingCreateBtn");
    var skipAuth = document.getElementById("onboardingSkipAuth");
    var emailInput = document.getElementById("onboardingEmail");
    var passwordInput = document.getElementById("onboardingPassword");

    function onboardAuthMsg(text) {
      var msg = document.getElementById("onboardingAuthMsg");
      if (msg) msg.textContent = text || "";
    }

    function friendlyAuthError(err, creating) {
      var raw = ((err && err.message) || "") + "";
      var low = raw.toLowerCase();
      if (
        low.indexOf("already registered") >= 0 ||
        low.indexOf("already been registered") >= 0 ||
        low.indexOf("user already exists") >= 0
      ) {
        return "That email already has an account — tap Sign in instead.";
      }
      if (low.indexOf("invalid login") >= 0 || low.indexOf("invalid credentials") >= 0) {
        return "Email or password didn’t match. Try Sign in again, or Create account if you’re new here.";
      }
      if (low.indexOf("email confirmation") >= 0 || low.indexOf("confirm email") >= 0) {
        return "Account created — try Sign in with that email and password.";
      }
      return raw || (creating ? "Could not create account." : "Could not sign in.");
    }

    async function runOnboardAuth(creating) {
      var email = emailInput ? emailInput.value.trim() : "";
      var password = passwordInput ? passwordInput.value : "";
      var name = partnerName() || "friend";
      var last = partnerLastName();
      if (!window.FS.Cloud) {
        onboardAuthMsg("Sign-in isn’t available right now — continue and try from the top bar later.");
        return;
      }
      if (passwordInput) {
        passwordInput.setAttribute("autocomplete", creating ? "new-password" : "current-password");
      }
      var btn = creating ? createBtn : signInBtn;
      try {
        if (btn) btn.disabled = true;
        var res = creating
          ? await window.FS.Cloud.signUp(email, name, password, last)
          : await window.FS.Cloud.signIn(email, name, password);
        onboardAuthMsg(res.message || "You’re signed in.");
        if (res.kind === "local" || res.kind === "signed_in") {
          flushSave();
          if (creating && last) {
            try {
              await window.FS.Cloud.updateProfile({
                display_name: name,
                last_name: last
              });
            } catch (e) {}
          }
          if (window.FS.BridgeUI && window.FS.BridgeUI.mergeProgress) {
            try { await window.FS.BridgeUI.mergeProgress(); } catch (e) {}
          }
          if (dismissOnboardingIfModeChosen()) return;
          advanceToInstallStep();
        }
      } catch (err) {
        onboardAuthMsg(friendlyAuthError(err, creating));
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    if (emailInput) {
      emailInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (passwordInput) passwordInput.focus();
        }
      });
    }
    if (passwordInput) {
      passwordInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (signInBtn) signInBtn.click();
        }
      });
    }
    if (signInBtn) signInBtn.addEventListener("click", function () { runOnboardAuth(false); });
    if (createBtn) createBtn.addEventListener("click", function () { runOnboardAuth(true); });
    if (skipAuth) {
      skipAuth.addEventListener("click", function () {
        advanceToInstallStep();
      });
    }

    var installChoices = wrap.querySelectorAll("[data-install-platform]");
    for (var ic = 0; ic < installChoices.length; ic++) {
      installChoices[ic].addEventListener("click", function (ev) {
        selectInstallPlatform(ev.currentTarget.getAttribute("data-install-platform"));
      });
    }
    var installConfirm = document.getElementById("onboardInstallConfirm");
    if (installConfirm && !installConfirm.dataset.bound) {
      installConfirm.dataset.bound = "1";
      installConfirm.addEventListener("change", syncInstallNextEnabled);
    }
    var installNext = document.getElementById("onboardingInstallNext");
    if (installNext) {
      installNext.addEventListener("click", function () {
        if (!installPlatform && !isRunningAsInstalledApp()) return;
        if (!isRunningAsInstalledApp() && installPlatform !== "standalone") {
          var conf = document.getElementById("onboardInstallConfirm");
          if (!conf || !conf.checked) return;
          /* Still in the browser — steer them onto the Home Screen icon so storage doesn’t fork. */
          var msg = document.getElementById("onboardingInstallMsg");
          var note = (OB && OB.installSwitchNote) ||
            "Close this browser and open First Seeds from your Home Screen icon to finish setup there.";
          if (msg) msg.textContent = note;
          return;
        }
        advanceToModeStep();
      });
    }
    var installSkip = document.getElementById("onboardingInstallSkip");
    if (installSkip) {
      installSkip.addEventListener("click", function () {
        advanceToModeStep();
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

  /* ── mini tour (coachmarks near the real UI) ─────────── */
  var tourIdx = 0;
  var tourPlaceTimer = null;
  var tourTargetEl = null;
  var tourKind = "main"; /* main | team */
  var tourTipsActive = null;

  function tipSelectorList(tip) {
    var list = [];
    if (!tip) return list;
    if (Array.isArray(tip.target)) list = list.concat(tip.target);
    else if (tip.target) list.push(tip.target);
    if (Array.isArray(tip.fallbackTarget)) list = list.concat(tip.fallbackTarget);
    else if (tip.fallbackTarget) list.push(tip.fallbackTarget);
    return list;
  }

  function isTourTargetVisible(el) {
    if (!el || el.hidden) return false;
    if (el.closest && el.closest("[hidden]")) return false;
    var r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }

  function resolveTourTarget(tip) {
    var sels = tipSelectorList(tip);
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (isTourTargetVisible(el)) return { el: el, selector: sels[i] };
    }
    return null;
  }

  function tipHasVisibleTarget(tip) {
    return !!resolveTourTarget(tip);
  }

  function buildTeamTourTips() {
    var tips = CFG.teamTour || [];
    var out = [];
    for (var i = 0; i < tips.length; i++) {
      var tip = tips[i];
      if (tip && tip.optional && !tipHasVisibleTarget(tip)) continue;
      out.push(tip);
    }
    return out;
  }

  function currentTourTips() {
    if (tourTipsActive) return tourTipsActive;
    if (tourKind === "team") return CFG.teamTour || [];
    return CFG.tour || [];
  }

  function clearTourHighlight(opts) {
    opts = opts || {};
    if (tourTargetEl) {
      tourTargetEl.classList.remove("tour-target-on");
      tourTargetEl = null;
    }
    var leftovers = document.querySelectorAll(".tour-target-on");
    for (var i = 0; i < leftovers.length; i++) leftovers[i].classList.remove("tour-target-on");
    if (opts.hideSpot) {
      var spot = document.getElementById("tourSpotlight");
      if (spot) {
        spot.hidden = true;
        spot.style.cssText = "";
      }
      document.body.classList.remove("tour-reveal-grove");
    }
  }

  function centerTourCard(opts) {
    opts = opts || {};
    var card = document.getElementById("tourCard");
    var spot = document.getElementById("tourSpotlight");
    if (spot && opts.hideSpot) spot.hidden = true;
    if (!card) return;
    card.style.top = "50%";
    card.style.left = "50%";
    card.style.right = "auto";
    card.style.bottom = "auto";
    card.style.transform = "translate(-50%, -50%)";
  }

  /* Open collapsed details only when this tip needs mentoring targets */
  function prepareTeamTourTarget(tip) {
    if (tourKind !== "team") return;
    var sels = tipSelectorList(tip);
    if (!sels.length && !(tip && (tip.openCheerSheet || tip.openNoteSheet))) return;
    var Bridge = window.FS.BridgeUI;
    if (tip.openCheerSheet && Bridge && typeof Bridge.openCheerSheetForTour === "function") {
      if (Bridge.closeNoteSheet) Bridge.closeNoteSheet();
      Bridge.openCheerSheetForTour();
    } else if (tip.openNoteSheet && Bridge && typeof Bridge.openNoteSheetForTour === "function") {
      if (Bridge.closeCheerSheet) Bridge.closeCheerSheet();
      Bridge.openNoteSheetForTour();
    } else {
      if (Bridge && typeof Bridge.closeCheerSheet === "function") Bridge.closeCheerSheet();
      if (Bridge && typeof Bridge.closeNoteSheet === "function") Bridge.closeNoteSheet();
    }
    var joined = sels.join(" ");
    var needsMentorOpen = /nudge|cheer|note|mentor|leader-col|leaderLists|how-grow-snapshot/.test(joined);
    if (needsMentorOpen || tip.openCheerSheet || tip.openNoteSheet) {
      var cols = document.querySelectorAll("#leaderLists details.leader-col");
      for (var i = 0; i < cols.length; i++) cols[i].open = true;
      var firstCard = document.querySelector("#leaderLists details.leader-card");
      if (firstCard) firstCard.open = true;
    }
    var resolved = resolveTourTarget(tip);
    var el = resolved && resolved.el;
    if (!el) return;
    var node = el;
    while (node && node !== document.body) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
  }

  function placeTourChrome(targetEl, tipOrPlacement) {
    var card = document.getElementById("tourCard");
    var spot = document.getElementById("tourSpotlight");
    if (!card || !targetEl) {
      centerTourCard({ keepSpot: true });
      return;
    }

    var tip = (tipOrPlacement && typeof tipOrPlacement === "object") ? tipOrPlacement : null;
    var placement = tip ? (tip.placement || "auto") : (tipOrPlacement || "auto");
    var fullSpot = !!(tip && tip.fullSpot);
    var isNav = !!(targetEl.closest && targetEl.closest(".bottom-nav"));

    var pad = isNav ? 6 : 8;
    var gap = 12;
    /* Leave room above bottom nav for tips — but let the spotlight cover nav buttons fully */
    var navSafe = isNav ? 6 : 78;
    var rect = targetEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (rect.width < 2 && rect.height < 2) {
      centerTourCard({ keepSpot: true });
      return;
    }

    var maxSpotH = fullSpot
      ? Math.max(160, Math.min(rect.height + pad * 2, vh - navSafe - 200))
      : isNav
        ? Math.max(rect.height + pad * 2, 56)
        : Math.max(64, Math.floor(vh * 0.28));
    var spotH = Math.min(rect.height + pad * 2, maxSpotH);
    var spotTop = Math.max(6, rect.top - pad);
    var spotLeft = Math.max(6, rect.left - pad);
    var spotRight = Math.min(vw - 6, rect.right + pad);
    var spotBottom = Math.min(vh - navSafe, spotTop + spotH);
    if (isNav) {
      /* Wrap the real tab — don't clamp away from the bottom edge */
      spotTop = Math.max(6, rect.top - pad);
      spotBottom = Math.min(vh - 4, rect.bottom + pad);
      spotH = spotBottom - spotTop;
    } else if (spotBottom > vh - navSafe) {
      spotBottom = vh - navSafe;
      spotTop = Math.max(6, spotBottom - spotH);
    }

    if (spot) {
      spot.hidden = false;
      spot.style.top = spotTop + "px";
      spot.style.left = spotLeft + "px";
      spot.style.width = Math.max(24, spotRight - spotLeft) + "px";
      spot.style.height = Math.max(24, spotBottom - spotTop) + "px";
      spot.style.borderRadius = isNav || targetEl.closest(".bottom-nav-btn") ? "16px" : "14px";
    }

    card.style.transform = "none";
    var cardW = Math.min(360, vw - 24);
    card.style.width = cardW + "px";
    card.style.maxWidth = cardW + "px";
    var cardH = card.offsetHeight || 200;

    var spaceBelow = vh - spotBottom - gap - (isNav ? 8 : 72);
    var spaceAbove = spotTop - gap;
    var place = placement || "auto";
    var tall = fullSpot || rect.height > vh * 0.36;

    if (isNav) place = "above";
    else if (place === "auto" || (tall && place !== "above" && place !== "below")) {
      place = spaceAbove >= cardH + 8 ? "above" : (spaceBelow >= cardH + 8 ? "below" : "center");
    }
    if (!isNav) {
      if (place === "below" && spaceBelow < Math.min(cardH, 130) && spaceAbove > spaceBelow) place = "above";
      if (place === "above" && spaceAbove < Math.min(cardH, 130) && spaceBelow > spaceAbove) place = "below";
      if (spotBottom > vh * 0.62 && spaceAbove >= Math.min(cardH, 140)) place = "above";
      if (fullSpot && spaceAbove >= Math.min(cardH, 120)) place = "above";
    }

    if (place === "center") {
      centerTourCard({ keepSpot: true });
      return;
    }

    var top;
    if (place === "above") top = spotTop - gap - cardH;
    else top = spotBottom + gap;

    var left = spotLeft + ((spotRight - spotLeft) / 2) - (cardW / 2);
    left = Math.min(Math.max(12, left), vw - cardW - 12);
    top = Math.min(Math.max(12, top), vh - cardH - (isNav ? 12 : 78));

    card.style.top = top + "px";
    card.style.left = left + "px";
    card.style.right = "auto";
    card.style.bottom = "auto";
  }

  function scrollTourTargetIntoView(el, tip) {
    if (!el) return;
    if (el.closest && el.closest(".bottom-nav")) return; /* fixed chrome — never scroll the page for it */
    var node = el;
    while (node && node !== document.body) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
    var locked = document.body.classList.contains("overlay-open");
    if (locked) document.body.classList.remove("overlay-open");
    try {
      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var fullSpot = !!(tip && tip.fullSpot);
      var tipRoom = 200;
      var needsScroll = fullSpot
        ? (rect.top < tipRoom - 24 || rect.top > vh - 176)
        : (rect.top < 64 || rect.bottom > vh - 88);
      if (needsScroll) {
        if (fullSpot) window.scrollBy(0, rect.top - tipRoom);
        else if (rect.top < 64) window.scrollBy(0, rect.top - 80);
        else window.scrollBy(0, rect.bottom - (vh - 100));
      }
    } catch (err) {
      try { el.scrollIntoView({ block: "nearest", behavior: "auto" }); } catch (err2) { /* ignore */ }
    }
    if (locked) document.body.classList.add("overlay-open");
  }

  function mainTourNeedsGroveReveal() {
    var tips = CFG.tour || [];
    for (var i = 0; i < tips.length; i++) {
      if (tips[i] && tips[i].revealGroveTab) return true;
    }
    return false;
  }

  function scheduleTourPlacement(tip) {
    clearTimeout(tourPlaceTimer);
    clearTourHighlight(); /* keep spotlight visible between steps */

    /* Soft start: keep Grove visible for the whole main tour so Learn→Grove doesn't reflow mid-step */
    if (tourKind === "main" && mainTourNeedsGroveReveal()) {
      document.body.classList.add("tour-reveal-grove");
    } else {
      document.body.classList.toggle("tour-reveal-grove", !!(tip && tip.revealGroveTab));
    }

    var attempts = 0;
    var isSheet = !!(tip && (tip.openCheerSheet || tip.openNoteSheet));
    var isNav = !!(tip && tip.target && String(tip.target).indexOf("bottomNav") >= 0);
    var settleMs = isSheet ? 160 : (tip && tip.fullSpot) ? 140 : (isNav ? 100 : 70);

    var tryPlace = function () {
      prepareTeamTourTarget(tip);
      var resolved = resolveTourTarget(tip);
      var el = resolved && resolved.el;
      if (!el && attempts < 14) {
        attempts++;
        tourPlaceTimer = setTimeout(tryPlace, 70);
        return;
      }
      if (!el) {
        centerTourCard({ keepSpot: true });
        return;
      }
      tourTargetEl = el;
      el.classList.add("tour-target-on");
      scrollTourTargetIntoView(el, tip);
      tourPlaceTimer = setTimeout(function () {
        if (!tourTargetEl) return;
        /* Re-query after reveal/layout — Soft start Grove tab can shift nav buttons */
        var freshResolved = resolveTourTarget(tip);
        var fresh = freshResolved && freshResolved.el;
        if (fresh && fresh !== tourTargetEl) {
          tourTargetEl.classList.remove("tour-target-on");
          tourTargetEl = fresh;
          tourTargetEl.classList.add("tour-target-on");
        }
        placeTourChrome(tourTargetEl, tip);
      }, settleMs);
    };

    /* Let CSS reveal (Grove tab) paint before first measure */
    requestAnimationFrame(function () {
      requestAnimationFrame(tryPlace);
    });
  }

  function startTour() {
    var wrap = document.getElementById("tour");
    if (wrap && wrap.classList.contains("open")) return;
    tourKind = "main";
    tourTipsActive = CFG.tour || [];
    var tips = currentTourTips();
    if (!wrap || !tips.length) {
      tourTipsActive = null;
      state.tourDone = true;
      save();
      syncOverlayBodyLock();
      return;
    }
    tourIdx = 0;
    /* Reveal Grove for Soft start before step 1 so Learn/Grove highlights don't reflow */
    if (mainTourNeedsGroveReveal()) document.body.classList.add("tour-reveal-grove");
    wrap.classList.add("open");
    setOverlayOpen(true);
    centerTourCard();
    /* Brief beat so bottom nav can settle with Grove visible */
    setTimeout(function () { renderTourStep(); }, mainTourNeedsGroveReveal() ? 80 : 0);
  }

  function startTeamTour(opts) {
    opts = opts || {};
    var wrap = document.getElementById("tour");
    if (!wrap) return;
    if (wrap.classList.contains("open")) return;
    if (!opts.replay && state.data.teamTourDone) return;
    tourKind = "team";
    tourTipsActive = buildTeamTourTips();
    var tips = currentTourTips();
    if (!tips.length) {
      tourTipsActive = null;
      if (!opts.replay) {
        state.data.teamTourDone = true;
        save();
      }
      return;
    }
    tourIdx = 0;
    state.active = "leader";
    save();
    renderNav();
    renderPanels();
    wrap.classList.add("open");
    setOverlayOpen(true);
    centerTourCard();
    /* Wait until Team UI (tree / mentoring) has painted — renderLeader is async */
    var tries = 0;
    var waitReady = function () {
      var ready = document.querySelector("#liveTeamGraph:not([hidden]) .live-team-head, #leaderLists .leader-card, #leaderLists .leader-empty");
      if (ready || tries >= 20) {
        prepareTeamTourTarget(tips[0]);
        renderTourStep();
        return;
      }
      tries++;
      setTimeout(waitReady, 100);
    };
    setTimeout(waitReady, 200);
  }

  function maybeStartTeamTour(count) {
    /* Auto-show once: first time someone is on their live team — never again unless Settings → Replay Grove tour.
       Do NOT reset on teamTourVersion bumps (that was re-showing the tour for everyone). */
    if (!count || count < 1) return;
    if (state.data.teamTourDone) return;
    if (!state.tourDone) return; /* finish home tour first */
    var wrap = document.getElementById("tour");
    if (wrap && wrap.classList.contains("open")) return;
    if (state.active !== "leader") return;
    startTeamTour();
  }
  window.FS.maybeStartTeamTour = maybeStartTeamTour;

  function replayTeamTourFromSettings() {
    closeHubMenu();
    startTeamTour({ replay: true });
  }

  function renderTourStep() {
    var tips = currentTourTips();
    var tip = tips[tourIdx];
    if (!tip) return;
    setText("tourTitle", tip.title);
    setText("tourBody", tip.body);
    var next = document.getElementById("tourNext");
    if (next) {
      if (tourKind === "team") {
        next.textContent = tourIdx >= tips.length - 1 ? "Got it — let's mentor →" : "Next";
      } else {
        next.textContent = tourIdx >= tips.length - 1 ? "Let's start on Sprout →" : "Next";
      }
    }
    var dots = document.getElementById("tourDots");
    if (dots) {
      dots.innerHTML = "";
      for (var i = 0; i < tips.length; i++) {
        var iEl = document.createElement("i");
        if (i === tourIdx) iEl.className = "on";
        dots.appendChild(iEl);
      }
    }

    if (tip.panel && state.active !== tip.panel) {
      state.active = tip.panel;
      save();
      renderNav();
      renderPanels();
    }

    scheduleTourPlacement(tip);
  }

  function finishTour() {
    clearTimeout(tourPlaceTimer);
    clearTourHighlight({ hideSpot: true });
    if (window.FS.BridgeUI) {
      if (typeof window.FS.BridgeUI.closeCheerSheet === "function") window.FS.BridgeUI.closeCheerSheet();
      if (typeof window.FS.BridgeUI.closeNoteSheet === "function") window.FS.BridgeUI.closeNoteSheet();
    }
    var wrap = document.getElementById("tour");
    if (wrap) wrap.classList.remove("open");
    var card = document.getElementById("tourCard");
    if (card) {
      card.style.cssText = "";
    }
    if (tourKind === "team") {
      state.data.teamTourDone = true;
      state.data.teamTourVer = CFG.teamTourVersion || 1;
    } else {
      state.tourDone = true;
    }
    tourKind = "main";
    tourTipsActive = null;
    save();
    syncOverlayBodyLock();
    renderGreetings();
    setTimeout(maybeOfferHowIGrow, 250);
    setTimeout(maybeOfferLastName, 700);
  }

  function wireTour() {
    var next = document.getElementById("tourNext");
    if (!next || next.dataset.wired === "1") return;
    next.dataset.wired = "1";
    next.addEventListener("click", function () {
      var tips = currentTourTips();
      if (tourIdx >= tips.length - 1) return finishTour();
      tourIdx++;
      renderTourStep();
    });
    window.addEventListener("resize", function () {
      var wrap = document.getElementById("tour");
      if (!wrap || !wrap.classList.contains("open")) return;
      var tips = currentTourTips();
      var tip = tips[tourIdx];
      if (tip && tourTargetEl) placeTourChrome(tourTargetEl, tip);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var tourWrap = document.getElementById("tour");
      if (tourWrap && tourWrap.classList.contains("open")) {
        finishTour();
        return;
      }
      closeHubMenu();
      setRoadmapOpen(false);
      closeGrowthMoment();
    }
  });

  /* ── clicks ──────────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto],[data-complete],[data-grove-pick],[data-prod-nav],[data-prod-open],[data-prod-fav],[data-prod-scope],[data-choice],[data-rhythm],[data-copy],[data-tadd],[data-tstatus],[data-tdel],[data-seedtype],[data-menu-goto],[data-soft-unlock],[data-faq],[data-talk],[data-talk-cat],[data-copy-toggle],#exportBtn,#exportBtn2,#resetBtn,#replayOnboardingBtn,#replayTeamTourBtn,#modeStarter,#modeFull,#lockToastUnlockFull,#todayUnlockFull,#leadPageBuiltIn,#leadPageCustom,#levelUpBtn,#settingsNavBtn,#menuCloseBtn,#menuCloseBackdrop,#todayAuthBtn,#lockToastClose");
    if (!t) return;

    if (t.hasAttribute("data-prod-fav")) {
      e.preventDefault();
      e.stopPropagation();
      var beforeSproutFav = lastSprout;
      var favId = t.getAttribute("data-prod-fav");
      toggleProductFavorite(favId);
      save();
      syncFavHeartButtons(favId);
      var browseFav = ensureProductBrowse();
      /* Favorites list membership changed — refresh results without remounting thumbs elsewhere. */
      if (browseFav.scope === "favorites" && !browseFav.productId) {
        updateProductBrowseResults();
      }
      refreshAllShortlists();
      refreshButtons();
      renderModuleChecklists();
      renderTodayCard();
      liveRefresh({ silent: true });
      if (checklistProgress().sproutDone > beforeSproutFav) {
        lastSprout = beforeSproutFav;
        renderPlant({});
      }
      return;
    }
    if (t.hasAttribute("data-prod-scope")) {
      var browseScope = ensureProductBrowse();
      browseScope.scope = t.getAttribute("data-prod-scope") === "favorites" ? "favorites" : "all";
      browseScope.productId = null;
      if (browseScope.scope === "favorites") {
        browseScope.category = null;
        browseScope.subcategory = null;
      }
      save();
      renderProductLibrary();
      return;
    }
    if (t.hasAttribute("data-talk-cat")) {
      var talkCat = t.getAttribute("data-talk-cat");
      if (!state.data.talkCatOpen || typeof state.data.talkCatOpen !== "object") {
        state.data.talkCatOpen = {};
      }
      state.data.talkCatOpen[talkCat] = !state.data.talkCatOpen[talkCat];
      save();
      renderTalkGuide((window.FS.CONTENT || {}).talkGuide);
      return;
    }
    if (t.hasAttribute("data-talk")) {
      var talkId = t.getAttribute("data-talk");
      state.data.openTalk = state.data.openTalk === talkId ? "" : talkId;
      save();
      renderTalkGuide((window.FS.CONTENT || {}).talkGuide);
      return;
    }
    if (t.hasAttribute("data-faq")) {
      var faqId = t.getAttribute("data-faq");
      state.data.openFaq = state.data.openFaq === faqId ? "" : faqId;
      save();
      renderKnowPanel();
      return;
    }
    if (t.hasAttribute("data-copy-toggle")) {
      var body = document.getElementById(t.getAttribute("data-copy-toggle") + "_body");
      var card = t.closest(".copy-card");
      if (body) {
        var willOpen = body.hidden;
        body.hidden = !willOpen;
        if (card) card.classList.toggle("open", willOpen);
        var chev = t.querySelector(".copy-card-chev");
        if (chev) chev.textContent = willOpen ? "−" : "+";
      }
      return;
    }

    if (t.id === "todayAuthBtn") {
      if (window.FS.BridgeUI && window.FS.BridgeUI.openAuth) window.FS.BridgeUI.openAuth(true);
      return;
    }
    if (t.id === "settingsNavBtn") { openHubMenu(); return; }
    if (t.id === "menuCloseBtn" || t.id === "menuCloseBackdrop") { closeHubMenu(); return; }
    if (t.id === "lockToastClose") { hideLockToast(); return; }
    if (t.hasAttribute("data-soft-unlock")) {
      var unlockId = t.getAttribute("data-soft-unlock");
      ensureSoftUnlockMap();
      state.data.softUnlock[unlockId] = true;
      state.active = unlockId;
      save();
      hideLockToast();
      renderNav();
      renderPanels();
      renderModuleChecklists();
      return;
    }
    if (t.hasAttribute("data-menu-goto")) {
      var dest = t.getAttribute("data-menu-goto");
      if (dest === "calendar") dest = "tend";
      closeHubMenu();
      hideLockToast();
      state.active = dest;
      save();
      renderNav();
      renderPanels();
      return;
    }

    if (t.id === "modeStarter") {
      setHubMode("starter");
      return;
    }
    if (t.id === "modeFull" || t.id === "lockToastUnlockFull" || t.id === "todayUnlockFull" || t.id === "levelUpBtn") {
      setHubMode("full");
      if (t.id === "levelUpBtn" || t.id === "todayUnlockFull") {
        closeHubMenu();
        state.active = "welcome";
        save();
        renderNav();
        renderPanels();
        renderTodayCard();
        renderFinishCopy();
      }
      return;
    }
    if (t.id === "leadPageBuiltIn") {
      setPageChoice("generic", { openLeads: true });
      closeHubMenu();
      return;
    }
    if (t.id === "leadPageCustom") {
      setPageChoice("custom");
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
      if (goto === "calendar") goto = "tend";
      if (goto === "leader" && !isFull()) {
        showGrowthToast("Grove unlocks on All in — switch your pace in Settings anytime.");
        return;
      }
      if (isContentSurface(goto) && !isFull()) {
        var lockEl = document.getElementById("lockToast");
        if (lockEl) {
          lockEl.hidden = false;
          lockEl.innerHTML =
            '<div class="lock-toast-inner">' +
            "<p><strong>Content</strong> unlocks on All in — calendar, post vault, stories, and photos.</p>" +
            '<div class="lock-toast-actions">' +
            '<button type="button" class="btn" id="lockToastUnlockFull">Unlock All in →</button>' +
            '<button type="button" class="lock-toast-x" id="lockToastClose" aria-label="Dismiss">×</button>' +
            "</div></div>";
        }
        return;
      }
      if (goto === "products") {
        ensureProductBrowse();
        state.productBrowse.category = null;
        state.productBrowse.subcategory = null;
        state.productBrowse.productId = null;
        hideLockToast();
        closeHubMenu();
        state.active = "products";
        save(); renderNav(); renderPanels();
        return;
      }
      if (goto === "curiosity-photos") {
        hideLockToast();
        closeHubMenu();
        state.active = "curiosity-photos";
        save(); renderNav(); renderPanels();
        return;
      }
      if (goto === "content-stories") {
        hideLockToast();
        closeHubMenu();
        if (!state.data.vaultBrowse) state.data.vaultBrowse = {};
        if (!state.data.vaultBrowse.vault) state.data.vaultBrowse.vault = { q: "", format: "", promoting: "", lane: "all" };
        state.data.vaultBrowse.vault.format = "story";
        state.active = "content-vault";
        save(); renderNav(); renderPanels();
        return;
      }
      if (goto === "content-vault" || goto === "content-week") {
        hideLockToast();
        closeHubMenu();
        state.active = goto;
        save(); renderNav(); renderPanels();
        return;
      }
      if (goto === "talk") {
        hideLockToast();
        closeHubMenu();
        var beforeTalk = lastSprout;
        state.active = "talk";
        markTalkOpened();
        save(); renderNav(); renderPanels();
        if (checklistProgress().sproutDone > beforeTalk) {
          lastSprout = beforeTalk;
          renderPlant({});
        }
        return;
      }
      if (goto === "leads" && usesCustomLanding()) {
        showGrowthToast("Leads is off while you use a custom-built page — switch to In-app lead page in Settings.");
        return;
      }
      if (goto !== "welcome" && goto !== "done" && goto !== "calendar" && goto !== "leader" && goto !== "know" && goto !== "tend" && goto !== "products" && goto !== "talk" && goto !== "curiosity-photos" && goto !== "content-vault" && goto !== "content-stories" && goto !== "content-week" && goto !== "leads" && !sectionVisible(goto)) return;
      if (goto !== "welcome" && goto !== "done" && goto !== "calendar" && goto !== "leader" && goto !== "know" && goto !== "tend" && goto !== "products" && goto !== "talk" && goto !== "curiosity-photos" && goto !== "content-vault" && goto !== "content-stories" && goto !== "content-week" && goto !== "leads" && !isModuleUnlocked(goto)) {
        showLockToast(goto);
        return;
      }
      hideLockToast();
      closeHubMenu();
      state.active = goto;
      save(); renderNav(); renderPanels();
      return;
    }
    if (t.hasAttribute("data-prod-nav") || t.hasAttribute("data-prod-open")) {
      var browseNav = ensureProductBrowse();
      var wasOnProducts = state.active === "products";
      var openingDetail = t.hasAttribute("data-prod-open");
      var keepScroll = false;
      if (openingDetail) {
        browseNav.productId = t.getAttribute("data-prod-open");
        var retPanel = t.getAttribute("data-prod-return");
        if (retPanel) {
          browseNav.returnTo = {
            panel: retPanel,
            label: t.getAttribute("data-prod-return-label") || "Back"
          };
        } else {
          browseNav.returnTo = null;
        }
      } else {
        var navMode = t.getAttribute("data-prod-nav");
        browseNav.productId = null;
        if (navMode === "return") {
          var retTo = browseNav.returnTo;
          browseNav.returnTo = null;
          if (retTo && retTo.panel) {
            state.active = retTo.panel;
            save();
            renderNav();
            renderPanels();
            window.scrollTo(0, 0);
            return;
          }
          browseNav.scope = "favorites";
          browseNav.category = null;
          browseNav.subcategory = null;
        } else if (navMode === "hub") {
          browseNav.category = null;
          browseNav.subcategory = null;
          browseNav.scope = "all";
          browseNav.returnTo = null;
        } else if (navMode === "favorites") {
          browseNav.scope = "favorites";
          browseNav.category = null;
          browseNav.subcategory = null;
          browseNav.q = "";
          browseNav.returnTo = null;
        } else if (navMode === "cat") {
          browseNav.scope = "all";
          browseNav.returnTo = null;
          var nextCat = t.getAttribute("data-prod-cat") || null;
          /* Subcategory chips — stay put instead of jumping to the top */
          keepScroll = wasOnProducts && t.hasAttribute("data-prod-sub") && browseNav.category === nextCat;
          browseNav.category = nextCat;
          if (t.hasAttribute("data-prod-sub")) {
            browseNav.subcategory = t.getAttribute("data-prod-sub") || null;
          } else {
            browseNav.subcategory = null;
          }
        }
      }
      state.active = "products";
      save();
      if (keepScroll) {
        var y = window.scrollY || window.pageYOffset || 0;
        renderProductLibrary();
        requestAnimationFrame(function () {
          window.scrollTo(0, y);
        });
      } else {
        renderNav();
        renderPanels();
      }
      return;
    }
    if (t.hasAttribute("data-complete")) {
      var id = t.getAttribute("data-complete");
      if (!canComplete(id)) return;
      var wasNew = !state.done[id];
      state.done[id] = true;
      if (id === "grove") syncGroveCalendar();
      var nxt = nextAfter(id) || "done";
      /* If next is locked somehow, still allow — completing prior unlocks it */
      state.active = nxt;
      save(); renderNav(); renderPlant(); renderPanels(); refreshButtons(); renderFinishCopy(); renderModuleChecklists(); renderTodayCard();
      hideLockToast();
      if (wasNew) {
        var r = t.getBoundingClientRect();
        leafBurst(r.left + r.width / 2, r.top);
      }
      return;
    }
    if (t.hasAttribute("data-grove-pick")) {
      var beforeGroveSprout = lastSprout;
      var lane = t.getAttribute("data-grove-pick");
      var idx = parseInt(t.getAttribute("data-grove-idx"), 10);
      var pool = lane === "warm" ? groveNames() : customerNames();
      var pickName = pool[idx] || "";
      toggleGrovePick(lane, pickName);
      save();
      liveRefresh({ silent: true });
      if (checklistProgress().sproutDone > beforeGroveSprout) {
        lastSprout = beforeGroveSprout;
        renderPlant({});
      }
      flash("grove");
      return;
    }
    if (t.hasAttribute("data-choice")) {
      var beforeSprout = lastSprout;
      var choiceKey = t.getAttribute("data-choice");
      var choiceVal = t.getAttribute("data-value");
      if (choiceKey === "page_choice") {
        setPageChoice(choiceVal);
        if (checklistProgress().sproutDone > beforeSprout) {
          lastSprout = beforeSprout;
          renderPlant({});
        }
        flash(sectionOf(t));
        return;
      }
      state.data[choiceKey] = choiceVal;
      save(); renderChoices(); liveRefresh({ silent: true });
      if (checklistProgress().sproutDone > beforeSprout) {
        lastSprout = beforeSprout;
        renderPlant({});
      }
      flash(sectionOf(t));
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
        save(); Tree.render(state); liveRefresh({ silent: true }); renderModuleChecklists(); refreshButtons(); flash("tree");
        var inputs = document.querySelectorAll(".tnode-name");
        for (var n = inputs.length - 1; n >= 0; n--) {
          if (!inputs[n].value) { inputs[n].focus(); break; }
        }
      }
      return;
    }
    if (t.hasAttribute("data-tstatus")) {
      if (Tree.toggleStatus(state, t.getAttribute("data-tstatus"))) {
        save(); Tree.render(state); liveRefresh({ silent: true }); renderModuleChecklists(); refreshButtons(); flash("tree");
      }
      return;
    }
    if (t.hasAttribute("data-tdel")) {
      if (Tree.remove(state, t.getAttribute("data-tdel"))) {
        save(); Tree.render(state); liveRefresh({ silent: true }); renderModuleChecklists(); refreshButtons(); flash("tree");
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
    if (t.id === "replayOnboardingBtn") { replayOnboardingFromSettings(); return; }
    if (t.id === "replayTeamTourBtn") { replayTeamTourFromSettings(); return; }
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
        /* If signed in, push the blank slate so cloud can't resurrect old Growth. */
        if (window.FS.BridgeUI && window.FS.BridgeUI.syncNow) {
          window.FS.BridgeUI.syncNow().catch(function () {});
        }
      }
      return;
    }
  });

  /* ── export ──────────────────────────────────────────── */
  function exportAnswers() {
    var d = state.data;
    var treeC = Tree.counts(Tree.ensure(state));
    var name = partnerName();
    var modeLabel = isStarter() ? "Soft start" : isFull() ? "All in" : "—";
    if (MODES.starter && isStarter()) modeLabel = MODES.starter.label || modeLabel;
    if (MODES.full && isFull()) modeLabel = MODES.full.label || modeLabel;
    var lines = ["FIRST SEEDS — my launch runway"];
    if (name) lines.push("Partner: " + name);
    lines = lines.concat([
      "Mode: " + modeLabel,
      "saved " + new Date().toLocaleDateString(), "",
      "═══ 01 · MY ROOTS ═══",
      "My why:", d.why || "—", "",
      "My Ringana moment:", d.moment || "—", "",
      "Why I said yes:", d.said_yes || "—", "",
      "═══ MY GROVE · CUSTOMERS (" + customerNames().length + " names) ═══",
      d.customers || "—", "",
      "First customer chats:", (grovePicks("customer_first").join(", ") || "—"), "",
      "═══ MY GROVE · PARTNERS · optional (" + groveNames().length + " names) ═══",
      d.warm || "—", "",
      "First partner chats:", (grovePicks("warm_first").join(", ") || "—"), ""
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

    if (isFull() || anySeedDraft()) {
      lines = lines.concat([
        "═══ MY STARTER TRIO (Post Studio) ═══",
        "My curiosity post ✨:", d.seed_open || "—", "",
        "Behind the scenes 🎬:", d.seed_curtain || "—", "",
        "Honest note 📝:", d.seed_honest || "—", "",
        "Values post 🚩:", d.seed_values || d.seed_value || "—", "",
        "My soft invite 🚪:", d.seed_invite || "—", "",
        "(Cadence: share value a few times, then one soft invite)", ""
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
  window.FS.onCalendarChange = function () {
    var beforeSprout = lastSprout;
    if (canComplete("tend") && !state.done.tend) {
      state.done.tend = true;
      save();
    }
    refreshButtons();
    renderModuleChecklists();
    renderTodayCard();
    liveRefresh({ silent: true });
    if (checklistProgress().sproutDone > beforeSprout) {
      lastSprout = beforeSprout;
      renderPlant({});
    }
  };

  renderBrand();
  wireOnboarding();
  wireHowIGrow();
  wireLastNamePrompt();
  wireGrowthSettings();
  wireSettingsName();
  wireWeekStartSettings();
  syncGrowthSettingsUI();
  syncWeekStartSettingsUI();
  wireTour();
  updateModeUI();
  renderNav();
  renderPanels();
  renderChoices();
  renderRhythms();
  renderSeedTypes();
  renderHooks();
  renderContentBanks();
  renderKnowPanel();
  Tree.render(state);
  renderCountdowns();
  wireRoadmapHover();
  var keys = ["why", "moment", "said_yes", "page_story", "seed_open", "seed_value", "seed_curtain", "seed_honest", "seed_values", "seed_invite"];
  for (var ki = 0; ki < keys.length; ki++) runClaimCheck(keys[ki]);
  liveRefresh({ silent: true });
  setInterval(renderCountdowns, 60000);

  window.FS.onAuthReady = function () {
    liveRefresh({ silent: true });
    syncPageStoryToLeadBlurb();
    var split = splitFullNameIfNeeded();
    if (cloudSignedIn() && !partnerLastName()) {
      var u = howGrowCloud() && howGrowCloud().user ? howGrowCloud().user() : null;
      if (u && u.last_name) {
        state.settings.partnerLastName = String(u.last_name).trim();
        split = true;
      }
    }
    if (split) {
      save();
      try {
        var Cloud = howGrowCloud();
        if (Cloud && Cloud.isSignedIn() && partnerLastName()) {
          Cloud.updateProfile({
            display_name: partnerName(),
            last_name: partnerLastName()
          }).catch(function () {});
        }
      } catch (e) {}
    }
    if (dismissOnboardingIfModeChosen()) {
      if (!state.tourDone) startTour();
      else setTimeout(maybeOfferLastName, 500);
      return;
    }
    var wrap = document.getElementById("onboarding");
    if (!wrap || !wrap.classList.contains("open")) {
      setTimeout(maybeOfferLastName, 500);
      return;
    }
    if (partnerName() && cloudSignedIn()) {
      onboardingStep = 4;
      renderOnboardingStep();
    } else if (partnerName() || hasLocalRootsProgress()) {
      onboardingStep = partnerName() ? 3 : 2;
      renderOnboardingStep();
    }
  };

  function finishBootGate() {
    if (dismissOnboardingIfModeChosen()) {
      if (!state.tourDone) startTour();
      else {
        refreshHowGrowReminder();
        setTimeout(maybeOfferLastName, 600);
      }
      return;
    }
    if (!modeChosen()) startOnboarding();
    refreshHowGrowReminder();
  }

  if (window.FS.BridgeUI) {
    /* Open the gate from local state right away; cloud merge may dismiss it. */
    if (!modeChosen()) startOnboarding();
    window.FS.BridgeUI.init({
      getState: function () { return state; },
      setStateFromCloud: function (next) {
        state.data = next.data || state.data;
        state.done = next.done || state.done;
        state.active = next.active || state.active;
        if (state.active === "calendar") state.active = "tend";
        state.settings = next.settings || state.settings;
        ensureSettings();
        state.tourDone = !!next.tourDone;
        state.cheers = next.cheers || [];
        if (!state.data.calendar) state.data.calendar = {};
        /* hydrate fields — don't clobber a focused input mid-edit */
        var fs = document.querySelectorAll("[data-key]");
        for (var j = 0; j < fs.length; j++) {
          if (document.activeElement === fs[j]) continue;
          var k = fs[j].getAttribute("data-key");
          if (state.data[k] != null) fs[j].value = state.data[k];
        }
        save();
        updateModeUI();
        renderNav();
        renderPanels();
        renderChoices();
        renderRhythms();
        renderSeedTypes();
        Tree.render(state);
        liveRefresh({ silent: true });
        renderGreetings();
        /* Cloud may restore hubMode after onboarding already opened — drop the gate. */
        dismissOnboardingIfModeChosen();
      },
      persist: function () { save(); },
      gotoPanel: function (id) {
        if (id === "leads" && usesCustomLanding()) {
          showGrowthToast("Leads is off while you use a custom-built page — switch to In-app lead page in Settings.");
          return;
        }
        if (id === "calendar") id = "tend";
        if (id === "content-stories") {
          if (!state.data.vaultBrowse) state.data.vaultBrowse = {};
          if (!state.data.vaultBrowse.vault) state.data.vaultBrowse.vault = { q: "", format: "", promoting: "", lane: "all" };
          state.data.vaultBrowse.vault.format = "story";
          id = "content-vault";
        }
        if (id === "curiosity-photos" || id === "products" || id === "talk" || id === "tend" || id === "know" || id === "content-vault" || id === "content-week") {
          hideLockToast();
          state.active = id;
          save();
          renderNav();
          renderPanels();
          return;
        }
        if (id !== "welcome" && id !== "done" && id !== "calendar" && id !== "leader" && id !== "know" && id !== "talk" && id !== "products" && id !== "leads" && !isModuleUnlocked(id)) {
          showLockToast(id);
          return;
        }
        hideLockToast();
        state.active = id;
        save();
        renderNav();
        renderPanels();
      }
    }).then(finishBootGate).catch(finishBootGate);
  } else {
    finishBootGate();
  }

  /* Deep link back from lead-page preview */
  try {
    var bootParams = new URLSearchParams(window.location.search);
    var go = (bootParams.get("go") || "").trim();
    if (go === "leads") {
      state.data.lead_preview_seen = true;
      if (!usesCustomLanding()) state.active = "leads";
      save();
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
    }
  } catch (e) {}

  /* If they landed on a locked module (old save), send them home */
  if (state.active && state.active === "leads" && usesCustomLanding()) {
    state.active = "ground";
    save();
  }
  if (state.active && !isModuleUnlocked(state.active)) {
    state.active = "welcome";
    save();
  }
})();
