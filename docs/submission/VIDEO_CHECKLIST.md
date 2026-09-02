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

- [ ] **Pre-warm Render:** open https://catalog-greenlight.onrender.com and wait **60–90 seconds** for cold start before recording
- [ ] Health check: `GET https://catalog-greenlight.onrender.com/api/v1/health` → `ready: true`
- [ ] **Fresh greenlight:** open `https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1` once (bypasses 10-min cache)
- [ ] **Gemini billing:** `/ask` and `/ingest` require a funded `GEMINI_API_KEY` on Render (HTTP 429 if credits depleted or rate-limited). Greenlight still returns 3 scorer picks when synthesis fails (timeout, 429, or quota); the UI shows a warning banner but metrics and ritual table remain visible.
- [ ] Browser: **UI language English**, **1920×1080** (or 1280×720), zoom 100%, **hide bookmarks bar**
- [ ] Close unrelated tabs; mute notifications
- [ ] Prepare architecture slide (see § Architecture slide below)
- [ ] Mic test; speak clearly; total runtime ≤ 3:00

**Do not** record against `localhost:5173` for the submission video.

---

## Shot list & timing

| # | Time | Shot | Action on screen | Branch B |
|---|------|------|------------------|----------|
| 1 | 0:00–0:20 | Hook | Say **Catalog Greenlight** + programming-chief problem (weekly greenlight needs evidence, not vibes). | — |
| 2 | 0:20–0:45 | Dashboard — live stats | Navigate to **/** — three stat cards: catalog size, genres tracked, latest revenue ($, views, top title). Narrate ClickHouse via MCP. | — |
| 3 | 0:45–1:15 | Ingest → Catalog | `/ingest` — enter “Midnight Signal”, genre Sci-Fi → submit → Gemini enrichment success → `/catalog` — scroll to new row. | If Gemini down / ingest fails: say **exactly** “Ingest needs Gemini; skipping to Ask/Greenlight” → jump to shot 4 or 5. |
| 4 | 1:15–2:00 | Ask — 6-step agent | `/ask` — chip or type *“Which genre is under-represented in our catalog?”* → Run → **Answer** → **SQL** → **Evidence** → **Agent timeline** (INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT). | If HTTP **429**: do **not** fake Ask on camera — note **“If 429, record Ask after credits”** and continue to shot 5; re-record Ask segment later. |
| 5 | 2:00–2:30 | Greenlight — three cards + pitch | **/** — **Greenlight this week** → provenance header → weekly ritual table → **three rec-cards** (score, WoW, genre gap, cannibal). **Say pitch aloud.** | — |
| 6 | 2:30–3:00 | Architecture + CTA | Slide: `mcp-clickhouse` + `@google/genai` + GitHub + hosted URL. **Not Agent Builder.** | — |

**Total:** ≤ 3:00

---

## Narration script (word-for-word, English)

Read exactly as written. Pause on screen actions; trim only dead air in post if over 3:00.

> **[0:00–0:20]** “**Catalog Greenlight** is built for a streaming programming chief who faces the same question every week: what should we greenlight next? The answer has to come from ClickHouse evidence — not vibes, not generic AI summaries.”
>
> **[0:20–0:45]** “Here's the live app at **catalog-greenlight.onrender.com**. The dashboard loads three stat cards — total catalog size, genre breakdown, and latest weekly revenue with views and top title. Every number comes from ClickHouse through the **mcp-clickhouse** MCP server at runtime.”
>
> **[0:45–1:15]** “On Ingest I add a fictional title — **Midnight Signal**, Sci-Fi — and submit. Gemini enriches the metadata, the API runs an MCP INSERT into ClickHouse, and on Catalog we scroll to confirm the new row is persisted.”
>
> **Branch B (Gemini down / ingest fails):** say exactly — “**Ingest needs Gemini; skipping to Ask/Greenlight**” — then cut to `/ask` or `/` Greenlight.
>
> **[1:15–2:00]** “On Ask I use the chip: which genre is under-represented in our catalog? Watch the six-step agent timeline — intent, discover, plan SQL, execute, synthesize, and audit. Here's the SQL block, the evidence rows, and the answer — every claim tied to numbers from the query.”
>
> **Branch B (HTTP 429 on Ask):** do not narrate a failed Ask. Note for editor: **“If 429, record Ask after credits”** — finish Greenlight + architecture on this take; splice Ask later.
>
> **[2:00–2:30]** “Back on the dashboard, **Greenlight this week** shows three ranked rec-cards. Each card exposes score provenance — opportunity score, week-over-week momentum, genre gap, and cannibal pair — plus a Gemini justification grounded in query evidence. **ClickHouse measures. TypeScript scores. Gemini explains.**”
>
> **[2:30–3:00]** “Under the hood: **mcp-clickhouse** for analytics, the Gemini API via **@google/genai** on Google Cloud — **not Agent Builder** — and a custom six-step AgentRunner in TypeScript. Try **catalog-greenlight.onrender.com**, or clone the repo on GitHub.”

**SCRIPT_SECONDS_ESTIMATE:** ~165 s (~2:45) at clear pace with on-screen pauses; hard cap 3:00.

---

## What to highlight (judge-visible)

### Dashboard stat cards (`/`)

- Total catalog entries + recent additions
- Genre breakdown (from ClickHouse)
- Latest revenue week: USD total, views, top title

### Greenlight panel (`/` — Greenlight this week)

**Provenance header** — stack badge (`mcp-clickhouse` + `@google/genai`) + scorer formula bar.

**Weekly programming ritual table** — 3 ranked rows with metrics, justification, evidence; CSV/JSON export buttons.

**Rec-cards** — per card:

| UI label | Field | Notes |
|----------|-------|-------|
| Score | `opportunity_score` | 3 decimal places |
| WoW | `wow_pct` | Shown as % |
| Genre gap | `genre_gap` | 3 decimal places |
| Cannibal pair | `in_cannibal_pair` | yes / no |
| Body | `justification` | Gemini narrative |
| Evidence | `evidence` | Tied to query data |
| Provenance | score dimensions | Genre gap / WoW / cannibal from MCP queries A–D |

**ClickHouse analytics** (below rec-cards): genre gap bars, WoW momentum top titles, cannibal pairs table.

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

Suggested content (Keynote / Google Slides / Figma — one slide):

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
