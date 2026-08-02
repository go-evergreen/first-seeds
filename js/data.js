/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — DATA
   Section list + post types + claim-checker vocabulary.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

/* modes: which hub modes show this section in the nav.
   Starter = calm 4-step path. Full = all six. */
window.FS.SECTIONS = [
  { id: "roots",  label: "Plant Your Roots",     sub: "your story",       modes: ["starter", "full"] },
  { id: "ground", label: "Your Patch of Ground", sub: "your page",        modes: ["starter", "full"] },
  { id: "grove",  label: "Map Your Grove",       sub: "customers · partners optional", modes: ["starter", "full"] },
  { id: "tree",   label: "Grow Your Tree",       sub: "your future team", modes: ["full"] },
  { id: "plant",  label: "Start Planting",       sub: "your first seeds", modes: ["full"] },
  { id: "tend",   label: "Calendar",             sub: "your content plan", modes: ["starter", "full"] }
];

window.FS.DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

/* ═══ THE FIVE SEED TYPES ═══
   Built for how social actually works now: saves, comments,
   native conversation — not polished brochure posts. */
window.FS.SEED_TYPES = [
  {
    id: "open_loop",
    icon: "🔓",
    name: "The Open Loop",
    tagline: "Start a true story. Don't finish it yet.",
    works_today: "Algorithms reward watch-time and returns. An unfinished true story makes people stop scrolling — and come back. Use it as a Reel hook, carousel first slide, or the first line of a caption.",
    psychology: "Curiosity is an information gap. Once someone knows a specific unanswered detail exists, not knowing it feels uncomfortable. Vague mystery reads as bait. A concrete unfinished moment reads as a story mid-telling.",
    template: "One specific true moment + how it landed on you + a soft hold-back (\"more soon\" / \"still sitting with this\"). Don't resolve the whole thing in one post.",
    example: "I stayed up way too late reading about a skincare company I'd never heard of. One detail stopped me cold — and I'm still sitting with it.",
    classy_rule: "The payoff has to be real later. One open loop at a time. If you tease everything and deliver nothing, people mute you.",
    draftKey: "seed_open",
    draftKind: "open",
    draftHint: "A true moment. Leave the ending for later.",
    draftPlaceholder: "I stayed up too late reading about…"
  },
  {
    id: "curtain",
    icon: "🎬",
    name: "Behind the Curtain",
    tagline: "Document the messy middle — not the highlight reel.",
    works_today: "Process content outperforms polish right now. \"Currently…\" posts feel human on Stories, Reels, and carousels. People follow people who are figuring something out in public.",
    psychology: "People don't argue with stories the way they argue with claims. A documented journey (learning, doubting, deciding) builds trust that a product shot can't.",
    template: "What you're doing right now + what surprised you + what you're still unsure about. Present tense. Leave the rough edges in.",
    example: "Currently: learning about an Austrian company that makes fresh cosmetics without synthetic preservatives as the shortcut. Surprised by how much the expiry date actually matters. Still figuring out how to talk about it without sounding weird.",
    classy_rule: "Show real uncertainty. Perfect \"day in the life\" edits feel like ads. A half-formed thought feels like a friend.",
    draftKey: "seed_curtain",
    draftKind: "give",
    draftHint: "What's happening in the messy middle — no ask yet.",
    draftPlaceholder: "Currently…"
  },
  {
    id: "honest_note",
    icon: "📝",
    name: "The Honest Note",
    tagline: "One specific observation + one honest caveat.",
    works_today: "Saves beat likes. Specific + two-sided notes get bookmarked. \"Here's what I noticed / here's who it's not for\" is the format people trust right now.",
    psychology: "Praise that includes a limitation is rated more credible than pure praise. Specificity does the same work — \"soft after 12 hours\" beats \"life-changing.\"",
    template: "What you tried + the one thing you actually noticed + when you noticed it + one caveat (who it's NOT for, or what surprised you).",
    example: "Honest note on the cleanser: takes makeup off with just a washcloth and my skin doesn't feel tight after. Caveat — if you love a big foamy lather, this isn't that. It's more of a milk.",
    classy_rule: "Only claim what you personally experienced. The caveat isn't weakness — it's why people believe you.",
    draftKey: "seed_honest",
    draftKind: "give",
    draftHint: "One thing you noticed + one honest caveat.",
    draftPlaceholder: "Honest note…"
  },
  {
    id: "values_flag",
    icon: "🚩",
    name: "The Values Flag",
    tagline: "Say what you stand for. No product. No ask.",
    works_today: "Identity posts drive follows and shares. When someone agrees with your standard, your later posts feel like consistency — not a pitch. Great as a carousel opinion or a short talking-head Reel.",
    psychology: "People commit to identities more than purchases. Agreeing with your bar (\"ingredients should need no apology\") makes saying yes later feel like staying true to themselves.",
    template: "A belief about products / ingredients / wellness + why you hold it + zero selling, zero links, zero CTA.",
    example: "Unpopular-ish opinion: \"natural\" on a label doesn't tell me much. I want to know who made it, why each ingredient is there, and whether they'd put it on their own kid. That's the bar for me.",
    classy_rule: "No product, no link, no \"DM me.\" This post only plants a flag people want to stand near.",
    draftKey: "seed_values",
    draftKind: "give",
    draftHint: "A belief you'd stand by — no product, no ask.",
    draftPlaceholder: "Something I believe…"
  },
  {
    id: "soft_door",
    icon: "🚪",
    name: "The Soft Door",
    tagline: "One tiny invite. Zero pressure. After you've given.",
    works_today: "Comments and DMs beat link-in-bio clicks for warm outreach. One clear ask (\"drop a 🌱\" / \"comment curious\") outperforms a wall of CTAs. Earn this post with four gives first.",
    psychology: "A single small ask starts a real conversation. Moving from the feed into messages is where trust builds. Two CTAs compete and both lose.",
    template: "Quick true context + exactly one action + what they get + explicit no-pressure language.",
    example: "I've been researching a wellness company that keeps answering my questions the deeper I look. If you'd like to follow along while I share what I'm learning, drop a 🌱 below — happy to bring you along. No pressure either way.",
    classy_rule: "Four gives, then one door. Never stack soft doors. The ratio is your reputation.",
    draftKey: "seed_invite",
    draftKind: "invite",
    draftHint: "One tiny invite. Zero pressure.",
    draftPlaceholder: "If you'd like to follow along, drop a 🌱…"
  }
];

