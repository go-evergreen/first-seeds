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
      label: "Soft start",
      badge: "Soft start",
      tag: "Essentials",
      desc: "Five calm steps: your story, products that feel like you, a simple page to share, who you'd tell first, and a clear finish. Content and Grove unlock on All in."
    },
    full: {
      label: "All in",
      badge: "All in",
      tag: "Everything",
      desc: "Everything in Soft start, plus Content (calendar, post vault, stories, photos), a dream-team sketch, Post Studio, and Grow Your Grove — all the way to launch."
    }
  },

  /* Plain-language names used across the hub */
  terms: [
    {
      term: "Growth",
      def: "The percentage on Sprout. It shows how many checklist steps you've finished — real prep done, not how loud you've been online."
    },
    {
      term: "Runway",
      def: "Your step-by-step prep path on Sprout. Soft start is the shorter path; All in unlocks Content, the dream-team sketch, Post Studio, and Grow Your Grove."
    },
    {
      term: "Pick Your First Few",
      def: "A Soft start step after Roots: favorite a few products you’re looking forward to, and open Talking fresh — so your story has real product knowledge behind it."
    },
    {
      term: "Roots",
      def: "The three story questions that start everything — why you're here, a moment that mattered, and what made you say yes."
    },
    {
      term: "Grow Your Grove",
      def: "The All in tab for live partners in First Seeds — who’s moving, who needs a check-in, and your join link. Bottom nav shortens it to Grove."
    },
    {
      term: "Grove",
      def: "Two close meanings: on Sprout, Map Your Grove is your people list (customers first, partners optional). In the bottom nav, Grove opens Grow Your Grove — your live Fresh Grove partners."
    },
    {
      term: "Customers",
      def: "People who'd care about the products even if business talk isn't their thing. Tap your first chats in the list — that's your outreach list (and they show on the Content calendar on All in)."
    },
    {
      term: "Leads",
      def: "Your lead generation page. Share the link — people leave name + email or phone, and whether they care about products, business, or both. Entries land only in your inbox — different from your team join link."
    },
    {
      term: "Learn the products",
      def: "A searchable product library inside Learn — skincare, body, hair, baby, and supplements."
    },
    {
      term: "Post vault",
      def: "Suggested feed posts with hooks, slides, and captions. Each card has Type (Carousel/Reel/Story…) and Promoting (product, values, business…)."
    },
    {
      term: "Content",
      def: "Your calendar plus This week, Post vault, Story sequences, and Grab a photo. Plan here — nothing auto-sends."
    },
    {
      term: "Talking fresh",
      def: "A conversation guide inside Learn — what to say when someone comments, objects, goes quiet, or asks about partnering."
    },
    {
      term: "Learn",
      def: "Clear Ringana + U.S. launch facts — and Talking fresh for when someone asks. Clarity over hype."
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

    nameEyebrow: "Nice to meet you",
    nameTitle: "What should we call you?",
    nameHint: "First name is perfect — we'll use it on Sprout so this feels like yours.",
    namePlaceholder: "Your first name",
    nameCta: "That's me →",
    hypeLine: "Pre-registration opens October 1. Prep season is right now — and you're already in it.",

    authEyebrow: "Save your spot",
    authTitle: "Keep your progress with you",
    authBody: "Create a quick email + password so your story, calendar, and share link don't vanish if you switch phones or clear your browser. You can skip for now and sign in anytime from the top bar.",
    authCta: "Sign in →",
    authSkip: "Continue without signing in",
    authHint: "New here? Tap Create account. Already have one? Sign in with the same email.",

    installEyebrow: "One important step",
    installTitle: "Add First Seeds to your Home Screen",
    installLead: "This isn’t an App Store download — you’ll save it once so it opens like an app. Pick your device, follow the taps, then confirm below.",
    installCta: "I've added it →",
    installSkip: "I'll add it later",

    modeEyebrow: "Your path",
    modeTitle: "How much do you want on your plate?",
    modeLead: "No wrong answer. Start light or go all in — you can switch anytime in Settings."
  },

  tour: [
    {
      title: "Sprout is your home base",
      body: "You'll see a little plant and a Growth % here. Answer the three Roots questions and it starts growing — every real step you finish helps it along. No pressure to finish everything today.",
      panel: "welcome",
      target: ".home-plant-zone",
      placement: "below"
    },
    {
      title: "Checklists are your map",
      body: "Each section has a short list of real prep steps. Clear a box, watch the plant catch up. Visiting a page doesn't count — finishing a step does.",
      panel: "welcome",
      target: ".home-runway",
      placement: "above"
    },
    {
      title: "When someone asks, open Learn",
      body: "Launch dates, product differences, and Talking fresh (how to handle the real moments) live under Learn. Clear facts first — so you never have to bluff.",
      panel: "welcome",
      target: '#bottomNav [data-tab="know"]',
      placement: "above"
    },
    {
      title: "This is where you grow your own grove",
      body: "Grove is your live team home — and this is where you get your unique join link to share with people who want to build a business with you. When they sign in with your link, they’re on your team. You’ll also see who’s moving and can cheer them on. (Soft start unlocks Grove on All in anytime in Settings.)",
      panel: "welcome",
      target: '#bottomNav [data-tab="team"]',
      placement: "above",
      revealGroveTab: true
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
      title: "First Seeds lead page (in-app)",
      desc: "Built into this app — claim a short link to share with interested people. Their info lands in your inbox. No extra tools needed."
    },
    custom: {
      title: "A custom-built landing page",
      desc: "Connect with your Fresh Grove leader for more info."
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
      id: "silent_week",
      when: "Quiet for a week+",
      match: function (ctx) { return ctx.daysSinceActive >= 7 && ctx.sectionsDone < ctx.sectionTotal; },
      body: "Thinking of you, {name}. Life gets busy — First Seeds will be right where you left it. One tiny answer is enough. Here if you want company on a module."
    },
    {
      id: "no_roots_stalled",
      when: "Joined, still on Roots after several days",
      match: function (ctx) {
        return !ctx.done.roots && (ctx.daysSinceJoined >= 5 || ctx.daysSinceActive >= 5);
      },
      body: "Hey {name} — no rush at all. When you have 10 quiet minutes, the three Roots questions are just your story in your words. That's the whole first step 🌱 I'm here if you want company."
    },
    {
      id: "stuck_grove",
      when: "Finished Ground, quiet on Grove",
      match: function (ctx) {
        return ctx.done.ground && !ctx.done.grove && ctx.daysSinceActive >= 5;
      },
      body: "Hey {name} — your page draft's in. Next is Map Your Grove whenever you're ready: list people who'd love the products, then tap a few first chats. Partners are optional if you're building. No pressure."
    }
  ],

  /* Supportive check-ins for people who are new or still moving — not "nudge" tone */
  supports: [
    {
      id: "welcome",
      when: "Just getting started",
      match: function (ctx) {
        return ctx.daysSinceJoined <= 2 || (ctx.sectionsDone === 0 && ctx.daysSinceActive <= 1);
      },
      body: "Hey {name} — so glad you're here. No rush at all. Explore First Seeds at your pace — I'm around if you want a hand 🌱"
    },
    {
      id: "active_today",
      when: "Active today",
      match: function (ctx) { return ctx.daysSinceActive === 0; },
      body: "Hey {name} — saw you in First Seeds today. That quiet showing-up counts. Here if you want company on anything 🌳"
    },
    {
      id: "roots_soft",
      when: "Settling into Roots",
      match: function (ctx) { return !ctx.done.roots; },
      body: "Hey {name} — loving that you're in. The Roots questions are just getting your story down in your words — whenever you're ready 💚"
    },
    {
      id: "making_progress",
      when: "Making progress",
      match: function (ctx) { return ctx.sectionsDone >= 1 && ctx.sectionsDone < ctx.sectionTotal; },
      body: "Hey {name} — you're moving through this beautifully. Keep going at your pace — proud of you for showing up."
    },
    {
      id: "blooming",
      when: "Almost there — cheer",
      match: function (ctx) { return ctx.sectionsDone >= Math.max(3, ctx.sectionTotal - 1); },
      body: "Look at you, {name}. You've done the quiet prep most people skip. Proud of you — keep learning at your pace 🌳"
    }
  ],

  cheerTemplates: [
    "I see you showing up — that matters more than perfect posts.",
    "Root by root. You're doing the real work.",
    "Proud of you. Clarity over hype — keep going at your pace.",
    "Your prep is showing. Soft and steady still counts as progress.",
    "Someone out there is going to feel safer because you learned this carefully.",
    "No rush to be loud — keep planting what feels true.",
    "I'm cheering for the quiet work you're doing behind the scenes."
  ],

  /* Coachmarks the first time someone appears on Team */
  teamTourVersion: 11,
  teamTour: [
    {
      title: "Your unique team link",
      body: "Share this anytime from the button up top. When someone signs in with your link, they’re linked to you in First Seeds — that’s how your live team tree starts.",
      panel: "leader",
      target: '[data-team-tour="invite"]',
      placement: "below"
    },
    {
      title: "Your growing team",
      body: "This is your live tree. Tap a name for their card. A + means they have people under them. Sort by Most legs or Newest.",
      panel: "leader",
      target: '[data-team-tour="tree"]',
      placement: "above",
      fullSpot: true
    },
    {
      title: "Mentoring — by how they’re moving",
      body: "Needs a nudge · In motion · Ready. Tap a name to expand — progress, Send cheer, and Leave note. Cards stay clean; drafts only open when you tap those buttons.",
      panel: "leader",
      target: "#leaderLists .leader-col",
      placement: "auto"
    },
    {
      title: "Send a cheer",
      body: "Cheer is a warm preset line you send inside First Seeds. Preview it here, tap Choose another to cycle lines, then Send — they get a banner from you at the top of their app.",
      panel: "leader",
      target: "#cheerSheet .cheer-sheet-card",
      openCheerSheet: true,
      placement: "auto"
    },
    {
      title: "Leave a note",
      body: "Leave note is your own message (often prefilled from how they’re moving). Edit it, then Send so it shows on their runway — or Copy and paste it wherever you usually chat. Nothing sits on their card until you open this.",
      panel: "leader",
      target: "#noteSheet .cheer-sheet-card",
      openNoteSheet: true,
      placement: "auto"
    },
    {
      title: "Optional: sketch with real names",
      body: "Down below, “Add live names to Grow Your Tree” copies people from this live team into your Grow Your Tree sketch — so your practice map can match who’s really with you.",
      panel: "leader",
      target: '[data-team-tour="tools"]',
      placement: "above"
    }
  ],

  storeKey: "firstSeeds_v6",
  legacyStoreKey: "firstSeeds_v5"
};
