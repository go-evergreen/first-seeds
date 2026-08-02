# Evergreen handoff (Jan 2027)

First Seeds is the **bridge** until Evergreen Co launches. This doc describes how to migrate identity, sponsorship, and runway progress without rebuilding history.

## Identity

- Same **email** = same person in Evergreen.
- Supabase Auth users (or local-bridge IDs during demo) map 1:1 via `profiles.id`.
- Prefer importing by email; keep `profiles.id` as a secondary key if Evergreen also uses Supabase.

## Export bundle

Leaders can download **Export Evergreen handoff JSON** from **My people**.

Shape:

```json
{
  "version": 1,
  "exported_at": "ISO-8601",
  "product": "first-seeds-bridge",
  "profile": {
    "id": "uuid-or-local-id",
    "email": "...",
    "display_name": "...",
    "hub_mode": "starter|full|",
    "invite_code": "...",
    "sponsor_id": "uuid|null"
  },
  "runway_progress": {
    "active": "welcome|roots|...",
    "data": { "why": "...", "warm": "...", "calendar": {}, "tree": [] },
    "done": { "roots": true },
    "calendar": { "2026-10-01": { "status": "posted", "draft": "..." } },
    "cheers": [],
    "updated_at": "ISO-8601"
  },
  "sponsorships": [
    {
      "partner": { "id": "...", "email": "...", "display_name": "...", "hub_mode": "..." },
      "progress": { "active": "...", "data": {}, "done": {}, "calendar": {} }
    }
  ]
}
```

## Suggested Evergreen import map

| First Seeds | Evergreen |
|---|---|
| `profile.email` | user identity |
| `profile.sponsor_id` / sponsorships[] | mentor / sapling graph |
| `runway_progress.done` | onboarding checklist completion flags |
| `runway_progress.data` | story vault / warm list / tree (archive) |
| `runway_progress.calendar` | optional seed for Share habits (Posted counts only) |
| `hub_mode` | starter vs full preference |

## What NOT to duplicate

Do **not** port First Seeds chat (there is none). Do **not** rebuild the runway as Evergreen's core — archive it.

Evergreen owns: Plan, Share, Grove mentoring, long-term training library.

First Seeds owns (until handoff): founding runway, invite attachment, bridge calendar, leader triage nudges.

## SQL source of truth

Schema lives in [`supabase/schema.sql`](../supabase/schema.sql). After Evergreen cutover you can:

1. Snapshot `profiles`, `runway_progress`, `team_events`
2. Import into Evergreen tables
3. Soft-redirect First Seeds URL → Evergreen with a banner for 30–60 days

## Local bridge mode

If `js/supabase-config.js` has empty URL/key, the app uses **local bridge** (`localStorage` key `firstSeeds_bridge_v1`). Fine for demos; not multi-device. Turn on real Supabase before inviting the whole team.