/* Gentle nudges, never blocks. Each entry: regex, display word, tip. */
window.FS.RISKY = [
  { re: /\bcure[sd]?\b|\bcuring\b/i, word: "cure", tip: "reads as a medical claim — describe your own experience instead" },
  { re: /\bheal(s|ed|ing)?\b/i, word: "heal", tip: "health-claim territory — try \u201cmy skin felt\u2026\u201d" },
  { re: /\btreat(s|ed|ment|ing)?\b/i, word: "treat", tip: "implies medical treatment — keep it personal and cosmetic" },
  { re: /\bfix(es|ed)?\s+(my|your)\b/i, word: "fix", tip: "promises an outcome — share what you noticed instead" },
  { re: /\bdetox\w*\b/i, word: "detox", tip: "a claim regulators watch closely — skip it" },
  { re: /\banti-?inflammatory\b/i, word: "anti-inflammatory", tip: "a drug-level claim — leave this to the label" },
  { re: /\b(eczema|psoriasis|acne|rosacea|arthritis|anxiety|depression|adhd|thyroid|hormon\w+|cancer|diabetes)\b/i, word: "condition names", tip: "naming conditions turns a story into a claim — talk about you, not a diagnosis" },
  { re: /\bguarantee[sd]?\b/i, word: "guarantee", tip: "never promise results — honesty converts better anyway" },
  { re: /\bmiracle\b/i, word: "miracle", tip: "platforms flag this word — your honest note is stronger" },
  { re: /\bclinically proven\b/i, word: "clinically proven", tip: "only if citing Ringana's actual published data" },
  { re: /\bfda[\s-]?approved\b/i, word: "FDA approved", tip: "cosmetics aren't FDA-approved — this one can't be said" }
];
