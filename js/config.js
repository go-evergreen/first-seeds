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
      desc: "New to social selling — or just want a calm start? Four simple steps: your story, a short warm list, a page, and a rhythm you can keep."
    },
    full: {
      label: "Full runway",
      badge: "Full runway",
      desc: "Already comfortable sharing online? All six sections — story, grove, dream team, page, Post Studio, and your weekly rhythm."
    }
  },

  /* Onboarding copy — short + hype + personal */
  onboarding: {
    welcomeEyebrow: "Welcome to the team",
    welcomeTitle: "You made it in.",
    welcomeBody: "You're in The Fresh Grove — early enough that what you do before October 1 actually matters.\n\nNo fancy scripts. No pressure. Just a few quiet steps that make launch day feel less scary. Glad you're here.",
    welcomeCta: "Let's go",
    nameEyebrow: "Step 2 of 3",
    nameTitle: "What should we call you?",
    nameHint: "First name is perfect — we'll use it to cheer you on.",
    namePlaceholder: "Your first name",
    nameCta: "Continue",
    hypeLine: "Pre-registration opens October 1. The quiet work starts now.",
    modeEyebrow: "Step 3 of 3",
    modeTitle: "Pick your pace",
    modeLead: "No wrong answer. Pick what fits today — you can switch anytime under Your pace in the sidebar."
  },

  /* Mini-tour after mode pick */
  tour: [
    {
      title: "Roots grow when you answer",
      body: "Every box you fill sends a root deeper underground. Watch the soil — your work is happening even when it feels quiet."
    },
    {
      title: "Your sprout grows when you finish a section",
      body: "Hit continue on a section and the plant above ground stretches taller. Roots = answers. Sprout = finished sections. Both matter."
    },
    {
      title: "It saves on this device",
      body: "Leave and come back anytime. Download your answers when you want a copy for yourself or your team lead."
    }
  ],

  /* Hook bank — everyday voice, not pitchy */
  hookBank: [
    "I've been reading ingredient labels more than I used to. Found something that made me pause…",
    "Okay so I joined something new and I'm still figuring out how to talk about it without sounding weird.",
    "Tiny thing I noticed this week that made me rethink my bathroom shelf…",
    "I used to roll my eyes at \"clean beauty.\" Then I actually looked at what I was putting on my face.",
    "Not selling anything today — just sharing something I've been learning about freshness in skincare.",
    "If you've ever stood in a store aisle feeling overwhelmed by options… same.",
    "I said I'd never do one of these. Then a friend walked me through it slowly and it actually made sense.",
    "Honest question I've been asking myself lately about the products I buy…"
  ],

  /* Soft DM starter — sounds like a text to a friend */
  dmStarter: "hey! totally random — I joined this Austrian skincare thing that's coming to the US in the fall. still learning, but I thought of you. no pressure at all, just didn't want you hearing about it from a random ad later. want me to send you a little update when it's closer?",

  /* Landing page options in "Your Patch of Ground" */
  pageOptions: {
    custom: {
      title: "A custom page from your team lead",
      desc: "Your own page with your story on it. Message your team lead when you're ready — no rush."
    },
    generic: {
      title: "The team template on our board",
      desc: "Grab the ready-made page, drop in your name and a short note about you. Fine to start here and upgrade later."
    }
  },

  /* Weekly rhythm options in "Tend It".
     day: 0=Sun 1=Mon ... 6=Sat, or -1 for non-calendar habits */
  rhythms: [
    { label: "Monday — share a little piece of my why", day: 1, icon: "📖", short: "Story" },
    { label: "Wednesday — one honest note on something I'm trying", day: 3, icon: "🧴", short: "Product" },
    { label: "Friday — something real about this founding season", day: 5, icon: "✨", short: "Moment" },
    { label: "Sunday — soft invite (\"DM me FRESH if you want updates\")", day: 0, icon: "💌", short: "Invite" },
    { label: "I'll check in with the team group once a week", day: -1, icon: "🌳", short: "" },
    { label: "I'll message one person from my grove list each week", day: -1, icon: "💬", short: "" }
  ],

  /* localStorage key — bump the version if you change data shape */
  storeKey: "firstSeeds_v5",

  /* Previous key — one-time migrate answers if present */
  legacyStoreKey: "firstSeeds_v4"
};
