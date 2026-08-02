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
    var week = Cal.weekSlice(plan, now);
    var stats = Cal.weekStats(week);
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
    if (user && (forceAccount || true)) {
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
    }
    if (!user) {
      if (signPane) signPane.hidden = false;
      if (acctPane) acctPane.hidden = true;
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
      pulse.groveTrees + '</strong> warm-list names planted across the team · <strong>' +
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
        if (under) html += ' <span class="live-team-count">' + under + " growing under them</span>";
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

  function renderCalendar() {
    var wrap = $("calendarWeek");
    var detail = $("calendarDetail");
    if (!wrap || !getState) return;
    var state = getState();
    if (!state || !state.data) return;
    if (!state.data.calendar) state.data.calendar = {};
    var plan = Cal.plan(window.FS.CONFIG, state.data.calendar, state.data);
    var week = Cal.weekSlice(plan);
    var stats = Cal.weekStats(week);
    var statsEl = $("calendarStats");
    if (statsEl) {
      statsEl.textContent = stats.posted + " posted · " + stats.drafted + " drafted · " + stats.total + " suggested this week (rest days free)";
    }
    var selected = state.data.calendarSelected || (week[0] && week[0].date);
    var html = "";
    week.forEach(function (d) {
      html += '<button type="button" class="cal-day' +
        (d.date === selected ? " on" : "") +
        (d.status !== "todo" ? " " + d.status : "") +
        (d.reactive ? " reactive" : "") +
        '" data-cal-day="' + d.date + '">';
      html += '<span class="cal-dow">' + ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][Cal.parseYmd(d.date).getDay()] + '</span>';
      html += '<span class="cal-icon">' + d.icon + '</span>';
      html += '<span class="cal-label">' + esc(d.label) + '</span>';
      html += '<span class="cal-status">' + (d.reactive && d.status === "todo" ? "optional" : d.status) + '</span>';
      html += '</button>';
    });
    wrap.innerHTML = html;

    var day = null;
    for (var i = 0; i < week.length; i++) if (week[i].date === selected) day = week[i];
    if (!day && week.length) day = week[0];
    if (!detail || !day) return;
    detail.innerHTML =
      '<div class="live-tag">' + esc(day.date) + ' · ' + day.icon + ' ' + esc(day.label) + '</div>' +
      (day.reactive
        ? '<p class="body-p">Rest or engage day — no post required. Reply to humans.</p>'
        : '') +
      '<label class="field"><span class="field-label">Draft</span>' +
      '<textarea id="calDraft" rows="5">' + esc(day.draft) + '</textarea>' +
      '<span class="claim-check" id="calClaim"></span></label>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn-ghost" data-cal-status="drafted">Mark drafted</button>' +
      '<button type="button" class="btn" data-cal-status="posted">Mark posted</button>' +
      '<button type="button" class="btn-ghost" data-cal-status="skipped">Skip</button>' +
      '</div>';
    var ta = $("calDraft");
    if (ta) {
      ta.addEventListener("input", function () {
        var st = getState();
        if (!st.data.calendar[day.date]) st.data.calendar[day.date] = { status: day.status };
        st.data.calendar[day.date].draft = ta.value;
        runCalClaim(ta.value);
        persist();
      });
      runCalClaim(ta.value);
    }
  }

  function runCalClaim(text) {
    var el = $("calClaim");
    if (!el) return;
    var RISKY = window.FS.RISKY || [];
    if (!text || !text.trim()) { el.innerHTML = ""; return; }
    var hits = [];
    for (var i = 0; i < RISKY.length; i++) if (RISKY[i].re.test(text)) hits.push(RISKY[i]);
    if (!hits.length) { el.innerHTML = '<span class="claim-ok">Reads clean ✓</span>'; return; }
    el.innerHTML = '<span class="claim-flag">⚠ ' + esc(hits[0].word) + '</span><span class="claim-note">' + esc(hits[0].tip) + '</span>';
  }

  async function afterAuth() {
    renderAuthChrome();
    await renderCheers();
    await renderPulse();
    await renderLeaderNoteBanner();
    if (getState && getState().active === "leader") await renderLeader();
    if (getState && getState().active === "calendar") renderCalendar();
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("click", async function (e) {
      var t = e.target.closest(
        "#authOpenBtn,#authCloseBtn,#authSubmitBtn,#authSignOutBtn,#railCopyInvite,#leaderCopyInvite,#authCopyInvite," +
        "#exportBridgeBtn,#importLiveTreeBtn,#cheerDismiss,#notifySponsorBtn,[data-goto-bridge],[data-copy-nudge],[data-cheer],[data-note]," +
        "[data-cal-day],[data-cal-status]"
      );
      if (!t) return;

      if (t.id === "authOpenBtn") { openAuth(true); return; }
      if (t.id === "authCloseBtn") { closeAuth(); return; }
      if (t.id === "authSubmitBtn") {
        var email = ($("authEmail") || {}).value;
        var name = ($("authName") || {}).value;
        var msg = $("authMsg");
        try {
          var res = await Cloud.signIn(email, name);
          if (msg) msg.textContent = res.message;
          if (res.kind === "local") {
            await mergeCloudProgress();
            closeAuth();
            await afterAuth();
          }
        } catch (err) {
          if (msg) msg.textContent = err.message || "Could not sign in.";
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
      if (t.hasAttribute("data-cal-day")) {
        var st = getState();
        st.data.calendarSelected = t.getAttribute("data-cal-day");
        persist();
        renderCalendar();
        return;
      }
      if (t.hasAttribute("data-cal-status")) {
        var st2 = getState();
        var date = st2.data.calendarSelected;
        if (!date) return;
        if (!st2.data.calendar[date]) st2.data.calendar[date] = {};
        var draftEl = $("calDraft");
        if (draftEl) st2.data.calendar[date].draft = draftEl.value;
        st2.data.calendar[date].status = t.getAttribute("data-cal-status");
        persist();
        renderCalendar();
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
    /* Prefer richer local if remote empty; else remote wins for done flags merge */
    var mergedData = Object.assign({}, remote.data || {}, local.data || {});
    var mergedDone = Object.assign({}, remote.done || {}, local.done || {});
    var mergedCal = Object.assign({}, remote.calendar || {}, (local.data && local.data.calendar) || {});
    setStateFromCloud({
      data: Object.assign(mergedData, { calendar: mergedCal }),
      done: mergedDone,
      active: local.active && local.active !== "welcome" ? local.active : (remote.active || local.active),
      settings: {
        hubMode: local.settings.hubMode || Cloud.user().hub_mode || "",
        partnerName: local.settings.partnerName || Cloud.user().display_name || ""
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
    openAuth: openAuth
  };
})();
