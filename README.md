# First Seeds 🌱

A self-paced onboarding runway for founding Ringana partners — and the **Fresh Grove bridge** until Evergreen Co launches (Jan 2027).

Zero build step: plain HTML/CSS/JS. Optional Supabase for accounts, invite links, leader visibility, and cloud sync.

## Bridge Hub features

| Feature | What it does |
|---|---|
| **Sign in** | Magic link (Supabase) or local bridge mode for demos |
| **Join links** | `?join=CODE` attaches a new partner to their sponsor |
| **Cloud save** | Runway answers sync when signed in |
| **My people** | Leader triage: Needs a nudge / In motion / Blooming + copy-paste nudges + leave a note |
| **Post calendar** | Suggested posts (4:1 give/ask + rest days); Drafted / Done / Skipped |
| **Cheers** | Leader one-tap encouragement (no chat) |
| **Notify leader** | Finish-screen one-tap ping so your sponsor sees you asked for eyes |
| **Team pulse** | Aggregate grove names / blooming counts on Home |
| **Handoff export** | JSON for Evergreen import — see [`docs/EVERGREEN-HANDOFF.md`](docs/EVERGREEN-HANDOFF.md) |

**Not building:** team chat, auto-posting to social, income dashboards.

## Dual modes

| Mode | Path |
|---|---|
| **Soft start** | Roots → Pick Your First Few → Ground → Grove → finish |
| **All in** | + Grow Your Tree · Start Planting · Content (+ Grove in nav) |

## Structure

```
first-seeds/
├── index.html
├── css/styles.css
├── docs/EVERGREEN-HANDOFF.md
├── supabase/schema.sql      ← run in Supabase SQL editor
└── js/
    ├── config.js            ← leader-editable copy, nudges, dates
    ├── supabase-config.js   ← paste project URL + anon key
    ├── data.js
    ├── plant.js / tree.js
    ├── calendar.js
    ├── cloud.js             ← auth + sync + downline
    ├── bridge-ui.js         ← account, leader, calendar UI
    └── app.js
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor
3. Enable **Email** auth (magic link) under Authentication
4. Paste URL + anon key into [`js/supabase-config.js`](js/supabase-config.js)
5. Add your site URL to Auth → Redirect URLs

Leave keys blank to use **local bridge mode** (same browser only — perfect for testing join links with two accounts).

## Customizing

Edit [`js/config.js`](js/config.js): team name, dates, modes, hooks, DM starter, **nudges**, cheer templates, rhythms.

## Deploy

Static host (GitHub Pages, Netlify, etc.). For Supabase magic links, use HTTPS and configure redirect URLs.

## Success metrics (bridge season)

- % of invitees finishing Roots in 7 days
- Runway completion before Oct 1
- Drop in “what do I post?” DMs you send manually
- Partners marking ≥3 calendar cards Done / week in October
