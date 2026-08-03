/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — BRIDGE UI
   Auth gate, leader dashboard, calendar, cheers, invite link.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  var Cloud = window.FS.Cloud;
  var Cal = window.FS.Calendar;
  var getState = null;
  var setStateFromCloud = null;
  var persist = null;
  var gotoPanel = null;
  var wired = false;

  function esc(t) {
    return (t + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function $(id) { return document.getElementById(id); }

  function daysBetween(a, b) {
    return Math.floor((b - a) / 864e5);
  }

  function progressCtx(row, cfg) {
    var done = (row.progress && row.progress.done) || {};
    var data = (row.progress && row.progress.data) || {};
    var cal = (row.progress && row.progress.calendar) || {};
    var sections = (window.FS.SECTIONS || []).filter(function (s) {
      var mode = row.profile.hub_mode || "full";
      return !s.modes || s.modes.indexOf(mode) > -1;
    });
    var sectionsDone = 0;
    sections.forEach(function (s) { if (done[s.id]) sectionsDone++; });
    var last = row.profile.last_active_at ? new Date(row.profile.last_active_at) : new Date(0);
    var now = new Date();
    var plan = Cal.plan(cfg, cal, data);
    var slice = Cal.weekSlice(plan, now, 0);
    var stats = Cal.weekStats(slice.days || []);
    var pre = new Date(now.getFullYear(), cfg.preRegDate.month - 1, cfg.preRegDate.day);
    if (pre < now) pre = new Date(now.getFullYear() + 1, cfg.preRegDate.month - 1, cfg.preRegDate.day);
    return {
      done: done,
      data: data,
      sectionsDone: sectionsDone,
      sectionTotal: sections.length || 4,
      daysSinceActive: daysBetween(last, now),
      weekPosted: stats.posted,
      daysToPreReg: Math.max(0, Math.ceil((pre - now) / 864e5)),
      active: (row.progress && row.progress.active) || "welcome",
      name: (row.profile.display_name || "friend").split(/\s+/)[0]
    };
  }

  function pickNudge(ctx) {
    var nudges = (window.FS.CONFIG.nudges || []).slice();
    for (var i = 0; i < nudges.length; i++) {
      try {
        if (nudges[i].match(ctx)) {
          return {
            id: nudges[i].id,
            when: nudges[i].when,
            body: nudges[i].body.replace(/\{name\}/g, ctx.name)
          };
        }
      } catch (e) {}
    }
    return {
      id: "default",
      when: "Gentle check-in",
      body: "Hey " + ctx.name + " — just checking in. First Seeds is waiting whenever you have a few quiet minutes. Here if you need me."
    };
  }

  function bucketFor(ctx) {
    if (ctx.sectionsDone >= ctx.sectionTotal) return "ready";
    if (ctx.daysSinceActive >= 5 || (ctx.sectionsDone === 0 && ctx.daysSinceActive >= 2)) return "nudge";
    return "motion";
  }

  function renderAuthChrome() {
    var user = Cloud.user();
    var chip = $("accountChip");
    var signBtn = $("authOpenBtn");
    var syncLabel = $("syncLabel");
    if (chip) {
      if (user) {
        chip.hidden = false;
        chip.textContent = user.display_name || user.email || "Account";
      } else {
        chip.hidden = true;
      }
    }
    if (signBtn) {
      signBtn.textContent = user ? "Account" : "Sign in";
    }
    if (syncLabel) {
      syncLabel.textContent = user
        ? (Cloud.mode() === "supabase" ? "You're signed in — progress syncs." : "Signed in · local demo mode (this browser).")
        : "Answers save on this device. Sign in anytime to sync.";
    }
    var inviteWrap = $("inviteBlock");
    if (inviteWrap) {
      inviteWrap.hidden = !user;
      if (user) {
        var url = Cloud.joinUrl(user.invite_code);
        ["railInviteInput", "leaderInviteInput", "authInviteInput"].forEach(function (id) {
          var input = $(id);
          if (input) input.value = url;
        });
      }
    }
  }

  function openAuth(forceAccount) {
    var overlay = $("authOverlay");
    if (!overlay) return;
    var user = Cloud.user();
    var signPane = $("authSignPane");
    var acctPane = $("authAccountPane");
    var showAccount = !!(user && forceAccount);
    if (showAccount) {
      if (signPane) signPane.hidden = true;
      if (acctPane) acctPane.hidden = false;
      var nameEl = $("authDisplayName");
      if (nameEl) nameEl.textContent = user.display_name || "";
      var emailEl = $("authEmailLine");
      if (emailEl) emailEl.textContent = user.email || "";
      var modeEl = $("authModeLine");
      if (modeEl) modeEl.textContent = Cloud.mode() === "supabase" ? "Cloud (Supabase)" : "Local bridge mode";
      var inv = $("authInviteInput");
      if (inv) inv.value = Cloud.joinUrl(user.invite_code);
    } else {
      if (signPane) signPane.hidden = false;
      if (acctPane) acctPane.hidden = true;
      var msg = $("authMsg");
      if (msg) msg.textContent = "";
      var authName = $("authName");
      if (authName && getState) {
        var st = getState();
        if (st && st.settings && st.settings.partnerName && !authName.value) {
          authName.value = st.settings.partnerName;
        }
      }
    }
    overlay.classList.add("open");
    document.body.classList.add("overlay-open");
  }

  function closeAuth() {
    var overlay = $("authOverlay");
    if (overlay) overlay.classList.remove("open");
    if (!$("onboarding") || !$("onboarding").classList.contains("open")) {
      if (!$("tour") || !$("tour").classList.contains("open")) {
        document.body.classList.remove("overlay-open");
      }
    }
  }

  async function renderCheers() {
    var banner = $("cheerBanner");
    if (!banner || !Cloud.isSignedIn()) {
      if (banner) banner.hidden = true;
      return;
    }
    var cheers = await Cloud.unreadCheers();
    if (!cheers.length) {
      banner.hidden = true;
      return;
    }
    var c = cheers[0];
    banner.hidden = false;
    banner.innerHTML = '<div class="cheer-tag">FROM YOUR LEADER</div><div class="cheer-body">' +
      esc(c.body || "") + '</div><button type="button" class="cheer-dismiss" id="cheerDismiss">Got it</button>';
  }

  async function renderPulse() {
    var el = $("teamPulse");
    if (!el) return;
    if (!Cloud.isSignedIn()) {
      el.hidden = true;
      return;
    }
    var pulse = await Cloud.teamPulse();
    el.hidden = false;
    el.innerHTML = '<div class="live-tag">THE FRESH GROVE PULSE</div><p class="pulse-line"><strong>' +
      pulse.groveTrees + '</strong> names on warm lists across the team · <strong>' +
      pulse.blooming + '</strong> partners blooming · <strong>' +
      pulse.downlineCount + '</strong> people linked to you</p>';
  }

  async function renderLeader() {
    var root = $("leaderLists");
    if (!root) return;
    if (!Cloud.isSignedIn()) {
      root.innerHTML = '<p class="body-p">Sign in to see people who joined with your link.</p>';
      return;
    }
    var cfg = window.FS.CONFIG;
    var rows = await Cloud.listDownline();
    if (!rows.length) {
      root.innerHTML = '<p class="body-p">Nobody\'s linked yet. Share your join link — when they sign in, they show up here.</p>';
      return;
    }
    var now = new Date();
    var buckets = { nudge: [], motion: [], ready: [] };
    rows.forEach(function (row) {
      var ctx = progressCtx(row, cfg);
      var b = bucketFor(ctx);
      buckets[b].push({ row: row, ctx: ctx, nudge: pickNudge(ctx) });
    });
    function col(title, items, empty) {
      var html = '<div class="leader-col"><div class="leader-col-title">' + esc(title) +
        ' <span>' + items.length + '</span></div>';
      if (!items.length) {
        html += '<p class="leader-empty">' + esc(empty) + '</p></div>';
        return html;
      }
      items.forEach(function (item) {
        var p = item.row.profile;
        var ctx = item.ctx;
        html += '<div class="leader-card" data-partner="' + esc(p.id) + '">';
        html += '<div class="leader-card-name">' + esc(p.display_name || p.email) + '</div>';
        html += '<div class="leader-card-meta">' + esc(p.hub_mode || "—") + ' · ' +
          ctx.sectionsDone + '/' + ctx.sectionTotal + ' sections · last active ' +
          (ctx.daysSinceActive === 0 ? "today" : ctx.daysSinceActive + "d ago") + '</div>';
        html += '<div class="leader-card-nudge"><em>' + esc(item.nudge.when) + '</em><div id="nudge_' +
          esc(p.id) + '">' + esc(item.nudge.body) + '</div></div>';
        if (item.row.progress && item.row.progress.notified_at) {
          var pingAge = daysBetween(new Date(item.row.progress.notified_at), now);
          if (pingAge <= 3) {
            html += '<div class="leader-ping">Pinged you ' + (pingAge === 0 ? "today" : pingAge + "d ago") + '</div>';
          }
        }
        html += '<div class="leader-card-actions">';
        html += '<button type="button" class="copy-btn small" data-copy-nudge="' + esc(p.id) + '">Copy nudge</button>';
        html += '<button type="button" class="btn-ghost small-btn" data-cheer="' + esc(p.id) + '">Send cheer</button>';
        html += '<button type="button" class="btn-ghost small-btn" data-note="' + esc(p.id) + '">Leave note</button>';
        html += '</div></div>';
      });
      html += '</div>';
      return html;
    }
    root.innerHTML =
      col("Needs a nudge", buckets.nudge, "Nobody stuck — nice.") +
      col("In motion", buckets.motion, "No active partners this week.") +
      col("Ready / blooming", buckets.ready, "No one finished yet — they're coming.");
    await renderLiveTeamGraph();
  }

  async function renderLiveTeamGraph() {
    var el = $("liveTeamGraph");
    if (!el) return;
    if (!Cloud.isSignedIn()) {
      el.hidden = true;
      return;
    }
    var graph = await Cloud.listTeamGraph();
    var roots = graph.roots || [];
    if (!roots.length) {
      el.hidden = true;
      return;
    }
    function countAll(nodes) {
      var n = 0;
      (nodes || []).forEach(function (p) {
        n += 1 + countAll(p.children);
      });
      return n;
    }
    function renderBranch(nodes, depth) {
      if (!nodes || !nodes.length) return "";
      var html = '<ul class="live-team-kids depth-' + depth + '">';
      nodes.forEach(function (p) {
        var under = countAll(p.children);
        var icon = depth === 1 ? "🌳" : "🌱";
        html += '<li>';
        html += '<span class="live-team-name">' + icon + " " + esc(p.display_name || p.email) + "</span>";
        if (under) html += ' <span class="live-team-count">' + under + " linked with them</span>";
        html += renderBranch(p.children, depth + 1);
        html += "</li>";
      });
      html += "</ul>";
      return html;
    }
    el.hidden = false;
    var total = countAll(roots);
    var html = '<div class="live-tag">YOUR GROWING TEAM</div>';
    html += '<p class="body-p" style="margin-top:6px">Up to four levels — the people who joined with your link, and the people <em>they</em> brought in. You still coach your front line day to day. This just lets you see the family forming.</p>';
    html += '<div class="live-team">';
    html += '<div class="live-team-you">🌿 You <span class="live-team-count">' + total + " on your tree</span></div>";
    html += renderBranch(roots, 1);
    html += "</div>";
    el.innerHTML = html;
  }

  async function renderLeaderNoteBanner() {
    var el = $("leaderNoteBanner");
    if (!el) return;
    if (!Cloud.isSignedIn()) {
      el.hidden = true;
      return;
    }
    var notes = await Cloud.myLeaderNotes();
    var active = getState ? getState().active : "welcome";
    var note = null;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].section_id === active || notes[i].section_id === "welcome") {
        note = notes[i];
        if (notes[i].section_id === active) break;
      }
    }
    if (!note || !note.body) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = '<div class="live-tag">NOTE FROM YOUR LEADER</div><p class="body-p" style="margin:0">' +
      esc(note.body) + '</p>';
  }

  function openCalSheet() {
    var sheet = $("calSheet");
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add("cal-sheet-open");
  }

  function closeCalSheet() {
    var sheet = $("calSheet");
    if (!sheet) return;
    sheet.hidden = true;
    document.body.classList.remove("cal-sheet-open");
    var st = getState();
    if (st) {
      st.data.calendarEditing = null;
      st.data.libraryEditing = null;
      if (persist) persist();
    }
  }

  function setSheetKicker(text) {
    var kicker = document.querySelector("#calSheet .cal-sheet-kicker");
    if (kicker) kicker.textContent = text || "Card";
  }

  function selectedDayLabel(st) {
    var selectedKey = (st && st.data.calendarSelected) || Cal.ymd(new Date());
    try {
      var dt = Cal.parseYmd(selectedKey);
      return Cal.DOW[dt.getDay()] + " · " + Cal.MON[dt.getMonth()] + " " + dt.getDate();
    } catch (e) {
      return selectedKey;
    }
  }

  function cadenceEnabled(st) {
    return st.data.calendarCadence === true;
  }

  function renderTypeOptions(selected) {
    return Cal.EVENT_TYPES.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selected ? " selected" : "") + ">" +
        t.icon + " " + esc(t.label) + "</option>";
    }).join("");
  }

  function chipClass(it) {
    var cat = it.category || "content";
    var st = it.status || "todo";
    return "cal-chip cat-" + cat + (st !== "todo" ? " is-" + st : "");
  }

  function renderDayChips(day) {
    var html = "";
    (day.items || []).forEach(function (it) {
      html += '<button type="button" class="' + chipClass(it) + '" data-cal-edit="' + day.date + '" data-cal-item="' + it.id + '">';
      html += '<span class="cal-chip-ico">' + (it.icon || "·") + "</span>";
      html += '<span class="cal-chip-txt">' + esc(it.person ? it.person : it.label) + "</span>";
      html += "</button>";
    });
    if (!day.items.length && day.suggested) {
      html += '<button type="button" class="cal-chip ghost" data-cal-accept="' + day.date + '">';
      html += '<span class="cal-chip-ico">' + day.suggested.icon + "</span>";
      html += '<span class="cal-chip-txt">' + esc(day.suggested.label) + "</span>";
      html += "</button>";
    }
    return html;
  }

  function renderCalendar() {
    var grid = $("calendarGrid");
    var phaseEl = $("calendarPhases");
    var navEl = $("calendarWeekNav");
    var setupEl = $("calendarSetup");
    var toggleEl = $("calendarViewToggle");
    if (!grid || !getState) return;
    var state = getState();
    if (!state || !state.data) return;
    if (!state.data.calendar) state.data.calendar = {};
    if (typeof state.data.calendarWeekOffset !== "number") state.data.calendarWeekOffset = 0;
    if (typeof state.data.calendarMonthOffset !== "number") state.data.calendarMonthOffset = 0;
    if (!state.data.calendarView) state.data.calendarView = "week";
    if (!state.data.libraryTab) state.data.libraryTab = "hooks";

    var cadenceChosen = state.data.calendarCadence === true || state.data.calendarCadence === false;
    if (typeof state.data.calendarSetupOpen !== "boolean") {
      state.data.calendarSetupOpen = !cadenceChosen;
    }
    if (setupEl) {
      var setupOpen = !!state.data.calendarSetupOpen;
      var modeLabel = !cadenceChosen
        ? "Not chosen yet"
        : (cadenceEnabled(state) ? "Suggested month of post ideas" : "Building it yourself");
      setupEl.hidden = false;
      setupEl.innerHTML =
        '<div class="cal-setup-bubble' + (setupOpen ? " is-open" : "") + '">' +
        '<button type="button" class="cal-setup-toggle" data-cal-setup-toggle aria-expanded="' + (setupOpen ? "true" : "false") + '">' +
        '<span><span class="cal-setup-toggle-label">How do you want to plan?</span>' +
        '<span class="cal-setup-toggle-meta">' + esc(modeLabel) + "</span></span>" +
        '<span class="cal-setup-chevron" aria-hidden="true">▼</span>' +
        "</button>" +
        (setupOpen
          ? ('<div class="cal-setup-body">' +
            (!cadenceChosen
              ? ('<div class="cal-setup-actions">' +
                '<button type="button" class="btn" data-cal-cadence="fill">Fill my month with post ideas</button>' +
                '<button type="button" class="btn-ghost" data-cal-cadence="blank">Start blank — I\'ll build it</button>' +
                "</div>" +
                '<div class="cal-setup-hint">' +
                "<p><strong>Suggested month</strong> lays out ~4 weeks of ideas on the calendar. Nothing posts itself — you edit, skip, or swap anytime.</p>" +
                "<ol class=\"cal-setup-weeks\">" +
                "<li><strong>Week 1</strong> — Curiosity posts + a soft invite</li>" +
                "<li><strong>Week 2</strong> — Product moments + honest notes</li>" +
                "<li><strong>Week 3</strong> — Values + reach out to people you listed</li>" +
                "<li><strong>Week 4</strong> — Soft invite + follow-ups (with rest days mixed in)</li>" +
                "</ol>" +
                "<p>Or start blank and pull ready drafts from <em>Post ideas</em> below.</p>" +
                "</div>")
              : ('<div class="cal-setup-bar">' +
                '<span class="cal-setup-mode">' + (cadenceEnabled(state) ? "Suggested month is on" : "Blank calendar") + "</span>" +
                '<button type="button" class="cal-setup-switch" data-cal-cadence="' + (cadenceEnabled(state) ? "blank" : "fill") + '">' +
                (cadenceEnabled(state) ? "Switch to blank" : "Fill with post ideas") + "</button>" +
                "</div>" +
                '<p class="cal-setup-hint" style="margin-top:8px">' +
                (cadenceEnabled(state)
                  ? "Light chips on empty days are suggestions — tap one to keep it, edit the draft, or grab a different idea below."
                  : "Add a card with ＋ on a day, or tap a ready draft under Post ideas.") +
                "</p>")) +
            "</div>")
          : "") +
        "</div>";
    }

    var view = state.data.calendarView === "month" ? "month" : "week";
    var useCadence = cadenceEnabled(state);
    var plan = Cal.plan(window.FS.CONFIG, state.data.calendar, state.data, { cadence: useCadence });

    var todayKey = Cal.ymd(new Date());
    var slice = view === "month"
      ? Cal.monthSlice(plan, new Date(), state.data.calendarMonthOffset)
      : Cal.weekSlice(plan, new Date(), state.data.calendarWeekOffset);
    var visibleDays = view === "month" ? (slice.cells || []) : (slice.days || []);
    var weekForStats = view === "week" ? visibleDays : Cal.weekSlice(plan, new Date(), 0).days;
    var weekStats = Cal.weekStats(weekForStats);
    var runway = Cal.runwayStats(plan);

    if (toggleEl) {
      var btns = toggleEl.querySelectorAll("[data-cal-view]");
      for (var ti = 0; ti < btns.length; ti++) {
        var on = btns[ti].getAttribute("data-cal-view") === view;
        btns[ti].classList.toggle("on", on);
        btns[ti].setAttribute("aria-selected", on ? "true" : "false");
      }
    }

    var statsEl = $("calendarStats");
    if (statsEl) {
      statsEl.textContent = runway.cards + " cards · " + runway.posted + " done · " + runway.drafted + " drafted · week " + weekStats.posted + "/" + Math.max(weekStats.total, 0);
    }

    if (navEl) {
      var off = view === "month" ? state.data.calendarMonthOffset : state.data.calendarWeekOffset;
      navEl.innerHTML =
        '<button type="button" class="cal-nav-btn" data-cal-nav="-1" aria-label="Previous">‹</button>' +
        '<span class="cal-nav-label">' + esc(slice.label || "") + "</span>" +
        '<button type="button" class="cal-nav-btn" data-cal-nav="1" aria-label="Next">›</button>' +
        (off ? '<button type="button" class="cal-nav-today" data-cal-nav="0">Today</button>' : "");
    }

    if (phaseEl) {
      var phaseDay = Cal.findDay(plan, todayKey) || visibleDays[0];
      var ph = (phaseDay && phaseDay.phase) || { label: "", tip: "" };
      phaseEl.innerHTML = ph.label
        ? ('<span class="cal-phase-pill">' + esc(ph.label) + '</span><span class="cal-phase-tip">' + esc(ph.tip || "") + "</span>")
        : "";
    }

    if (!state.data.calendarSelected) state.data.calendarSelected = todayKey;

    grid.className = "cal-grid " + (view === "month" ? "cal-grid-month" : "cal-grid-week");
    var html = "";
    if (view === "month") {
      html += '<div class="cal-month-dows">' + Cal.DOW.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div>";
      html += '<div class="cal-month-cells">';
      visibleDays.forEach(function (d) {
        html += '<div class="cal-cell' +
          (d.date === state.data.calendarSelected ? " on" : "") +
          (d.date === todayKey ? " today" : "") +
          (d.inMonth ? "" : " out") + '" data-cal-select="' + d.date + '">';
        html += '<div class="cal-cell-top">';
        html += '<span class="cal-cell-num">' + d.dayNum + "</span>";
        html += '<button type="button" class="cal-cell-add" data-cal-new="' + d.date + '" aria-label="Add">＋</button>';
        html += "</div>";
        html += '<div class="cal-cell-chips">' + renderDayChips(d) + "</div>";
        html += "</div>";
      });
      html += "</div>";
    } else {
      visibleDays.forEach(function (d) {
        var dt = Cal.parseYmd(d.date);
        html += '<div class="cal-cell week' +
          (d.date === state.data.calendarSelected ? " on" : "") +
          (d.date === todayKey ? " today" : "") + '" data-cal-select="' + d.date + '">';
        html += '<div class="cal-cell-top">';
        html += '<div><span class="cal-dow">' + Cal.DOW[dt.getDay()] + '</span>';
        html += '<span class="cal-cell-num">' + dt.getDate() + "</span></div>";
        html += '<button type="button" class="cal-cell-add" data-cal-new="' + d.date + '" aria-label="Add">＋</button>';
        html += "</div>";
        html += '<div class="cal-cell-chips">' + renderDayChips(d) + "</div>";
        html += "</div>";
      });
    }
    grid.innerHTML = html;

    renderLibrary();
    if (state.data.calendarEditing) renderCalEditor();
  }

  function renderLibrary() {
    var tabs = $("libraryTabs");
    var list = $("libraryList");
    var target = $("libraryTarget");
    if (!tabs || !list || !getState) return;
    var st = getState();
    var buckets = Cal.libraryBuckets();
    var active = st.data.libraryTab || "photos";
    if (!buckets.some(function (b) { return b.id === active; }) && buckets[0]) active = buckets[0].id;
    st.data.libraryTab = active;

    var dayLabel = selectedDayLabel(st);
    if (target) {
      target.hidden = false;
      target.textContent = "Adding to " + dayLabel + " · tap another day above to change";
    }

    tabs.innerHTML = buckets.map(function (b) {
      return '<button type="button" class="cal-lib-tab' + (b.id === active ? " on" : "") + '" data-lib-tab="' + b.id + '">' + esc(b.title) + "</button>";
    }).join("");

    var bucket = buckets.filter(function (b) { return b.id === active; })[0] || buckets[0];
    if (!bucket) { list.innerHTML = ""; return; }
    var html = "";
    if (bucket.hint) html += '<p class="cal-lib-hint">' + esc(bucket.hint) + "</p>";
    if (!bucket.items || !bucket.items.length) {
      html += '<p class="cal-lib-hint">Nothing in this shelf yet.</p>';
    } else if (bucket.id === "photos") {
      html += '<div class="cal-lib-photo-grid">';
      bucket.items.forEach(function (it) {
        html += '<button type="button" class="cal-lib-photo-card" data-lib-open="' + esc(bucket.id) + '" data-lib-id="' + esc(it.id) + '">';
        if (it.thumb) {
          html += '<img class="cal-lib-photo-img" src="' + esc(it.thumb) + '" alt="' + esc(it.alt || it.title) + '" loading="lazy" decoding="async" width="420" height="560">';
        }
        html += '<span class="cal-lib-photo-meta">';
        html += '<span class="cal-lib-card-title">' + esc(it.title) + "</span>";
        if (it.pairsWith) html += '<span class="cal-lib-photo-pairs">' + esc(it.pairsWith) + "</span>";
        html += '<span class="cal-lib-open-hint">Open</span></span></button>';
      });
      html += "</div>";
    } else {
      bucket.items.forEach(function (it) {
        var meta = Cal.typeMeta ? Cal.typeMeta(it.type) : null;
        html += '<button type="button" class="cal-lib-card' + (it.thumb ? " has-thumb" : "") + '" data-lib-open="' + esc(bucket.id) + '" data-lib-id="' + esc(it.id) + '">';
        if (it.thumb) {
          html += '<img class="cal-lib-card-thumb" src="' + esc(it.thumb) + '" alt="" loading="lazy" decoding="async" width="72" height="96">';
        }
        html += '<div class="cal-lib-card-main">';
        html += '<div class="cal-lib-card-top"><div>';
        if (meta && meta.label) html += '<span class="cal-lib-card-type">' + esc(meta.label) + "</span>";
        html += '<span class="cal-lib-card-title">' + esc((it.icon ? it.icon + " " : "") + it.title) + "</span></div>";
        html += '<span class="cal-lib-open-hint">Open</span></div>';
        html += '<p class="cal-lib-body">' + esc(it.body || "") + "</p>";
        html += "</div></button>";
      });
    }
    list.innerHTML = html;
  }

  function libraryItem(bucketId, itemId) {
    var buckets = Cal.libraryBuckets();
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].id !== bucketId) continue;
      for (var j = 0; j < buckets[i].items.length; j++) {
        if (buckets[i].items[j].id === itemId) return buckets[i].items[j];
      }
    }
    return null;
  }

  function openLibraryIdea(bucketId, itemId) {
    var st = getState();
    var lib = libraryItem(bucketId, itemId);
    if (!st || !lib) return;
    st.data.calendarEditing = null;
    st.data.libraryEditing = {
      bucketId: bucketId,
      itemId: itemId,
      type: lib.type || "open_loop",
      title: lib.title || "",
      body: lib.body || "",
      icon: lib.icon || "",
      imageId: lib.imageId || "",
      image: lib.image || "",
      alt: lib.alt || "",
      pairsWith: lib.pairsWith || ""
    };
    persist();
    renderLibraryEditor();
    openCalSheet();
  }

  function renderLibraryEditor() {
    var detail = $("calendarDetail");
    var titleEl = $("calSheetTitle");
    var st = getState();
    if (!detail || !st || !st.data.libraryEditing) return;
    var ed = st.data.libraryEditing;
    var meta = Cal.typeMeta ? Cal.typeMeta(ed.type) : null;
    var resolved = ed.imageId && Cal.resolveCuriosityImage
      ? Cal.resolveCuriosityImage(ed.imageId)
      : null;
    var fullSrc = (resolved && resolved.src) || ed.image || "";
    var alt = (resolved && resolved.alt) || ed.alt || ed.title || "";
    setSheetKicker(ed.imageId ? "Photo" : ((meta && meta.label) || "Post idea"));
    if (titleEl) titleEl.textContent = ed.title || "Post idea";

    var html = "";
    if (fullSrc) {
      html += '<figure class="cal-lib-sheet-figure">';
      html += '<img class="cal-lib-sheet-img" src="' + esc(fullSrc) + '" alt="' + esc(alt) + '" loading="eager" decoding="async">';
      if (ed.pairsWith) html += '<figcaption class="cal-lib-sheet-cap">Pairs with: ' + esc(ed.pairsWith) + "</figcaption>";
      html += "</figure>";
    }
    html +=
      '<label class="field"><span class="field-label">Title</span>' +
        '<input type="text" id="libTitle" class="cal-input" placeholder="Optional short label" value="' + esc(ed.title || "") + '"></label>' +
      '<label class="field"><span class="field-label">Full draft</span>' +
        '<textarea id="libDraft" rows="10" placeholder="Rewrite until it sounds like you…">' + esc(ed.body || "") + "</textarea>" +
        '<span class="cal-lib-sheet-hint">Edits stay here until you add this to a day — then you can keep refining on the calendar card.</span></label>' +
      '<p class="cal-lib-sheet-target">Will add to <strong>' + esc(selectedDayLabel(st)) + '</strong>. Tap another day on the calendar first if you want a different date.</p>' +
      '<div class="cal-sheet-actions">' +
        '<button type="button" class="btn" data-lib-commit>Add to day</button>' +
        '<button type="button" class="btn-ghost" data-cal-save>Close</button>' +
      "</div>";
    detail.innerHTML = html;

    var titleIn = $("libTitle");
    var draftIn = $("libDraft");
    if (titleIn) {
      titleIn.addEventListener("input", function () {
        var cur = getState();
        if (!cur || !cur.data.libraryEditing) return;
        cur.data.libraryEditing.title = titleIn.value;
        if (titleEl) titleEl.textContent = titleIn.value || "Post idea";
        persist();
      });
    }
    if (draftIn) {
      draftIn.addEventListener("input", function () {
        var cur = getState();
        if (!cur || !cur.data.libraryEditing) return;
        cur.data.libraryEditing.body = draftIn.value;
        persist();
      });
      setTimeout(function () {
        try { draftIn.focus(); draftIn.setSelectionRange(0, 0); } catch (e) {}
      }, 50);
    }
  }

  function commitLibraryIdea() {
    var st = getState();
    if (!st || !st.data.libraryEditing) return;
    var ed = st.data.libraryEditing;
    var titleIn = $("libTitle");
    var draftIn = $("libDraft");
    if (titleIn) ed.title = titleIn.value;
    if (draftIn) ed.body = draftIn.value;
    var dateAdd = st.data.calendarSelected || Cal.ymd(new Date());
    var image = ed.image || "";
    if (!image && ed.imageId && Cal.resolveCuriosityImage) {
      var r = Cal.resolveCuriosityImage(ed.imageId);
      if (r) image = r.src;
    }
    st.data.libraryEditing = null;
    createCard(dateAdd, {
      type: ed.type || "open_loop",
      title: ed.title || "",
      draft: ed.body || "",
      image: image,
      imageId: ed.imageId || ""
    });
  }

  function openEditor(date, itemId) {
    var st = getState();
    st.data.libraryEditing = null;
    st.data.calendarSelected = date;
    st.data.calendarEditing = { date: date, itemId: itemId || null };
    persist();
    renderCalEditor();
    openCalSheet();
  }

  function createCard(date, partial) {
    var st = getState();
    var day = Cal.ensureDay(st.data.calendar, date);
    var item = Cal.newItem(partial || { type: "personal" }, st.data, date);
    day.items.push(item);
    st.data.calendarSelected = date;
    persist();
    renderCalendar();
    openEditor(date, item.id);
    if (typeof window.FS.onCalendarChange === "function") window.FS.onCalendarChange();
  }

  function acceptSuggestion(date) {
    var st = getState();
    var plan = Cal.plan(window.FS.CONFIG, st.data.calendar, st.data, { cadence: true });
    var day = Cal.findDay(plan, date);
    if (!day || !day.suggested) {
      createCard(date, { type: "personal" });
      return;
    }
    createCard(date, {
      type: day.suggested.type,
      draft: day.suggested.draft,
      title: ""
    });
  }

  function renderCalEditor() {
    var detail = $("calendarDetail");
    var titleEl = $("calSheetTitle");
    var st = getState();
    if (!detail || !st || !st.data.calendarEditing) return;
    var date = st.data.calendarEditing.date;
    var itemId = st.data.calendarEditing.itemId;
    var dayRow = Cal.ensureDay(st.data.calendar, date);
    var item = null;
    for (var i = 0; i < dayRow.items.length; i++) {
      if (dayRow.items[i].id === itemId) item = dayRow.items[i];
    }
    if (!item) {
      closeCalSheet();
      return;
    }
    var meta = Cal.typeMeta(item.type);
    setSheetKicker("Card");
    if (titleEl) titleEl.textContent = Cal.prettyDate(Cal.parseYmd(date));
    var isOutreach = meta.kind === "outreach";
    var imgSrc = item.image || "";
    if (!imgSrc && item.imageId && Cal.resolveCuriosityImage) {
      var ir = Cal.resolveCuriosityImage(item.imageId);
      if (ir) imgSrc = ir.src;
    }

    var html = "";
    if (imgSrc) {
      html += '<figure class="cal-lib-sheet-figure">';
      html += '<img class="cal-lib-sheet-img" src="' + esc(imgSrc) + '" alt="" loading="eager" decoding="async">';
      html += '<figcaption class="cal-lib-sheet-cap">Photo stays with this card — save/share it from your device when you post.</figcaption>';
      html += "</figure>";
    }
    html +=
      '<label class="field"><span class="field-label">Type</span>' +
        '<select id="calType" class="cal-select">' + renderTypeOptions(item.type) + "</select></label>" +
      (isOutreach || item.person || item.type === "personal"
        ? '<label class="field"><span class="field-label">Who</span>' +
          '<input type="text" id="calPerson" class="cal-input" placeholder="Name…" value="' + esc(item.person || "") + '"></label>'
        : '<input type="hidden" id="calPerson" value="' + esc(item.person || "") + '">') +
      '<label class="field"><span class="field-label">Title</span>' +
        '<input type="text" id="calTitle" class="cal-input" placeholder="Optional short label" value="' + esc(item.title || "") + '"></label>' +
      '<label class="field"><span class="field-label">' + (isOutreach ? "Message" : "Draft") + "</span>" +
        '<textarea id="calDraft" rows="8" placeholder="Write it in your voice…">' + esc(item.draft || "") + "</textarea>" +
        '<span class="claim-check" id="calClaim"></span></label>' +
      '<div class="cal-status-row">' +
        Cal.STATUSES.map(function (s) {
          return '<button type="button" class="cal-status-btn' + (item.status === s.id ? " on" : "") + '" data-cal-status="' + s.id + '">' + esc(s.label) + "</button>";
        }).join("") +
      "</div>" +
      '<div class="cal-sheet-actions">' +
        ((meta.kind === "content" && item.type !== "reactive")
          ? '<button type="button" class="btn-ghost" data-cal-swap>Try another</button>' : "") +
        '<button type="button" class="btn" data-cal-save>Done</button>' +
        '<button type="button" class="btn-ghost danger-ghost" data-cal-delete>Delete</button>' +
      "</div>";
    detail.innerHTML = html;

    wireEditorFields(date, item.id);
  }

  function wireEditorFields(date, itemId) {
    var st = getState();
    function itemRow() {
      var day = Cal.ensureDay(st.data.calendar, date);
      for (var i = 0; i < day.items.length; i++) if (day.items[i].id === itemId) return day.items[i];
      return null;
    }
    function touch(rerender) {
      persist();
      if (rerender) {
        renderCalendar();
        renderCalEditor();
      }
      if (typeof window.FS.onCalendarChange === "function") window.FS.onCalendarChange();
    }

    var typeEl = $("calType");
    if (typeEl) typeEl.addEventListener("change", function () {
      var it = itemRow(); if (!it) return;
      var meta = Cal.typeMeta(typeEl.value);
      it.type = typeEl.value;
      it.category = meta.category;
      if (!(it.draft || "").trim()) it.draft = Cal.draftFor(it.type, st.data, date);
      touch(true);
    });
    ["calPerson", "calTitle"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("input", function () {
        var it = itemRow(); if (!it) return;
        if (id === "calPerson") it.person = el.value;
        if (id === "calTitle") it.title = el.value;
        touch(false);
      });
    });
    var ta = $("calDraft");
    if (ta) {
      ta.addEventListener("input", function () {
        var it = itemRow(); if (!it) return;
        it.draft = ta.value;
        runCalClaim(ta.value);
        touch(false);
      });
      runCalClaim(ta.value);
    }
  }

  function runCalClaim(text) {
    var el = $("calClaim");
    if (!el) return;
    var RISKY = window.FS.RISKY || [];
    var trimmed = (text || "").trim();
    if (!trimmed) { el.innerHTML = ""; return; }
    var hits = [];
    for (var i = 0; i < RISKY.length; i++) if (RISKY[i].re.test(text)) hits.push(RISKY[i]);
    if (hits.length) {
      el.innerHTML = '<span class="claim-flag">⚠ ' + esc(hits[0].word) + '</span><span class="claim-note">' + esc(hits[0].tip) + '</span>';
      return;
    }
    if (trimmed.length < 12) { el.innerHTML = ""; return; }
    el.innerHTML = "";
  }

  var leadsFilter = "all";
  var leadsCache = [];

  function interestLabel(v) {
    if (v === "products") return "Products";
    if (v === "business") return "Business";
    if (v === "both") return "Both";
    return v || "—";
  }

  function statusLabel(v) {
    if (v === "new") return "New";
    if (v === "reached") return "Reached out";
    if (v === "done") return "Done";
    if (v === "archived") return "Archived";
    return v || "—";
  }

  function syncLeadsShareUI(slug) {
    var share = $("leadsShareInput");
    var preview = $("leadsPreviewLink");
    var slugInput = $("leadsSlugInput");
    if (slugInput && document.activeElement !== slugInput) slugInput.value = slug || "";
    var url = slug ? Cloud.leadUrl(slug) : "";
    if (share) share.value = url;
    if (preview) {
      preview.href = slug
        ? ("lead.html?p=" + encodeURIComponent(slug) + "&from=app")
        : "lead.html";
      preview.hidden = !slug;
      preview.removeAttribute("target");
      preview.removeAttribute("rel");
    }
  }

  function renderLeadsList() {
    var list = $("leadsList");
    if (!list) return;
    var rows = leadsCache.filter(function (r) {
      if (leadsFilter === "all") return r.status !== "archived";
      return r.status === leadsFilter;
    });
    if (!rows.length) {
      list.innerHTML = '<p class="leads-empty">No leads yet. Share your link — when someone submits, they show up only here.</p>';
      return;
    }
    var html = "";
    rows.forEach(function (r) {
      var when = "";
      try {
        var d = new Date(r.created_at);
        when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } catch (e) {}
      var contact = [];
      if (r.email) contact.push(esc(r.email));
      if (r.phone) contact.push(esc(r.phone));
      html += '<article class="leads-card' + (r.status === "new" ? " is-new" : "") + '">';
      html += '<div class="leads-card-top">';
      html += '<div><div class="leads-card-name">' + esc(r.name) + "</div>";
      html += '<div class="leads-card-meta">' + contact.join(" · ") + "</div></div>";
      html += '<div class="leads-card-tags"><span class="leads-pill">' + esc(interestLabel(r.interest)) + "</span>";
      html += '<span class="leads-pill soft">' + esc(statusLabel(r.status)) + "</span></div></div>";
      html += '<div class="leads-card-foot"><span class="leads-card-when">' + esc(when) + "</span>";
      html += '<div class="leads-card-actions">';
      if (r.status === "new") {
        html += '<button type="button" class="btn-ghost" data-lead-status="' + esc(r.id) + '" data-status="reached">Mark reached out</button>';
      }
      if (r.status === "reached" || r.status === "new") {
        html += '<button type="button" class="btn-ghost" data-lead-status="' + esc(r.id) + '" data-status="done">Done</button>';
      }
      if (r.status !== "archived") {
        html += '<button type="button" class="btn-ghost" data-lead-status="' + esc(r.id) + '" data-status="archived">Archive</button>';
      }
      if (r.status === "archived") {
        html += '<button type="button" class="btn-ghost" data-lead-status="' + esc(r.id) + '" data-status="new">Restore</button>';
      }
      html += "</div></div></article>";
    });
    list.innerHTML = html;
  }

  async function renderLeads() {
    var gate = $("leadsGate");
    var studio = $("leadsStudio");
    if (!gate || !studio) return;
    var user = Cloud.user();
    if (!user) {
      gate.hidden = false;
      studio.hidden = true;
      return;
    }
    gate.hidden = true;
    studio.hidden = false;
    var modeNote = $("leadsModeNote");
    if (modeNote) {
      if (Cloud.mode() === "local") {
        modeNote.hidden = false;
        modeNote.textContent = "Local demo mode: leads stay in this browser only. Connect Supabase (and run supabase/leads.sql) so each partner’s page works for real visitors.";
      } else {
        modeNote.hidden = true;
        modeNote.textContent = "";
      }
    }
    var st = getState ? getState() : null;
    var preferred = (st && st.settings && st.settings.partnerName) || user.display_name || "";
    try {
      var slug = await Cloud.ensureLeadSlug(preferred);
      syncLeadsShareUI(slug);
      var blurb = $("leadsBlurbInput");
      if (blurb && document.activeElement !== blurb) {
        var st = getState ? getState() : null;
        var story = st && st.data ? (st.data.page_story || "").trim() : "";
        blurb.value = user.lead_blurb || story || "";
      }
      var thanks = $("leadsThanksInput");
      if (thanks && document.activeElement !== thanks) {
        thanks.value = user.lead_thanks || Cloud.DEFAULT_LEAD_THANKS || "";
      }
      leadsCache = await Cloud.listMyLeads();
      renderLeadsList();
      var badge = document.querySelector('[data-tab="leads"] .bottom-nav-badge');
      var nNew = 0;
      leadsCache.forEach(function (r) { if (r.status === "new") nNew++; });
      if (badge) {
        badge.hidden = nNew < 1;
        badge.textContent = nNew > 9 ? "9+" : String(nNew);
      }
    } catch (err) {
      var msg = $("leadsSlugMsg");
      if (msg) msg.textContent = (err && err.message) || "Could not load leads.";
    }
  }

  async function afterAuth() {
    renderAuthChrome();
    await renderCheers();
    await renderPulse();
    await renderLeaderNoteBanner();
    if (getState && getState().active === "leader") await renderLeader();
    if (getState && (getState().active === "calendar" || getState().active === "tend")) renderCalendar();
    if (getState && getState().active === "leads") await renderLeads();
    else if (Cloud.isSignedIn()) {
      /* Quiet badge refresh */
      try {
        var n = await Cloud.countNewLeads();
        var badge = document.querySelector('[data-tab="leads"] .bottom-nav-badge');
        if (badge) {
          badge.hidden = n < 1;
          badge.textContent = n > 9 ? "9+" : String(n);
        }
      } catch (e) {}
    }
    if (typeof window.FS.onAuthReady === "function") {
      try { window.FS.onAuthReady(Cloud.user()); } catch (e) {}
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var overlay = $("authOverlay");
      if (!overlay || !overlay.classList.contains("open")) return;
      if (document.activeElement && (document.activeElement.id === "authPassword" || document.activeElement.id === "authEmail")) {
        e.preventDefault();
        var sb = $("authSubmitBtn");
        if (sb) sb.click();
      }
    });
    document.addEventListener("click", async function (e) {
      var t = e.target.closest(
        "#authOpenBtn,#authCloseBtn,#authSubmitBtn,#authCreateBtn,#authSignOutBtn,#railCopyInvite,#leaderCopyInvite,#authCopyInvite," +
        "#exportBridgeBtn,#importLiveTreeBtn,#cheerDismiss,#notifySponsorBtn,[data-goto-bridge],[data-copy-nudge],[data-cheer],[data-note]," +
        "[data-cal-day],[data-cal-select],[data-cal-status],[data-cal-swap],[data-cal-week],[data-cal-nav],[data-cal-view],[data-cal-add],[data-cal-clear]," +
        "[data-cal-new],[data-cal-edit],[data-cal-item],[data-cal-accept],[data-cal-cadence],[data-cal-setup-toggle],[data-cal-save],[data-cal-delete]," +
        "[data-lib-tab],[data-lib-open],[data-lib-commit],[data-lib-add],#calSheetClose,#calSheetX," +
        "#leadsSignInBtn,#leadsCopyLink,#leadsPageSettingsBtn,#leadsPageSettingsSave,[data-leads-filter],[data-lead-status]"
      );
      if (!t) return;

      if (t.id === "authOpenBtn") { openAuth(true); return; }
      if (t.id === "leadsSignInBtn") { openAuth(true); return; }
      if (t.id === "leadsCopyLink") {
        var shareIn = $("leadsShareInput");
        if (shareIn && navigator.clipboard) {
          navigator.clipboard.writeText(shareIn.value).then(function () {
            t.textContent = "Copied ✓";
            setTimeout(function () { t.textContent = "Copy"; }, 1600);
          });
        }
        return;
      }
      if (t.id === "leadsPageSettingsBtn") {
        var panel = $("leadsPageSettings");
        if (!panel) return;
        var open = panel.hidden;
        panel.hidden = !open;
        t.classList.toggle("on", open);
        t.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      if (t.id === "leadsPageSettingsSave") {
        var settingsMsg = $("leadsSlugMsg");
        var desired = (($("leadsSlugInput") || {}).value || "").trim();
        try {
          t.disabled = true;
          var claimed = await Cloud.claimLeadSlug(desired);
          syncLeadsShareUI(claimed);
          await Cloud.setLeadPageCopy(
            (($("leadsBlurbInput") || {}).value || ""),
            (($("leadsThanksInput") || {}).value || "")
          );
          if (settingsMsg) settingsMsg.textContent = "Page settings saved.";
        } catch (err) {
          if (settingsMsg) settingsMsg.textContent = (err && err.message) || "Could not save page settings.";
        } finally {
          t.disabled = false;
        }
        return;
      }
      if (t.hasAttribute("data-leads-filter")) {
        leadsFilter = t.getAttribute("data-leads-filter") || "all";
        var filters = document.querySelectorAll("[data-leads-filter]");
        for (var fi = 0; fi < filters.length; fi++) {
          filters[fi].classList.toggle("on", filters[fi].getAttribute("data-leads-filter") === leadsFilter);
        }
        renderLeadsList();
        return;
      }
      if (t.hasAttribute("data-lead-status")) {
        var leadId = t.getAttribute("data-lead-status");
        var nextStatus = t.getAttribute("data-status");
        try {
          await Cloud.updateLeadStatus(leadId, nextStatus);
          await renderLeads();
        } catch (err) {
          alert((err && err.message) || "Could not update lead.");
        }
        return;
      }
      if (t.id === "authCloseBtn") { closeAuth(); return; }
      if (t.id === "authSubmitBtn" || t.id === "authCreateBtn") {
        var email = ($("authEmail") || {}).value;
        var name = ($("authName") || {}).value;
        var password = ($("authPassword") || {}).value;
        var msg = $("authMsg");
        var creating = t.id === "authCreateBtn";
        try {
          t.disabled = true;
          var res = creating
            ? await Cloud.signUp(email, name, password)
            : await Cloud.signIn(email, name, password);
          if (msg) msg.textContent = res.message;
          if (res.kind === "local" || res.kind === "signed_in") {
            await mergeCloudProgress();
            closeAuth();
            await afterAuth();
          }
        } catch (err) {
          if (msg) msg.textContent = (err && err.message) || (creating ? "Could not create account." : "Could not sign in.");
        } finally {
          t.disabled = false;
        }
        return;
      }
      if (t.id === "authSignOutBtn") {
        await Cloud.signOut();
        closeAuth();
        await afterAuth();
        return;
      }
      if (t.id === "railCopyInvite" || t.id === "leaderCopyInvite" || t.id === "authCopyInvite") {
        var input = t.id === "authCopyInvite" ? $("authInviteInput")
          : t.id === "leaderCopyInvite" ? $("leaderInviteInput")
          : $("railInviteInput");
        if (input && navigator.clipboard) {
          navigator.clipboard.writeText(input.value).then(function () {
            var prev = t.textContent;
            t.textContent = "Copied ✓";
            setTimeout(function () { t.textContent = prev; }, 1400);
          });
        }
        return;
      }
      if (t.id === "notifySponsorBtn") {
        if (!Cloud.isSignedIn()) {
          openAuth(true);
          return;
        }
        var user = Cloud.user();
        if (!user.sponsor_id) {
          alert("No leader linked yet — open a join link from your leader, then sign in.");
          return;
        }
        try {
          await Cloud.notifySponsor({
            active: getState().active,
            data: getState().data,
            done: getState().done,
            calendar: getState().data.calendar || {},
            cheers: getState().cheers || [],
            settings: getState().settings,
            tourDone: getState().tourDone
          });
          t.textContent = "Leader notified ✓";
          setTimeout(function () { t.textContent = "Notify my leader"; }, 2000);
        } catch (err) {
          alert(err.message || "Could not notify");
        }
        return;
      }
      if (t.id === "exportBridgeBtn") {
        var bundle = await Cloud.exportBundle();
        var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "first-seeds-evergreen-handoff.json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
        return;
      }
      if (t.id === "importLiveTreeBtn") {
        if (!Cloud.isSignedIn()) {
          openAuth(true);
          return;
        }
        try {
          var graph = await Cloud.listTeamGraph();
          var roots = graph.roots || [];
          if (!roots.length) {
            alert("Nobody on your team yet — share your join link with someone first.");
            return;
          }
          if (!getState || !window.FS.tree) return;
          var result = window.FS.tree.mergeLiveTeam(getState(), roots);
          if (persist) persist();
          window.FS.tree.render(getState());
          t.textContent = (result.added || result.updated)
            ? ("Pulled in " + result.added + " new · updated " + result.updated + " ✓")
            : "Already up to date ✓";
          setTimeout(function () { t.textContent = "Pull real names into Grow Your Tree"; }, 2200);
          if (gotoPanel) gotoPanel("tree");
        } catch (err) {
          alert(err.message || "Could not import live team");
        }
        return;
      }
      if (t.id === "cheerDismiss") {
        await Cloud.clearCheers();
        await renderCheers();
        return;
      }
      if (t.hasAttribute("data-goto-bridge")) {
        if (gotoPanel) gotoPanel(t.getAttribute("data-goto-bridge"));
        return;
      }
      if (t.hasAttribute("data-copy-nudge")) {
        var id = t.getAttribute("data-copy-nudge");
        var src = $("nudge_" + id);
        if (src && navigator.clipboard) {
          navigator.clipboard.writeText(src.textContent).then(function () {
            t.textContent = "Copied ✓";
            setTimeout(function () { t.textContent = "Copy nudge"; }, 1400);
          });
        }
        return;
      }
      if (t.hasAttribute("data-cheer")) {
        var pid = t.getAttribute("data-cheer");
        var templates = window.FS.CONFIG.cheerTemplates || ["Proud of you — keep going."];
        var body = templates[Math.floor(Math.random() * templates.length)];
        try {
          await Cloud.sendEvent(pid, "cheer", body);
          t.textContent = "Sent ✓";
          setTimeout(function () { t.textContent = "Send cheer"; }, 1400);
        } catch (err) {
          alert(err.message || "Could not send cheer");
        }
        return;
      }
      if (t.hasAttribute("data-note")) {
        var notePid = t.getAttribute("data-note");
        var noteBody = window.prompt("Short note for this partner (shown at the top of their runway):", "");
        if (noteBody == null) return;
        noteBody = noteBody.trim();
        if (!noteBody) return;
        try {
          var sectionId = "welcome";
          var partnerRow = (await Cloud.listDownline()).filter(function (r) { return r.profile.id === notePid; })[0];
          if (partnerRow && partnerRow.progress && partnerRow.progress.active) {
            sectionId = partnerRow.progress.active;
          }
          await Cloud.saveLeaderNote(notePid, sectionId, noteBody);
          t.textContent = "Saved ✓";
          setTimeout(function () { t.textContent = "Leave note"; }, 1400);
        } catch (err) {
          alert(err.message || "Could not save note");
        }
        return;
      }
      if (t.id === "calSheetClose" || t.id === "calSheetX" || t.hasAttribute("data-cal-save")) {
        closeCalSheet();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-view")) {
        var stV = getState();
        stV.data.calendarView = t.getAttribute("data-cal-view") === "month" ? "month" : "week";
        persist();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-nav") || t.hasAttribute("data-cal-week")) {
        var stW = getState();
        var delta = t.getAttribute("data-cal-nav") || t.getAttribute("data-cal-week");
        var isMonth = stW.data.calendarView === "month";
        if (delta === "0") {
          if (isMonth) stW.data.calendarMonthOffset = 0;
          else stW.data.calendarWeekOffset = 0;
        } else {
          var n = parseInt(delta, 10) || 0;
          if (isMonth) stW.data.calendarMonthOffset = (stW.data.calendarMonthOffset || 0) + n;
          else stW.data.calendarWeekOffset = (stW.data.calendarWeekOffset || 0) + n;
        }
        persist();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-select")) {
        var stSel = getState();
        stSel.data.calendarSelected = t.getAttribute("data-cal-select");
        persist();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-setup-toggle")) {
        var stSetup = getState();
        stSetup.data.calendarSetupOpen = !stSetup.data.calendarSetupOpen;
        persist();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-cadence")) {
        var stCad = getState();
        var mode = t.getAttribute("data-cal-cadence");
        if (mode === "fill") {
          stCad.data.calendarCadence = true;
          Cal.applyCadenceFill(stCad.data.calendar, stCad.data, window.FS.CONFIG);
        } else {
          stCad.data.calendarCadence = false;
          Cal.clearCadenceSuggestions(stCad.data.calendar);
        }
        stCad.data.calendarSetupOpen = false;
        persist();
        renderCalendar();
        if (typeof window.FS.onCalendarChange === "function") window.FS.onCalendarChange();
        return;
      }
      if (t.hasAttribute("data-cal-new")) {
        createCard(t.getAttribute("data-cal-new"), { type: "personal" });
        return;
      }
      if (t.hasAttribute("data-cal-accept")) {
        acceptSuggestion(t.getAttribute("data-cal-accept"));
        return;
      }
      if (t.hasAttribute("data-cal-edit")) {
        openEditor(t.getAttribute("data-cal-edit"), t.getAttribute("data-cal-item"));
        return;
      }
      if (t.hasAttribute("data-lib-tab")) {
        var stLib = getState();
        stLib.data.libraryTab = t.getAttribute("data-lib-tab");
        persist();
        renderLibrary();
        return;
      }
      if (t.hasAttribute("data-lib-open")) {
        openLibraryIdea(t.getAttribute("data-lib-open"), t.getAttribute("data-lib-id"));
        return;
      }
      if (t.hasAttribute("data-lib-commit")) {
        commitLibraryIdea();
        return;
      }
      if (t.hasAttribute("data-lib-add")) {
        var lib = libraryItem(t.getAttribute("data-lib-add"), t.getAttribute("data-lib-id"));
        if (!lib) return;
        var stAdd = getState();
        var dateAdd = stAdd.data.calendarSelected || Cal.ymd(new Date());
        createCard(dateAdd, {
          type: lib.type || "open_loop",
          title: lib.title || "",
          draft: lib.body || "",
          image: lib.image || "",
          imageId: lib.imageId || ""
        });
        return;
      }
      if (t.hasAttribute("data-cal-status")) {
        var st2 = getState();
        var ed = st2.data.calendarEditing;
        if (!ed) return;
        var day2 = Cal.ensureDay(st2.data.calendar, ed.date);
        for (var si = 0; si < day2.items.length; si++) {
          if (day2.items[si].id === ed.itemId) {
            var draftEl = $("calDraft");
            var personEl2 = $("calPerson");
            var titleEl2 = $("calTitle");
            if (draftEl) day2.items[si].draft = draftEl.value;
            if (personEl2) day2.items[si].person = personEl2.value;
            if (titleEl2) day2.items[si].title = titleEl2.value;
            day2.items[si].status = t.getAttribute("data-cal-status");
          }
        }
        persist();
        renderCalEditor();
        renderCalendar();
        if (typeof window.FS.onCalendarChange === "function") window.FS.onCalendarChange();
        return;
      }
      if (t.hasAttribute("data-cal-delete")) {
        var stDel = getState();
        var edDel = stDel.data.calendarEditing;
        if (!edDel) return;
        var dayDel = Cal.ensureDay(stDel.data.calendar, edDel.date);
        dayDel.items = dayDel.items.filter(function (it) { return it.id !== edDel.itemId; });
        if (!dayDel.items.length) delete stDel.data.calendar[edDel.date];
        persist();
        closeCalSheet();
        renderCalendar();
        if (typeof window.FS.onCalendarChange === "function") window.FS.onCalendarChange();
        return;
      }
      if (t.hasAttribute("data-cal-swap")) {
        var st3 = getState();
        var ed3 = st3.data.calendarEditing;
        if (!ed3) return;
        var day3 = Cal.ensureDay(st3.data.calendar, ed3.date);
        var item3 = null;
        for (var di = 0; di < day3.items.length; di++) {
          if (day3.items[di].id === ed3.itemId) item3 = day3.items[di];
        }
        if (!item3) return;
        var alts = (window.FS.ContentPick && window.FS.ContentPick.alternativesForType)
          ? window.FS.ContentPick.alternativesForType(item3.type)
          : [];
        if (!alts.length) return;
        var idx = (item3.altIndex || 0) + 1;
        if (idx >= alts.length) idx = 0;
        item3.altIndex = idx;
        item3.draft = alts[idx].body;
        persist();
        renderCalEditor();
        return;
      }
    });
  }

  async function mergeCloudProgress() {
    if (!Cloud.isSignedIn() || !setStateFromCloud) return;
    var remote = await Cloud.pullProgress();
    var local = getState();
    if (!remote) {
      await Cloud.pushProgress({
        active: local.active,
        data: local.data,
        done: local.done,
        calendar: local.data.calendar || {},
        cheers: [],
        settings: local.settings,
        tourDone: local.tourDone
      });
      return;
    }
    /* Prefer non-empty field wins; never let a cleared local wipe remote text,
       and never let a sticky remote done:true resurrect after local cleared it. */
    var remoteData = remote.data || {};
    var localData = local.data || {};
    var mergedData = Object.assign({}, remoteData, localData);
    Object.keys(remoteData).forEach(function (k) {
      var lv = localData[k];
      var rv = remoteData[k];
      if (typeof rv === "string" && typeof lv === "string") {
        if (!lv.trim() && rv.trim()) mergedData[k] = rv;
      }
    });
    var remoteDone = remote.done || {};
    var localDone = local.done || {};
    var mergedDone = {};
    Object.keys(remoteDone).concat(Object.keys(localDone)).forEach(function (k) {
      /* Explicit false/cleared local wins over remote true */
      if (Object.prototype.hasOwnProperty.call(localDone, k)) mergedDone[k] = !!localDone[k];
      else mergedDone[k] = !!remoteDone[k];
    });
    var mergedCal = Object.assign({}, remote.calendar || {}, (local.data && local.data.calendar) || {});
    setStateFromCloud({
      data: Object.assign(mergedData, { calendar: mergedCal }),
      done: mergedDone,
      active: local.active && local.active !== "welcome" ? local.active : (remote.active || local.active),
      settings: {
        hubMode: local.settings.hubMode || Cloud.user().hub_mode || "",
        partnerName: local.settings.partnerName || Cloud.user().display_name || "",
        growthMoment: typeof local.settings.growthMoment === "boolean" ? local.settings.growthMoment : true,
        growthToast: typeof local.settings.growthToast === "boolean" ? local.settings.growthToast : true
      },
      tourDone: local.tourDone || Cloud.user().tour_done,
      cheers: remote.cheers || []
    });
    await Cloud.pushProgress({
      active: getState().active,
      data: getState().data,
      done: getState().done,
      calendar: getState().data.calendar || {},
      cheers: remote.cheers || [],
      settings: getState().settings,
      tourDone: getState().tourDone
    });
  }

  window.FS.BridgeUI = {
    init: async function (hooks) {
      getState = hooks.getState;
      setStateFromCloud = hooks.setStateFromCloud;
      persist = hooks.persist;
      gotoPanel = hooks.gotoPanel;
      wire();
      await Cloud.init();
      if (Cloud.isSignedIn()) await mergeCloudProgress();
      await afterAuth();
      Cloud.onChange(function () { afterAuth(); });
    },
    syncNow: async function () {
      if (!Cloud.isSignedIn()) return;
      var s = getState();
      await Cloud.pushProgress({
        active: s.active,
        data: s.data,
        done: s.done,
        calendar: s.data.calendar || {},
        cheers: s.cheers || [],
        settings: s.settings,
        tourDone: s.tourDone
      });
    },
    renderLeader: renderLeader,
    renderCalendar: renderCalendar,
    renderPulse: renderPulse,
    renderCheers: renderCheers,
    renderLeaderNoteBanner: renderLeaderNoteBanner,
    renderLeads: renderLeads,
    openAuth: openAuth
  };
})();
