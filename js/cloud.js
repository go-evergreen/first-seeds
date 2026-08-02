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
        last_active_at: u.last_active_at,
        lead_slug: u.lead_slug || "",
        lead_blurb: u.lead_blurb || "",
        lead_thanks: u.lead_thanks || ""
      };
    },

    DEFAULT_LEAD_THANKS:
      "Thanks for adding your info! I’ll be in touch with some exciting Ringana details soon!",

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

    _assertEmailPassword: function (email, password) {
      email = (email || "").trim().toLowerCase();
      password = String(password || "");
      if (!email || email.indexOf("@") < 1) throw new Error("Enter a valid email.");
      if (password.length < 6) throw new Error("Password needs at least 6 characters.");
      return { email: email, password: password };
    },

    _finishLocalSignIn: function (email, displayName) {
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

    /* Email + password — stays inside the PWA (no Safari redirect). */
    signIn: async function (email, displayName, password) {
      var creds = Cloud._assertEmailPassword(email, password);
      displayName = (displayName || creds.email.split("@")[0]).trim();

      if (configured() && client) {
        var { data, error } = await client.auth.signInWithPassword({
          email: creds.email,
          password: creds.password
        });
        if (error) throw error;
        if (data && data.user) {
          sessionUser = await Cloud._hydrateSupabaseUser(data.user);
          emit("auth", sessionUser);
        }
        return { kind: "signed_in", message: "You’re signed in." };
      }

      return Cloud._finishLocalSignIn(creds.email, displayName);
    },

    signUp: async function (email, displayName, password) {
      var creds = Cloud._assertEmailPassword(email, password);
      displayName = (displayName || creds.email.split("@")[0]).trim();

      if (configured() && client) {
        var { data, error } = await client.auth.signUp({
          email: creds.email,
          password: creds.password,
          options: {
            data: { display_name: displayName }
          }
        });
        if (error) throw error;
        if (!data.session) {
          throw new Error(
            "Account created, but email confirmation is still on in Supabase. Turn off Authentication → Providers → Email → Confirm email, then sign in."
          );
        }
        if (data.user) {
          sessionUser = await Cloud._hydrateSupabaseUser(data.user);
          emit("auth", sessionUser);
        }
        return { kind: "signed_in", message: "Account created — you’re signed in." };
      }

      return Cloud._finishLocalSignIn(creds.email, displayName);
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
    },

    /* ── personal lead pages ───────────────────────────── */
    slugifyName: function (name) {
      var raw = (name || "").toLowerCase();
      try { raw = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
      var s = raw
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);
      return s || "friend";
    },

    leadUrl: function (slug) {
      var dir = window.location.pathname.replace(/[^/]+$/, "");
      return window.location.origin + dir + "lead.html?p=" + encodeURIComponent(slug || "");
    },

    ensureLeadSlug: async function (preferredName) {
      if (!sessionUser) throw new Error("Sign in to get your lead page.");
      if (sessionUser.lead_slug) return sessionUser.lead_slug;
      var desired = Cloud.slugifyName(preferredName || sessionUser.display_name || "friend");
      return Cloud.claimLeadSlug(desired, { allowSuffix: true });
    },

    claimLeadSlug: async function (desired, opts) {
      if (!sessionUser) throw new Error("Sign in first.");
      desired = Cloud.slugifyName(desired);
      var allowSuffix = !!(opts && opts.allowSuffix);
      if (configured() && client) {
        var { data, error } = await client.rpc("claim_lead_slug", {
          desired: desired,
          allow_suffix: allowSuffix
        });
        if (error) throw error;
        sessionUser.lead_slug = data;
        emit("auth", sessionUser);
        return data;
      }
      var store = localStore();
      var base = desired;
      var candidate = base;
      var n = 2;
      function taken(slug) {
        return Object.keys(store.users).some(function (id) {
          var u = store.users[id];
          return u && u.id !== sessionUser.id && (u.lead_slug || "").toLowerCase() === slug;
        });
      }
      if (allowSuffix) {
        while (taken(candidate)) {
          candidate = base + "-" + n;
          n++;
          if (n > 99) {
            candidate = base + "-" + makeCode().slice(0, 4);
            break;
          }
        }
      } else if (taken(candidate)) {
        throw new Error("That link is already in use — try another.");
      }
      var me = store.users[sessionUser.id];
      me.lead_slug = candidate;
      store.users[sessionUser.id] = me;
      localSave(store);
      sessionUser = Cloud._publicUser(me);
      emit("auth", sessionUser);
      return candidate;
    },

    setLeadBlurb: async function (blurb) {
      if (!sessionUser) throw new Error("Sign in first.");
      blurb = ((blurb || "") + "").trim().slice(0, 280);
      return Cloud.updateProfile({ lead_blurb: blurb });
    },

    setLeadPageCopy: async function (blurb, thanks) {
      if (!sessionUser) throw new Error("Sign in first.");
      blurb = ((blurb || "") + "").trim().slice(0, 280);
      thanks = ((thanks || "") + "").trim().slice(0, 280);
      return Cloud.updateProfile({ lead_blurb: blurb, lead_thanks: thanks });
    },

    getLeadPage: async function (slug) {
      slug = (slug || "").trim().toLowerCase();
      if (!slug) return null;
      if (configured() && client) {
        var { data, error } = await client.rpc("get_lead_page", { p_slug: slug });
        if (error) throw error;
        return data || null;
      }
      var store = localStore();
      var found = null;
      Object.keys(store.users).forEach(function (id) {
        var u = store.users[id];
        if (u && (u.lead_slug || "").toLowerCase() === slug) {
          found = {
            slug: u.lead_slug,
            display_name: u.display_name,
            blurb: u.lead_blurb || "",
            thanks: u.lead_thanks || ""
          };
        }
      });
      return found;
    },

    submitLead: async function (slug, payload) {
      slug = (slug || "").trim().toLowerCase();
      var name = ((payload && payload.name) || "").trim();
      var email = ((payload && payload.email) || "").trim().toLowerCase();
      var phone = ((payload && payload.phone) || "").trim();
      var interest = ((payload && payload.interest) || "").trim().toLowerCase();
      if (!slug) throw new Error("Page not found.");
      if (name.length < 2) throw new Error("Please enter your name.");
      if (["products", "business", "both"].indexOf(interest) < 0) {
        throw new Error("Pick what you’re interested in.");
      }
      if (!email && !phone) throw new Error("Add an email or a phone number.");
      if (email && email.indexOf("@") < 1) throw new Error("That email doesn’t look right.");

      if (configured() && client) {
        var { data, error } = await client.rpc("submit_lead", {
          p_slug: slug,
          p_name: name,
          p_email: email,
          p_phone: phone,
          p_interest: interest
        });
        if (error) throw error;
        return { id: data };
      }

      var store = localStore();
      var ownerId = null;
      Object.keys(store.users).forEach(function (id) {
        if ((store.users[id].lead_slug || "").toLowerCase() === slug) ownerId = id;
      });
      if (!ownerId) throw new Error("Page not found.");
      if (!store.leads) store.leads = {};
      if (!store.leads[ownerId]) store.leads[ownerId] = [];
      var id = "lead_" + makeCode();
      store.leads[ownerId].unshift({
        id: id,
        partner_id: ownerId,
        name: name,
        email: email,
        phone: phone,
        interest: interest,
        status: "new",
        source_slug: slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      localSave(store);
      return { id: id };
    },

    listMyLeads: async function () {
      if (!sessionUser) return [];
      if (configured() && client) {
        var { data, error } = await client
          .from("leads")
          .select("*")
          .eq("partner_id", sessionUser.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      }
      var store = localStore();
      return ((store.leads && store.leads[sessionUser.id]) || []).slice();
    },

    updateLeadStatus: async function (leadId, status) {
      if (!sessionUser) throw new Error("Sign in first.");
      if (["new", "reached", "done", "archived"].indexOf(status) < 0) {
        throw new Error("Unknown status.");
      }
      if (configured() && client) {
        var { data, error } = await client
          .from("leads")
          .update({ status: status })
          .eq("id", leadId)
          .eq("partner_id", sessionUser.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      var store = localStore();
      var list = (store.leads && store.leads[sessionUser.id]) || [];
      var found = null;
      list.forEach(function (row) {
        if (row.id === leadId) {
          row.status = status;
          row.updated_at = new Date().toISOString();
          found = row;
        }
      });
      if (!found) throw new Error("Lead not found.");
      store.leads[sessionUser.id] = list;
      localSave(store);
      return found;
    },

    countNewLeads: async function () {
      var rows = await Cloud.listMyLeads();
      var n = 0;
      rows.forEach(function (r) { if (r.status === "new") n++; });
      return n;
    }
  };

  window.FS.Cloud = Cloud;
})();
