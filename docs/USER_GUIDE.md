# User Guide — Catalog Greenlight

**Agentic Cinema Hackathon · ClickHouse track**

> Spanish version: [GUIA_DE_USO.md](./GUIA_DE_USO.md)

---

## What is it?

**Catalog Greenlight** helps a **programming chief** pick **three titles to push** each week. Recommendations come from **measured** ClickHouse analytics — genre gaps, week-over-week revenue momentum, and cannibalization — not from a single improvised SQL query.

Gemini writes the narrative; TypeScript scores the titles.

---

## Judges — 60-second hosted path

**URL:** https://catalog-greenlight.onrender.com

1. Wait until the health banner shows `ready: true` (~60–90s after cold start on Render free tier).
2. **`/`** — Weekly slate of 3 titles (TypeScript scorer + four MCP SELECTs).
3. **`/ask`** — Chip *“Which genre is under-represented in our catalog?”* → Documentary `gap_score ≈ 0.074`.
4. **`/judge`** — Pitch vs Chloe/Flashframe, Remove ClickHouse wedge, benchmark table.

Honest warm p50s: ~11s cached greenlight · ~37s refresh · ~33s ask ([`docs/submission/BENCHMARKS.md`](./submission/BENCHMARKS.md)). Keep-alive during judging: `npm run keepalive:smoke`.

The ~200-title catalog is **synthetic demo data** for the hackathon; real partner ingest is future work.

---

## What it's for

| Need | Feature |
|------|---------|
| Catalog health at a glance | Dashboard stats via MCP |
| Weekly slate of 3 titles | Deterministic greenlight + Gemini writer |
| Browse titles | Catalog table with filter |
| Add a title | Ingest → Gemini enrich → MCP INSERT |
| Ad-hoc questions | Ask the Catalog (NL → SQL → evidence) |

---

## Quick start

```bash
cp .env.example .env   # GEMINI_API_KEY + ClickHouse credentials
npm install
npm run dev
```

Open **http://localhost:5173** · In-app guide: **User guide** (`/about`) · EN/ES toggle in the header.

---

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — stats + weekly greenlight (async) |
| `/catalog` | All titles in ClickHouse |
| `/ingest` | Add a title through the agent pipeline |
| `/ask` | Natural-language questions with 6-step timeline |
| `/about` | Full user guide inside the app |

See [GUIA_DE_USO.md](./GUIA_DE_USO.md) for detailed step-by-step instructions in Spanish.
