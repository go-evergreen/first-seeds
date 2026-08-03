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
      settings: { hubMode: "", partnerName: "", growthMoment: true, growthToast: true, weekStartsOn: "sunday" },
      tourDone: false
    };
  }

  var state = blankState();

  function ensureSettings() {
    if (!state.settings) state.settings = {};
    if (!state.settings.hubMode) state.settings.hubMode = "";
    if (!state.settings.partnerName) state.settings.partnerName = "";
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
  function save() {
    try { localStorage.setItem(CFG.storeKey, JSON.stringify(state)); } catch (e) {}
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(function () {
      if (window.FS.BridgeUI) window.FS.BridgeUI.syncNow();
    }, 800);
  }

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

  /* Starter path: roots → ground → grove → tend → done
     Full path:    roots → ground → grove → tree → plant → tend → done */
  function nextAfter(id) {
    if (isStarter()) {
      return { roots: "ground", ground: "grove", grove: "done" }[id];
    }
    return { roots: "ground", ground: "grove", grove: "tree", tree: "plant", plant: "tend", tend: "done" }[id];
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

  function firstName() {
    var n = partnerName();
    return n ? n.split(/\s+/)[0] : "";
  }

  /* ── growth math ────────────────────────────────────────
     Roots  = the 3 Roots answers (underground)
     Sprout = each checklist item done outside Roots
     Bar    = checklist items done / total
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

  /* Soft-unlock is peek-only for Growth — the full prior chain must be finished. */
  function sectionEarnsGrowth(id) {
    if (!id || id === "roots") return true;
    if (!sectionVisible(id)) return false;
    return sectionChainComplete(priorSectionId(id));
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
    var secs = visibleSections();
    var done = 0, total = 0, sproutDone = 0, sproutTotal = 0;
    for (var i = 0; i < secs.length; i++) {
      var earns = sectionEarnsGrowth(secs[i].id);
      var items = checklistItems(secs[i].id);
      for (var j = 0; j < items.length; j++) {
        if (items[j].optional) continue;
        if (!earns && secs[i].id !== "roots") continue;
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
    setText("obModeEyebrow", OB.modeEyebrow);
    setText("obModeTitle", OB.modeTitle);
    setText("obModeLead", OB.modeLead);
    setText("onboardingNameNext", OB.nameCta || "Continue");

    var nameInput = document.getElementById("partnerNameInput");
    if (nameInput && OB.namePlaceholder) nameInput.placeholder = OB.namePlaceholder;

    if (MODES.starter) {
      setText("modePickStarterTag", MODES.starter.tag || "Soft start");
      setText("modePickStarterLabel", MODES.starter.label);
      setText("modePickStarterDesc", MODES.starter.desc);
    }
    if (MODES.full) {
      setText("modePickFullTag", MODES.full.tag || "All in");
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
      pathNote.innerHTML = "Your plant lives here. Content, Leads, Learn, and your path stay one tap away at the bottom.";
    }

    var rh = document.getElementById("rootsHeadline");
    if (rh) rh.textContent = name ? (name + " — plant your roots") : "Plant Your Roots";

    /* section numbers: roots=01, ground=02, then grove/tree/plant/tend */
    var groundNum = document.getElementById("groundNum");
    var groveNum = document.getElementById("groveNum");
    var treeNum = document.getElementById("treeNum");
    var plantNum = document.getElementById("plantNum");
    var tendNum = document.getElementById("tendNum");
    if (groundNum) groundNum.textContent = "02";
    if (isStarter()) {
      if (groveNum) groveNum.textContent = "03";
      if (tendNum) tendNum.textContent = "04";
    } else {
      if (groveNum) groveNum.textContent = "03";
      if (treeNum) treeNum.textContent = "04";
      if (plantNum) plantNum.textContent = "05";
      if (tendNum) tendNum.textContent = "06";
    }

    renderFinishCopy();
    renderTodayCard();
  }

  /* ── "What should I do today?" — one next move, no overwhelm ─ */
  function sectionStarted(id) {
    if (id === "roots") return filledText("why") || filledText("moment") || filledText("said_yes");
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
        body: "List people who'd love the products, then tap up to 5 first chats — they land on your calendar. Partners are optional if you're building.",
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
        title: "Draft today's seeds.",
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
            ? { label: "Or peek at the calendar", goto: "calendar" }
            : null
        };
      }
    }

    var pulse = calendarWeekPulse();
    if (pulse.restToday && pulse.todayStatus === "todo") {
      return {
        title: "Rest counts.",
        body: "Today's a real-life / reply day on your calendar. Answer a comment, text one grove person, or just live your life.",
        why: "Consistency includes rest, " + hey + ".",
        primary: { label: "See today's calendar →", goto: "calendar" },
        secondary: { label: "Revisit any section", goto: "roots" }
      };
    }
    if (pulse.posted < 3 && pulse.total > 0) {
      return {
        title: "Share one true thing.",
        body: pulse.posted === 0
          ? "Your runway's done — nice. Grab one gentle idea from the calendar and mark it Posted when you share (or Skipped if today isn't the day)."
          : ("You've marked " + pulse.posted + " posted this week. One more true post keeps the habit warm."),
        why: "No auto-post. Just a nudge so you don't go silent.",
        primary: { label: "Open Content →", goto: "calendar" },
        secondary: { label: "Notify my leader", goto: "done" }
      };
    }

    var Cloud = window.FS.Cloud;
    if (Cloud && Cloud.isSignedIn && Cloud.isSignedIn()) {
      return {
        title: "You're in motion.",
        body: "Growth checklist humming and content warm. Open Team if you're leading partners — or leave your leader a quiet ping that you're still here.",
        why: "Showing up is the whole game, " + hey + ".",
        primary: { label: "Team →", goto: "leader" },
        secondary: { label: "Notify my leader", goto: "done" }
      };
    }

    return {
      title: "Look at you.",
      body: "You've done the quiet work most people skip. Keep the content warm, and sign in so your progress can travel with you.",
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
      } else {
        html += '<button type="button" class="btn" data-goto="' + esc(move.primary.goto) + '" id="todayPrimaryBtn">' +
          esc(move.primary.label) + "</button>";
      }
    }
    if (move.secondary) {
      if (move.secondary.action === "auth") {
        html += '<button type="button" class="btn-ghost" id="todayAuthBtn">' + esc(move.secondary.label) + "</button>";
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

    if (isStarter()) {
      if (eyebrow) eyebrow.textContent = "ROOTS DOWN";
      if (headline) headline.textContent = name ? ("Nice work, " + name + ".") : "Nice work.";
      if (body) body.innerHTML = "You've got your story, your grove, your page, and a rhythm to carry you to October 1. That's a real foundation — and you did it before the doors opened. When you're ready for the dream team tree and Post Studio, unlock the Full runway anytime.";
      if (levelUp) levelUp.hidden = false;
    } else {
      if (eyebrow) eyebrow.textContent = "IN FULL BLOOM";
      if (headline) headline.textContent = name ? ("Look what you grew, " + name + ".") : "Look what you grew.";
      if (body) body.innerHTML = "You've got your story, your grove, clear facts in Learn, and a rhythm you can keep. That's calm prep — not a scramble. Keep showing up, keep flipping 🌱 to 🌳, and let launch feel like opening a door you already helped build.";
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
    var starterBtn = document.getElementById("modeStarter");
    var fullBtn = document.getElementById("modeFull");
    if (starterBtn) starterBtn.classList.toggle("on", isStarter());
    if (fullBtn) fullBtn.classList.toggle("on", isFull());
    var hint = document.getElementById("hubModeHint");
    if (hint) {
      if (isStarter()) hint.textContent = "Getting started keeps the path light: story, page, grove, finish. Content and Team unlock on Full runway.";
      else if (isFull()) hint.textContent = "All six sections unlocked, plus Content and Team in the bottom nav. Switch to Getting started for a simpler view — your progress stays.";
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
    save();
    updateLeadPageSettingUI();
    renderChoices();
    liveRefresh({ silent: true });
    renderNav();
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
    renderPlant();
    refreshButtons();
    liveRefresh();
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
          if (pendingGrowth) flushPendingGrowth();
        });
      })(fields[i]);
    }
  }

  function renderSeedTypes() {
    var wrap = document.getElementById("seedTypes");
    if (!wrap) return;
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
        return '<div class="faq-item' + (isOpen ? " open" : "") + '">' +
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
        html += '<div class="fact-card"><div class="fact-label">' +
          esc(String(i + 1)) + " · " + esc(p.title) +
          "</div><p>" + esc(p.body) + "</p></div>";
      });
      html += "</div>";
    }
    if (G.moments && G.moments.length) {
      html += '<p class="talk-sec-label">In the moment</p>';
      html += '<p class="body-p">' + esc(G.momentsIntro || "") + "</p>";
      html += '<div class="faq-list talk-moments">';
      G.moments.forEach(function (m) {
        var id = "talk_" + m.id;
        var isOpen = openTalk === id;
        html += '<div class="faq-item' + (isOpen ? " open" : "") + '">';
        html += '<button type="button" class="faq-q" data-talk="' + id + '">' +
          '<span class="talk-q-wrap"><span class="talk-cat">' + esc(m.cat) + "</span>" +
          esc(m.q) + '</span><span class="faq-chev">' + (isOpen ? "−" : "+") + "</span></button>";
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
      state.productBrowse = { category: null, subcategory: null, productId: null, q: "" };
    }
    return state.productBrowse;
  }

  function productLib() {
    return window.FS.PRODUCT_LIB || { categories: [], products: [], disclaimer: "", sourceNote: "" };
  }

  function isSpfProduct(p) {
    if (!p) return true;
    var name = ((p.name || "") + " " + (p.id || "")).toLowerCase();
    /* After-sun stays in the library — only hide true SPF / sunscreen products */
    if (/after[\s-]*sun/.test(name)) return false;
    var sub = ((p.subcategory || "") + "").toLowerCase();
    if (sub === "sunscreen") return true;
    if (/\bspf\b|sunscreen/.test(name)) return true;
    if (sub === "sun" && !/after[\s-]*sun|tan booster/.test(name)) return true;
    if (/tinted moisturiser/i.test(p.name || "") && (p.badges || []).some(function (b) {
      return /\bspf\b/i.test(b || "");
    })) return true;
    return false;
  }

  function visibleProducts() {
    return (productLib().products || []).filter(function (p) { return !isSpfProduct(p); });
  }

  function isHiddenSunSub(subId) {
    var id = ((subId || "") + "").toLowerCase();
    return id === "sunscreen";
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
      .replace(/[ \t]+\n/g, "\n")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  function cleanForWhoList(list) {
    return (list || []).map(function (s) {
      return cleanProdSquares(s).replace(/\s*\(site category\)\s*/gi, "").trim();
    }).filter(Boolean);
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
    return list.filter(function (p) {
      if (browse.category && p.category !== browse.category) return false;
      if (browse.subcategory && p.subcategory !== browse.subcategory) return false;
      if (browse.subcategory && isHiddenSunSub(browse.subcategory)) return false;
      if (!q) return true;
      var hay = [
        p.name, p.tagline, p.summary, p.heroIngredients, p.ingredientsNote,
        p.application, (p.claims || []).join(" "), (p.forWho || []).join(" "),
        p.step, p.subcategory, p.category
      ].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderProductListRows(items) {
    if (!items.length) return '<p class="prod-empty">No products match that search in this view. Try another word, or clear search.</p>';
    return '<div class="prod-list">' + items.map(function (p) {
      return '<button type="button" class="prod-row" data-prod-open="' + esc(p.id) + '">' +
        '<span class="prod-row-name">' + esc(p.name) + "</span>" +
        "</button>";
    }).join("") + "</div>";
  }

  function renderProductDetail(p) {
    var cat = categoryById(p.category);
    var forWho = cleanForWhoList(p.forWho);
    var notFor = realNotForList(p.notFor);
    var ing = splitIngredientsDump(p.ingredientsNote);
    var howTo = cleanProdSquares(p.application || "");
    if (ing.usageExtra) {
      howTo = howTo ? (howTo + "\n\n" + ing.usageExtra) : ing.usageExtra;
    }

    var html = "";
    html += '<div class="prod-nav-bar">' +
      (cat
        ? '<button type="button" class="prod-pill on" data-prod-nav="cat" data-prod-cat="' + esc(p.category) + '">← ' + esc(cat.label) + "</button>"
        : "") +
      '<button type="button" class="prod-pill" data-prod-nav="hub">All products</button>' +
      "</div>";
    html += '<div class="prod-detail-kicker">' + esc((cat ? cat.label : "") + (p.step ? " · " + p.step : "")) + "</div>";
    html += '<h1 class="prod-detail-title">' + esc(p.name) + "</h1>";
    if (p.tagline) html += '<p class="prod-detail-tagline">' + esc(p.tagline) + "</p>";
    if (p.summary) html += '<p class="prod-detail-summary">' + esc(p.summary) + "</p>";

    html += '<div class="prod-acc-stack">';
    if (p.heroIngredients) {
      html += prodAcc("Hero ingredients", "<p>" + esc(cleanProdSquares(p.heroIngredients)) + "</p>", true);
    }
    if (p.claims && p.claims.length) {
      html += prodAcc(
        "Study / performance notes",
        "<ul>" + p.claims.map(function (c) { return "<li>" + esc(cleanProdSquares(c)) + "</li>"; }).join("") +
          '</ul><p class="prod-acc-note">As published on the ringana.com product page. Not a guarantee of individual results.</p>'
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

  function renderProductLibrary() {
    var root = document.getElementById("productLibRoot");
    if (!root) return;
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

    if (browse.productId) {
      var detail = productById(browse.productId);
      if (!detail) {
        browse.productId = null;
      } else {
        root.innerHTML = renderProductDetail(detail);
        return;
      }
    }

    if (browse.category) {
      html += '<div class="prod-nav-bar"><button type="button" class="prod-pill on" data-prod-nav="hub">← All products</button></div>';
    }

    if (!browse.category) {
      html += '<h1 class="prod-head-title">Learn the products</h1>';
      html += '<p class="prod-head-sub">' + esc(lib.sourceNote || "Browse by category — searchable and ready to learn.") + "</p>";
    } else {
      var cat = categoryById(browse.category);
      html += '<h1 class="prod-head-title">' + esc(cat ? cat.label : browse.category) + "</h1>";
      html += '<p class="prod-head-sub">' + esc(cat ? cat.blurb : "") + "</p>";
    }

    html += '<label class="sr-only" for="productSearch">Search products</label>';
    html += '<input type="search" id="productSearch" class="prod-search" placeholder="Search ingredients, names, skin concerns…" value="' + esc(browse.q || "") + '" autocomplete="off">';
    var scoped = productsInScope(browse);
    html += '<p class="prod-search-meta">' + scoped.length + " product" + (scoped.length === 1 ? "" : "s") +
      (browse.q ? " matching “" + esc(browse.q) + "”" : " to explore") + "</p>";
    html += '<p class="prod-disclaimer">' + esc(lib.disclaimer || "") + "</p>";

    if (!browse.category && !browse.q) {
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
        html += '<div class="prod-sub-row">';
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

    root.innerHTML = html;
    var search = document.getElementById("productSearch");
    if (search) {
      search.addEventListener("input", function () {
        ensureProductBrowse().q = search.value || "";
        renderProductLibrary();
        var again = document.getElementById("productSearch");
        if (again) {
          again.focus();
          var len = again.value.length;
          try { again.setSelectionRange(len, len); } catch (e) {}
        }
      });
    }
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
        { done: named >= 1, label: "Add someone to your front line" },
        { done: named >= 3, label: "At least 3 people on your tree (" + named + "/3)" }
      ];
    }
    if (id === "ground") {
      var items = [
        { done: !!state.data.page_choice, label: "Pick a page option" },
        { done: filledText("page_story"), label: "Draft your opening line" }
      ];
      if (usesBuiltInLeadPage()) {
        items.push({ done: leadSignedIn(), label: "Sign in for your lead page" });
        items.push({ done: leadPageReady(), label: "Save the link you'll share" });
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
          esc(sectionLabel(priorSectionId(s.id) || "roots")) + ". Soft-unlock from the nav if you need a peek.</p>";
      }
      box.innerHTML = html;
    }
  }

  function openHubMenu() {
    var menu = document.getElementById("hubMenu");
    if (!menu) return;
    syncGrowthSettingsUI();
    syncWeekStartSettingsUI();
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
    var btns = bar.querySelectorAll(".bottom-nav-btn");
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].getAttribute("data-tab");
      btns[i].classList.toggle("on", !!tab && t === tab);
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

  function filterKnowSearch() {
    var input = document.getElementById("knowSearch");
    var empty = document.getElementById("knowSearchEmpty");
    if (!input) return;
    var q = (input.value || "").trim().toLowerCase();
    var secs = document.querySelectorAll("#panel-know .know-acc");
    var shown = 0;
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      var text = (sec.textContent || "").toLowerCase();
      var match = !q || text.indexOf(q) > -1;
      sec.hidden = !match;
      if (match) {
        shown++;
        if (q) sec.open = true;
      }
    }
    if (empty) empty.hidden = !q || shown > 0;
  }

  function wireKnowSearch() {
    var input = document.getElementById("knowSearch");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    input.addEventListener("input", filterKnowSearch);
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

  function flushPendingGrowth() {
    clearTimeout(growthIdleTimer);
    growthIdleTimer = null;
    if (!pendingGrowth) return;
    var p = pendingGrowth;
    pendingGrowth = null;
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
      return "Roots are in. Next checklist items grow the sprout above ground.";
    }
    if (sproutTotal > 0 && sproutDone >= sproutTotal) return "Full bloom — growth checklist complete.";
    return "Sprout growing · " + sproutDone + " of " + sproutTotal + " checklist items. Each one grows it more.";
  }

  function plantVisualStage(sproutDone, sproutTotal) {
    if (sproutDone <= 0) return 0;
    if (sproutTotal > 0 && sproutDone >= sproutTotal) return 6;
    if (sproutTotal <= 1) return Math.min(5, sproutDone);
    return Math.max(1, Math.min(5, Math.round((sproutDone / sproutTotal) * 5)));
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
      sproutTotal: sproutTotal
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
    if (statMods) statMods.innerHTML = "<em>Checks</em> " + progress.done + "/" + progress.total;

    if (grewRoots) {
      var rootMsg = growthMessage("roots", roots, sproutDone, sproutTotal);
      if (opts.deferCelebrate) {
        if (caption) caption.textContent = plantCaptionFor(roots, sproutDone, sproutTotal);
        queueGrowthCelebration("roots", rootMsg, prevSnap, nextSnap);
      } else {
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
        pulsePlant("sprout");
        highlightCaption(sproutMsg);
        celebrateGrowth("sprout", sproutMsg, prevSnap, nextSnap);
      }
    } else if (caption && !caption.classList.contains("highlight")) {
      caption.textContent = plantCaptionFor(roots, sproutDone, sproutTotal);
    }
    lastRoots = roots;
    lastSprout = sproutDone;
    lastSecs = typeof doneCount === "function" ? doneCount() : visualSecs;
  }

  function settleViewTop() {
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
      renderTalkGuide((window.FS.CONTENT || {}).talkGuide);
    }
    if (state.active === "products") {
      renderProductLibrary();
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
        meta.textContent = picks.length
          ? picks.length + " of 5 first chats selected · landing on your calendar"
          : "Tap the easiest people to share a product story with first.";
      } else {
        meta.textContent = picks.length
          ? picks.length + " partner chats selected · also on your calendar"
          : "Optional — tap anyone you'd start a mission chat with.";
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
        mid: "Solid optional list — tap first chats if you want them on the calendar.",
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
      if (isLongWrite) {
        f.addEventListener("blur", function () {
          if (pendingGrowth) flushPendingGrowth();
        });
      }
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
    if (platform === "ios") {
      return head +
        '<ol class="onboard-install-steps">' +
        "<li>Open this page in <strong>Safari</strong> (not Chrome, and not inside Instagram or Texts).</li>" +
        "<li>Tap the <strong>Share</strong> button " +
        '<span class="onboard-install-glyph" aria-hidden="true">□↑</span> ' +
        "at the bottom of Safari (or top on iPad).</li>" +
        '<li class="onboard-install-key">Scroll and tap <strong>Add to Home Screen</strong>.</li>' +
        "<li>Tap <strong>Add</strong> in the top right — you should see a First Seeds icon on your Home Screen.</li>" +
        "</ol>" +
        '<p class="onboard-install-note">If you don’t see “Add to Home Screen,” scroll the share sheet all the way down. Then come back here and check the box below.</p>';
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
        "</ol>" +
        '<p class="onboard-install-note">On some Androids it says “Install” in the address bar instead of the menu. After it’s added, check the box below.</p>';
    }
    /* desktop */
    var deskBtn = deferredInstallPrompt
      ? '<button type="button" class="btn overlay-btn" id="onboardInstallPromptBtn" style="margin-bottom:12px">Install First Seeds →</button>'
      : "";
    return head + deskBtn +
      '<ol class="onboard-install-steps">' +
      '<li class="onboard-install-key">In <strong>Chrome</strong> or <strong>Edge</strong>, click the install icon in the address bar (a screen / ⊕), or menu → <strong>Install First Seeds</strong>.</li>' +
      "<li>On a Mac with Safari: <strong>File → Add to Dock</strong> (or Share → Add to Dock).</li>" +
      "<li>Phone is usually better day-to-day — you can install there later from the same link.</li>" +
      "</ol>" +
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
    if (next && OB && OB.installCta) next.textContent = OB.installCta;
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
      if (input) {
        input.value = partnerName();
        syncNameNext();
        setTimeout(function () { input.focus(); }, 50);
      }
    }
    if (onboardingStep === 3) {
      var emailIn = document.getElementById("onboardingEmail");
      var msg = document.getElementById("onboardingAuthMsg");
      if (msg) msg.textContent = "";
      if (cloudSignedIn()) {
        advanceToInstallStep();
        return;
      }
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
    var btn = document.getElementById("onboardingNameNext");
    if (!btn) return;
    var ok = input && input.value.trim().length > 0;
    btn.disabled = !ok;
  }

  var onboardingReplay = false;

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
    } else if (partnerName()) {
      onboardingStep = 3;
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
    if (!wasReplay && !state.tourDone) startTour();
    else setOverlayOpen(false);
  }

  function replayOnboardingFromSettings() {
    closeHubMenu();
    startOnboarding({ replay: true });
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

    async function runOnboardAuth(creating) {
      var email = emailInput ? emailInput.value.trim() : "";
      var password = passwordInput ? passwordInput.value : "";
      var name = partnerName() || "friend";
      if (!window.FS.Cloud) {
        onboardAuthMsg("Sign-in isn’t available right now — continue and try from the top bar later.");
        return;
      }
      var btn = creating ? createBtn : signInBtn;
      try {
        if (btn) btn.disabled = true;
        var res = creating
          ? await window.FS.Cloud.signUp(email, name, password)
          : await window.FS.Cloud.signIn(email, name, password);
        onboardAuthMsg(res.message || "You’re signed in.");
        if (res.kind === "local" || res.kind === "signed_in") {
          advanceToInstallStep();
        }
      } catch (err) {
        onboardAuthMsg((err && err.message) || (creating ? "Could not create account." : "Could not sign in."));
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

  function currentTourTips() {
    if (tourKind === "team") return CFG.teamTour || [];
    return CFG.tour || [];
  }

  function clearTourHighlight() {
    if (tourTargetEl) {
      tourTargetEl.classList.remove("tour-target-on");
      tourTargetEl = null;
    }
    var spot = document.getElementById("tourSpotlight");
    if (spot) {
      spot.hidden = true;
      spot.style.cssText = "";
    }
  }

  function centerTourCard() {
    var card = document.getElementById("tourCard");
    var spot = document.getElementById("tourSpotlight");
    if (spot) spot.hidden = true;
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
    var sel = tip && tip.target;
    if (!sel) return;
    var needsMentorOpen = /nudge|cheer|note|mentor|leader-col|leaderLists/.test(sel);
    if (needsMentorOpen) {
      var cols = document.querySelectorAll("#leaderLists details.leader-col");
      for (var i = 0; i < cols.length; i++) cols[i].open = true;
      var firstCard = document.querySelector("#leaderLists details.leader-card");
      if (firstCard) firstCard.open = true;
    }
    var el = document.querySelector(sel);
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
      centerTourCard();
      return;
    }

    var tip = (tipOrPlacement && typeof tipOrPlacement === "object") ? tipOrPlacement : null;
    var placement = tip ? (tip.placement || "auto") : (tipOrPlacement || "auto");
    var fullSpot = !!(tip && tip.fullSpot);

    var pad = 8;
    var gap = 12;
    var navSafe = 72; /* leave room above bottom nav */
    var rect = targetEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    /* Hidden / not laid out yet */
    if (rect.width < 2 && rect.height < 2) {
      centerTourCard();
      return;
    }

    /* Default: cap tall targets. fullSpot (e.g. live team tree) shows most of the block. */
    var maxSpotH = fullSpot
      ? Math.max(160, Math.min(rect.height + pad * 2, vh - navSafe - 200))
      : Math.max(64, Math.floor(vh * 0.28));
    var spotH = Math.min(rect.height + pad * 2, maxSpotH);
    var spotTop = Math.max(6, rect.top - pad);
    var spotLeft = Math.max(6, rect.left - pad);
    var spotRight = Math.min(vw - 6, rect.right + pad);
    var spotBottom = Math.min(vh - navSafe, spotTop + spotH);
    if (spotBottom > vh - navSafe) {
      spotBottom = vh - navSafe;
      spotTop = Math.max(6, spotBottom - spotH);
    }

    if (spot) {
      var prevTop = parseFloat(spot.style.top) || spotTop;
      var jump = Math.abs(spotTop - prevTop) > 100;
      if (jump) spot.style.transition = "none";
      spot.hidden = false;
      spot.style.top = spotTop + "px";
      spot.style.left = spotLeft + "px";
      spot.style.width = Math.max(24, spotRight - spotLeft) + "px";
      spot.style.height = Math.max(24, spotBottom - spotTop) + "px";
      spot.style.borderRadius = targetEl.closest(".bottom-nav-btn") ? "16px" : "14px";
      if (jump) {
        /* Re-enable transition on next frame so later steps still ease gently */
        requestAnimationFrame(function () {
          if (spot) spot.style.transition = "";
        });
      }
    }

    card.style.transform = "none";
    var cardW = Math.min(360, vw - 24);
    card.style.width = cardW + "px";
    card.style.maxWidth = cardW + "px";
    var cardH = card.offsetHeight || 200;

    var spaceBelow = vh - spotBottom - gap - navSafe;
    var spaceAbove = spotTop - gap;
    var place = placement || "auto";
    var tall = fullSpot || rect.height > vh * 0.36;

    if (place === "auto" || (tall && place !== "above" && place !== "below")) {
      place = spaceAbove >= cardH + 8 ? "above" : (spaceBelow >= cardH + 8 ? "below" : "center");
    }
    if (place === "below" && spaceBelow < Math.min(cardH, 130) && spaceAbove > spaceBelow) place = "above";
    if (place === "above" && spaceAbove < Math.min(cardH, 130) && spaceBelow > spaceAbove) place = "below";
    /* Near the bottom of the screen, prefer the tip above the hole */
    if (spotBottom > vh * 0.62 && spaceAbove >= Math.min(cardH, 140)) place = "above";
    /* Full-tree steps: tip sits above so the people stay visible in the hole */
    if (fullSpot && spaceAbove >= Math.min(cardH, 120)) place = "above";

    if (place === "center") {
      centerTourCard();
      return;
    }

    var top;
    if (place === "above") top = spotTop - gap - cardH;
    else top = spotBottom + gap;

    var left = spotLeft + ((spotRight - spotLeft) / 2) - (cardW / 2);
    left = Math.min(Math.max(12, left), vw - cardW - 12);
    top = Math.min(Math.max(12, top), vh - cardH - navSafe);

    card.style.top = top + "px";
    card.style.left = left + "px";
    card.style.right = "auto";
    card.style.bottom = "auto";
  }

  function scrollTourTargetIntoView(el, tip) {
    if (!el) return;
    /* Open any closed details ancestors first */
    var node = el;
    while (node && node !== document.body) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
    /* Tour sets body.overlay-open { overflow:hidden }, which blocks scrollIntoView */
    var locked = document.body.classList.contains("overlay-open");
    if (locked) document.body.classList.remove("overlay-open");
    try {
      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var fullSpot = !!(tip && tip.fullSpot);
      /* Prefer center for small targets; nearest for tall ones so we don't overshoot */
      var block = fullSpot || rect.height > vh * 0.4 ? "nearest" : "center";
      el.scrollIntoView({ block: block, inline: "nearest", behavior: "auto" });
      rect = el.getBoundingClientRect();
      if (fullSpot) {
        /* Leave room above for the tip; do not pull tall trees back up afterward */
        var tipRoom = 190;
        var bottomSafe = vh - 80;
        if (rect.top < tipRoom) window.scrollBy(0, rect.top - tipRoom);
        rect = el.getBoundingClientRect();
        /* Only nudge if the TOP of the target is below the fold — keep tip room */
        if (rect.top > bottomSafe - 40) window.scrollBy(0, rect.top - tipRoom);
      } else if (rect.top < 70) {
        window.scrollBy(0, rect.top - 80);
      } else if (rect.bottom > vh - 80) {
        window.scrollBy(0, rect.bottom - (vh - 90));
      }
    } catch (err) {
      try { el.scrollIntoView(true); } catch (err2) { /* ignore */ }
    }
    if (locked) document.body.classList.add("overlay-open");
  }

  function scheduleTourPlacement(tip) {
    clearTimeout(tourPlaceTimer);
    clearTourHighlight();
    var attempts = 0;
    var tryPlace = function () {
      prepareTeamTourTarget(tip);
      var el = tip && tip.target ? document.querySelector(tip.target) : null;
      /* Prefer a visible tree; skip hidden #liveTeamGraph when graph didn't paint */
      if (el && el.hidden) el = null;
      if (el && el.closest && el.closest("[hidden]")) el = null;
      var rectOk = el && (function () {
        var r = el.getBoundingClientRect();
        return r.width >= 2 && r.height >= 2;
      })();
      if ((!el || !rectOk) && attempts < 10) {
        attempts++;
        tourPlaceTimer = setTimeout(tryPlace, 120);
        return;
      }
      if (!el || !rectOk) {
        centerTourCard();
        return;
      }
      tourTargetEl = el;
      el.classList.add("tour-target-on");
      scrollTourTargetIntoView(el, tip);
      placeTourChrome(el, tip);
      /* Second pass after layout settles */
      tourPlaceTimer = setTimeout(function () {
        if (!tourTargetEl) return;
        prepareTeamTourTarget(tip);
        scrollTourTargetIntoView(tourTargetEl, tip);
        placeTourChrome(tourTargetEl, tip);
      }, 320);
    };
    requestAnimationFrame(function () {
      requestAnimationFrame(tryPlace);
    });
  }

  function startTour() {
    var wrap = document.getElementById("tour");
    tourKind = "main";
    var tips = currentTourTips();
    if (!wrap || !tips.length) {
      state.tourDone = true;
      save();
      setOverlayOpen(false);
      return;
    }
    tourIdx = 0;
    wrap.classList.add("open");
    setOverlayOpen(true);
    centerTourCard();
    renderTourStep();
  }

  function startTeamTour(opts) {
    opts = opts || {};
    var wrap = document.getElementById("tour");
    if (!wrap) return;
    if (wrap.classList.contains("open")) return;
    if (!opts.replay && state.data.teamTourDone) return;
    tourKind = "team";
    var tips = currentTourTips();
    if (!tips.length) {
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
    if (!count || count < 1) return;
    var ver = (CFG.teamTourVersion || 1);
    if (state.data.teamTourVer !== ver) {
      state.data.teamTourDone = false;
    }
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
        next.textContent = tourIdx >= tips.length - 1 ? "Start planting →" : "Next";
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
    clearTourHighlight();
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
    save();
    setOverlayOpen(false);
    renderGreetings();
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
    var t = e.target.closest("[data-goto],[data-complete],[data-grove-pick],[data-prod-nav],[data-prod-open],[data-choice],[data-rhythm],[data-copy],[data-tadd],[data-tstatus],[data-tdel],[data-seedtype],[data-menu-goto],[data-soft-unlock],[data-faq],[data-talk],[data-copy-toggle],#exportBtn,#exportBtn2,#resetBtn,#replayOnboardingBtn,#replayTeamTourBtn,#modeStarter,#modeFull,#lockToastUnlockFull,#leadPageBuiltIn,#leadPageCustom,#levelUpBtn,#settingsNavBtn,#menuCloseBtn,#menuCloseBackdrop,#todayAuthBtn,#lockToastClose");
    if (!t) return;

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
    if (t.id === "modeFull" || t.id === "lockToastUnlockFull" || t.id === "levelUpBtn") {
      setHubMode("full");
      if (t.id === "levelUpBtn") {
        closeHubMenu();
        state.active = "welcome";
        save();
        renderNav();
        renderPanels();
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
      if (goto === "leader" && !isFull()) return;
      if (isContentSurface(goto) && !isFull()) {
        var lockEl = document.getElementById("lockToast");
        if (lockEl) {
          lockEl.hidden = false;
          lockEl.innerHTML =
            '<div class="lock-toast-inner">' +
            "<p><strong>Content</strong> unlocks on Full runway — calendar, post vault, stories, and photos.</p>" +
            '<div class="lock-toast-actions">' +
            '<button type="button" class="btn" id="lockToastUnlockFull">Unlock Full runway →</button>' +
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
        state.active = "talk";
        save(); renderNav(); renderPanels();
        return;
      }
      if (goto === "leads" && usesCustomLanding()) return;
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
      if (t.hasAttribute("data-prod-open")) {
        browseNav.productId = t.getAttribute("data-prod-open");
      } else {
        var navMode = t.getAttribute("data-prod-nav");
        browseNav.productId = null;
        if (navMode === "hub") {
          browseNav.category = null;
          browseNav.subcategory = null;
        } else if (navMode === "cat") {
          browseNav.category = t.getAttribute("data-prod-cat") || null;
          if (t.hasAttribute("data-prod-sub")) {
            browseNav.subcategory = t.getAttribute("data-prod-sub") || null;
          } else {
            browseNav.subcategory = null;
          }
        }
      }
      state.active = "products";
      save(); renderNav(); renderPanels();
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
      var lane = t.getAttribute("data-grove-pick");
      var idx = parseInt(t.getAttribute("data-grove-idx"), 10);
      var pool = lane === "warm" ? groveNames() : customerNames();
      var pickName = pool[idx] || "";
      toggleGrovePick(lane, pickName);
      save();
      liveRefresh({ silent: true });
      flash("grove");
      return;
    }
    if (t.hasAttribute("data-choice")) {
      var beforeSprout = lastSprout;
      var choiceKey = t.getAttribute("data-choice");
      var choiceVal = t.getAttribute("data-value");
      state.data[choiceKey] = choiceVal;
      if (choiceKey === "page_choice" && choiceVal === "custom" && state.active === "leads") {
        state.active = "ground";
      }
      if (choiceKey === "page_choice" && choiceVal === "generic") {
        syncPageStoryToLeadBlurb();
      }
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
  wireGrowthSettings();
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
    var wrap = document.getElementById("onboarding");
    if (!wrap || !wrap.classList.contains("open") || modeChosen()) return;
    if (partnerName() && cloudSignedIn()) {
      onboardingStep = 4;
      renderOnboardingStep();
    } else if (partnerName()) {
      onboardingStep = 3;
      renderOnboardingStep();
    }
  };

  if (window.FS.BridgeUI) {
    window.FS.BridgeUI.init({
      getState: function () { return state; },
      setStateFromCloud: function (next) {
        state.data = next.data || state.data;
        state.done = next.done || state.done;
        state.active = next.active || state.active;
        state.settings = next.settings || state.settings;
        ensureSettings();
        state.tourDone = !!next.tourDone;
        state.cheers = next.cheers || [];
        if (!state.data.calendar) state.data.calendar = {};
        /* hydrate fields */
        var fs = document.querySelectorAll("[data-key]");
        for (var j = 0; j < fs.length; j++) {
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
      },
      persist: function () { save(); },
      gotoPanel: function (id) {
        if (id === "leads" && usesCustomLanding()) {
          id = "ground";
        }
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
    });
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

  if (!modeChosen()) {
    startOnboarding();
  } else if (!state.tourDone) {
    startTour();
  }
})();
