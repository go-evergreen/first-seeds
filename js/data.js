/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — DATA
   Section list + claim-checker vocabulary.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

/* modes: which hub modes show this section in the nav.
   Starter = calm 4-step path. Full = all six. */
window.FS.SECTIONS = [
  { id: "roots",  label: "Plant Your Roots",     sub: "your story",       modes: ["starter", "full"] },
  { id: "grove",  label: "Map Your Grove",       sub: "your warm list",   modes: ["starter", "full"] },
  { id: "tree",   label: "Grow Your Tree",       sub: "your future team", modes: ["full"] },
  { id: "ground", label: "Your Patch of Ground", sub: "your page",        modes: ["starter", "full"] },
  { id: "plant",  label: "Start Planting",       sub: "your first seeds", modes: ["full"] },
  { id: "tend",   label: "Tend It",              sub: "your rhythm",      modes: ["starter", "full"] }
];

window.FS.DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

/* ═══ THE FIVE SEED TYPES ═══
   Post frameworks for the Post Studio — examples sound like
   a regular person figuring this out, not a launch script. */
window.FS.SEED_TYPES = [
  {
    id: "open_loop",
    icon: "🔓",
    name: "The Open Loop",
    tagline: "Start a true story. Don't finish it — yet.",
    psychology: "Curiosity is the itch of an information gap: once someone knows a specific question exists, not knowing the answer is genuinely uncomfortable. Specificity is what makes it work — vague mystery reads as bait, a concrete unanswered detail reads as a story mid-telling.",
    template: "Specific true moment + the feeling it gave you + \u201cmore on this soon\u201d or \u201cask me\u201d. Never resolve everything in one post.",
    example: "I stayed up way too late last night reading about a skincare company I'd never heard of. One detail stopped me cold — and I'm still sitting with it. (more this week)",
    classy_rule: "The payoff must be real and worth the wait. One open loop at a time — stacked cliffhangers feel like a soap opera, one feels like a story."
  },
  {
    id: "curtain",
    icon: "🎬",
    name: "Behind the Curtain",
    tagline: "Share the journey, not the product.",
    psychology: "People don't argue with stories the way they argue with claims — a narrative gets processed as an experience, not a pitch to evaluate. Documenting your real journey (deciding, learning, doubting, committing) builds parasocial trust that no product shot can.",
    template: "What you're doing right now + what surprised you + what you're still figuring out. Present tense. Imperfect on purpose.",
    example: "Currently: trying to write about this new thing I joined without sounding like a commercial. Surprised by how much I care about the freshness piece. Still figuring out what to say out loud.",
    classy_rule: "Show real process, including uncertainty. Perfection is forgettable; a documented decision is a story people follow to the end."
  },
  {
    id: "honest_note",
    icon: "📝",
    name: "The Honest Note",
    tagline: "One product. One specific observation. Include the caveat.",
    psychology: "Two-sided messages — praise that includes a limitation — are consistently rated more credible than pure praise, because admitting a downside signals you're informing, not selling. Specificity does the same work: \u201csoft after 12 hours\u201d is believable where \u201clife-changing\u201d is noise.",
    template: "Product + the one specific thing you noticed + when/how you noticed it + one honest caveat or who it's NOT for.",
    example: "Honest note on the cleanser: takes makeup off with just a washcloth and my skin doesn't feel tight after. Caveat — if you love a big foamy lather, this isn't that. It's more of a milk. Took me a minute.",
    classy_rule: "Only ever claim what you personally experienced. The caveat isn't a weakness in the post — it's the engine of it."
  },
  {
    id: "values_flag",
    icon: "🚩",
    name: "The Values Flag",
    tagline: "What you stand for — no product mentioned.",
    psychology: "People follow people, and they commit to identities more than to purchases. When someone agrees with your standard (\u201cingredients should need no apology\u201d), saying yes to what you share later is just consistency with who they've already decided they are.",
    template: "A belief you hold about products/ingredients/wellness + why you hold it + zero selling. Let people self-select into your worldview.",
    example: "Unpopular-ish opinion: \"natural\" on a label doesn't tell me much. I want to know who made it, why each ingredient is there, and whether they'd put it on their own kid. That's the bar for me.",
    classy_rule: "No product, no link, no CTA. This post's only job is to plant a flag people want to stand near."
  },
  {
    id: "soft_door",
    icon: "🚪",
    name: "The Soft Door",
    tagline: "One clear, tiny, zero-pressure invitation.",
    psychology: "A single small ask converts better than a big one or many: micro-commitments (\u201cDM me a word\u201d) start a consistency ladder, and moving to DMs shifts you from broadcasting to a 1:1 conversation — which is where trust actually converts. One CTA per post; two CTAs compete and both lose.",
    template: "Quick recap of the moment (launch timing) + exactly one action + what they get + explicit no-pressure language.",
    example: "This brand opens in the US this fall and I'm putting together a little first-access list for friends who want updates. If that's you, DM me FRESH. No pitch — just first in line if you want it.",
    classy_rule: "Earn the door with the four posts before it. Never post two doors in a row — the ratio is the reputation."
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
