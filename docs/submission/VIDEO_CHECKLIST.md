# Demo video checklist — Catalog Greenlight

**Target:** ≤ 3 minutes, **English** narration, recorded against the **hosted app** (not localhost).

| Item | Value |
|------|-------|
| **Hosted URL** | https://catalog-greenlight.onrender.com |
| **Devpost draft** | 1155720 |
| **YouTube** | `TODO_YOUTUBE` — paste link into `DEVPOST.md` after upload |
| **Pitch line** | “ClickHouse measures. TypeScript scores. Gemini explains.” |

---

## Pre-recording

- [ ] Confirm hosted app loads: https://catalog-greenlight.onrender.com
- [ ] Health check: `GET https://catalog-greenlight.onrender.com/api/v1/health` → `ready: true`
- [ ] **Gemini billing:** `/ask` and `/ingest` need a funded `GEMINI_API_KEY` on Render (429 if credits depleted). Greenlight still returns 3 scorer picks if synthesis times out.
- [ ] Browser: English UI, 1920×1080 or 1280×720, zoom 100%, hide bookmarks bar
- [ ] Close unrelated tabs; mute notifications
- [ ] Optional: force fresh greenlight before recording — open `https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1` once (bypasses 10-min cache)
- [ ] Prepare architecture slide (see § Architecture slide below)
- [ ] Mic test; speak clearly; total runtime ≤ 3:00

**Do not** record against `localhost:5173` for the submission video.

---

## Shot list & timing

| # | Time | Shot | Action on screen |
|---|------|------|------------------|
| 1 | 0:00–0:20 | Hook / title card | Title **Catalog Greenlight** + one-line problem (programming chief, weekly greenlight, needs evidence not vibes). |
| 2 | 0:20–0:45 | Dashboard — live stats | Navigate to **/** — three stat cards: catalog size, genres tracked (top genres list), latest revenue ($, views, top title). Narrate: data comes from ClickHouse via MCP at runtime. |
| 3 | 0:45–1:15 | Ingest → Catalog | `/ingest` — enter a short fictional title (e.g. “Midnight Signal”, genre Sci-Fi) → submit → show Gemini enrichment success → `/catalog` — scroll to confirm the new row. |
| 4 | 1:15–2:00 | Ask — 6-step agent | `/ask` — use chip or type: *“Which genre is under-represented in our catalog?”* → Run → scroll: **Answer** (numbers in text) → **SQL** block → **Evidence** (query rows JSON) → **Agent timeline** — expand/walk INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT. |
| 5 | 2:00–2:30 | Greenlight rec-cards | Back to **/** — **Greenlight this week** panel. On each of three rec-cards, point to metrics: **Score** (`opportunity_score`), **WoW** (`wow_pct`), **Genre gap** (`genre_gap`), **Cannibal pair** (yes/no). Scroll to **analytics panels** below (genre gap bars, WoW momentum top 5, cannibal pairs table). **Say the pitch aloud.** Optionally scroll to greenlight agent timeline below cards. |
| 6 | 2:30–3:00 | Architecture + CTA | Cut to slide (or split screen): stack diagram + URLs. End on hosted URL + GitHub. |

**Total:** ≤ 3:00

---

## Narration script (English)

Read naturally; shorten pauses if over 3 minutes.

> **[0:00]** “Catalog Greenlight helps a streaming programming chief decide what to push each week — with ClickHouse evidence, not generic AI guesses.”
>
> **[0:20]** “Here’s the live app at catalog-greenlight on Render. The dashboard loads real catalog stats from ClickHouse through the official mcp-clickhouse MCP server — genre counts and latest weekly revenue.”
>
> **[0:45]** “We can ingest a new title. Gemini enriches the metadata, and the row lands in ClickHouse via MCP INSERT. The catalog table confirms it’s persisted.”
>
> **[1:15]** “On Ask, I pose a natural-language question. Watch the six-step agent: intent, schema discovery, SQL planning, execution, synthesis, and audit. Here’s the generated SQL, the result rows, and a grounded answer that cites the numbers.”
>
> **[2:00]** “Greenlight this week ranks three titles with a transparent TypeScript scorer. Each card shows opportunity score, week-over-week momentum, genre gap, and cannibalization — plus a Gemini narrative tied to query evidence.”
>
> **[2:15]** **“ClickHouse measures. TypeScript scores. Gemini explains.”**
>
> **[2:30]** “Under the hood: mcp-clickhouse for analytics, the Gemini API via google/genai on Google Cloud — not Agent Builder — and a custom six-step AgentRunner. Try it at the link on screen, or clone the repo on GitHub.”

---

## What to highlight (judge-visible)

### Dashboard stat cards (`/`)

- Total catalog entries + recent additions
- Genre breakdown (from ClickHouse)
- Latest revenue week: USD total, views, top title

### Greenlight rec-cards (`/` — Greenlight this week)

Per card, ensure these are visible:

| UI label | Field | Notes |
|----------|-------|-------|
| Score | `opportunity_score` | 3 decimal places |
| WoW | `wow_pct` | Shown as % |
| Genre gap | `genre_gap` | 3 decimal places |
| Cannibal pair | `in_cannibal_pair` | yes / no |
| Body | `justification` | Gemini narrative |
| Evidence | `evidence` | Tied to query data |

Formula (mention if time): `opportunity = 0.4×genre_gap + 0.4×wow − 0.2×cannibalization`

### Ask page (`/ask`)

1. Question chip: *“Which genre is under-represented in our catalog?”*
2. Answer paragraph with numeric claims
3. **SQL** `<pre>` block
4. **Evidence (N rows)** JSON preview
5. **Agent timeline** — all six steps with status/latency

### Ingest (`/ingest` → `/catalog`)

- Form submit → success state
- New row visible in catalog table

---

## Architecture slide (final 30s)

Suggested content (Keynote / Google Slides / figma — one slide):

```
Catalog Greenlight — architecture

  React UI (hosted on Render)
       ↓ REST
  Express API + AgentRunner (6 steps)
       ↓                    ↓
  mcp-clickhouse          @google/genai
  (ClickHouse Cloud)      Gemini API on Google Cloud
                          (NOT Agent Builder / ADK)

  Greenlight: 4 parallel MCP SELECTs → TypeScript scorer → Gemini narrative only
  Catalog Q&A: Gemini intent + NL→SQL + synthesis

  https://catalog-greenlight.onrender.com
  https://github.com/armandobecerraro/catalog-greenlight
```

Show the slide while narrating the closing line. Keep hosted URL readable for ≥ 5 seconds.

---

## Post-recording

- [ ] Trim dead air; verify ≤ 3:00
- [ ] Upload to YouTube (public or unlisted per Devpost rules)
- [ ] Replace `TODO_YOUTUBE` in `docs/submission/DEVPOST.md`
- [ ] Paste same URL into Devpost draft 1155720
- [ ] Spot-check: video uses **catalog-greenlight.onrender.com**, not localhost

---

## Related docs

- `README.md` § “3-minute demo video script” — summary table
- `DEVPOST.md` — submission copy and hosted URL
- `DEPLOY.md` — redeploy / seed if hosted app is cold or empty
