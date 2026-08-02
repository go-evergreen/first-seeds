/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — CONFIG
   This is the ONLY file a leader needs to edit to make
   this guide their own. Everything here is safe to change.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

window.FS.CONFIG = {

  /* Shown in the sidebar above "First Seeds" */
  teamName: "THE FRESH GROVE",

  /* Friendly team name used in onboarding copy */
  teamDisplayName: "The Fresh Grove",

  /* Sidebar tagline */
  tagline: "Your runway to launch — it grows as you do.",

  /* Key dates (month is 1-12). Countdown targets these. */
  preRegDate:  { month: 10, day: 1, label: "Pre-Reg Opens" },
  launchDate:  { month: 11, day: 1, label: "Products Launch" },

  /* Sign-off on the finish screen */
  signoff: "— see you in The Fresh Grove 🌱",

  /* Dual-mode labels (shown in onboarding + rail settings) */
  modes: {
    starter: {
      label: "Getting started",
      badge: "Getting started",
      desc: "New to Ringana or feeling a little overwhelmed? A calm 4-step path — your story, your warm list, your page, and a simple rhythm. No pressure to do it all."
    },
    full: {
      label: "Full runway",
      badge: "Full runway",
      desc: "Ready to build? All six sections — story, grove, dream team tree, landing page, Post Studio, and your launch rhythm. The whole toolkit."
    }
  },

  /* Onboarding copy — short + hype + personal */
  onboarding: {
    welcomeEyebrow: "Welcome to the team",
    welcomeTitle: "You made it in.",
    welcomeBody: "You're a founding partner of The Fresh Grove — early enough that what you do before October 1 actually shapes the launch.\n\nNo scripts. No pressure. Just quiet work that turns into real momentum. We're glad you're here.",
    welcomeCta: "Let's go",
    nameEyebrow: "Step 2 of 3",
    nameTitle: "What should we call you?",
    nameHint: "First name is perfect — we'll use it to cheer you on.",
    namePlaceholder: "Your first name",
    nameCta: "Continue",
    hypeLine: "Pre-registration opens October 1. The quiet work starts now.",
    modeEyebrow: "Step 3 of 3",
    modeTitle: "Pick your pace",
    modeLead: "No wrong answer — just pick what fits where you are right now. You can switch anytime under Your pace in the sidebar."
  },

  /* Mini-tour after mode pick (2–3 tips) */
  tour: [
    {
      title: "Your plant grows with you",
      body: "Every answer you fill in grows the roots. Every section you finish grows the plant above ground. By the end, it blooms — and so do you."
    },
    {
      title: "One section at a time",
      body: "Work at your own pace. Complete a section when it feels done, then move forward. You can always revisit anything from the sidebar."
    },
    {
      title: "It saves on this device",
      body: "Leave and come back anytime — your answers stick. Download them when you want a copy for yourself or your team lead."
    }
  ],

  /* Hook bank — copyable opening lines in the Post Studio.
     Edit freely; make them sound like your team's voice. */
  hookBank: [
    "I flew across the country in the middle of winter for a skincare company. Worth it. Here's why…",
    "The ingredient list that made me rethink everything after years of loyalty to another brand…",
    "A family in Austria has been quietly doing what the clean beauty industry keeps promising…",
    "I've recommended a lot of products over the years. I've never done this before.",
    "My skincare has an expiration date like fresh food. That's not a flaw — that's the whole point.",
    "Nobody in the US can buy this yet. That's exactly why I'm telling you about it now.",
    "I said I'd never join another one of these. Then I actually read the formulation standards.",
    "The question I asked their team that changed my mind…"
  ],

  /* The copyable DM starter in the Grove section.
     Rewrite this in YOUR voice — it's meant to be stolen and personalized. */
  dmStarter: "hey! random but exciting — that Austrian skincare company I've been obsessed with is finally coming to the US. I got in early and I'm gathering my first people before it officially opens. zero pressure, I just didn't want you finding out from anyone else 💚 want me to keep you in the loop?",

  /* Landing page options in "Your Patch of Ground" */
  pageOptions: {
    custom: {
      title: "A custom page from your team lead",
      desc: "Your own fully designed page — personalized to your story, at a discounted partner rate. Message your team lead to set it up."
    },
    generic: {
      title: "The team template on our board",
      desc: "Grab the ready-to-go page from the team board and drop in your own name, story, and link. Free, fast, and totally solid to start with. You can always upgrade later."
    }
  },

  /* Weekly rhythm options in "Tend It".
     day: 0=Sun 1=Mon ... 6=Sat, or -1 for non-calendar habits */
  rhythms: [
    { label: "Monday — Story day (why Ringana, the legacy, my why)", day: 1, icon: "📖", short: "Story" },
    { label: "Wednesday — Product day (one honest note on something I love)", day: 3, icon: "🧴", short: "Product" },
    { label: "Friday — Founding-moment day (first time in the US / this doesn't repeat)", day: 5, icon: "✨", short: "Moment" },
    { label: "Sunday — Invitation day (soft \u201cDM me FRESH\u201d)", day: 0, icon: "💌", short: "Invite" },
    { label: "I'll show up in the team group at least once a week", day: -1, icon: "🌳", short: "" },
    { label: "I'll DM one new person from my grove list each week", day: -1, icon: "💬", short: "" }
  ],

  /* localStorage key — bump the version if you change data shape */
  storeKey: "firstSeeds_v5",

  /* Previous key — one-time migrate answers if present */
  legacyStoreKey: "firstSeeds_v4"
};
