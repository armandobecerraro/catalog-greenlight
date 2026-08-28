# User Guide — Catalog Greenlight

**Agentic Cinema Hackathon · ClickHouse track**

> Spanish version: [GUIA_DE_USO.md](./GUIA_DE_USO.md)

---

## What is it?

**Catalog Greenlight** helps a **programming chief** pick **three titles to push** each week. Recommendations come from **measured** ClickHouse analytics — genre gaps, week-over-week revenue momentum, and cannibalization — not from a single improvised SQL query.

Gemini writes the narrative; TypeScript scores the titles.

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
