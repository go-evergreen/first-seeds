# First Seeds 🌱

A self-paced onboarding runway for founding Ringana partners — from "I'm in" to a story, a warm list, a dream team tree, a landing page, and first seeds planted, before pre-registration opens.

Built with zero dependencies: plain HTML/CSS/JS, deploys anywhere static files work (GitHub Pages, Netlify, etc.). No build step.

## Dual modes

Partners choose a pace at the end of onboarding (switch anytime in the rail):

| Mode | Path | Best for |
|---|---|---|
| **Getting started** | Roots → Grove → Ground → Tend (4 steps) | New or overwhelmed — calm foundation without the tree or Post Studio |
| **Full runway** | All 6 sections | Ready to go — dream team tree, Post Studio frameworks, hooks, starter trio |

Progress and answers persist across mode switches. Starter finish offers **Unlock Full runway**.

## Onboarding

First visit (or after Start over):

1. Welcome to the team (hype + founding-partner energy)
2. First name + Oct 1 countdown
3. Mode pick (Getting started / Full runway)
4. Mini-tour (plant growth, one-section-at-a-time, auto-save)

Name appears in greetings throughout ("Hey Maya — let's put down roots.").

## Structure

```
first-seeds/
├── index.html          ← markup, onboarding + tour overlays
├── css/
│   └── styles.css      ← design system + overlays
└── js/
    ├── config.js       ← ⭐ THE ONLY FILE LEADERS NEED TO EDIT
    ├── data.js         ← sections (with modes), claim-checker, seed types
    ├── plant.js        ← growing plant SVG
    ├── tree.js         ← family tree builder
    └── app.js          ← state, modes, onboarding, tour, widgets (loads last)
```

Script load order: `config → data → plant → tree → app`.

## Customizing for a leader

Everything a leader should personalize lives in `js/config.js`:

- `teamName` / `teamDisplayName` — sidebar eyebrow + onboarding copy
- `tagline` — sidebar subtitle
- `preRegDate` / `launchDate` — countdown targets (auto-roll to next year)
- `signoff` — finish-screen sign-off
- `modes.starter` / `modes.full` — labels + descriptions on the mode-pick cards
- `onboarding` — welcome / name / mode-step copy
- `tour` — mini-tour tip cards after mode pick
- `dmStarter` — copyable DM template in the Grove section
- `hookBank` — copyable first-lines in the Post Studio
- `pageOptions` — landing-page option cards
- `rhythms` — weekly rhythm checklist (day: 0=Sun…6=Sat, -1 for habits)
- `storeKey` / `legacyStoreKey` — localStorage keys; bump `storeKey` if you change data shape

## How it works

- **Persistence**: everything saves to `localStorage` on the partner's device, debounced 500ms after typing. "Start over" clears it (with confirm) and reopens onboarding.
- **Growth**: the sidebar plant's *roots* grow per answer; the *plant* above ground grows per completed section (scaled to the active mode's section count). Bloom at full completion.
- **Claim checker**: `data.js` → `RISKY` array of `{re, word, tip}`. Runs live on writing fields.
- **Post Studio (Full only)**: five frameworks in `SEED_TYPES`. Starter trio + 4:1 give:ask cadence.
- **Family tree (Full only)**: nested `{name, status, children}`. Included in text export.
- **Export**: "Download my answers" produces a plain-text summary (includes name + mode).

## Deploy (GitHub Pages)

Drop the whole folder into your repo (e.g. as `/first-seeds/`) and it's live at
`https://<user>.github.io/<repo>/first-seeds/`.

## Ideas for later

- Sync progress to a backend so leaders see team progress
- Shareable read-only tree snapshot
- Per-leader config via URL param (`?team=grove`)
- Reminder emails when someone stalls mid-guide
