/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — SUGGESTED POST CALENDAR
   4:1 give/ask cadence with reactive rest days.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  var CADENCE = [
    { type: "open_loop", label: "Open Loop", icon: "🔓", give: true },
    { type: "curtain", label: "Behind the Curtain", icon: "🎬", give: true },
    { type: "honest_note", label: "Honest Note", icon: "📝", give: true },
    { type: "values_flag", label: "Values Flag", icon: "🚩", give: true },
    { type: "soft_door", label: "Soft Door", icon: "🚪", give: false },
    { type: "reactive", label: "Real life / reply day", icon: "💬", give: true, reactive: true },
    { type: "reactive", label: "Rest or engage", icon: "🌿", give: true, reactive: true }
  ];

  function ymd(d) {
    var y = d.getFullYear();
    var m = (d.getMonth() + 1);
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseYmd(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function seedTypeById(id) {
    var types = window.FS.SEED_TYPES || [];
    for (var i = 0; i < types.length; i++) if (types[i].id === id) return types[i];
    return null;
  }

  function draftFromRoots(type, data) {
    data = data || {};
    var why = (data.why || "").trim();
    var moment = (data.moment || "").trim();
    var st = seedTypeById(type);
    if (type === "reactive") {
      return "No post required today. Reply to comments, check DMs, or live your life. Consistency includes rest.";
    }
    if (type === "open_loop" && (moment || why)) {
      var base = moment || why;
      var clipped = base.length > 180 ? base.slice(0, 180) + "…" : base;
      return clipped + " — more on this soon.";
    }
    if (type === "curtain") {
      return "Currently: figuring out how to talk about this new thing without sounding like a commercial. Still learning. Still in.";
    }
    if (type === "honest_note") {
      return "Honest note: I'm still early with these products, so I'm sharing what I notice as I go — not a highlight reel.";
    }
    if (type === "values_flag") {
      return why
        ? ("Something I care about: " + (why.length > 160 ? why.slice(0, 160) + "…" : why))
        : "I care more about what's in a product than how pretty the bottle is. That's my bar.";
    }
    if (type === "soft_door") {
      return "If you want quiet updates as this opens in the US, DM me FRESH. No pitch — just first in line if you want it.";
    }
    return (st && st.example) || "Write something true and specific today.";
  }

  function buildRange(startDate, endDate) {
    var days = [];
    var d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    var end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    var i = 0;
    while (d <= end && i < 120) {
      var slot = CADENCE[i % CADENCE.length];
      days.push({
        date: ymd(d),
        dow: d.getDay(),
        type: slot.type,
        label: slot.label,
        icon: slot.icon,
        reactive: !!slot.reactive
      });
      d = addDays(d, 1);
      i++;
    }
    return days;
  }

  function defaultEnd(cfg) {
    var now = new Date();
    var launch = new Date(now.getFullYear(), (cfg.launchDate.month || 11) - 1, cfg.launchDate.day || 1);
    if (launch < now) return addDays(now, 14);
    return launch;
  }

  window.FS.Calendar = {
    ymd: ymd,
    parseYmd: parseYmd,
    addDays: addDays,
    draftFor: draftFromRoots,
    plan: function (cfg, calendarState, rootsData) {
      var today = new Date();
      today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var end = defaultEnd(cfg || window.FS.CONFIG);
      var days = buildRange(today, end);
      calendarState = calendarState || {};
      return days.map(function (day) {
        var saved = calendarState[day.date] || {};
        return {
          date: day.date,
          type: day.type,
          label: day.label,
          icon: day.icon,
          reactive: day.reactive,
          status: saved.status || "todo",
          draft: saved.draft || draftFromRoots(day.type, rootsData)
        };
      });
    },
    weekSlice: function (plan, anchor) {
      anchor = anchor || new Date();
      var start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      var keys = {};
      for (var i = 0; i < 7; i++) keys[ymd(addDays(start, i))] = true;
      var slice = plan.filter(function (d) { return keys[d.date]; });
      /* If plan starts mid-range, keep order by date */
      slice.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      return slice;
    },
    weekStats: function (plan) {
      var posted = 0, drafted = 0, total = 0;
      plan.forEach(function (d) {
        if (d.reactive) return;
        total++;
        if (d.status === "posted") posted++;
        if (d.status === "drafted") drafted++;
      });
      return { posted: posted, drafted: drafted, total: total };
    }
  };
})();
