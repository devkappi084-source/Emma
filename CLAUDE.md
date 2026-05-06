# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A static single-page website for a baptism event (Taufe), deployable to **Cloudflare Pages**. It has no build step — all files are served as-is. The backend consists of two **Cloudflare Pages Functions** that use **Cloudflare KV** for persistence.

## Local development

Serve the root directory with any static file server:

```bash
python3 -m http.server 8765
# → http://localhost:8765
```

The Cloudflare Pages Functions (`/api/rsvp`, `/api/votes`) will return 404 locally unless you use Wrangler:

```bash
wrangler pages dev . --kv BAPTISM_KV
```

## Architecture

### Configuration (`js/config.js`)
Single source of truth for all event data. Assigned to `window.CONFIG` (not `const`) so it is accessible as a global from all subsequent scripts. Every piece of user-facing content — names, dates, locations, poll questions, photo list — lives here. This is the only file that needs to be edited for a new event.

### Script loading order (index.html)
```
js/config.js   → defines window.CONFIG
js/main.js     → reads CONFIG; handles navbar, countdown, RSVP form, polls
js/gallery.js  → reads CONFIG.gallery; handles grid rendering and lightbox
```
All three scripts run on `DOMContentLoaded`. `main.js` calls `initPolls()` which dynamically creates `.poll-card` elements *after* `initFadeIn()` has already run, so poll cards add the `fade-in` class manually in `buildPollCard()` — the IntersectionObserver from `initFadeIn()` does not observe them.

### Cloudflare Pages Functions (`functions/api/`)
Both functions use the KV binding named `BAPTISM_KV` (must be created in the Cloudflare dashboard and bound to the Pages project).

| File | Route | Notes |
|---|---|---|
| `rsvp.js` | `POST /api/rsvp` | Saves entry under key `rsvp:<timestamp>:<random>` |
| `rsvp.js` | `GET /api/rsvp?key=ADMIN_KEY` | Returns all RSVPs; requires `ADMIN_KEY` env var |
| `votes.js` | `POST /api/votes` | Increments count under key `poll:<pollId>:results` |
| `votes.js` | `GET /api/votes?pollId=X` | Returns `{ counts, total }` |

Vote deduplication is client-side only via `localStorage` (`voted_<pollId>`).

### Gallery activation
The gallery section shows a placeholder until `CONFIG.gallery.active` is `true` **and** `CONFIG.gallery.photos` is non-empty. To publish photos after the event:
1. Upload images to `images/gallery/`
2. Add entries to `CONFIG.gallery.photos`
3. Set `CONFIG.gallery.active = true`

### Strings / encoding
Strings containing German quotation marks (`„…"`) must use single-quote JS string delimiters or escape the inner `"` — mixing double-quote delimiters with `"` (U+201C) causes a syntax error that silently prevents `window.CONFIG` from being defined and breaks all dynamic rendering.
