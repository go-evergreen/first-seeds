# Curiosity photos

Ready-to-use images for curiosity posts (Post ideas → Photos).

| File | Role |
|------|------|
| `full/*.webp` | Full post image (~768px, WebP ~q84) |
| `thumbs/*.webp` | Card previews (~420px wide) |
| `_source/` | Originals — local only, not shipped |

Add a new photo:
1. Drop the original into `_source/` as `{id}.jpg`
2. Export `full/{id}.webp` and `thumbs/{id}.webp` (same id)
3. Register it in `js/content.js` → `curiosityImages`
