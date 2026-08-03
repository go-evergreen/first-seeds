/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — CALENDAR ENGINE
   Optional cadence · multi-card days · week/month slices
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  /* 28-day monthly flow — weeks feel different, not the same loop forever */
  var MONTHLY_CADENCE = [
    /* Week 1 — curiosity opens */
    { type: "open_loop", label: "Curiosity post", icon: "✨", category: "content" },
    { type: "product_curious", label: "Product spark", icon: "🫧", category: "content" },
    { type: "curtain", label: "Behind the scenes", icon: "🎬", category: "content" },
    { type: "reactive", label: "Rest / reply", icon: "🌿", category: "rest", reactive: true },
    { type: "values_flag", label: "Values post", icon: "🚩", category: "content" },
    { type: "soft_door", label: "Soft invite", icon: "🚪", category: "outreach" },
    { type: "reactive", label: "Rest / reply", icon: "💬", category: "rest", reactive: true },
    /* Week 2 — product noticing */
    { type: "product_curious", label: "Product spark", icon: "🫧", category: "content" },
    { type: "honest_note", label: "Honest note", icon: "📝", category: "content" },
    { type: "open_loop", label: "Curiosity post", icon: "✨", category: "content" },
    { type: "reactive", label: "Rest / reply", icon: "🌿", category: "rest", reactive: true },
    { type: "curtain", label: "Behind the scenes", icon: "🎬", category: "content" },
    { type: "soft_door", label: "Soft invite", icon: "🚪", category: "outreach" },
    { type: "reactive", label: "Rest / reply", icon: "💬", category: "rest", reactive: true },
    /* Week 3 — story + conversation */
    { type: "values_flag", label: "Values post", icon: "🚩", category: "content" },
    { type: "product_curious", label: "Product spark", icon: "🫧", category: "content" },
    { type: "honest_note", label: "Honest note", icon: "📝", category: "content" },
    { type: "reactive", label: "Rest / reply", icon: "🌿", category: "rest", reactive: true },
    { type: "open_loop", label: "Curiosity post", icon: "✨", category: "content" },
    { type: "reach_out", label: "Reach out", icon: "💬", category: "outreach" },
    { type: "reactive", label: "Rest / reply", icon: "💬", category: "rest", reactive: true },
    /* Week 4 — invite + follow-through */
    { type: "curtain", label: "Behind the scenes", icon: "🎬", category: "content" },
    { type: "product_curious", label: "Product spark", icon: "🫧", category: "content" },
    { type: "soft_door", label: "Soft invite", icon: "🚪", category: "outreach" },
    { type: "reactive", label: "Rest / reply", icon: "🌿", category: "rest", reactive: true },
    { type: "follow_up", label: "Follow up", icon: "🔁", category: "followup" },
    { type: "honest_note", label: "Honest note", icon: "📝", category: "content" },
    { type: "reactive", label: "Rest / reply", icon: "💬", category: "rest", reactive: true }
  ];

  var EVENT_TYPES = [
    { id: "open_loop", label: "Curiosity post", icon: "✨", category: "content", kind: "content" },
    { id: "product_curious", label: "Product spark", icon: "🫧", category: "content", kind: "content" },
    { id: "curtain", label: "Behind the scenes", icon: "🎬", category: "content", kind: "content" },
    { id: "honest_note", label: "Honest note", icon: "📝", category: "content", kind: "content" },
    { id: "values_flag", label: "Values post", icon: "🚩", category: "content", kind: "content" },
    { id: "soft_door", label: "Soft invite", icon: "🚪", category: "outreach", kind: "content" },
    { id: "reach_out", label: "Reach out", icon: "💬", category: "outreach", kind: "outreach" },
    { id: "follow_up", label: "Follow up", icon: "🔁", category: "followup", kind: "outreach" },
    { id: "personal", label: "Reminder", icon: "📌", category: "personal", kind: "personal" },
    { id: "reactive", label: "Rest / reply", icon: "🌿", category: "rest", kind: "rest", reactive: true }
  ];

  var CATEGORIES = [
    { id: "content", label: "Content" },
    { id: "outreach", label: "Outreach" },
    { id: "followup", label: "Follow-up" },
    { id: "personal", label: "Personal" },
    { id: "rest", label: "Rest" }
  ];

  var STATUSES = [
    { id: "todo", label: "To do" },
    { id: "drafted", label: "Drafted" },
    { id: "posted", label: "Done" },
    { id: "skipped", label: "Skip" }
  ];

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function ymd(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseYmd(s) {
    var p = (s || "").split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function prettyDate(d) {
    return DOW[d.getDay()] + ", " + MON[d.getMonth()] + " " + d.getDate();
  }

  function uid() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function phaseFor(d, cfg) {
    cfg = cfg || window.FS.CONFIG || {};
    /* Anchor to one founding season year so Jan after launch doesn't flip back to Prep. */
    var y = cfg.seasonYear != null ? cfg.seasonYear : d.getFullYear();
    var pre = new Date(y, (cfg.preRegDate && cfg.preRegDate.month || 10) - 1, cfg.preRegDate && cfg.preRegDate.day || 1);
    var miami = new Date(y, (cfg.miamiDate && cfg.miamiDate.month || 10) - 1, cfg.miamiDate && cfg.miamiDate.day || 24);
    var launch = new Date(y, (cfg.launchDate && cfg.launchDate.month || 11) - 1, cfg.launchDate && cfg.launchDate.day || 1);
    if (d < pre) return { id: "prep", label: "Prep season", tip: "Learn · share · plant roots" };
    if (d < miami) return { id: "prereg", label: "Pre-reg window", tip: "Reserve · soft updates" };
    if (d < launch) return { id: "miami", label: "Miami → launch", tip: "Event energy · founder packs" };
    return { id: "launch", label: "Launch", tip: "First customers · first stories" };
  }

  function typeMeta(id) {
    for (var i = 0; i < EVENT_TYPES.length; i++) if (EVENT_TYPES[i].id === id) return EVENT_TYPES[i];
    return EVENT_TYPES[0];
  }

  function categoryMeta(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[0];
  }

  function draftFor(type, data, dateKey) {
    data = data || {};
    var meta = typeMeta(type);
    if (type === "follow_up") {
      return "Quick check-in with ___ — no pressure, just curious if they want the next bit of what I've been learning.";
    }
    if (type === "reach_out") {
      return "Hey — random but I've been diving into something new and you came to mind. Want me to share a little?";
    }
    if (type === "personal") return "";
    var Pick = window.FS.ContentPick;
    if (Pick && Pick.draftForType) {
      var picked = Pick.draftForType(type, dateKey || type, data);
      if (picked) return picked;
    }
    var types = window.FS.SEED_TYPES || [];
    for (var i = 0; i < types.length; i++) {
      if (types[i].id === type) return types[i].example || "";
    }
    return "";
  }

  function defaultEnd(cfg) {
    var now = new Date();
    cfg = cfg || {};
    var launch = new Date(now.getFullYear(), (cfg.launchDate && cfg.launchDate.month || 11) - 1, cfg.launchDate && cfg.launchDate.day || 1);
    if (launch < now) return addDays(now, 14);
    return launch;
  }

  function buildCadenceMap(startDate, endDate) {
    var map = {};
    var d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    var end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    var i = 0;
    while (d <= end && i < 160) {
      var slot = MONTHLY_CADENCE[i % MONTHLY_CADENCE.length];
      map[ymd(d)] = {
        type: slot.type,
        label: slot.label,
        icon: slot.icon,
        category: slot.category,
        reactive: !!slot.reactive
      };
      d = addDays(d, 1);
      i++;
    }
    return map;
  }

  function normalizeItem(raw, dateKey, rootsData) {
    raw = raw || {};
    var type = raw.type || "personal";
    var meta = typeMeta(type);
    var title = (raw.title || "").trim();
    var draft = raw.draft != null ? raw.draft : "";
    return {
      id: raw.id || uid(),
      type: type,
      category: raw.category || meta.category,
      kind: meta.kind,
      icon: meta.icon,
      label: title || meta.label,
      title: title,
      person: raw.person || "",
      notes: raw.notes || "",
      draft: draft,
      image: raw.image || "",
      imageId: raw.imageId || "",
      status: raw.status || "todo",
      altIndex: raw.altIndex || 0,
      suggested: !!raw.suggested,
      fromCadence: !!raw.fromCadence
    };
  }

  function itemsFromSaved(saved, dateKey, rootsData) {
    if (!saved) return [];
    if (Array.isArray(saved.items)) {
      return saved.items.map(function (it) { return normalizeItem(it, dateKey, rootsData); });
    }
    if (saved.draft || saved.type || saved.status || saved.person || saved.title || saved.notes) {
      return [normalizeItem({
        id: "legacy-" + dateKey,
        type: saved.type || "open_loop",
        category: saved.category,
        title: saved.title || "",
        person: saved.person || "",
        notes: saved.notes || "",
        draft: saved.draft || "",
        image: saved.image || "",
        imageId: saved.imageId || "",
        status: saved.status || "todo",
        altIndex: saved.altIndex || 0
      }, dateKey, rootsData)];
    }
    return [];
  }

  function snippetOf(text) {
    var t = (text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    return t.length > 48 ? t.slice(0, 46) + "…" : t;
  }

  function plan(cfg, calendarState, rootsData, opts) {
    opts = opts || {};
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cfg = cfg || window.FS.CONFIG;
    var end = defaultEnd(cfg);
    var cadenceOn = opts.cadence !== false;
    var cadenceMap = cadenceOn ? buildCadenceMap(today, end) : {};
    calendarState = calendarState || {};

    var dates = {};
    Object.keys(cadenceMap).forEach(function (k) { dates[k] = true; });
    Object.keys(calendarState).forEach(function (k) { dates[k] = true; });

    /* Include full month grid range around today for empty browsing */
    var monthStart = startOfMonth(today);
    var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var gridStart = startOfWeek(monthStart);
    for (var g = 0; g < 42; g++) dates[ymd(addDays(gridStart, g))] = true;

    return Object.keys(dates).sort().map(function (dateKey) {
      var dt = parseYmd(dateKey);
      var saved = calendarState[dateKey];
      var items = itemsFromSaved(saved, dateKey, rootsData);
      var slot = cadenceMap[dateKey] || null;
      var suggested = null;
      if (cadenceOn && slot && !items.length) {
        suggested = {
          type: slot.type,
          label: slot.label,
          icon: slot.icon,
          category: slot.category,
          reactive: !!slot.reactive,
          draft: draftFor(slot.type, rootsData, dateKey)
        };
      }
      return {
        date: dateKey,
        pretty: prettyDate(dt),
        phase: phaseFor(dt, cfg),
        items: items,
        suggested: suggested,
        empty: !items.length && !suggested
      };
    });
  }

  function findDay(planDays, dateKey) {
    for (var i = 0; i < (planDays || []).length; i++) {
      if (planDays[i].date === dateKey) return planDays[i];
    }
    return null;
  }

  function findItem(day, itemId) {
    if (!day || !day.items) return null;
    for (var i = 0; i < day.items.length; i++) {
      if (day.items[i].id === itemId) return day.items[i];
    }
    return null;
  }

  function ensureDay(calendarState, dateKey) {
    if (!calendarState[dateKey]) calendarState[dateKey] = { items: [] };
    if (!Array.isArray(calendarState[dateKey].items)) {
      calendarState[dateKey] = { items: itemsFromSaved(calendarState[dateKey], dateKey, {}) };
    }
    return calendarState[dateKey];
  }

  function newItem(partial, rootsData, dateKey) {
    var type = (partial && partial.type) || "personal";
    var meta = typeMeta(type);
    var draft = (partial && partial.draft != null) ? partial.draft : draftFor(type, rootsData, dateKey);
    return normalizeItem({
      id: uid(),
      type: type,
      category: (partial && partial.category) || meta.category,
      title: (partial && partial.title) || "",
      person: (partial && partial.person) || "",
      notes: (partial && partial.notes) || "",
      draft: draft,
      image: (partial && partial.image) || "",
      imageId: (partial && partial.imageId) || "",
      status: (partial && partial.status) || "todo"
    }, dateKey, rootsData);
  }

  function applyCadenceFill(calendarState, rootsData, cfg) {
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var map = buildCadenceMap(today, defaultEnd(cfg || window.FS.CONFIG));
    Object.keys(map).forEach(function (dateKey) {
      var day = ensureDay(calendarState, dateKey);
      if (day.items.length) return;
      var slot = map[dateKey];
      var item = newItem({
        type: slot.type,
        title: "",
        draft: draftFor(slot.type, rootsData, dateKey),
        status: "todo"
      }, rootsData, dateKey);
      item.fromCadence = true;
      day.items.push(item);
    });
  }

  function clearCadenceSuggestions(calendarState) {
    /* Remove untouched auto-fill cards; keep anything drafted / done / edited by hand. */
    Object.keys(calendarState || {}).forEach(function (k) {
      var day = calendarState[k];
      var items = itemsFromSaved(day, k, {});
      var kept = items.filter(function (it) {
        if (!it.fromCadence) return true;
        if (it.status && it.status !== "todo") return true;
        if ((it.title || "").trim()) return true;
        if ((it.person || "").trim()) return true;
        if ((it.notes || "").trim()) return true;
        return false;
      });
      if (!kept.length) delete calendarState[k];
      else calendarState[k] = { items: kept };
    });
    return calendarState;
  }

  function curiosityImageById(id) {
    if (!id) return null;
    var list = (window.FS.CONTENT && window.FS.CONTENT.curiosityImages) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function resolveCuriosityImage(imageId) {
    var meta = curiosityImageById(imageId);
    if (!meta) return null;
    return {
      id: meta.id,
      title: meta.title || "",
      alt: meta.alt || meta.title || "",
      pairsWith: meta.pairsWith || "",
      body: meta.body || "",
      src: "assets/curiosity/full/" + meta.id + ".webp",
      thumb: "assets/curiosity/thumbs/" + meta.id + ".webp"
    };
  }

  function libraryBuckets() {
    var C = window.FS.CONTENT || {};
    var buckets = [];
    buckets.push({
      id: "photos",
      title: "Photos",
      hint: "Curiosity photos — tap to preview full size, tweak a caption, then add to a day. Thumbs stay light; full images load only when you open one.",
      items: (C.curiosityImages || []).map(function (it) {
        var resolved = resolveCuriosityImage(it.id);
        return {
          id: "photo-" + it.id,
          type: "open_loop",
          title: it.title,
          body: it.body || "",
          icon: "📷",
          imageId: it.id,
          image: resolved ? resolved.src : "",
          thumb: resolved ? resolved.thumb : "",
          alt: it.alt || it.title,
          pairsWith: it.pairsWith || ""
        };
      })
    });
    buckets.push({
      id: "hooks",
      title: "Curiosity posts",
      hint: "Short unfinished stories that stop the scroll — drop one on a day, then rewrite it in your voice.",
      items: (C.openLoops || []).map(function (it, i) {
        var body = typeof it === "string" ? it : (it.body || "");
        var title = (typeof it === "object" && it.title) ? it.title : ("Curiosity " + (i + 1));
        var imageId = (typeof it === "object" && it.imageId) ? it.imageId : "";
        var resolved = resolveCuriosityImage(imageId);
        return {
          id: "hook-" + i,
          type: "open_loop",
          title: title,
          body: body,
          icon: "✨",
          imageId: imageId,
          image: resolved ? resolved.src : "",
          thumb: resolved ? resolved.thumb : "",
          alt: resolved ? resolved.alt : ""
        };
      })
    });
    buckets.push({
      id: "sparks",
      title: "Product moments",
      hint: "Everyday product noticing — good midweek posts with no hard ask.",
      items: (C.productSparks || []).map(function (it) {
        return { id: "spark-" + it.id, type: "product_curious", title: it.title, body: it.body, icon: it.icon || "🫧" };
      })
    });
    buckets.push({
      id: "doors",
      title: "Soft invites",
      hint: "One low-pressure ask after you've shared value — comment or DM, no spam.",
      items: (C.curiosity || []).map(function (it) {
        return { id: "door-" + it.id, type: "soft_door", title: it.title, body: it.body };
      })
    });
    buckets.push({
      id: "product",
      title: "Product story posts",
      hint: "Longer posts about what makes the products different — share in any order.",
      items: ((C.productStory && C.productStory.posts) || []).map(function (it) {
        return { id: "prod-" + it.id, type: "honest_note", title: it.title, body: it.body, icon: it.icon };
      })
    });
    buckets.push({
      id: "business",
      title: "How the business works",
      hint: "Plain-language business / company story posts — for when someone asks how it works.",
      items: (Array.isArray(C.businessStory) ? C.businessStory : ((C.businessStory && C.businessStory.posts) || [])).map(function (it) {
        return { id: "biz-" + (it.id || it.title), type: "curtain", title: it.title, body: it.body, icon: it.icon };
      })
    });
    buckets.push({
      id: "pillars",
      title: "Values posts",
      hint: "Plant a flag — what you stand for — with zero pitch.",
      items: (C.pillars || []).map(function (it) {
        return { id: "pil-" + (it.id || it.title), type: "values_flag", title: it.title || it.name, body: it.body || it.blurb || "", icon: it.icon };
      })
    });
    return buckets;
  }

  function countByStatus(calendarState, status) {
    var n = 0;
    Object.keys(calendarState || {}).forEach(function (k) {
      itemsFromSaved(calendarState[k], k, {}).forEach(function (it) {
        if (it.status === status) n++;
      });
    });
    return n;
  }

  /* Growth / Tend checklist: only Done (posted) counts — Skip and Drafted do not. */
  function countPosted(calendarState) {
    return countByStatus(calendarState, "posted");
  }

  function countDrafted(calendarState) {
    return countByStatus(calendarState, "drafted");
  }

  /* Legacy helper: any non-todo status (kept for stats that want “touched”). */
  function countMarked(calendarState) {
    var n = 0;
    Object.keys(calendarState || {}).forEach(function (k) {
      itemsFromSaved(calendarState[k], k, {}).forEach(function (it) {
        if (it.status && it.status !== "todo") n++;
      });
    });
    return n;
  }

  function weekStats(days) {
    var posted = 0, drafted = 0, total = 0;
    (days || []).forEach(function (d) {
      (d.items || []).forEach(function (it) {
        if (it.kind === "rest" || it.type === "reactive") return;
        total++;
        if (it.status === "posted") posted++;
        if (it.status === "drafted") drafted++;
      });
    });
    return { posted: posted, drafted: drafted, total: total };
  }

  /* Seed / refresh reach-out cards for grove first-chat picks.
     people: [{ name, lane }] — lane is "customers" or "warm"
     Only removes prior grove-seed items still on todo; keeps drafted/posted. */
  function syncGroveOutreach(calendarState, people, rootsData) {
    calendarState = calendarState || {};
    people = people || [];
    var wanted = {};
    people.forEach(function (p) {
      if (!p || !p.name) return;
      wanted[p.name.toLowerCase()] = { name: p.name, lane: p.lane || "customers" };
    });

    var keptByName = {};
    Object.keys(calendarState).forEach(function (dateKey) {
      var day = ensureDay(calendarState, dateKey);
      day.items = (day.items || []).filter(function (it) {
        var note = (it.notes || "");
        if (note.indexOf("grove-seed") !== 0) return true;
        var key = ((it.person || "") + "").trim().toLowerCase();
        if (!key) return false;
        if (it.status && it.status !== "todo") {
          keptByName[key] = true;
          return true;
        }
        if (!wanted[key]) return false;
        keptByName[key] = true;
        return true;
      });
      if (!day.items.length) delete calendarState[dateKey];
    });

    var toAdd = [];
    Object.keys(wanted).forEach(function (k) {
      if (!keptByName[k]) toAdd.push(wanted[k]);
    });
    if (!toAdd.length) return calendarState;

    var cursor = addDays(new Date(), 1);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    var guard = 0;
    toAdd.forEach(function (p) {
      while (guard < 60) {
        guard++;
        /* Prefer weekdays so outreach doesn't stack on Sunday */
        if (cursor.getDay() === 0) { cursor = addDays(cursor, 1); continue; }
        var key = ymd(cursor);
        var day = ensureDay(calendarState, key);
        var hasOutreach = (day.items || []).some(function (it) {
          return it.kind === "outreach" || it.type === "reach_out" || it.type === "follow_up";
        });
        if (hasOutreach) { cursor = addDays(cursor, 1); continue; }
        var laneNote = p.lane === "warm" ? "grove-seed:partner" : "grove-seed:customer";
        day.items.push(newItem({
          type: "reach_out",
          person: p.name,
          notes: laneNote,
          title: p.lane === "warm" ? "Partner chat" : "Product chat",
          status: "todo"
        }, rootsData || {}, key));
        cursor = addDays(cursor, 1);
        break;
      }
    });
    return calendarState;
  }

  function runwayStats(planDays) {
    var posted = 0, drafted = 0, cards = 0;
    (planDays || []).forEach(function (d) {
      (d.items || []).forEach(function (it) {
        cards++;
        if (it.status === "posted") posted++;
        if (it.status === "drafted") drafted++;
      });
    });
    return { posted: posted, drafted: drafted, cards: cards, days: (planDays || []).length };
  }

  window.FS.Calendar = {
    ymd: ymd,
    parseYmd: parseYmd,
    addDays: addDays,
    prettyDate: prettyDate,
    phaseFor: phaseFor,
    draftFor: draftFor,
    typeMeta: typeMeta,
    categoryMeta: categoryMeta,
    EVENT_TYPES: EVENT_TYPES,
    CATEGORIES: CATEGORIES,
    STATUSES: STATUSES,
    DOW: DOW,
    MON: MON,
    MON_LONG: MON_LONG,
    uid: uid,
    plan: plan,
    findDay: findDay,
    findItem: findItem,
    ensureDay: ensureDay,
    newItem: newItem,
    itemsFromSaved: itemsFromSaved,
    applyCadenceFill: applyCadenceFill,
    syncGroveOutreach: syncGroveOutreach,
    clearCadenceSuggestions: clearCadenceSuggestions,
    libraryBuckets: libraryBuckets,
    resolveCuriosityImage: resolveCuriosityImage,
    curiosityImageById: curiosityImageById,
    countMarked: countMarked,
    countPosted: countPosted,
    countDrafted: countDrafted,
    snippetOf: snippetOf,
    weekStats: weekStats,
    runwayStats: runwayStats,
    weekSlice: function (planDays, anchor, weekOffset) {
      weekOffset = weekOffset || 0;
      anchor = anchor || new Date();
      var start = startOfWeek(addDays(anchor, weekOffset * 7));
      var byDate = {};
      (planDays || []).forEach(function (d) { byDate[d.date] = d; });
      var days = [];
      for (var i = 0; i < 7; i++) {
        var key = ymd(addDays(start, i));
        var dt = addDays(start, i);
        days.push(byDate[key] || {
          date: key,
          pretty: prettyDate(dt),
          phase: phaseFor(dt, window.FS.CONFIG),
          items: [],
          suggested: null,
          empty: true
        });
      }
      return {
        days: days,
        start: start,
        label: MON[start.getMonth()] + " " + start.getDate() + " – " + MON[addDays(start, 6).getMonth()] + " " + addDays(start, 6).getDate()
      };
    },
    monthSlice: function (planDays, anchor, monthOffset) {
      monthOffset = monthOffset || 0;
      anchor = anchor || new Date();
      var first = startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() + monthOffset, 1));
      var gridStart = startOfWeek(first);
      var byDate = {};
      (planDays || []).forEach(function (d) { byDate[d.date] = d; });
      var cells = [];
      for (var i = 0; i < 42; i++) {
        var dt = addDays(gridStart, i);
        var key = ymd(dt);
        var day = byDate[key] || {
          date: key,
          pretty: prettyDate(dt),
          phase: phaseFor(dt, window.FS.CONFIG),
          items: [],
          suggested: null,
          empty: true
        };
        cells.push(Object.assign({}, day, {
          inMonth: dt.getMonth() === first.getMonth(),
          dayNum: dt.getDate()
        }));
      }
      return {
        cells: cells,
        start: first,
        label: MON_LONG[first.getMonth()] + " " + first.getFullYear()
      };
    }
  };
})();
