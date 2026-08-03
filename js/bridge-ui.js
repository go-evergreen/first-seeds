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
    var joined = row.profile.created_at ? new Date(row.profile.created_at) : last;
    var now = new Date();
    var plan = Cal.plan(cfg, cal, data);
    var slice = Cal.weekSlice(plan, now, 0, weekStartPref(getState && getState()));
    var stats = Cal.weekStats(slice.days || []);
    var pre = new Date(now.getFullYear(), cfg.preRegDate.month - 1, cfg.preRegDate.day);
    if (pre < now) pre = new Date(now.getFullYear() + 1, cfg.preRegDate.month - 1, cfg.preRegDate.day);
    return {
      done: done,
      data: data,
      sectionsDone: sectionsDone,
      sectionTotal: sections.length || 4,
      daysSinceActive: daysBetween(last, now),
      daysSinceJoined: Math.max(0, daysBetween(joined, now)),
      weekPosted: stats.posted,
      daysToPreReg: Math.max(0, Math.ceil((pre - now) / 864e5)),
      active: (row.progress && row.progress.active) || "welcome",
      name: (row.profile.display_name || "friend").split(/\s+/)[0]
    };
  }

  function pickFromList(list, ctx, fallback) {
    for (var i = 0; i < (list || []).length; i++) {
      try {
        if (list[i].match(ctx)) {
          return {
            id: list[i].id,
            when: list[i].when,
            body: list[i].body.replace(/\{name\}/g, ctx.name),
            tone: list[i].tone || "support"
          };
        }
      } catch (e) {}
    }
    return fallback;
  }

  /* Supportive by default. Real "nudge" copy only when they're in the nudge bucket. */
  function pickMentorMessage(ctx, bucket) {
    var cfg = window.FS.CONFIG || {};
    if (bucket === "nudge") {
      return pickFromList(cfg.nudges, ctx, {
        id: "default_nudge",
        when: "Gentle check-in",
        body: "Thinking of you, " + ctx.name + ". First Seeds will be right where you left it — one tiny step is enough. Here if you want company.",
        tone: "nudge"
      });
    }
    if (bucket === "ready") {
      return pickFromList(cfg.supports, ctx, {
        id: "ready_cheer",
        when: "Ready / blooming",
        body: "Look at you, " + ctx.name + ". You've done the quiet prep most people skip. Proud of you 🌳",
        tone: "support"
      });
    }
    return pickFromList(cfg.supports, ctx, {
      id: "default_support",
      when: "Supportive check-in",
      body: "Hey " + ctx.name + " — glad you're here. No rush. I'm around if you want a hand with anything in First Seeds 🌱",
      tone: "support"
    });
  }

  function bucketFor(ctx) {
    if (ctx.sectionsDone >= ctx.sectionTotal) return "ready";
    /* Only "needs a nudge" when truly quiet — not day-one or a few hours offline */
    if (ctx.daysSinceActive >= 7) return "nudge";
    if (ctx.sectionsDone === 0 && ctx.daysSinceJoined >= 5 && ctx.daysSinceActive >= 3) return "nudge";
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
    var more = cheers.length > 1 ? ' <span class="cheer-more">+' + (cheers.length - 1) + " more</span>" : "";
    banner.hidden = false;
    banner.innerHTML = '<div class="cheer-copy"><div class="cheer-tag">CHEER FROM YOUR LEADER' + more +
      '</div><div class="cheer-body">' + esc(c.body || "") +
      '</div></div><button type="button" class="cheer-dismiss" id="cheerDismiss">Got it</button>';
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

  function formatOutreachWhen(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      var days = daysBetween(d, new Date());
      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return days + "d ago";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function outreachKindLabel(kind) {
    if (kind === "note") return "Note";
    if (kind === "nudge") return "Nudge";
    return "Cheer";
  }

  function mergeOutreachLists(remoteList, localList) {
    var out = [];
    var seen = {};
    function add(item) {
      if (!item || !(item.body || "").trim()) return;
      var key = (item.kind || "cheer") + "|" + String(item.body || "").trim() + "|" + String(item.at || "").slice(0, 16);
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        kind: item.kind || "cheer",
        body: item.body || "",
        at: item.at || ""
      });
    }
    (localList || []).forEach(add);
    (remoteList || []).forEach(add);
    out.sort(function (a, b) {
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
    return out.slice(0, 20);
  }

  function appendOutreachLog(partnerId, kind, body) {
    if (!getState || !partnerId || !(body || "").trim()) return;
    var st = getState();
    if (!st.data.outreachLog) st.data.outreachLog = {};
    if (!st.data.outreachLog[partnerId]) st.data.outreachLog[partnerId] = [];
    st.data.outreachLog[partnerId].unshift({
      kind: kind,
      body: body,
      at: new Date().toISOString()
    });
    st.data.outreachLog[partnerId] = st.data.outreachLog[partnerId].slice(0, 30);
    if (!st.data.leaderLogOpen) st.data.leaderLogOpen = {};
    st.data.leaderLogOpen[partnerId] = true;
    persist();
  }

  function outreachLogHtml(partnerId, items) {
    if (!(items || []).length) return "";
    var st = getState ? getState() : null;
    var open = !!(st && st.data.leaderLogOpen && st.data.leaderLogOpen[partnerId]);
    var latest = items[0];
    var summary = outreachKindLabel(latest.kind).toLowerCase() +
      (latest.at ? " · " + formatOutreachWhen(latest.at) : "");
    var html = '<div class="leader-log">';
    html += '<button type="button" class="leader-log-toggle" data-leader-log="' + esc(partnerId) + '" aria-expanded="' + (open ? "true" : "false") + '">';
    html += '<span class="leader-log-toggle-main">Messages sent <span class="leader-log-count">' + items.length + "</span></span>";
    html += '<span class="leader-log-toggle-sub">Last ' + esc(summary) + "</span>";
    html += '<span class="leader-log-chev" aria-hidden="true">' + (open ? "▴" : "▾") + "</span>";
    html += "</button>";
    html += '<div class="leader-log-panel"' + (open ? "" : " hidden") + '>';
    items.forEach(function (it) {
      html += '<div class="leader-log-item is-' + esc(it.kind || "cheer") + '">';
      html += '<div class="leader-log-meta"><span class="leader-log-kind">' + esc(outreachKindLabel(it.kind)) +
        '</span><span class="leader-log-when">' + esc(formatOutreachWhen(it.at)) + "</span></div>";
      html += '<p class="leader-log-body">' + esc(it.body) + "</p>";
      html += "</div>";
    });
    html += "</div></div>";
    return html;
  }

  async function renderLeader() {
    var root = $("leaderLists");
    if (!root) return;
    if (!Cloud.isSignedIn()) {
      root.innerHTML = '<p class="body-p">Sign in to see people who joined with your link — and their real First Seeds progress.</p>';
      return;
    }
    var cfg = window.FS.CONFIG;
    var rows = await Cloud.listDownline();
    var graph = await Cloud.listTeamGraph();
    var underById = {};
    function countDesc(nodes) {
      var n = 0;
      (nodes || []).forEach(function (p) {
        n += 1 + countDesc(p.children);
      });
      return n;
    }
    (graph.roots || []).forEach(function (p) {
      underById[p.id] = countDesc(p.children);
    });
    if (!rows.length) {
      root.innerHTML = '<p class="body-p">Nobody\'s linked yet. Share your join link — when they sign in, they show up here with live progress.</p>';
      await renderLiveTeamGraph(graph, rows);
      markTeamJoinsSeen(rows);
      paintTeamBadge(0);
      return;
    }
    var partnerIds = rows.map(function (r) { return r.profile.id; });
    var remoteOutreach = {};
    try {
      remoteOutreach = await Cloud.listOutreachMap(partnerIds);
    } catch (e) {
      remoteOutreach = {};
    }
    var localLog = (getState && getState().data && getState().data.outreachLog) || {};
    var outreachById = {};
    partnerIds.forEach(function (id) {
      outreachById[id] = mergeOutreachLists(remoteOutreach[id] || [], localLog[id] || []);
    });
    var now = new Date();
    var buckets = { nudge: [], motion: [], ready: [] };
    var mentorMarked = false;
    rows.forEach(function (row) {
      var ctx = progressCtx(row, cfg);
      var under = underById[row.profile.id] || 0;
      var b = bucketFor(ctx);
      buckets[b].push({ row: row, ctx: ctx, nudge: pickMentorMessage(ctx, b), under: under, bucket: b });
    });
    function sortByUnder(a, b) {
      if (b.under !== a.under) return b.under - a.under;
      return String(b.row.profile.last_active_at || "").localeCompare(String(a.row.profile.last_active_at || ""));
    }
    buckets.nudge.sort(sortByUnder);
    buckets.motion.sort(sortByUnder);
    buckets.ready.sort(sortByUnder);

    function col(kind, title, items) {
      if (!items.length) return "";
      var html = '<div class="leader-col is-' + kind + '"><div class="leader-col-title">' + esc(title) +
        ' <span>' + items.length + '</span></div>';
      items.forEach(function (item) {
        var p = item.row.profile;
        var ctx = item.ctx;
        var modeLabel = p.hub_mode === "starter" ? "Getting started" : (p.hub_mode === "full" ? "Full runway" : "—");
        var pct = Math.round((ctx.sectionsDone / Math.max(1, ctx.sectionTotal)) * 100);
        var isMentorDemo = !mentorMarked;
        mentorMarked = true;
        html += '<div class="leader-card" data-partner="' + esc(p.id) + '">';
        html += '<div class="leader-card-head">';
        html += '<div class="leader-card-name">' + esc(p.display_name || p.email) + '</div>';
        if (item.under > 0) {
          html += '<span class="leader-under-chip">' + item.under + " under</span>";
        }
        html += "</div>";
        html += '<div class="leader-card-meta">' + esc(modeLabel) + ' · last active ' +
          (ctx.daysSinceActive === 0 ? "today" : ctx.daysSinceActive + "d ago") + '</div>';
        html += '<div class="leader-progress-row"><div class="leader-progress" aria-hidden="true"><span style="width:' +
          pct + '%"></span></div><span class="leader-progress-label">' + ctx.sectionsDone + '/' + ctx.sectionTotal + '</span></div>';
        var msg = item.nudge || {};
        var copyLabel = item.bucket === "nudge" ? "Copy nudge" : "Copy message";
        html += '<div class="leader-card-nudge' + (item.bucket === "nudge" ? " is-nudge-tone" : " is-support-tone") + '"' + (isMentorDemo ? ' data-team-tour="nudge"' : "") + '>';
        html += '<em>' + esc(msg.when || "Check-in") + '</em>';
        html += '<div id="nudge_' + esc(p.id) + '">' + esc(msg.body || "") + '</div>';
        html += '<button type="button" class="leader-nudge-copy" data-copy-nudge="' + esc(p.id) + '" data-copy-label="' + esc(copyLabel) + '">' + esc(copyLabel) + "</button>";
        html += '</div>';
        if (item.row.progress && item.row.progress.notified_at) {
          var pingAge = daysBetween(new Date(item.row.progress.notified_at), now);
          if (pingAge <= 3) {
            html += '<div class="leader-ping">Pinged you ' + (pingAge === 0 ? "today" : pingAge + "d ago") + '</div>';
          }
        }
        html += outreachLogHtml(p.id, outreachById[p.id] || []);
        html += '<div class="leader-card-actions"' + (isMentorDemo ? ' data-team-tour="mentor"' : "") + '>';
        html += '<button type="button" class="btn-ghost leader-action-btn" data-cheer="' + esc(p.id) + '"' +
          (isMentorDemo ? ' data-team-tour="cheer"' : "") + '>Send cheer</button>';
        html += '<button type="button" class="btn-ghost leader-action-btn" data-note="' + esc(p.id) + '"' +
          (isMentorDemo ? ' data-team-tour="note"' : "") + '>Leave note</button>';
        html += '</div></div>';
      });
      html += '</div>';
      return html;
    }
    var colsHtml =
      col("nudge", "Needs a nudge", buckets.nudge) +
      col("motion", "In motion", buckets.motion) +
      col("ready", "Ready / blooming", buckets.ready);
    var colCount = (buckets.nudge.length ? 1 : 0) + (buckets.motion.length ? 1 : 0) + (buckets.ready.length ? 1 : 0);
    root.className = "leader-board cols-" + Math.max(1, colCount);
    root.innerHTML = '<div class="leader-board-kicker">MENTORING</div>' + (colsHtml || '<p class="leader-empty">Everyone\'s settled for now.</p>');
    await renderLiveTeamGraph(graph, rows);
    markTeamJoinsSeen(rows);
    paintTeamBadge(0);
    if (typeof window.FS.maybeStartTeamTour === "function") {
      window.FS.maybeStartTeamTour(rows.length);
    }
  }

  function countTreeDesc(nodes) {
    var n = 0;
    (nodes || []).forEach(function (p) { n += 1 + countTreeDesc(p.children); });
    return n;
  }

  function teamSortMode() {
    var st = getState ? getState() : null;
    var mode = st && st.data && st.data.teamSort;
    return mode === "newest" ? "newest" : "legs";
  }

  function setTeamSortMode(mode) {
    if (!getState) return;
    var st = getState();
    st.data.teamSort = mode === "newest" ? "newest" : "legs";
    persist();
  }

  function sortTeamNodes(nodes, mode) {
    mode = mode || teamSortMode();
    function sortLevel(list) {
      (list || []).forEach(function (p) {
        if (p.children && p.children.length) sortLevel(p.children);
      });
      (list || []).sort(function (a, b) {
        if (mode === "newest") {
          return String(b.created_at || b.last_active_at || "").localeCompare(String(a.created_at || a.last_active_at || ""));
        }
        /* Most legs first; among equals, older joins stay above brand-new ones */
        var ub = countTreeDesc(b.children);
        var ua = countTreeDesc(a.children);
        if (ub !== ua) return ub - ua;
        return String(a.created_at || a.last_active_at || "").localeCompare(String(b.created_at || b.last_active_at || ""));
      });
    }
    sortLevel(nodes);
    return nodes;
  }

  /* Keep old name for any callers */
  function sortNodesByUnder(nodes) {
    return sortTeamNodes(nodes, "legs");
  }

  function hubModeChipHtml(hubMode) {
    if (hubMode === "starter") {
      return '<span class="team-mode-chip is-starter">Getting started</span>';
    }
    if (hubMode === "full") {
      return '<span class="team-mode-chip is-full">Full runway</span>';
    }
    return '<span class="team-mode-chip is-unknown">Path unset</span>';
  }

  function formatJoinedOn(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return "—";
    }
  }

  function ensureTeamSeenMap() {
    if (!getState) return {};
    var st = getState();
    if (!st.data.teamSeenIds || typeof st.data.teamSeenIds !== "object") {
      st.data.teamSeenIds = {};
    }
    return st.data.teamSeenIds;
  }

  function countUnseenTeamJoins(rows) {
    var seen = ensureTeamSeenMap();
    var st = getState ? getState() : null;
    var seeded = !!(st && st.data.teamSeenSeeded);
    if (!seeded) {
      (rows || []).forEach(function (row) {
        if (row && row.profile && row.profile.id) seen[row.profile.id] = true;
      });
      if (st) {
        st.data.teamSeenSeeded = true;
        persist();
      }
      return 0;
    }
    var n = 0;
    (rows || []).forEach(function (row) {
      if (row && row.profile && row.profile.id && !seen[row.profile.id]) n++;
    });
    return n;
  }

  function markTeamJoinsSeen(rows) {
    var seen = ensureTeamSeenMap();
    (rows || []).forEach(function (row) {
      if (row && row.profile && row.profile.id) seen[row.profile.id] = true;
    });
    if (getState) {
      getState().data.teamSeenSeeded = true;
      persist();
    }
  }

  function paintTeamBadge(count) {
    var badge = document.querySelector('[data-tab="team"] .bottom-nav-badge');
    if (!badge) return;
    badge.hidden = count < 1;
    badge.textContent = count > 9 ? "9+" : String(count);
  }

  async function refreshTeamBadge() {
    if (!Cloud.isSignedIn()) {
      paintTeamBadge(0);
      return;
    }
    try {
      var rows = await Cloud.listDownline();
      paintTeamBadge(countUnseenTeamJoins(rows));
    } catch (e) {
      paintTeamBadge(0);
    }
  }

  var teamPersonCache = {};

  function closeTeamPersonSheet() {
    var sheet = $("teamPersonSheet");
    if (sheet) sheet.hidden = true;
  }

  function openTeamPersonSheet(partnerId) {
    var person = teamPersonCache[partnerId];
    if (!person) return;
    var sheet = $("teamPersonSheet");
    var nameEl = $("teamPersonName");
    var chips = $("teamPersonChips");
    var facts = $("teamPersonFacts");
    var actions = $("teamPersonActions");
    if (!sheet || !nameEl || !chips || !facts || !actions) return;
    nameEl.textContent = person.display_name || person.email || "Partner";
    chips.innerHTML = hubModeChipHtml(person.hub_mode) +
      (person.under ? '<span class="live-l1-under on">' + person.under + " under</span>" : "");
    var factRows = [
      ["Joined", formatJoinedOn(person.created_at)],
      ["Last active", person.daysSinceActive == null ? "—" :
        (person.daysSinceActive === 0 ? "Today" : person.daysSinceActive + "d ago")]
    ];
    if (person.sectionsDone != null) {
      factRows.push(["Progress", person.sectionsDone + "/" + person.sectionTotal + " sections"]);
    }
    if (person.email) factRows.push(["Email", person.email]);
    facts.innerHTML = factRows.map(function (pair) {
      return "<div><dt>" + esc(pair[0]) + "</dt><dd>" + esc(pair[1]) + "</dd></div>";
    }).join("");
    var html = "";
    if (person.isDirect) {
      html += '<button type="button" class="btn" data-cheer="' + esc(partnerId) + '">Send cheer</button>';
      html += '<button type="button" class="btn-ghost" data-note="' + esc(partnerId) + '">Leave note</button>';
    } else {
      html += '<p class="team-person-hint">Cheer and notes are for your Level 1 — this person is deeper on the tree.</p>';
    }
    actions.innerHTML = html;
    sheet.hidden = false;
  }

  async function renderLiveTeamGraph(graphPrefetch, downlineRows) {
    var el = $("liveTeamGraph");
    if (!el) return;
    if (!Cloud.isSignedIn()) {
      el.hidden = true;
      return;
    }
    var graph = graphPrefetch || await Cloud.listTeamGraph();
    var progressById = {};
    var downlineById = {};
    (downlineRows || []).forEach(function (row) {
      progressById[row.profile.id] = progressCtx(row, window.FS.CONFIG);
      downlineById[row.profile.id] = row;
    });
    var roots = (graph.roots || []).slice();
    /* Fill join dates from downline if team_graph RPC hasn't been migrated yet */
    roots.forEach(function (p) {
      if (!p.created_at && downlineById[p.id] && downlineById[p.id].profile) {
        p.created_at = downlineById[p.id].profile.created_at;
      }
    });
    var sortMode = teamSortMode();
    sortTeamNodes(roots, sortMode);
    if (!roots.length) {
      el.hidden = true;
      return;
    }

    function cachePerson(p, under, ctx, isDirect) {
      teamPersonCache[p.id] = {
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        hub_mode: p.hub_mode,
        created_at: p.created_at || (downlineById[p.id] && downlineById[p.id].profile.created_at) || "",
        last_active_at: p.last_active_at,
        daysSinceActive: ctx ? ctx.daysSinceActive : (p.last_active_at ? daysBetween(new Date(p.last_active_at), new Date()) : null),
        sectionsDone: ctx ? ctx.sectionsDone : null,
        sectionTotal: ctx ? ctx.sectionTotal : null,
        under: under,
        isDirect: !!isDirect
      };
    }

    function renderKids(nodes, depth) {
      if (!nodes || !nodes.length) return "";
      var html = '<ul class="live-team-kids depth-' + depth + '">';
      nodes.forEach(function (p) {
        var under = countTreeDesc(p.children);
        cachePerson(p, under, null, false);
        html += '<li class="live-team-node">';
        html += '<button type="button" class="live-team-row" data-team-person="' + esc(p.id) + '">';
        html += '<span class="live-team-dot" aria-hidden="true"></span>';
        html += '<span class="live-team-name">' + esc(p.display_name || p.email) + "</span>";
        html += hubModeChipHtml(p.hub_mode);
        if (under) html += '<span class="live-team-count">' + under + " under</span>";
        html += "</button>";
        html += renderKids(p.children, depth + 1);
        html += "</li>";
      });
      html += "</ul>";
      return html;
    }

    var total = countTreeDesc(roots);
    var l1 = roots.length;
    el.hidden = false;
    var html = '<div class="live-team-head">';
    html += '<div class="live-tag">YOUR GROWING TEAM</div>';
    html += '<div class="live-team-sort" role="group" aria-label="Sort team tree">';
    html += '<button type="button" class="live-team-sort-btn' + (sortMode === "legs" ? " on" : "") + '" data-team-sort="legs">Most legs</button>';
    html += '<button type="button" class="live-team-sort-btn' + (sortMode === "newest" ? " on" : "") + '" data-team-sort="newest">Newest</button>';
    html += "</div></div>";
    html += '<p class="live-team-lead">Your people, growing together. Tap a person for details — expand a row to see who they’ve brought in.</p>';
    html += '<div class="live-team-stats is-compact">';
    html += '<div class="live-stat"><strong>' + l1 + '</strong><span>Level 1</span></div>';
    html += '<div class="live-stat"><strong>' + total + '</strong><span>on tree</span></div>';
    html += '<div class="live-stat"><strong>' + Math.min(6, graph.depth || 6) + '</strong><span>deep</span></div>';
    html += "</div>";
    html += '<div class="live-team">';
    html += '<div class="live-team-you"><span class="live-team-you-mark" aria-hidden="true">🌿</span> You</div>';
    html += '<div class="live-l1-list">';
    roots.forEach(function (p, idx) {
      var under = countTreeDesc(p.children);
      var ctx = progressById[p.id];
      if (!p.created_at && downlineById[p.id]) {
        p.created_at = downlineById[p.id].profile.created_at;
      }
      cachePerson(p, under, ctx, true);
      var shouldOpen = sortMode === "legs" ? idx < 5 : idx < 3;
      var stSeen = getState ? getState() : null;
      var seededSeen = !!(stSeen && stSeen.data && stSeen.data.teamSeenSeeded);
      var isNew = seededSeen && !ensureTeamSeenMap()[p.id];
      html += '<details class="live-l1' + (under ? " has-kids" : "") + (isNew ? " is-new" : "") + '"' + (shouldOpen ? " open" : "") + '>';
      html += '<summary class="live-l1-sum">';
      html += '<span class="live-l1-rank">' + (idx + 1) + "</span>";
      html += '<span class="live-l1-main">';
      html += '<span class="live-l1-name-row">';
      html += '<button type="button" class="live-l1-name" data-team-person="' + esc(p.id) + '">' +
        esc(p.display_name || p.email) + "</button>";
      html += hubModeChipHtml(p.hub_mode);
      if (isNew) html += '<span class="team-new-chip">New</span>';
      html += "</span>";
      if (ctx) {
        html += '<span class="live-l1-meta">' + ctx.sectionsDone + "/" + ctx.sectionTotal + " sections · " +
          (ctx.daysSinceActive === 0 ? "active today" : ctx.daysSinceActive + "d ago") +
          (p.created_at ? " · joined " + formatJoinedOn(p.created_at) : "") + "</span>";
      } else {
        html += '<span class="live-l1-meta">Joined your link' +
          (p.created_at ? " · " + formatJoinedOn(p.created_at) : "") + "</span>";
      }
      html += "</span>";
      html += '<span class="live-l1-under' + (under ? " on" : "") + '">' +
        (under ? (under + " under") : "building") + "</span>";
      html += "</summary>";
      if (p.children && p.children.length) {
        html += renderKids(p.children, 2);
      } else {
        html += '<p class="live-l1-empty">No one linked under them yet.</p>';
      }
      html += "</details>";
    });
    html += "</div></div>";
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

  function refreshIncomingMessages() {
    if (!Cloud.isSignedIn()) return;
    renderCheers().catch(function () {});
    renderLeaderNoteBanner().catch(function () {});
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

  function weekStartPref(st) {
    return st && st.settings && st.settings.weekStartsOn === "monday" ? 1 : 0;
  }

  function renderTypeOptions(selected) {
    return Cal.EVENT_TYPES.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selected ? " selected" : "") + ">" +
        t.icon + " " + esc(t.label) + "</option>";
    }).join("");
  }

  function vaultMeta() {
    return window.FS.CONTENT_VAULT || { formats: [], promoting: [], contentTypes: [], posts: [], stories: [], hookBank: [], weekPlan: [] };
  }

  function renderFormatOptions(selected) {
    var opts = vaultMeta().formats || [];
    var html = '<option value="">—</option>';
    opts.forEach(function (f) {
      html += '<option value="' + esc(f.id) + '"' + (f.id === selected ? " selected" : "") + ">" + esc(f.label) + "</option>";
    });
    return html;
  }

  function renderPromotingOptions(selected) {
    var opts = vaultMeta().promoting || [];
    var html = '<option value="">—</option>';
    opts.forEach(function (f) {
      html += '<option value="' + esc(f.id) + '"' + (f.id === selected ? " selected" : "") + ">" + esc(f.label) + "</option>";
    });
    return html;
  }

  function promotingLabel(id) {
    var opts = vaultMeta().promoting || [];
    for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i].label;
    return id || "";
  }

  function formatLabel(id) {
    var opts = vaultMeta().formats || [];
    for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i].label;
    return id || "";
  }

  function contentTypeToCalType(ct) {
    if (ct === "soft_invite") return "soft_door";
    if (ct === "review") return "product_curious";
    if (ct === "personal") return "values_flag";
    if (ct === "myth_bust") return "curtain";
    if (ct === "engagement") return "open_loop";
    return "honest_note";
  }

  function buildVaultDraft(post) {
    if (!post) return "";
    var parts = [];
    if (post.hook) parts.push("HOOK\n" + post.hook);
    if (post.altHooks && post.altHooks.length) {
      parts.push("ALT HOOKS\n" + post.altHooks.map(function (h) { return "• " + h; }).join("\n"));
    }
    if (post.slides && post.slides.length) {
      parts.push("SLIDES\n" + post.slides.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n"));
    }
    if (post.onScreen && post.onScreen.length) {
      parts.push("ON-SCREEN\n" + post.onScreen.join("\n"));
    }
    if (post.frames && post.frames.length) {
      parts.push("FRAMES\n" + post.frames.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n"));
    }
    if (post.caption) parts.push("CAPTION\n" + post.caption);
    if (post.keywords && post.keywords.length) parts.push("KEYWORDS · " + post.keywords.join(", "));
    if (post.whyFrame1) parts.push("WHY FRAME 1 WORKS\n" + post.whyFrame1);
    return parts.join("\n\n") || post.body || post.preview || "";
  }

  function cheerTemplates() {
    return (window.FS.CONFIG && window.FS.CONFIG.cheerTemplates) || ["Proud of you — keep going."];
  }

  function cheerIndex() {
    var st = getState();
    if (!st || !st.data) return 0;
    var n = typeof st.data.cheerIdx === "number" ? st.data.cheerIdx : 0;
    var len = cheerTemplates().length || 1;
    return ((n % len) + len) % len;
  }

  function setCheerIndex(n) {
    var st = getState();
    if (!st || !st.data) return;
    st.data.cheerIdx = n;
    persist();
  }

  function advanceCheerTemplate() {
    var len = cheerTemplates().length || 1;
    setCheerIndex((cheerIndex() + 1) % len);
  }

  var cheerPendingPartnerId = null;

  function openCheerSheet(partnerId) {
    closeTeamPersonSheet();
    cheerPendingPartnerId = partnerId;
    var sheet = $("cheerSheet");
    if (sheet) sheet.hidden = false;
    renderCheerSheetPreview();
  }

  function closeCheerSheet() {
    cheerPendingPartnerId = null;
    var sheet = $("cheerSheet");
    if (sheet) sheet.hidden = true;
  }

  function renderCheerSheetPreview() {
    var templates = cheerTemplates();
    var idx = cheerIndex();
    var body = templates[idx] || templates[0] || "";
    var meta = $("cheerSheetMeta");
    var preview = $("cheerSheetBody");
    if (meta) meta.textContent = "Cheer " + (idx + 1) + " of " + templates.length;
    if (preview) preview.textContent = '"' + body + '"';
  }

  async function confirmSendCheer() {
    if (!cheerPendingPartnerId) return;
    var templates = cheerTemplates();
    var idx = cheerIndex();
    var body = templates[idx] || templates[0] || "Proud of you — keep going.";
    var btn = $("cheerConfirmSend");
    try {
      if (btn) btn.textContent = "Sending…";
      await Cloud.sendEvent(cheerPendingPartnerId, "cheer", body);
      appendOutreachLog(cheerPendingPartnerId, "cheer", body);
      advanceCheerTemplate();
      closeCheerSheet();
      if (btn) btn.textContent = "Send this →";
      await renderLeader();
    } catch (err) {
      if (btn) btn.textContent = "Send this →";
      alert(err.message || "Could not send cheer");
    }
  }

  function chipClass(it) {
    var fmt = (it.format || "").toLowerCase();
    var st = it.status || "todo";
    if (fmt === "reel" || fmt === "carousel" || fmt === "story" || fmt === "single" || fmt === "facebook") {
      return "cal-chip fmt-" + fmt + (st !== "todo" ? " is-" + st : "");
    }
    var cat = it.category || "content";
    return "cal-chip cat-" + cat + (st !== "todo" ? " is-" + st : "");
  }

  function renderDayBars(day) {
    var html = '<div class="cal-cell-bars" aria-hidden="true">';
    var shown = 0;
    (day.items || []).forEach(function (it) {
      if (shown >= 3) return;
      if (it.kind === "rest" || it.type === "reactive") return;
      var fmt = (it.format || "").toLowerCase();
      var barClass = (fmt === "reel" || fmt === "carousel" || fmt === "story" || fmt === "single" || fmt === "facebook")
        ? ("fmt-" + fmt)
        : ("cat-" + (it.category || "content"));
      html += '<span class="cal-bar ' + esc(barClass) +
        (it.status === "posted" ? " is-posted" : "") +
        (it.status === "skipped" ? " is-skipped" : "") + '"></span>';
      shown++;
    });
    if (!((day.items || []).length) && day.suggested && shown < 3) {
      html += '<span class="cal-bar ghost"></span>';
      shown++;
    }
    if (!shown && (day.items || []).some(function (it) { return it.kind === "rest" || it.type === "reactive"; })) {
      html += '<span class="cal-bar cat-rest"></span>';
    }
    html += "</div>";
    return html;
  }

  function renderDayChips(day) {
    var html = "";
    (day.items || []).forEach(function (it) {
      html += '<button type="button" class="' + chipClass(it) + '" data-cal-edit="' + day.date + '" data-cal-item="' + it.id + '">';
      if (it.format) html += '<span class="cal-chip-fmt">' + esc(formatLabel(it.format) || it.format) + "</span>";
      else html += '<span class="cal-chip-ico">' + (it.icon || "·") + "</span>";
      html += '<span class="cal-chip-txt">' + esc(it.person ? it.person : (it.title || it.label)) + "</span>";
      html += "</button>";
    });
    if (!(day.items || []).length && day.suggested) {
      html += '<button type="button" class="cal-chip ghost" data-cal-accept="' + day.date + '">';
      html += '<span class="cal-chip-ico">' + day.suggested.icon + "</span>";
      html += '<span class="cal-chip-txt">' + esc(day.suggested.label) + "</span>";
      html += "</button>";
    }
    return html;
  }

  function countDated(days) {
    var n = 0;
    (days || []).forEach(function (d) {
      var has = (d.items || []).some(function (it) {
        return !(it.kind === "rest" || it.type === "reactive");
      });
      if (!has && d.suggested) has = true;
      if (has) n++;
    });
    return n;
  }

  function renderDayDetail(day) {
    var el = $("calendarDayDetail");
    if (!el) return;
    if (!day) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    var dt = Cal.parseYmd(day.date);
    var label = Cal.DOW[dt.getDay()] + " · " + Cal.MON[dt.getMonth()] + " " + dt.getDate();
    var chips = renderDayChips(day);
    el.innerHTML =
      '<div class="cal-day-detail-head">' +
        '<div><span class="cal-day-detail-kicker">Selected day</span>' +
        '<strong class="cal-day-detail-title">' + esc(label) + "</strong></div>" +
        '<button type="button" class="cal-day-detail-add" data-cal-new="' + day.date + '">＋ Add</button>' +
      "</div>" +
      (chips
        ? '<div class="cal-day-detail-chips">' + chips + "</div>"
        : '<p class="cal-day-detail-empty">Nothing on this day yet — add a card or open the Post vault.</p>');
  }

  function renderCalendar() {
    var grid = $("calendarGrid");
    var navEl = $("calendarWeekNav");
    var toggleEl = $("calendarViewToggle");
    var datedEl = $("calendarDated");
    if (!grid || !getState) return;
    var state = getState();
    if (!state || !state.data) return;
    if (!state.data.calendar) state.data.calendar = {};
    if (typeof state.data.calendarWeekOffset !== "number") state.data.calendarWeekOffset = 0;
    if (typeof state.data.calendarMonthOffset !== "number") state.data.calendarMonthOffset = 0;
    if (!state.data.calendarView) state.data.calendarView = "month";
    if (!state.data.libraryTab) state.data.libraryTab = "hooks";
    /* Blank by default — no setup chrome; fill cadence only if they already opted in. */
    if (state.data.calendarCadence !== true && state.data.calendarCadence !== false) {
      state.data.calendarCadence = false;
    }

    var view = state.data.calendarView === "week" ? "week" : "month";
    var useCadence = cadenceEnabled(state);
    var weekStart = weekStartPref(state);
    var plan = Cal.plan(window.FS.CONFIG, state.data.calendar, state.data, {
      cadence: useCadence,
      weekStart: weekStart
    });

    var todayKey = Cal.ymd(new Date());
    var slice = view === "month"
      ? Cal.monthSlice(plan, new Date(), state.data.calendarMonthOffset, weekStart)
      : Cal.weekSlice(plan, new Date(), state.data.calendarWeekOffset, weekStart);
    var visibleDays = view === "month" ? (slice.cells || []) : (slice.days || []);

    if (!state.data.calendarSelected) state.data.calendarSelected = todayKey;
    var selectedKey = state.data.calendarSelected;

    var monthDatedSource = view === "month"
      ? visibleDays.filter(function (d) { return d.inMonth; })
      : visibleDays;
    var datedCount = countDated(monthDatedSource);

    if (toggleEl) {
      var btns = toggleEl.querySelectorAll("[data-cal-view]");
      for (var ti = 0; ti < btns.length; ti++) {
        var on = btns[ti].getAttribute("data-cal-view") === view;
        btns[ti].classList.toggle("on", on);
        btns[ti].setAttribute("aria-selected", on ? "true" : "false");
      }
    }

    if (datedEl) datedEl.textContent = datedCount + " dated";

    if (navEl) {
      var off = view === "month" ? state.data.calendarMonthOffset : state.data.calendarWeekOffset;
      navEl.innerHTML =
        '<button type="button" class="cal-nav-btn" data-cal-nav="-1" aria-label="Previous">‹</button>' +
        '<span class="cal-nav-label">' + esc(slice.label || "") + "</span>" +
        '<button type="button" class="cal-nav-btn" data-cal-nav="1" aria-label="Next">›</button>' +
        (off ? '<button type="button" class="cal-nav-today" data-cal-nav="0">Today</button>' : "");
    }

    grid.className = "cal-grid " + (view === "month" ? "cal-grid-month" : "cal-grid-week");
    var html = "";
    if (view === "month") {
      html += '<div class="cal-month-dows">' + Cal.dowLabels(weekStart).map(function (d) {
        return "<span>" + d.slice(0, 3) + "</span>";
      }).join("") + "</div>";
      html += '<div class="cal-month-cells">';
      visibleDays.forEach(function (d) {
        html += '<button type="button" class="cal-cell' +
          (d.date === selectedKey ? " on" : "") +
          (d.date === todayKey ? " today" : "") +
          (d.inMonth ? "" : " out") + '" data-cal-select="' + d.date + '" aria-label="' + esc(d.date) + '">';
        html += '<span class="cal-cell-num">' + d.dayNum + "</span>";
        html += renderDayBars(d);
        html += "</button>";
      });
      html += "</div>";
    } else {
      visibleDays.forEach(function (d) {
        var dt = Cal.parseYmd(d.date);
        html += '<div class="cal-cell week' +
          (d.date === selectedKey ? " on" : "") +
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

    var selectedDay = Cal.findDay(plan, selectedKey);
    if (!selectedDay) {
      for (var si = 0; si < visibleDays.length; si++) {
        if (visibleDays[si].date === selectedKey) { selectedDay = visibleDays[si]; break; }
      }
    }
    if (view === "month") renderDayDetail(selectedDay);
    else {
      var detailEl = $("calendarDayDetail");
      if (detailEl) { detailEl.innerHTML = ""; detailEl.hidden = true; }
    }

    renderLibrary();
    if (state.data.calendarEditing) renderCalEditor();
  }

  function renderLibrary() {
    var tabs = $("libraryTabs");
    var list = $("libraryList");
    if (!tabs || !list) return; /* Post ideas library replaced by Content vault CTAs */
    var target = $("libraryTarget");
    if (!getState) return;
    var st = getState();
    var buckets = Cal.libraryBuckets();
    var active = st.data.libraryTab || "hooks";
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
    } else {
      bucket.items.forEach(function (it) {
        var meta = Cal.typeMeta ? Cal.typeMeta(it.type) : null;
        html += '<button type="button" class="cal-lib-card" data-lib-open="' + esc(bucket.id) + '" data-lib-id="' + esc(it.id) + '">';
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

  function renderCuriosityPhotos() {
    var root = $("curiosityPhotosRoot");
    if (!root) return;
    var list = (window.FS.CONTENT && window.FS.CONTENT.curiosityImages) || [];
    var html =
      '<div class="curio-photos-nav">' +
        '<button type="button" class="prod-pill on" data-goto="tend">← Back to Content</button>' +
      "</div>" +
      '<p class="eyebrow">FOR YOUR CURIOSITY POSTS</p>' +
      '<h1 class="curio-photos-title">Curiosity photos</h1>' +
      '<p class="curio-photos-intro">Tap a circle to open the full photo. Press and hold the image to save it to your camera roll — then pair it with a post from the vault.</p>';

    if (!list.length) {
      html += '<p class="cal-lib-hint">No photos yet — check back soon.</p>';
      root.innerHTML = html;
      return;
    }

    html += '<div class="curio-photo-circles" role="list">';
    list.forEach(function (it) {
      var resolved = Cal.resolveCuriosityImage ? Cal.resolveCuriosityImage(it.id) : null;
      if (!resolved) return;
      html += '<button type="button" class="curio-photo-circle" role="listitem" data-curio-open="' + esc(it.id) + '" aria-label="Open ' + esc(it.title) + '">';
      html += '<span class="curio-photo-circle-img-wrap">';
      html += '<img src="' + esc(resolved.thumb) + '" alt="" loading="lazy" decoding="async" width="120" height="120">';
      html += "</span>";
      html += '<span class="curio-photo-circle-label">' + esc(it.title) + "</span>";
      html += "</button>";
    });
    html += "</div>";
    root.innerHTML = html;
  }

  function openCuriosityLightbox(imageId) {
    var resolved = Cal.resolveCuriosityImage ? Cal.resolveCuriosityImage(imageId) : null;
    var box = $("curiosityLightbox");
    var img = $("curiosityLightboxImg");
    var title = $("curiosityLightboxTitle");
    var pairs = $("curiosityLightboxPairs");
    if (!resolved || !box || !img) return;
    if (title) title.textContent = resolved.title || "Photo";
    img.src = resolved.src;
    img.alt = resolved.alt || resolved.title || "";
    if (pairs) {
      if (resolved.pairsWith) {
        pairs.hidden = false;
        pairs.textContent = "Pairs well with: " + resolved.pairsWith;
      } else {
        pairs.hidden = true;
        pairs.textContent = "";
      }
    }
    box.hidden = false;
    document.body.classList.add("curio-lightbox-open");
  }

  function closeCuriosityLightbox() {
    var box = $("curiosityLightbox");
    var img = $("curiosityLightboxImg");
    if (box) box.hidden = true;
    if (img) {
      img.removeAttribute("src");
      img.alt = "";
    }
    document.body.classList.remove("curio-lightbox-open");
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
    if (bucketId === "vault" || findVaultPost(itemId)) {
      openVaultIdea(itemId);
      return;
    }
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
      pairsWith: lib.pairsWith || "",
      format: lib.format || "",
      promoting: lib.promoting || ""
    };
    persist();
    renderVaultEditor();
    openCalSheet();
  }

  function renderLibraryEditor() {
    renderVaultEditor();
  }

  function commitLibraryIdea() {
    var st = getState();
    if (!st || !st.data.libraryEditing) return;
    var ed = st.data.libraryEditing;
    var titleIn = $("libTitle");
    var draftIn = $("libDraft");
    if (titleIn) ed.title = titleIn.value;
    if (draftIn) ed.body = draftIn.value;
    var fmtIn = $("libFormat");
    var promIn = $("libPromoting");
    if (fmtIn) ed.format = fmtIn.value;
    if (promIn) ed.promoting = promIn.value;
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
      imageId: ed.imageId || "",
      format: ed.format || "",
      promoting: ed.promoting || "",
      vaultId: ed.vaultId || ""
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
      '<div class="vault-field-row">' +
        '<label class="field"><span class="field-label">Type</span>' +
          '<select id="calType" class="cal-select">' + renderTypeOptions(item.type) + "</select></label>" +
        '<label class="field"><span class="field-label">Promoting</span>' +
          '<select id="calPromoting" class="cal-select">' + renderPromotingOptions(item.promoting || "") + "</select></label>" +
      "</div>" +
      '<label class="field"><span class="field-label">Format</span>' +
        '<select id="calFormat" class="cal-select">' + renderFormatOptions(item.format || "") + "</select></label>" +
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
    var fmtEl = $("calFormat");
    if (fmtEl) fmtEl.addEventListener("change", function () {
      var it = itemRow(); if (!it) return;
      it.format = fmtEl.value;
      touch(false);
    });
    var promEl = $("calPromoting");
    if (promEl) promEl.addEventListener("change", function () {
      var it = itemRow(); if (!it) return;
      it.promoting = promEl.value;
      touch(false);
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
      html += '<div class="leads-card-identity">';
      html += '<div class="leads-card-name">' + esc(r.name) + "</div>";
      if (contact.length) html += '<div class="leads-card-meta">' + contact.join(" · ") + "</div>";
      html += "</div>";
      html += '<div class="leads-card-tags"><span class="leads-pill">' + esc(interestLabel(r.interest)) + "</span>";
      html += '<span class="leads-pill soft">' + esc(statusLabel(r.status)) + "</span></div></div>";
      if (when) html += '<div class="leads-card-when">' + esc(when) + "</div>";
      html += '<div class="leads-card-actions">';
      if (r.status === "new") {
        html += '<button type="button" class="leads-action is-primary" data-lead-status="' + esc(r.id) + '" data-status="reached">Reached out</button>';
      }
      if (r.status === "reached" || r.status === "new") {
        html += '<button type="button" class="leads-action" data-lead-status="' + esc(r.id) + '" data-status="done">Done</button>';
      }
      if (r.status !== "archived") {
        html += '<button type="button" class="leads-action is-quiet" data-lead-status="' + esc(r.id) + '" data-status="archived">Archive</button>';
      }
      if (r.status === "archived") {
        html += '<button type="button" class="leads-action is-primary" data-lead-status="' + esc(r.id) + '" data-status="new">Restore</button>';
      }
      html += "</div></article>";
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
    if (Cloud.isSignedIn() && !(getState && getState().active === "leader")) {
      refreshTeamBadge().catch(function () {});
    }
    if (typeof window.FS.onAuthReady === "function") {
      try { window.FS.onAuthReady(Cloud.user()); } catch (e) {}
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var personSheet = $("teamPersonSheet");
        if (personSheet && !personSheet.hidden) {
          closeTeamPersonSheet();
          return;
        }
        var box = $("curiosityLightbox");
        if (box && !box.hidden) {
          closeCuriosityLightbox();
          return;
        }
      }
      if (e.key !== "Enter") return;
      var overlay = $("authOverlay");
      if (!overlay || !overlay.classList.contains("open")) return;
      if (document.activeElement && (document.activeElement.id === "authPassword" || document.activeElement.id === "authEmail")) {
        e.preventDefault();
        var sb = $("authSubmitBtn");
        if (sb) sb.click();
      }
    });
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.hasAttribute("data-vault-format") || t.hasAttribute("data-vault-promoting")) {
        var id = t.getAttribute("data-vault-format") || t.getAttribute("data-vault-promoting");
        var st = getState();
        if (!st.data.vaultOverrides) st.data.vaultOverrides = {};
        var cur = st.data.vaultOverrides[id] || {};
        if (t.hasAttribute("data-vault-format")) cur.format = t.value;
        if (t.hasAttribute("data-vault-promoting")) cur.promoting = t.value;
        st.data.vaultOverrides[id] = cur;
        persist();
        paintVaultBubble(t);
        var card = t.closest(".vault-card");
        if (card && cur.format) {
          card.className = "vault-card fmt-" + (cur.format || "single");
        }
        if (card) {
          var chips = card.querySelector(".vault-card-chips");
          if (chips) {
            var fmtSel = card.querySelector("[data-vault-format]");
            var promoSel = card.querySelector("[data-vault-promoting]");
            chips.innerHTML = formatChipHtml(fmtSel ? fmtSel.value : cur.format) +
              promotingChipHtml(promoSel ? promoSel.value : cur.promoting);
          }
        }
        var src = t.getAttribute("data-vault-source") || "vault";
        if (src === "week") renderContentWeek();
        else renderContentVault();
      }
    });

    document.addEventListener("click", async function (e) {
      var t = e.target.closest(
        "#authOpenBtn,#authCloseBtn,#authSubmitBtn,#authCreateBtn,#authSignOutBtn,#railCopyInvite,#leaderCopyInvite,#authCopyInvite," +
        "#teamInviteOpen,#teamInviteClose,#teamInviteX,#exportBridgeBtn,#importLiveTreeBtn,#cheerDismiss,#notifySponsorBtn,[data-goto-bridge],[data-copy-nudge],[data-cheer],[data-note],[data-leader-log]," +
        "#cheerSheetClose,#cheerSheetCancel,#cheerChooseAnother,#cheerConfirmSend," +
        "#teamPersonClose,#teamPersonX,#teamPersonCancel,[data-team-sort],[data-team-person]," +
        "[data-cal-day],[data-cal-select],[data-cal-status],[data-cal-swap],[data-cal-week],[data-cal-nav],[data-cal-view],[data-cal-add],[data-cal-clear]," +
        "[data-cal-new],[data-cal-edit],[data-cal-item],[data-cal-accept],[data-cal-cadence],[data-cal-setup-toggle],[data-cal-save],[data-cal-delete]," +
        "[data-lib-tab],[data-lib-open],[data-lib-commit],[data-lib-add],[data-curio-open]," +
        "[data-vault-open],[data-vault-lane],[data-vault-week],[data-vault-format-tab],[data-vault-promoting-tab]," +
        "#curiosityLightboxClose,#curiosityLightboxX,#calSheetClose,#calSheetX," +
        "#leadsSignInBtn,#leadsCopyLink,#leadsPageSettingsBtn,#leadsPageSettingsSave,[data-leads-filter],[data-lead-status]"
      );
      if (!t) return;

      if (t.hasAttribute("data-vault-open")) {
        openVaultIdea(t.getAttribute("data-vault-open"));
        return;
      }
      if (t.hasAttribute("data-vault-format-tab")) {
        var vbFmt = ensureVaultBrowse("vault");
        vbFmt.format = t.getAttribute("data-vault-format-tab") || "";
        persist();
        renderContentVault();
        return;
      }
      if (t.hasAttribute("data-vault-promoting-tab")) {
        var vbPromo = ensureVaultBrowse("vault");
        vbPromo.promoting = t.getAttribute("data-vault-promoting-tab") || "";
        vbPromo.lane = "all";
        persist();
        renderContentVault();
        return;
      }
      if (t.hasAttribute("data-vault-lane")) {
        var vb = ensureVaultBrowse("vault");
        vb.lane = t.getAttribute("data-vault-lane") || "all";
        persist();
        renderContentVault();
        return;
      }
      if (t.hasAttribute("data-vault-week")) {
        var stW = getState();
        stW.data.vaultWeekIndex = parseInt(t.getAttribute("data-vault-week"), 10) || 1;
        persist();
        renderContentWeek();
        return;
      }
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
      if (t.id === "teamInviteOpen") {
        var pop = $("teamInvitePop");
        var openBtn = $("teamInviteOpen");
        var back = $("teamInviteClose");
        if (pop) {
          var opening = pop.hidden;
          pop.hidden = !opening;
          if (back) back.hidden = !opening;
          if (openBtn) openBtn.setAttribute("aria-expanded", opening ? "true" : "false");
          if (opening) {
            var copyFocus = $("leaderCopyInvite");
            if (copyFocus) setTimeout(function () { try { copyFocus.focus(); } catch (e) {} }, 40);
          }
        }
        return;
      }
      if (t.id === "teamInviteClose" || t.id === "teamInviteX") {
        var popClose = $("teamInvitePop");
        var openBtn2 = $("teamInviteOpen");
        var back2 = $("teamInviteClose");
        if (popClose) popClose.hidden = true;
        if (back2) back2.hidden = true;
        if (openBtn2) {
          openBtn2.setAttribute("aria-expanded", "false");
          openBtn2.focus();
        }
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
            var label = t.getAttribute("data-copy-label") || "Copy message";
            t.textContent = "Copied ✓";
            setTimeout(function () { t.textContent = label; }, 1400);
          });
        }
        return;
      }
      if (t.id === "teamPersonClose" || t.id === "teamPersonX" || t.id === "teamPersonCancel") {
        closeTeamPersonSheet();
        return;
      }
      if (t.hasAttribute("data-team-sort")) {
        setTeamSortMode(t.getAttribute("data-team-sort"));
        var sortRows = await Cloud.listDownline();
        var sortGraph = await Cloud.listTeamGraph();
        await renderLiveTeamGraph(sortGraph, sortRows);
        return;
      }
      if (t.hasAttribute("data-team-person")) {
        e.preventDefault();
        e.stopPropagation();
        openTeamPersonSheet(t.getAttribute("data-team-person"));
        return;
      }
      if (t.hasAttribute("data-cheer")) {
        openCheerSheet(t.getAttribute("data-cheer"));
        return;
      }
      if (t.hasAttribute("data-leader-log")) {
        var logPid = t.getAttribute("data-leader-log");
        var stLog = getState();
        if (!stLog.data.leaderLogOpen) stLog.data.leaderLogOpen = {};
        stLog.data.leaderLogOpen[logPid] = !stLog.data.leaderLogOpen[logPid];
        persist();
        var wrap = t.closest(".leader-log");
        var panel = wrap && wrap.querySelector(".leader-log-panel");
        var chev = t.querySelector(".leader-log-chev");
        var open = !!stLog.data.leaderLogOpen[logPid];
        t.setAttribute("aria-expanded", open ? "true" : "false");
        if (panel) panel.hidden = !open;
        if (chev) chev.textContent = open ? "▴" : "▾";
        return;
      }
      if (t.id === "cheerSheetClose" || t.id === "cheerSheetCancel") {
        closeCheerSheet();
        return;
      }
      if (t.id === "cheerChooseAnother") {
        advanceCheerTemplate();
        renderCheerSheetPreview();
        return;
      }
      if (t.id === "cheerConfirmSend") {
        await confirmSendCheer();
        return;
      }
      if (t.hasAttribute("data-note")) {
        closeTeamPersonSheet();
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
          appendOutreachLog(notePid, "note", noteBody);
          t.textContent = "Saved ✓";
          setTimeout(function () { t.textContent = "Leave note"; }, 1400);
          await renderLeader();
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
      if (t.id === "curiosityLightboxClose" || t.id === "curiosityLightboxX") {
        closeCuriosityLightbox();
        return;
      }
      if (t.hasAttribute("data-curio-open")) {
        openCuriosityLightbox(t.getAttribute("data-curio-open"));
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
        growthToast: typeof local.settings.growthToast === "boolean" ? local.settings.growthToast : true,
        weekStartsOn: local.settings.weekStartsOn === "monday" ? "monday" : "sunday"
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

  function ensureVaultBrowse(kind) {
    var st = getState();
    if (!st.data.vaultBrowse) st.data.vaultBrowse = {};
    if (!st.data.vaultBrowse[kind]) {
      st.data.vaultBrowse[kind] = { q: "", format: "", promoting: "", lane: "all" };
    }
    return st.data.vaultBrowse[kind];
  }

  function findVaultPost(id) {
    var V = vaultMeta();
    var i;
    for (i = 0; i < (V.posts || []).length; i++) if (V.posts[i].id === id) return V.posts[i];
    for (i = 0; i < (V.stories || []).length; i++) if (V.stories[i].id === id) return V.stories[i];
    return null;
  }

  function allVaultItems() {
    var V = vaultMeta();
    return (V.posts || []).concat(V.stories || []);
  }

  function formatChipHtml(formatId) {
    var id = (formatId || "").toLowerCase() || "single";
    var label = formatLabel(id) || id;
    return '<span class="fmt-chip fmt-' + esc(id) + '">' + esc(label) + "</span>";
  }

  function promotingChipHtml(promotingId) {
    if (!promotingId) return "";
    var label = promotingLabel(promotingId) || promotingId;
    return '<span class="promo-chip promo-' + esc(promotingId) + '">' + esc(label) + "</span>";
  }

  function formatSelectClass(formatId) {
    var id = (formatId || "").toLowerCase();
    return "cal-select vault-inline-select vault-bubble" + (id ? " fmt-" + id + " is-set" : "");
  }

  function promotingSelectClass(promotingId) {
    var id = (promotingId || "").toLowerCase();
    return "cal-select vault-inline-select vault-bubble promo-bubble" + (id ? " promo-" + id + " is-set" : "");
  }

  function paintVaultBubble(el) {
    if (!el) return;
    var isFmt = el.hasAttribute("data-vault-format") || el.id === "libFormat";
    var isPromo = el.hasAttribute("data-vault-promoting") || el.id === "libPromoting";
    if (!isFmt && !isPromo) return;
    var val = (el.value || "").toLowerCase();
    el.className = isFmt ? formatSelectClass(val) : promotingSelectClass(val);
    if (el.id === "libFormat" || el.id === "libPromoting") {
      el.className = el.className.replace("vault-inline-select", "vault-sheet-select");
    }
  }

  function vaultCardHtml(post, source) {
    var st = getState();
    var ov = (st && st.data.vaultOverrides && st.data.vaultOverrides[post.id]) || {};
    var format = ov.format || post.format || "";
    var promoting = ov.promoting || post.promoting || "";
    var needs = (post.verify || []).some(function (v) { return v.status === "needs_check"; });
    var fmtClass = "fmt-" + (format || "single");
    var html = '<article class="vault-card ' + fmtClass + '">';
    html += '<button type="button" class="vault-card-main" data-vault-open="' + esc(post.id) + '" data-vault-source="' + esc(source) + '">';
    html += '<div class="vault-card-top">';
    html += '<div class="vault-card-chips">' + formatChipHtml(format) + promotingChipHtml(promoting) + "</div>";
    if (needs) html += '<span class="vault-verify-chip">Check facts</span>';
    html += "</div>";
    html += '<h3 class="vault-card-title">' + esc(post.title) + "</h3>";
    html += '<p class="vault-card-hook">' + esc(post.hook || post.preview || "") + "</p>";
    html += '<span class="vault-card-open">Open →</span>';
    html += "</button>";
    html += '<div class="vault-card-meta">';
    html += '<label class="vault-mini-field"><span>Type</span><select class="' + formatSelectClass(format) + '" data-vault-format="' + esc(post.id) + '" data-vault-source="' + esc(source) + '">' +
      renderFormatOptions(format) + "</select></label>";
    html += '<label class="vault-mini-field"><span>Promoting</span><select class="' + promotingSelectClass(promoting) + '" data-vault-promoting="' + esc(post.id) + '" data-vault-source="' + esc(source) + '">' +
      renderPromotingOptions(promoting) + "</select></label>";
    html += "</div></article>";
    return html;
  }

  function filterVaultList(list, browse) {
    var q = (browse.q || "").trim().toLowerCase();
    return (list || []).filter(function (p) {
      if (browse.format && p.format !== browse.format) return false;
      if (browse.promoting && p.promoting !== browse.promoting) return false;
      if (browse.lane && browse.lane !== "all") {
        if (browse.lane === "stories") {
          if (p.format !== "story" && p.kind !== "story" && p.lane !== "stories") return false;
        } else if (p.lane !== browse.lane) {
          return false;
        }
      }
      if (!q) return true;
      var blob = [p.id, p.title, p.hook, p.preview, p.caption, p.topic, (p.keywords || []).join(" ")].join(" ").toLowerCase();
      return blob.indexOf(q) > -1;
    });
  }

  function renderVaultFilters(browse) {
    var html = '<div class="vault-filters">';
    html += '<label class="vault-filter"><span class="sr-only">Search</span><input type="search" class="prod-search" id="vaultSearch" placeholder="Search hooks, products, topics…" value="' + esc(browse.q || "") + '" autocomplete="off"></label>';

    html += '<div class="vault-filter-group">';
    html += '<div class="vault-filter-label">Content type</div>';
    html += '<div class="vault-chip-row" role="tablist" aria-label="Content type">';
    [
      { id: "", label: "All" },
      { id: "reel", label: "Reels" },
      { id: "carousel", label: "Carousels" },
      { id: "story", label: "Stories" },
      { id: "single", label: "Singles" },
      { id: "facebook", label: "Facebook" }
    ].forEach(function (f) {
      var on = (browse.format || "") === f.id;
      html += '<button type="button" class="vault-filter-chip fmt-tab' + (f.id ? " fmt-" + f.id : "") + (on ? " on" : "") + '" data-vault-format-tab="' + esc(f.id) + '" role="tab" aria-selected="' + (on ? "true" : "false") + '">' + esc(f.label) + "</button>";
    });
    html += "</div></div>";

    html += '<div class="vault-filter-group">';
    html += '<div class="vault-filter-label">Content pillar</div>';
    html += '<div class="vault-chip-row" role="tablist" aria-label="Content pillar">';
    var pillars = [{ id: "", label: "All" }].concat(vaultMeta().promoting || []);
    pillars.forEach(function (p) {
      var on = (browse.promoting || "") === (p.id || "");
      html += '<button type="button" class="vault-filter-chip promo-tab' + (p.id ? " promo-" + p.id : "") + (on ? " on" : "") + '" data-vault-promoting-tab="' + esc(p.id || "") + '" role="tab" aria-selected="' + (on ? "true" : "false") + '">' + esc(p.label) + "</button>";
    });
    html += "</div></div></div>";
    return html;
  }

  function wireVaultFilters(kind, rerender) {
    var browse = ensureVaultBrowse(kind);
    var search = $("vaultSearch");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", function () {
        browse.q = search.value;
        persist();
        rerender();
      });
    }
  }

  function renderContentVault() {
    var root = $("contentVaultRoot");
    if (!root || !getState) return;
    var browse = ensureVaultBrowse("vault");
    var list = filterVaultList(allVaultItems(), browse);
    var html =
      '<div class="talk-guide-nav"><button type="button" class="prod-pill on" data-goto="tend">← Back to Content</button></div>' +
      '<p class="eyebrow">POST VAULT</p>' +
      '<h1 class="prod-head-title">Posts, Reels &amp; Stories</h1>' +
      '<p class="prod-head-sub">Tap a type or pillar to filter, open a card, rewrite in your voice, then add it to a day.</p>' +
      '<p class="vault-target-line">Adding to <strong>' + esc(selectedDayLabel(getState())) + "</strong> · tap a calendar day first to change</p>" +
      renderVaultFilters(browse) +
      '<p class="vault-count">' + list.length + " idea" + (list.length === 1 ? "" : "s") + "</p>" +
      '<div class="vault-card-list">';
    list.forEach(function (p) { html += vaultCardHtml(p, "vault"); });
    if (!list.length) html += '<p class="cal-lib-hint">Nothing matches those filters.</p>';
    html += "</div>";
    root.innerHTML = html;
    wireVaultFilters("vault", renderContentVault);
  }

  function renderContentStories() {
    /* Stories live in the Post vault now — keep for old deep-links. */
    var st = getState();
    if (st && st.data) {
      var browse = ensureVaultBrowse("vault");
      browse.format = "story";
      persist();
    }
    if (gotoPanel) gotoPanel("content-vault");
    else renderContentVault();
  }

  function currentWeekIndex() {
    var st = getState();
    var saved = st.data.vaultWeekIndex;
    if (saved >= 1 && saved <= 8) return saved;
    return 1;
  }

  function parseWeekDayNote(note) {
    var text = note || "";
    var idMatch = text.match(/\b([PMBLS]\d+[a-z]?)\b/);
    var goal = "";
    var parts = text.split("·");
    if (parts.length > 1) goal = parts[parts.length - 1].trim().replace(/\[.*?\]/g, "").trim();
    return { vaultId: idMatch ? idMatch[1] : null, goal: goal, isRest: /^\s*rest\b/i.test(text) };
  }

  function weekDayCardHtml(d) {
    var parsed = parseWeekDayNote(d.note);
    var post = parsed.vaultId ? findVaultPost(parsed.vaultId) : null;
    if (parsed.isRest && !post) {
      return '<div class="vault-week-day is-rest">' +
        '<div class="vault-week-dow">' + esc(d.dow) + "</div>" +
        '<div class="vault-week-body"><span class="fmt-chip fmt-rest">Rest</span>' +
        '<p class="vault-week-title">Soft day</p>' +
        '<p class="vault-week-goal">' + esc((d.note || "").replace(/^\s*rest\s*\/?\s*/i, "") || "Repost what worked, or skip.") + "</p></div></div>";
    }
    if (post) {
      var goal = parsed.goal || "";
      return '<button type="button" class="vault-week-day is-openable fmt-' + esc(post.format || "single") + '" data-vault-open="' + esc(post.id) + '">' +
        '<div class="vault-week-dow">' + esc(d.dow) + "</div>" +
        '<div class="vault-week-body">' +
        '<div class="vault-card-chips">' + formatChipHtml(post.format) + (goal ? '<span class="vault-week-goal-chip">' + esc(goal) + "</span>" : "") + "</div>" +
        '<p class="vault-week-title">' + esc(post.title) + "</p>" +
        '<p class="vault-week-hook">' + esc(post.hook || "") + "</p>" +
        '<span class="vault-card-open">Open →</span></div></button>';
    }
    return '<div class="vault-week-day">' +
      '<div class="vault-week-dow">' + esc(d.dow) + "</div>" +
      '<div class="vault-week-body"><p class="vault-week-title">' + esc(d.note || "") + "</p></div></div>";
  }

  function renderContentWeek() {
    var root = $("contentWeekRoot");
    if (!root || !getState) return;
    var V = vaultMeta();
    var weekIdx = currentWeekIndex();
    var plan = (V.weekPlan || []).filter(function (w) { return w.week === weekIdx; })[0];
    var html =
      '<div class="talk-guide-nav"><button type="button" class="prod-pill on" data-goto="tend">← Back to Content</button></div>' +
      '<p class="eyebrow">8-WEEK ROTATION</p>' +
      '<h1 class="prod-head-title">This week\'s plan</h1>' +
      '<p class="prod-head-sub">A suggested rhythm — not a cage. Tap any day to open the ready post.</p>' +
      '<div class="vault-week-nav">';
    for (var w = 1; w <= 8; w++) {
      html += '<button type="button" class="vault-lane' + (w === weekIdx ? " on" : "") + '" data-vault-week="' + w + '">W' + w + "</button>";
    }
    html += "</div>";
    if (!plan) {
      html += '<p class="cal-lib-hint">Week plan missing.</p>';
      root.innerHTML = html;
      return;
    }
    html += '<div class="vault-week-theme"><div class="fact-label">Week ' + weekIdx + '</div><p>' + esc(plan.theme) + "</p></div>";
    html += '<div class="vault-week-days">';
    (plan.days || []).forEach(function (d) { html += weekDayCardHtml(d); });
    html += "</div>";
    root.innerHTML = html;
  }

  function openVaultIdea(postId) {
    var st = getState();
    var post = findVaultPost(postId);
    if (!st || !post) return;
    var overrides = (st.data.vaultOverrides && st.data.vaultOverrides[postId]) || {};
    var format = overrides.format || post.format || "";
    var promoting = overrides.promoting || post.promoting || "";
    st.data.calendarEditing = null;
    st.data.libraryEditing = {
      bucketId: "vault",
      itemId: post.id,
      vaultId: post.id,
      type: contentTypeToCalType(post.contentType),
      title: post.title || "",
      body: buildVaultDraft(post),
      format: format,
      promoting: promoting,
      icon: "",
      imageId: "",
      image: "",
      alt: "",
      pairsWith: "",
      verify: post.verify || []
    };
    persist();
    renderVaultEditor();
    openCalSheet();
  }

  function renderVaultEditor() {
    var detail = $("calendarDetail");
    var titleEl = $("calSheetTitle");
    var st = getState();
    if (!detail || !st || !st.data.libraryEditing) return;
    var ed = st.data.libraryEditing;
    setSheetKicker(ed.format ? formatLabel(ed.format) : (ed.vaultId ? "Vault" : "Post idea"));
    if (titleEl) titleEl.textContent = ed.title || "Post idea";

    var html =
      '<div class="vault-field-row">' +
        '<label class="field"><span class="field-label">Type</span>' +
          '<select id="libFormat" class="' + formatSelectClass(ed.format || "").replace("vault-inline-select", "vault-sheet-select") + '">' + renderFormatOptions(ed.format || "") + "</select></label>" +
        '<label class="field"><span class="field-label">Promoting</span>' +
          '<select id="libPromoting" class="' + promotingSelectClass(ed.promoting || "").replace("vault-inline-select", "vault-sheet-select") + '">' + renderPromotingOptions(ed.promoting || "") + "</select></label>" +
      "</div>" +
      '<label class="field"><span class="field-label">Title</span>' +
        '<input type="text" id="libTitle" class="cal-input" placeholder="Optional short label" value="' + esc(ed.title || "") + '"></label>' +
      '<label class="field"><span class="field-label">Full draft</span>' +
        '<textarea id="libDraft" rows="12" placeholder="Rewrite until it sounds like you…">' + esc(ed.body || "") + "</textarea>" +
        '<span class="cal-lib-sheet-hint">Steal the structure — rewrite in your voice. Edits stay here until you add this to a day.</span></label>' +
      '<p class="cal-lib-sheet-target">Will add to <strong>' + esc(selectedDayLabel(st)) + "</strong>.</p>" +
      '<div class="cal-sheet-actions">' +
        '<button type="button" class="btn" data-lib-commit>Add to day</button>' +
        '<button type="button" class="btn-ghost" data-cal-save>Close</button>' +
      "</div>";
    detail.innerHTML = html;

    function syncEd() {
      var cur = getState();
      if (!cur || !cur.data.libraryEditing) return;
      var titleIn = $("libTitle");
      var draftIn = $("libDraft");
      var fmt = $("libFormat");
      var prom = $("libPromoting");
      if (titleIn) cur.data.libraryEditing.title = titleIn.value;
      if (draftIn) cur.data.libraryEditing.body = draftIn.value;
      if (fmt) cur.data.libraryEditing.format = fmt.value;
      if (prom) cur.data.libraryEditing.promoting = prom.value;
      paintVaultBubble(fmt);
      paintVaultBubble(prom);
      if (cur.data.libraryEditing.vaultId) {
        if (!cur.data.vaultOverrides) cur.data.vaultOverrides = {};
        cur.data.vaultOverrides[cur.data.libraryEditing.vaultId] = {
          format: cur.data.libraryEditing.format,
          promoting: cur.data.libraryEditing.promoting
        };
      }
      if (titleEl && titleIn) titleEl.textContent = titleIn.value || "Post idea";
      persist();
    }
    ["libTitle", "libDraft", "libFormat", "libPromoting"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(id.indexOf("lib") === 0 && (id === "libFormat" || id === "libPromoting") ? "change" : "input", syncEd);
    });
    var draftIn = $("libDraft");
    if (draftIn) {
      setTimeout(function () {
        try { draftIn.focus(); draftIn.setSelectionRange(0, 0); } catch (e) {}
      }, 50);
    }
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
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refreshIncomingMessages();
      });
      window.addEventListener("focus", function () { refreshIncomingMessages(); });
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
    renderCuriosityPhotos: renderCuriosityPhotos,
    closeCuriosityLightbox: closeCuriosityLightbox,
    renderContentVault: renderContentVault,
    renderContentStories: renderContentStories,
    renderContentWeek: renderContentWeek,
    renderPulse: renderPulse,
    renderCheers: renderCheers,
    renderLeaderNoteBanner: renderLeaderNoteBanner,
    refreshIncomingMessages: refreshIncomingMessages,
    renderLeads: renderLeads,
    openAuth: openAuth
  };
})();
