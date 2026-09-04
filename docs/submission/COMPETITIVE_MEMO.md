# Competitive memo — Catalog Greenlight (ClickHouse track)

**Audiencia:** jueces ClickHouse (Gil Raphaelli, Dustin Healy). **Hechos verificados en repo y URLs públicas (2026-09-02).**  
**Nosotros:** [catalog-greenlight.onrender.com](https://catalog-greenlight.onrender.com) · [github.com/armandobecerraro/catalog-greenlight](https://github.com/armandobecerraro/catalog-greenlight)

---

## 1. Quiénes somos

**Catalog Greenlight** es una web app para un **programming chief** de un catálogo streaming: decide qué tres títulos impulsar cada semana con evidencia medida, no con intuición del LLM.

| Capa | Implementación |
|------|----------------|
| Medición | **4 queries MCP fijas** en paralelo (inventario por género, momentum WoW, pares de canibalización, huecos de slate) vía **mcp-clickhouse** oficial en runtime |
| Ranking | **Scorer TypeScript determinista** — `opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty + 0.05×language_gap`; diversidad de género; sin Gemini en PLAN_SQL del greenlight |
| Narrativa | **Gemini** (`@google/genai`, `gemini-flash-latest`) solo en SYNTHESIZE — explica candidatos ya rankeados |
| Evidencia UI | Timeline de 6 pasos, SQL visible, paneles analytics, provenance por tarjeta, ritual semanal exportable CSV/JSON |

Pitch: *ClickHouse measures. TypeScript scores. Gemini explains.*

---

## 2. Vs Chloe Greenlight (screenplay → film)

**Ellos:** [github.com/rainingsnow0914tw-ship-it/greenlight](https://github.com/rainingsnow0914tw-ship-it/greenlight) · demo [greenlight-demo-309793842076.us-central1.run.app](https://greenlight-demo-309793842076.us-central1.run.app) (verificado) · [Devpost](https://devpost.com/software/greenlight-screenplay-to-film) (verificado). Nueve agentes Gemini, **Google ADK**, Cloud Run; convierte guion en rodaje con cost ladder y learning loop en ClickHouse.

| Dimensión | Chloe Greenlight | **Catalog** Greenlight |
|-----------|------------------|------------------------|
| Usuario | Guionista / cineasta indie | Jefe de programación de catálogo |
| Wow factor | Cinematográfico (casting, shots, subtítulos) | Operacional (ranking semanal auditable) |
| ClickHouse | Ledger de generación, pass rates, calibración | Analytics de catálogo + revenue; queries fijas |
| Decisión | “¿Puedo filmar esto?” | “¿Qué impulso esta semana?” |

**Colisión de nombre:** el rival se llama “Greenlight”; nosotros siempre **“Catalog Greenlight”** o **“Catalog”** en comparativas.

**Posicionamiento:** ellos ganan en demo cinematográfica; nosotros ganamos en **ranking determinista + workflow de programación** con fórmula publicada y fallback sin LLM.

---

## 3. Vs Flashframe (QC de flashes)

**Ellos:** [github.com/edycutjong/flashframe](https://github.com/edycutjong/flashframe) (verificado). Dominio: **photosensitivity** (Ofcom 2.12 / ITU-R BT.1702); ffmpeg → ClickHouse; SQL con `lagInFrame` y ventanas deslizantes; Gemini adjudica spans ya medidos.

**Dominio distinto.** No competir en “más ClickHouse técnico” ni en SQL analítico de fotometría. Competir en **decisión enterprise de programación**: qué título promover con datos de catálogo, no si un corte pasa QC de flashes.

---

## 4. Vs CineVector Vault (continuidad / vectores)

**Ellos:** [github.com/AtchayamG/cinevector-vault](https://github.com/AtchayamG/cinevector-vault) · [cinevector-vault.vercel.app](https://cinevector-vault.vercel.app/) (verificado) · [Devpost](https://devpost.com/software/cinevector-vault-clickhouse-continuity-intelligence) (verificado). Continuidad multimodal (tokens visuales, embeddings 768-dim, búsqueda vectorial); MCP read-only en Cloud Run; trailer pre-generado Veo 3.1 ([YouTube en Devpost](https://youtu.be/pbyWb7vMHT4)).

| Dimensión | CineVector | **Catalog** |
|-----------|------------|-------------|
| Problema | Drift de personaje/vestuario entre shots | Gap de género y momentum en catálogo |
| Video | Trailer 56 s como evidencia fija | Sin video de producto |
| Score | Similitud vectorial / fixtures locales | Fórmula TS con pesos explícitos |
| Degradación | Errores live explícitos (según Devpost) | Greenlight devuelve 3 picks del scorer si Gemini falla (429, timeout 10 s) |

**Posicionamiento:** ellos tienen trailer; nosotros tenemos **scorer + fallback honesto** documentado en UI y código.

---

## 5. Qué NO somos

- **Track Grafana** — sin telemetría Grafana MCP en producto
- **Track Parallel** — sin vector search Parallel en runtime
- **Track IBM** — sin watsonx en path de demo
- **Track Replit** — sin generación de código Replit
- **ADK / Agent Builder** — orquestación propia `AgentRunner`, no `@google/adk`
- **Producción audiovisual** — no generamos shots, casting ni QC de flashes

Solo track **ClickHouse** con **mcp-clickhouse** obligatorio en runtime.

---

## 6. Gaps honestos

| Gap | Estado |
|-----|--------|
| **Video ≤3 min** | **Hecho** — https://youtu.be/XBCRFGOywTI (público, EN, ~2:32). Devpost **Submitted**. |
| **Gemini 429** | `/ask` e `/ingest` fallan con cuota agotada; greenlight sigue con picks del scorer |
| **Render cold start** | Health puede tardar ~30 s; greenlight 1–3 min en frío (documentado en UI/i18n) |
| **Seed sintético** | ~200 títulos generados; títulos filler tipo “Fading Line N” filtrados del ritual |
| **Gemini 429** | `/ask` e `/ingest` fallan con cuota agotada; greenlight sigue con picks del scorer |
| **Render cold start** | Health puede tardar ~30 s; greenlight 1–3 min en frío (documentado en UI/i18n) |
| **Seed sintético** | ~200 títulos generados; títulos filler tipo “Fading Line N” filtrados del ritual |

---

## 7. Por qué un juez ClickHouse debería shortlistearnos

1. **MCP oficial en runtime** — `uv run mcp-clickhouse`; `run_query`, `list_databases`, `list_tables`; sin `@clickhouse/client` en packages de producto.
2. **Queries fijas auditables** — las 4 SELECT del greenlight son código, no NL→SQL improvisado; juez puede repetirlas.
3. **Score no-LLM** — ranking en TypeScript con pesos en `GreenlightScorer.ts`; Gemini no elige los tres títulos.
4. **Evidencia en UI** — SQL en `/ask`, timeline de 6 pasos, paneles analytics, provenance por tarjeta, export del ritual semanal.
5. **Hosted + tests** — [catalog-greenlight.onrender.com](https://catalog-greenlight.onrender.com); Playwright 6/6 en `docs/submission/playwright-output.txt`.

**Mensaje para jurado:** no somos el demo más cinematográfico del hackathon; somos el caso donde **ClickHouse es la fuente de verdad de una decisión de negocio repetible** — medir, rankear con reglas, explicar con LLM opcional.
