/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — CLOUD BRIDGE
   Auth, invite links, progress sync, team queries, cheers.
   Uses Supabase when configured; otherwise local bridge mode.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  var LOCAL_KEY = "firstSeeds_bridge_v1";
  var JOIN_KEY = "firstSeeds_pending_join";
  var client = null;
  var sessionUser = null;
  var listeners = [];

  function emit(evt, payload) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](evt, payload); } catch (e) {}
    }
  }

  function onChange(fn) { listeners.push(fn); }

  function configured() {
    return typeof window.FS.supabaseConfigured === "function" && window.FS.supabaseConfigured();
  }

  /* ── local bridge store (demo / offline) ─────────────── */
  function localStore() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { users: {}, currentId: null };
  }

  function localSave(store) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); } catch (e) {}
  }

  function makeCode() {
    return Math.random().toString(36).slice(2, 10);
  }

  function blankProgress() {
    return {
      active: "welcome",
      data: {},
      done: {},
      calendar: {},
      cheers: [],
      updated_at: new Date().toISOString()
    };
  }

  function localUserFromId(id) {
    var s = localStore();
    return s.users[id] || null;
  }

  /* ── public API ──────────────────────────────────────── */
  var Cloud = {
    mode: function () { return configured() && client ? "supabase" : "local"; },
    onChange: onChange,
    user: function () { return sessionUser; },
    isSignedIn: function () { return !!sessionUser; },

    captureJoinFromUrl: function () {
      try {
        var params = new URLSearchParams(window.location.search);
        var code = params.get("join");
        if (code) {
          localStorage.setItem(JOIN_KEY, code.trim().toLowerCase());
          params.delete("join");
          var clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
          window.history.replaceState({}, "", clean);
        }
      } catch (e) {}
    },

    pendingJoinCode: function () {
      try { return (localStorage.getItem(JOIN_KEY) || "").trim().toLowerCase(); } catch (e) { return ""; }
    },

    clearPendingJoin: function () {
      try { localStorage.removeItem(JOIN_KEY); } catch (e) {}
    },

    joinUrl: function (code) {
      var base = window.location.origin + window.location.pathname;
      return base + "?join=" + encodeURIComponent(code || "");
    },

    init: async function () {
      Cloud.captureJoinFromUrl();
      if (configured() && window.supabase) {
        var cfg = window.FS.SUPABASE;
        client = window.supabase.createClient(cfg.url, cfg.anonKey);
        var res = await client.auth.getSession();
        if (res.data && res.data.session) {
          sessionUser = await Cloud._hydrateSupabaseUser(res.data.session.user);
        }
        client.auth.onAuthStateChange(async function (event, session) {
          if (session && session.user) {
            sessionUser = await Cloud._hydrateSupabaseUser(session.user);
          } else {
            sessionUser = null;
          }
          emit("auth", sessionUser);
        });
      } else {
        var store = localStore();
        if (store.currentId && store.users[store.currentId]) {
          sessionUser = Cloud._publicUser(store.users[store.currentId]);
        }
      }
      emit("auth", sessionUser);
      return sessionUser;
    },

    _publicUser: function (u) {
      return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        hub_mode: u.hub_mode || "",
        tour_done: !!u.tour_done,
        invite_code: u.invite_code,
        sponsor_id: u.sponsor_id || null,
        last_active_at: u.last_active_at
      };
    },

    _hydrateSupabaseUser: async function (authUser) {
      var { data: profile } = await client.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      if (!profile) {
        /* trigger may lag — upsert */
        var code = makeCode();
        await client.from("profiles").upsert({
          id: authUser.id,
          email: authUser.email,
          display_name: (authUser.user_metadata && authUser.user_metadata.display_name) || (authUser.email || "friend").split("@")[0],
          invite_code: code
        });
        await client.from("runway_progress").upsert({ partner_id: authUser.id });
        var again = await client.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
        profile = again.data;
      }
      var pending = Cloud.pendingJoinCode();
      if (pending) {
        try {
          await client.rpc("attach_sponsor", { code: pending });
          Cloud.clearPendingJoin();
          var refreshed = await client.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
          if (refreshed.data) profile = refreshed.data;
        } catch (e) {}
      }
      await client.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", authUser.id);
      return Cloud._publicUser(profile);
    },

    /* Magic-link or local passwordless demo sign-in */
    signIn: async function (email, displayName) {
      email = (email || "").trim().toLowerCase();
      if (!email || email.indexOf("@") < 1) throw new Error("Enter a valid email.");
      displayName = (displayName || email.split("@")[0]).trim();

      if (configured() && client) {
        var redirectTo = window.location.origin + window.location.pathname;
        var { error } = await client.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: redirectTo,
            data: { display_name: displayName }
          }
        });
        if (error) throw error;
        return { kind: "magic_link", message: "Check your email for a sign-in link." };
      }

      /* local bridge */
      var store = localStore();
      var existingId = null;
      Object.keys(store.users).forEach(function (id) {
        if (store.users[id].email === email) existingId = id;
      });
      var user;
      if (existingId) {
        user = store.users[existingId];
        if (displayName) user.display_name = displayName;
      } else {
        var id = "local_" + makeCode();
        user = {
          id: id,
          email: email,
          display_name: displayName,
          hub_mode: "",
          tour_done: false,
          invite_code: makeCode(),
          sponsor_id: null,
          last_active_at: new Date().toISOString(),
          progress: blankProgress()
        };
        store.users[id] = user;
      }
      var pending = Cloud.pendingJoinCode();
      if (pending && !user.sponsor_id) {
        Object.keys(store.users).forEach(function (id2) {
          var u2 = store.users[id2];
          if (u2.invite_code === pending && u2.id !== user.id) {
            user.sponsor_id = u2.id;
            Cloud.clearPendingJoin();
          }
        });
      }
      user.last_active_at = new Date().toISOString();
      store.currentId = user.id;
      store.users[user.id] = user;
      localSave(store);
      sessionUser = Cloud._publicUser(user);
      emit("auth", sessionUser);
      return { kind: "local", message: "Signed in (local bridge mode)." };
    },

    signOut: async function () {
      if (configured() && client) {
        await client.auth.signOut();
      }
      var store = localStore();
      store.currentId = null;
      localSave(store);
      sessionUser = null;
      emit("auth", null);
    },

    updateProfile: async function (patch) {
      if (!sessionUser) return;
      if (configured() && client) {
        var { data, error } = await client.from("profiles").update(patch).eq("id", sessionUser.id).select().single();
        if (error) throw error;
        sessionUser = Cloud._publicUser(data);
      } else {
        var store = localStore();
        var u = store.users[sessionUser.id];
        Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
        store.users[sessionUser.id] = u;
        localSave(store);
        sessionUser = Cloud._publicUser(u);
      }
      emit("auth", sessionUser);
      return sessionUser;
    },

    pullProgress: async function () {
      if (!sessionUser) return null;
      if (configured() && client) {
        var { data } = await client.from("runway_progress").select("*").eq("partner_id", sessionUser.id).maybeSingle();
        if (!data) return null;
        return {
          active: data.active,
          data: data.data || {},
          done: data.done || {},
          calendar: data.calendar || {},
          cheers: data.cheers || [],
          updated_at: data.updated_at
        };
      }
      var u = localUserFromId(sessionUser.id);
      return u ? (u.progress || blankProgress()) : null;
    },

    pushProgress: async function (stateSlice) {
      if (!sessionUser) return;
      var payload = {
        partner_id: sessionUser.id,
        active: stateSlice.active || "welcome",
        data: stateSlice.data || {},
        done: stateSlice.done || {},
        calendar: stateSlice.calendar || {},
        cheers: stateSlice.cheers || [],
        updated_at: new Date().toISOString()
      };
      if (configured() && client) {
        await client.from("runway_progress").upsert(payload);
        await client.from("profiles").update({
          hub_mode: (stateSlice.settings && stateSlice.settings.hubMode) || sessionUser.hub_mode || "",
          display_name: (stateSlice.settings && stateSlice.settings.partnerName) || sessionUser.display_name,
          tour_done: !!stateSlice.tourDone,
          last_active_at: new Date().toISOString()
        }).eq("id", sessionUser.id);
      } else {
        var store = localStore();
        var u = store.users[sessionUser.id];
        if (!u) return;
        u.progress = payload;
        if (stateSlice.settings) {
          if (stateSlice.settings.hubMode) u.hub_mode = stateSlice.settings.hubMode;
          if (stateSlice.settings.partnerName) u.display_name = stateSlice.settings.partnerName;
        }
        u.tour_done = !!stateSlice.tourDone;
        u.last_active_at = new Date().toISOString();
        store.users[sessionUser.id] = u;
        localSave(store);
        sessionUser = Cloud._publicUser(u);
      }
    },

    myInviteCode: function () {
      return sessionUser ? sessionUser.invite_code : "";
    },

    /* Direct downline for leader dashboard */
    listDownline: async function () {
      if (!sessionUser) return [];
      if (configured() && client) {
        var { data: people } = await client.from("profiles")
          .select("id, display_name, email, hub_mode, last_active_at, created_at")
          .eq("sponsor_id", sessionUser.id)
          .order("last_active_at", { ascending: false });
        if (!people || !people.length) return [];
        var ids = people.map(function (p) { return p.id; });
        var { data: progressRows } = await client.from("runway_progress")
          .select("partner_id, active, data, done, calendar, updated_at")
          .in("partner_id", ids);
        var byId = {};
        (progressRows || []).forEach(function (r) { byId[r.partner_id] = r; });
        return people.map(function (p) {
          var prog = byId[p.id] || null;
          if (prog && prog.data && prog.data._notified_at) {
            prog = Object.assign({}, prog, { notified_at: prog.data._notified_at });
          }
          return { profile: p, progress: prog };
        });
      }
      var store = localStore();
      var out = [];
      Object.keys(store.users).forEach(function (id) {
        var u = store.users[id];
        if (u.sponsor_id === sessionUser.id) {
          out.push({
            profile: {
              id: u.id,
              display_name: u.display_name,
              email: u.email,
              hub_mode: u.hub_mode,
              last_active_at: u.last_active_at,
              created_at: u.created_at || u.last_active_at
            },
            progress: u.progress || blankProgress()
          });
        }
      });
      out.sort(function (a, b) {
        return String(b.profile.last_active_at).localeCompare(String(a.profile.last_active_at));
      });
      return out;
    },

    /* You → up to 4 levels under you (names / structure). Coaching stays front-line only. */
    listTeamGraph: async function () {
      var MAX = 4;
      if (!sessionUser) return { roots: [], depth: MAX };
      if (configured() && client) {
        var { data, error } = await client.rpc("team_graph", { max_depth: MAX });
        if (error) throw error;
        return { roots: data || [], depth: MAX };
      }
      var store = localStore();
      function kidsOf(sponsorId, remaining) {
        if (remaining <= 0) return [];
        var out = [];
        Object.keys(store.users).forEach(function (id) {
          var u = store.users[id];
          if (u.sponsor_id !== sponsorId) return;
          out.push({
            id: u.id,
            display_name: u.display_name,
            email: u.email,
            hub_mode: u.hub_mode,
            last_active_at: u.last_active_at,
            children: kidsOf(u.id, remaining - 1)
          });
        });
        out.sort(function (a, b) {
          return String(b.last_active_at || "").localeCompare(String(a.last_active_at || ""));
        });
        return out;
      }
      return { roots: kidsOf(sessionUser.id, MAX), depth: MAX };
    },

    sendEvent: async function (partnerId, kind, body) {
      if (!sessionUser) throw new Error("Sign in first.");
      if (configured() && client) {
        var { error } = await client.from("team_events").insert({
          sponsor_id: sessionUser.id,
          partner_id: partnerId,
          kind: kind,
          body: body || ""
        });
        if (error) throw error;
        if (kind === "cheer") {
          /* also append to partner cheers in runway for quick banner */
          var { data: row } = await client.from("runway_progress").select("cheers").eq("partner_id", partnerId).maybeSingle();
          var cheers = (row && row.cheers) || [];
          cheers.unshift({
            from: sessionUser.display_name,
            body: body,
            at: new Date().toISOString()
          });
          await client.from("runway_progress").update({ cheers: cheers.slice(0, 20) }).eq("partner_id", partnerId);
        }
        return;
      }
      var store = localStore();
      var partner = store.users[partnerId];
      if (!partner) throw new Error("Partner not found.");
      if (!partner.progress) partner.progress = blankProgress();
      if (!partner.progress.cheers) partner.progress.cheers = [];
      if (kind === "cheer" || kind === "nudge" || kind === "notify") {
        partner.progress.cheers.unshift({
          from: sessionUser.display_name,
          body: body,
          kind: kind,
          at: new Date().toISOString()
        });
        partner.progress.cheers = partner.progress.cheers.slice(0, 20);
      }
      store.users[partnerId] = partner;
      localSave(store);
    },

    /* Partner → sponsor: sync progress + leave a ping on their card */
    notifySponsor: async function (stateSlice) {
      if (!sessionUser) throw new Error("Sign in first.");
      if (!sessionUser.sponsor_id) throw new Error("No leader linked.");
      await Cloud.pushProgress(stateSlice || {});
      var at = new Date().toISOString();
      if (configured() && client) {
        await client.from("team_events").insert({
          sponsor_id: sessionUser.sponsor_id,
          partner_id: sessionUser.id,
          kind: "notify",
          body: "Shared progress from First Seeds"
        });
        var prog = await Cloud.pullProgress();
        var data = (prog && prog.data) || {};
        data._notified_at = at;
        await client.from("runway_progress").update({
          data: Object.assign({}, (prog && prog.data) || {}, { _notified_at: at })
        }).eq("partner_id", sessionUser.id);
      } else {
        var store = localStore();
        var u = store.users[sessionUser.id];
        if (!u.progress) u.progress = blankProgress();
        u.progress.notified_at = at;
        u.last_active_at = at;
        store.users[sessionUser.id] = u;
        localSave(store);
      }
    },

    saveLeaderNote: async function (partnerId, sectionId, body) {
      if (!sessionUser) throw new Error("Sign in first.");
      sectionId = sectionId || "welcome";
      body = (body || "").trim();
      if (!body) throw new Error("Note is empty.");
      if (configured() && client) {
        var { error } = await client.from("leader_notes").upsert({
          sponsor_id: sessionUser.id,
          partner_id: partnerId,
          section_id: sectionId,
          body: body
        }, { onConflict: "sponsor_id,partner_id,section_id" });
        if (error) throw error;
        return;
      }
      var store = localStore();
      var partner = store.users[partnerId];
      if (!partner) throw new Error("Partner not found.");
      if (!partner.leader_notes) partner.leader_notes = [];
      var found = false;
      partner.leader_notes.forEach(function (n) {
        if (n.section_id === sectionId && n.sponsor_id === sessionUser.id) {
          n.body = body;
          n.updated_at = new Date().toISOString();
          found = true;
        }
      });
      if (!found) {
        partner.leader_notes.push({
          sponsor_id: sessionUser.id,
          partner_id: partnerId,
          section_id: sectionId,
          body: body,
          updated_at: new Date().toISOString()
        });
      }
      store.users[partnerId] = partner;
      localSave(store);
    },

    myLeaderNotes: async function () {
      if (!sessionUser) return [];
      if (configured() && client) {
        var { data } = await client.from("leader_notes")
          .select("section_id, body, created_at")
          .eq("partner_id", sessionUser.id)
          .order("created_at", { ascending: false });
        return data || [];
      }
      var u = localUserFromId(sessionUser.id);
      return (u && u.leader_notes) || [];
    },

    unreadCheers: async function () {
      if (!sessionUser) return [];
      var prog = await Cloud.pullProgress();
      return (prog && prog.cheers) || [];
    },

    clearCheers: async function () {
      if (!sessionUser) return;
      if (configured() && client) {
        await client.from("runway_progress").update({ cheers: [] }).eq("partner_id", sessionUser.id);
      } else {
        var store = localStore();
        var u = store.users[sessionUser.id];
        if (u && u.progress) {
          u.progress.cheers = [];
          store.users[sessionUser.id] = u;
          localSave(store);
        }
      }
    },

    teamPulse: async function () {
      /* Aggregate for belonging — local: count grove names across downline + self */
      var downline = await Cloud.listDownline();
      var trees = 0;
      var blooming = 0;
      function countWarm(data) {
        if (!data || !data.warm) return 0;
        return String(data.warm).split("\n").filter(function (l) { return l.trim(); }).length;
      }
      function isBlooming(done) {
        if (!done) return false;
        var n = 0;
        Object.keys(done).forEach(function (k) { if (done[k]) n++; });
        return n >= 4;
      }
      downline.forEach(function (row) {
        var d = row.progress && row.progress.data;
        var done = row.progress && row.progress.done;
        trees += countWarm(d);
        if (isBlooming(done)) blooming++;
      });
      if (sessionUser) {
        var mine = await Cloud.pullProgress();
        if (mine) {
          trees += countWarm(mine.data);
          if (isBlooming(mine.done)) blooming++;
        }
      }
      return {
        downlineCount: downline.length,
        groveTrees: trees,
        blooming: blooming
      };
    },

    exportBundle: async function () {
      /* Evergreen handoff JSON */
      var me = sessionUser;
      var progress = await Cloud.pullProgress();
      var downline = await Cloud.listDownline();
      return {
        version: 1,
        exported_at: new Date().toISOString(),
        product: "first-seeds-bridge",
        profile: me,
        runway_progress: progress,
        sponsorships: downline.map(function (row) {
          return {
            partner: row.profile,
            progress: row.progress
          };
        })
      };
    }
  };

  window.FS.Cloud = Cloud;
})();
