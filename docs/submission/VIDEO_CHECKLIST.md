# Demo video checklist — Catalog Greenlight

**Target:** ≤ 3 minutes, **English** narration, recorded against the **hosted app** (not localhost).

| Item              | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| **Hosted URL**    | https://catalog-greenlight.onrender.com                    |
| **Devpost draft** | 1155720                                                    |
| **YouTube**       | https://youtu.be/Q_MOBA7Thc4 — live on Devpost |
| **Pitch line**    | “ClickHouse measures. TypeScript scores. Gemini explains.” |

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

## Shot list & timing (winning order — validated on live smoke)

Do **not** open with Ingest. Skip Ingest unless you have spare time.

| #   | Time      | Shot                     | Action on screen                                                                                                                                                                                                                   | Branch B                                                         |
| --- | --------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | 0:00–0:18 | Warm Render              | Browser already on hosted **/** (English). Health banner gone / `ready: true`. Say the programming-chief problem, then the pitch once.                                                                                             | If still waking: wait, do not record the spinner.                |
| 2   | 0:18–1:05 | `/` stats + Greenlight   | Optional **Show catalog snapshot** (size / genres / revenue), then the **three rec-cards**. Point at Score / WoW / Genre gap. Click **Show evidence**. Name **mcp-clickhouse** and the TypeScript scorer. **Say the pitch aloud.** | —                                                                |
| 3   | 1:05–1:50 | `/ask` under-represented | Chip _“Which genre is under-represented in our catalog?”_ → Run → live `gap_score` (genre can move) → **SQL** → **Evidence** → 6-step timeline. | If HTTP **429**: skip Ask, stay on Greenlight; splice Ask later. |
| 3b  | optional  | Comedy ask               | Chip about comedy titles — grounded Comedy rows + honest no-runtime note (no invented `duration`).                                                                                                                                 | Skip if over time.                                               |
| 4   | 1:50–2:25 | Architecture slide       | mcp-clickhouse + TypeScript scorer + `@google/genai`. **Not Agent Builder / ADK.** **Remove ClickHouse** line. Optional flash of `/judge`.                                                                                         | —                                                                |
| 5   | 2:25–2:50 | CTA                      | Hosted URL + GitHub on screen ≥ 5 seconds.                                                                                                                                                                                         | —                                                                |

**Total:** ≤ 3:00 (target ~2:50). Video is live: https://youtu.be/Q_MOBA7Thc4

---

## Teleprompter (read this version on camera)

Pause while the UI loads. If you go over 3:00, cut Ingest (already optional) and shorten the architecture slide — **never** cut the pitch or the three rec-cards.

> **[0:00–0:18]** “**Catalog Greenlight** is for a streaming programming chief. Every week you have to pick a catalog slate — three titles to push — and the answer has to come from measured data, not vibes. **ClickHouse measures. TypeScript scores. Gemini explains.**”

> **[0:18–1:05]** “This is the live app at **catalog-greenlight.onrender.com**. Catalog stats come from ClickHouse. Greenlight this week is three ranked titles. ClickHouse ran four analytics queries through **mcp-clickhouse**: genre inventory, week-over-week momentum, cannibalization, and slate holes. A **TypeScript scorer** — not Gemini — computed opportunity score. Gemini only writes the prose. If Gemini times out, the three picks and the numbers stay.”

> **[1:05–1:50]** “On Ask: which genre is under-represented in our catalog? Watch the six-step agent — intent, discover, plan SQL, execute, synthesize, audit. The SQL is a ClickHouse CTE. The answer cites **gap_score** — revenue share minus title share — from live rows. That is not a chatbot inventing a genre.”

> **[1:50–2:25]** “Remove ClickHouse and this product disappears: no gap scores, no week-over-week revenue, no scorer inputs. We use official **mcp-clickhouse** and the Gemini API via **@google/genai** on Google Cloud — **not** Agent Builder.”

> **[2:25–2:50]** “Try **catalog-greenlight.onrender.com**, or clone the GitHub repo. Catalog Greenlight — ClickHouse measures, TypeScript scores, Gemini explains.”

**SCRIPT_SECONDS_ESTIMATE:** ~155 s (~2:35) at a clear pace with pauses; hard cap 3:00.

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

| UI label      | Field               | Notes                                           |
| ------------- | ------------------- | ----------------------------------------------- |
| Score         | `opportunity_score` | 3 decimal places                                |
| WoW           | `wow_pct`           | Shown as %                                      |
| Genre gap     | `genre_gap`         | 3 decimal places                                |
| Cannibal pair | `in_cannibal_pair`  | yes / no                                        |
| Body          | `justification`     | Gemini narrative                                |
| Evidence      | `evidence`          | Tied to query data                              |
| Provenance    | score dimensions    | Genre gap / WoW / cannibal from MCP queries A–D |

**ClickHouse analytics** (below rec-cards): genre gap bars, WoW momentum top titles, cannibal pairs table.

Formula (mention if time): `opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty + 0.05×language_gap`

### Ask page (`/ask`)

1. Question chip: _“Which genre is under-represented in our catalog?”_
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

  Remove ClickHouse → no gap_score, no WoW revenue, no scorer inputs.

  https://catalog-greenlight.onrender.com
  https://github.com/armandobecerraro/catalog-greenlight
```

Show the slide while narrating the closing line. Keep hosted URL readable for ≥ 5 seconds.

---

## Post-recording

- [ ] Trim dead air; verify ≤ 3:00
- [ ] Upload to YouTube (public or unlisted per Devpost rules)
- [x] YouTube live: https://youtu.be/Q_MOBA7Thc4 (also in `docs/submission/DEVPOST.md`)
- [ ] Paste same URL into Devpost draft 1155720
- [ ] Spot-check: video uses **catalog-greenlight.onrender.com**, not localhost

---

## Related docs

- `README.md` § “3-minute demo video script” — summary table
- `DEVPOST.md` — submission copy and hosted URL
- `DEPLOY.md` — redeploy / seed if hosted app is cold or empty
