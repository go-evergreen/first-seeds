/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — CONFIG
   Leader-editable. Voice: Ringana-coded — fresh, clear, calm.
   Clarity over hype. Education over scripts.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

window.FS.CONFIG = {

  teamName: "THE FRESH GROVE",
  teamDisplayName: "The Fresh Grove",

  tagline: "Fresh products. Clear facts. Laying solid roots before launch.",

  preRegDate:  { month: 10, day: 1, label: "Pre-Reg Opens" },
  launchDate:  { month: 11, day: 1, label: "Products Launch" },
  miamiDate:   { month: 10, day: 24, label: "Miami Fresh Experience" },
  seasonYear: 2026,

  signoff: "— with you in The Fresh Grove 🌱",

  modes: {
    starter: {
      label: "Getting started",
      badge: "Getting started",
      tag: "Soft start",
      desc: "Four calm modules: your story, a simple page, who you'd tell first, and a content calendar. Perfect if you're new to sharing — or just want room to breathe."
    },
    full: {
      label: "Full runway",
      badge: "Full runway",
      tag: "All in",
      desc: "The whole path — story, page, grove, dream team sketch, Post Studio, and your calendar all the way to launch."
    }
  },

  /* Plain-language names used across the hub */
  terms: [
    {
      term: "Growth",
      def: "The percentage on Home. It shows how many checklist steps you've finished — real prep done, not how loud you've been online."
    },
    {
      term: "Runway",
      def: "Your step-by-step prep path (the modules on the left). Getting started is the shorter path; Full runway unlocks the dream team tree and Post Studio."
    },
    {
      term: "Roots",
      def: "The three story questions that start everything — why you're here, a moment that mattered, and what made you say yes."
    },
    {
      term: "Team",
      def: "Your partners growing with you in First Seeds — who's moving, who needs a check-in, and your join link. Shows in the bottom nav on Full runway."
    },
    {
      term: "Grove",
      def: "Your people map. Customers who'd love the products come first. Partners who'd walk the mission with you are optional — for builders who want both."
    },
    {
      term: "Customers",
      def: "People who'd care about the products even if business talk isn't their thing. Tap your first chats in the list — they land on your calendar to reach out."
    },
    {
      term: "Leads",
      def: "Your personal interest page. Share your link — people leave name + email or phone, and whether they care about products, business, or both. Entries land only in your inbox."
    },
    {
      term: "Learn the products",
      def: "A searchable product library inside Know — skincare, body, hair, baby, and supplements."
    },
    {
      term: "Know",
      def: "Clear Ringana + U.S. launch facts you can lean on when someone asks. Clarity over hype."
    },
    {
      term: "Founding circle",
      def: "People committed to joining The Fresh Grove at the official Ringana USA launch — and anyone who's already expressed interest in partnering with you on this mission."
    },
    {
      term: "First Seeds",
      def: "This hub. A Fresh Grove team prep resource — not an official Ringana corporate product. Details can still shift as launch firms up."
    }
  ],

  onboarding: {
    welcomeEyebrow: "The Fresh Grove · founding season",
    welcomeTitle: "We get to build this together.",
    welcomeBody: "We're so excited you're here — truly. First Seeds is where The Fresh Grove prepares for Ringana USA as a community, not a crowd of strangers doing checklists alone.\n\nYou'll get clear facts, space for your real story, and a place to gather people who might walk this mission with you. Calm prep. Shared energy. Launch that feels like arriving with people you trust.",
    welcomeCta: "Let's plant something →",

    circleEyebrow: "Before we dig in",
    circleTitle: "This hub is for our circle.",
    circleBody: "First Seeds isn't only for you — it's also for the people who want to partner with you in sharing this mission.\n\nPlease don't blast it as a public link. And please don't share it with anyone who hasn't already expressed interest in the business. We're building something intentional, and that energy matters.",
    circleNote: "First Seeds is a Fresh Grove team resource — not something published by Ringana corporate. Launch details here can still shift as the company firms things up.",
    circleCta: "I'm in — let's grow →",

    nameEyebrow: "Make it yours",
    nameTitle: "What should we call you?",
    nameHint: "First name is perfect. We'll put it on Home so this feels like your greenhouse, not a generic checklist.",
    namePlaceholder: "Your first name",
    nameCta: "That's me →",
    hypeLine: "Pre-registration opens October 1. Prep season is right now — and you're already in it.",

    authEyebrow: "Save your spot",
    authTitle: "Sign in so nothing gets lost",
    authBody: "Use email + password so your runway, lead page, and progress stay with you — works in the home-screen app with no email links.",
    authCta: "Sign in →",
    authSkip: "Continue without signing in",
    authHint: "New here? Create an account with the same form. You can also sign in later from the top bar.",

    modeEyebrow: "Your path",
    modeTitle: "How deep do you want to go?",
    modeLead: "No wrong answer. Start soft or go all in — you can switch anytime in Settings."
  },

  tour: [
    {
      title: "Home is where we grow together",
      body: "Your plant, your Growth %, and what's next all live here. Answer the three Roots questions and growth starts underground — then every checklist item sprouts you a little higher. This is your greenhouse in The Fresh Grove."
    },
    {
      title: "Checklists grow the plant",
      body: "Each box you clear is a real step done — not just a section visited. Watch the sprout catch up with you."
    },
    {
      title: "Facts live in Know",
      body: "Launch dates, what makes Ringana different, and the U.S. snapshot sit under Know in the bottom bar. Clarity first. Always."
    }
  ],

  /* Hook bank mirrors CONTENT.openLoops — kept here so leaders can edit without touching content.js */
  hookBank: null,

  /* Warm DM options — partners pick one and rewrite until it sounds like them */
  dmStarters: [
    {
      label: "Curious + excited",
      text: "Hey! Random but I've been meaning to reach out — I've been diving deep into something new the last few months and you came to mind as someone who'd actually get it! A fresh-made skincare + supplement line out of Austria is launching in the US and it's looking like it's going to be huge. Their ingredient standards are insane. Can I tell you a little about it?"
    },
    {
      label: "Personal + early",
      text: "Okay you're one of maybe ten people I'm reaching out to personally about this because it's still soooo new… there's an Austrian brand, made-fresh skincare and supplements, coming to the US for the first time. I wanted you to hear it from me and not a random message from a stranger haha. Can I share a little bit about the company?! I can't believe after 30 years they're still family owned and operated with nooo investors!"
    },
    {
      label: "Thoughtful researcher",
      text: "Hey! So you know I don't jump on things lightly but I've been quietly researching a line called Ringana for a few months — fresh-made, no synthetic preservatives, with actual clinical data behind it. It's launching in the US soon and I'm building a little founding community around it. Thought of you. Want the rundown?"
    },
    {
      label: "Short + direct",
      text: "Hi! I'll keep this short — I'm putting together a small group of people to walk into a US product launch with me (fresh-made Austrian skincare, body care, and supplements that have been around 30 years in Europe). Any interest?"
    }
  ],

  coldOutreach: {
    tag: "COLD MESSAGE TRAINING · DON'T SPAM",
    body: "<strong>Warm first. Always.</strong> Your first five should be people who'd be a little hurt if you <em>didn't</em> tell them — not strangers, not everyone in your phone, not that one mutual who hasn't texted you in three years.<br><br><strong>Never copy-paste the same DM to a list.</strong> Change at least one personal detail every time (why them, how you know them, what made you think of them). Identical blasts get ignored — and they make you look like a bot.<br><br><strong>Cold = slower + shorter.</strong> If you barely know them: one soft line, ask permission, stop. No \"it's going to be huge,\" no product dump, no follow-up the next day. One ask. If they don't reply, leave it.<br><br><strong>Quality over volume.</strong> Ten thoughtful texts beat fifty spray-and-pray messages. Your grove is not a funnel."
  },

  pageOptions: {
    generic: {
      title: "The team starter page",
      desc: "Use the ready-made page, add your name and a short note. Fine to start here and refine later."
    },
    custom: {
      title: "A custom landing page",
      desc: "Contact your Fresh Grove leader for more info — they'll help you set one up when you're ready."
    }
  },

  rhythms: [
    { label: "Monday — share one true piece of my why (no product pitch)", day: 1, icon: "📖", short: "Story" },
    { label: "Wednesday — one honest note on something I'm learning or trying", day: 3, icon: "🧴", short: "Product" },
    { label: "Friday — something real about this prep season", day: 5, icon: "✨", short: "Moment" },
    { label: "Sunday — soft check-in (\"want me to share what I've been learning?\")", day: 0, icon: "💌", short: "Invite" },
    { label: "I'll check in with The Fresh Grove once a week", day: -1, icon: "🌳", short: "" },
    { label: "I'll message one person from my grove list each week", day: -1, icon: "💬", short: "" }
  ],

  nudges: [
    {
      id: "no_roots",
      when: "Hasn't finished Roots yet",
      match: function (ctx) { return !ctx.done.roots; },
      body: "Hey {name} — no rush. When you have 10 quiet minutes, answer the three Roots questions in First Seeds. Your words, not a script. That's the whole first step 🌱"
    },
    {
      id: "stuck_grove",
      when: "Finished Ground, stalled on Grove",
      match: function (ctx) { return ctx.done.ground && !ctx.done.grove; },
      body: "Hey {name} — your page draft's in. Next is Map Your Grove: list people who'd love the products, then tap a few first chats (they'll show up on your calendar). Partners are optional if you're building."
    },
    {
      id: "silent_week",
      when: "Inactive 5+ days",
      match: function (ctx) { return ctx.daysSinceActive >= 5 && ctx.sectionsDone < ctx.sectionTotal; },
      body: "Thinking of you, {name}. Life gets busy — First Seeds will be right where you left it. One tiny answer is enough. Here if you want company on a module."
    },
    {
      id: "calendar_quiet",
      when: "Suggested posts not marked this week",
      match: function (ctx) { return ctx.weekPosted === 0 && ctx.sectionsDone >= 1; },
      body: "Hey {name} — the calendar has gentle ideas (and rest days). Mark one Posted when you share something true, or Skipped if today isn't the day. No perfection required."
    },
    {
      id: "pre_reg",
      when: "Pre-reg week energy",
      match: function (ctx) { return ctx.daysToPreReg <= 14 && ctx.daysToPreReg >= 0; },
      body: "Pre-reg is close, {name}. If you've got a few names you'd want in the loop, you're ahead. Soft language only — \"want me to keep you updated?\" is enough."
    },
    {
      id: "blooming",
      when: "Runway mostly done — cheer",
      match: function (ctx) { return ctx.sectionsDone >= Math.max(3, ctx.sectionTotal - 1); },
      body: "Look at you, {name}. You've done the quiet prep most people skip. Proud of you — keep learning the products and flipping hopefuls to yes when it's real 🌳"
    }
  ],

  cheerTemplates: [
    "I see you showing up — that matters more than perfect posts.",
    "Root by root. You're doing the real work.",
    "Proud of you. Clarity over hype — keep going at your pace."
  ],

  storeKey: "firstSeeds_v6",
  legacyStoreKey: "firstSeeds_v5"
};
