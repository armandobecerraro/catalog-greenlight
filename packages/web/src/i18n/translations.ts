export type Locale = "en" | "es";

export const translations = {
  en: {
    brand: {
      tagline: "The agent that tells programming what to push — with ClickHouse evidence.",
    },
    nav: {
      dashboard: "Dashboard",
      catalog: "Catalog",
      ingest: "Ingest",
      ask: "Ask the Catalog",
      judge: "For judges",
      about: "User guide",
    },
    footer: "Agentic Cinema · ClickHouse track · Gemini + mcp-clickhouse",
    footerGuide: "User guide",
    footerJudge: "For judges",
    lang: {
      switchTo: "Español",
      label: "Language",
    },
    common: {
      loading: "Loading…",
      evidence: "Evidence",
      views: "views",
      top: "Top",
      yes: "yes",
      no: "no",
    },
    errors: {
      geminiBilling:
        "Gemini API credits are exhausted or rate-limited (429). Add billing in Google AI Studio or wait a few minutes, then try again.",
      clickhouseWaking:
        "ClickHouse or the API is still starting (503). Wait ~30 seconds until health shows ready: true, then refresh.",
      timeout:
        "The request timed out after {seconds}s. Agent calls (Gemini + ClickHouse) can take 1–2 minutes — please wait and retry.",
      network: "Could not reach the API. Check that the server is running.",
      generic: "Something went wrong. Try again in a moment.",
    },
    health: {
      wakingTitle: "Waking the demo on Render…",
      wakingBody:
        "Free tier spins down after inactivity. First load can take 60–90 seconds while ClickHouse MCP and the API start.",
      retry: "Check again",
      starting: "starting",
    },
    notFound: {
      title: "Page not found",
      subtitle: "That URL is not part of the Catalog Greenlight demo.",
      heading: "Unknown route",
      body: "Try the dashboard, catalog, or user guide. Greenlight picks live on the dashboard.",
      dashboard: "Dashboard",
      apiHint:
        "API routes like /api/v1/catalog/stats are not browser pages — use Dashboard or Catalog stats.",
    },
    judge: {
      title: "For judges",
      subtitle: "ClickHouse track · Catalog Greenlight in under 60 seconds",
      pitch: "ClickHouse measures. TypeScript scores. Gemini explains.",
      icp: "Built for a streaming programming chief who must pick a weekly catalog slate — not for filmmaker continuity or screenplay-to-production workflows.",
      coldStart:
        "Render free tier sleeps when idle. First load can take 60–90 seconds while mcp-clickhouse and the API wake. Wait until health shows ready: true.",
      archTitle: "Architecture (runtime)",
      archMcp:
        "four fixed SELECTs at runtime: genre inventory, WoW momentum, cannibalization pairs, slate holes.",
      archScorer:
        "deterministic opportunity formula + genre diversity. Gemini does not plan greenlight SQL.",
      archGemini: "narrative on greenlight; intent + NL→SQL on /ask. Not Agent Builder / ADK.",
      scorerNote:
        "Gemini does not plan greenlight SQL. The weekly ranking is TypeScript (GreenlightScorer). Synthesis can fail, time out, or hit 429 — the three scored picks still return.",
      linksTitle: "Live demo links",
      linkDashboard: "Dashboard",
      linkGreenlight: "Greenlight section",
      linkAsk: "Ask the catalog",
      linkHealth: "Health JSON",
      linkGreenlightApi: "Greenlight API (?refresh=1)",
      verifyTitle: "How to verify in 2 minutes",
      verifyWarm: "Warm Render:",
      verifyGreenlight: "Confirm three scored picks:",
      verifyAsk:
        "Open /ask and run the chip “Which genre is under-represented in our catalog?” — the answer should cite a ClickHouse gap_score (Documentary in the demo seed).",
      wedgeTitle: "Competitive wedge (ClickHouse track)",
      vsChloe:
        "We greenlight a catalog slate for a streaming programming chief — not screenplay→film production (Chloe Greenlight).",
      vsFlashframe:
        "We use ClickHouse for catalog economics and programming risk (genre gaps, WoW momentum, cannibalization) — not photosensitivity QC (Flashframe).",
      slatePreviewTitle: "Live weekly slate (measured scores)",
      downloadJson: "Download jury evidence JSON",
      downloaded: "Downloaded",
      removeTitle: "Remove ClickHouse and this weekly greenlight cannot measure",
      removeBody:
        "Remove ClickHouse / mcp-clickhouse and the weekly greenlight cannot measure genre gaps, WoW momentum, cannibalization pairs, or slate holes at runtime — those four MCP SELECTs plus audit inserts disappear; a TypeScript scorer with no measured inputs is useless. Gemini only synthesizes narrative (and NL→SQL on /ask).",
      qInventory: "genre gaps (title share vs revenue share)",
      qMomentum: "week-over-week title revenue momentum",
      qCannibal: "near-duplicate title pairs that cannibalize the same audience",
      qHoles: "slate holes (genre and language gap_score)",
      codePointers: "Code paths",
      exportTitle: "Export jury evidence JSON",
      exportBody:
        "Copies the latest greenlight response (intent, model, fallback, three picks, SQL) for the judging packet.",
      copyJson: "Copy jury evidence JSON",
      copied: "Copied",
      copyFailed: "Clipboard unavailable — use the Greenlight API JSON instead.",
      waitingGreenlight: "Waiting for a greenlight response (wake the API if this stays empty).",
    },
    empty: {
      catalog: {
        title: "No titles in the catalog yet",
        body: "Seed the demo database or ingest your first title to populate ClickHouse.",
        cta: "Ingest a title →",
      },
      recommendations: {
        title: "No greenlight picks yet",
        body: "The analyst finished but returned no recommendation cards. Check the agent timeline below for MCP or scoring details, or retry in a minute.",
      },
    },
    dashboard: {
      title: "Programming Dashboard",
      subtitle:
        "Live catalog stats from ClickHouse via MCP · Weekly greenlight picks from measured gaps and momentum",
      subtitleHero:
        "Weekly greenlight decision first — ClickHouse evidence, TypeScript scoring, Gemini narrative.",
      trustPitch: "ClickHouse measures. TypeScript scores. Gemini explains.",
      showSnapshot: "Show catalog snapshot & signals",
      hideSnapshot: "Hide catalog snapshot",
      showEvidence: "Show evidence (SQL, analytics, timeline)",
      hideEvidence: "Hide evidence",
      liveStrip:
        "Live ClickHouse Cloud via official mcp-clickhouse — ClickHouse measures, TypeScript scores, Gemini explains.",
      liveClickhouse: "ClickHouse {status}",
      liveMcp: "MCP {server}",
      mcpSqlTitle: "MCP SQL evidence",
      mcpSqlSub:
        "The four run_query statements from the greenlight DISCOVER step — copy-paste proof for judges.",
      mcpSqlMeta: "{rows} rows · {ms} ms",
      mcpSqlError: "query error",
      catalogSize: "Catalog size",
      addedLast30: "{count} added in the last 30 days",
      genresTracked: "Genres tracked",
      latestRevenue: "Latest revenue (7d)",
      noRevenue: "No revenue data",
      greenlightTitle: "Greenlight this week",
      greenlightLoading: "Running deterministic analyst (4 MCP queries + Gemini writer)…",
      greenlightProgressMeasuring: "Measuring catalog in ClickHouse…",
      greenlightProgressScoring: "Scoring candidates…",
      greenlightProgressNarrative: "Writing narrative…",
      greenlightProgressHint:
        "Usually takes 1–3 minutes on cold start. Catalog stats above are already live.",
      greenlightError429Title: "Gemini rate limited",
      greenlightError429:
        "Gemini returned HTTP 429 (rate limit or quota). Check your API key, quota, and billing in Google AI Studio, then reload the page.",
      greenlightFallbackNotice:
        "ClickHouse measured these picks and TypeScript scored them. Gemini prose is optional — the numbers are still live.",
      greenlightPartialNarrative: "Narrative pending…",
      agentRun: "Agent run {ms}ms",
      followUp: "Ask follow-up questions →",
      statsError: "Failed to load stats",
      greenlightError: "Greenlight agent failed",
      metricScore: "Opportunity score",
      metricWow: "WoW",
      metricGenreGap: "Genre gap",
      metricCannibal: "Cannibal pair",
      metricYes: "yes",
      metricNo: "no",
      analyticsTitle: "ClickHouse analytics",
      analyticsSub: "From the 4 MCP queries in the greenlight DISCOVER step",
      analyticsGenreTitle: "Genre gap & inventory",
      analyticsGenreHint: "Revenue share minus title share — higher means underserved",
      analyticsGenreMeta: "{count} titles · {titles} catalog vs {revenue} revenue",
      analyticsGenreTooltip: "Title share {titles} · revenue share {revenue}",
      analyticsMomentumTitle: "WoW momentum",
      analyticsMomentumHint: "Top titles by week-over-week revenue change",
      analyticsMomentumEmpty: "No titles with a meaningful week-over-week move in this run.",
      analyticsCannibalTitle: "Cannibalization pairs",
      analyticsCannibalHint: "Same-genre titles both in top revenue quartile",
      analyticsCannibalClear: "No cannibal pairs detected this week.",
      analyticsCannibalWarn:
        "These pairs compete in the same genre slot — greenlight applies a penalty.",
      analyticsColTitleA: "Title A",
      analyticsColTitleB: "Title B",
      analyticsColGenre: "Genre",
      analyticsColRevenue: "Revenue (7d)",
      analyticsNoData: "No rows for this query.",
      ritualTitle: "Weekly programming ritual",
      ritualSubtitle: "Evidence → 3 picks → contrafactual → export slate",
      colRank: "#",
      colTitle: "Title",
      colGenre: "Genre",
      colEvidence: "Evidence",
      exportCsv: "Export CSV",
      exportJson: "Export JSON",
      contrafactual:
        "If we pushed the {titleA} / {titleB} pair ({genre}), both titles would cannibalize top-quartile revenue in the same genre — the scorer excluded them from this week's slate.",
      contrafactualMore: "And {count} more near-duplicate pairs — see ClickHouse analytics below.",
      signals: {
        title: "This week's signals",
        impact:
          "Replaces manual analyst SQL — four fixed MCP queries score every title before Gemini writes the narrative.",
        guideLink: "How the demo story works",
        measuring: "Updating from ClickHouse…",
        loading: {
          comedy:
            "Comedy oversupply — measured from genre inventory (query A: title count vs 4-week revenue share)",
          thriller: "Thriller slate hole — scored from slate-holes analytics (query D)",
          cannibal: "Cannibalization pairs — near-duplicate titles penalized in scoring (query C)",
          breakout:
            "LATAM breakout momentum — week-over-week revenue surge from title momentum (query B)",
        },
        loaded: {
          comedy:
            "Comedy oversupplied: {count} titles ({titlePct}% of catalog) vs {revPct}% of 4-week revenue",
          comedyStatsOnly: "Comedy leads catalog volume: {count} titles ({titlePct}% of catalog)",
          thrillerGap: "Thriller slate hole: {gap} gap score (query D — underserved genre)",
          thrillerInventory:
            "Thriller gap: {thrillerCount} titles vs Comedy at {comedyCount} — thin thriller slice",
          cannibal: "Cannibal pair flagged: {titleA} ↔ {titleB} (query C penalty applied)",
          cannibalSingle: "Cannibal pair flagged: {title} (scorer penalty applied)",
          breakout: "{title} — {wow} WoW · {genre} (LATAM momentum, query B)",
          breakoutPick: "Top pick {title} — {wow} WoW · opportunity {score}",
        },
      },
    },
    greenlight: {
      stackBadge: "Measured by ClickHouse · Scored in TypeScript · Narrated by Gemini",
      formulaTitle: "Scoring formula",
      fallbackBadge: "Measured scores — Gemini memo optional",
      provenanceTitle: "Score provenance (MCP query dimensions)",
      fromQuery: "← {query}",
      stripAria: "Measured score fields from ClickHouse via mcp-clickhouse",
      stripMcpTitle: "Four fixed MCP SELECTs at greenlight runtime",
      clickhouseAttribution:
        "These numbers come from ClickHouse via mcp-clickhouse — Gemini did not invent the ranking.",
      fillerBadge: "catalog depth fill",
      fillerHint:
        "Genre-diversity backfill from catalog depth — scored in ClickHouse, not a story title.",
    },
    catalog: {
      title: "Catalog",
      subtitle: "{count} titles in ClickHouse",
      subtitleFiltered: "{shown} of {total} titles in ClickHouse (seed hidden)",
      filterPlaceholder: "Filter by title or genre…",
      hidePadding: "Hide seed filler (numbered demo titles)",
      loadError: "Failed to load catalog",
      colTitle: "Title",
      colGenre: "Genre",
      colRelease: "Release",
      colCast: "Cast",
    },
    catalogStats: {
      title: "Catalog stats",
      subtitle: "Live aggregates from ClickHouse via MCP",
      backToCatalog: "← Catalog table",
      backToDashboard: "Dashboard",
    },
    ingest: {
      title: "Ingest a title",
      subtitle: "Gemini enriches summary, tags, and positioning, then persists via mcp-clickhouse",
      labelTitle: "Title",
      titlePlaceholder: "e.g. Night Shift Bogotá",
      labelDescription: "Description",
      labelGenre: "Genre",
      labelRelease: "Release date",
      labelCast: "Cast (comma-separated)",
      castPlaceholder: "Actor One, Actor Two",
      submitting: "Enriching & storing…",
      submit: "Ingest via agent pipeline",
      error: "Ingest failed",
      success: "Stored {id} in {ms}ms via MCP INSERT",
      viewCatalog: "View in catalog →",
    },
    ask: {
      title: "Ask the catalog",
      subtitle:
        "Natural language → 6-step agent. Demo chips still query ClickHouse if Gemini is unavailable.",
      fallbackNotice:
        "Gemini planner/writer was unavailable. ClickHouse still ran via mcp-clickhouse — SQL and rows below are live.",
      fallbackBadge: "Narrative fallback — ClickHouse evidence still live",
      ungroundedRecs:
        "Recommendations from the agent were not grounded in catalog genres — see SQL and evidence rows above.",
      filteredRecs: "{count} ungrounded recommendation(s) hidden from display.",
      billingHint: "Greenlight on the dashboard still measures ClickHouse without Gemini.",
      billingHintCta: "Open dashboard →",
      labelQuestion: "Your question",
      running: "Agent running…",
      progressHint: "Typical run is ~30–60 seconds (Gemini + ClickHouse). The demo is not frozen.",
      progressElapsed: "{seconds}s elapsed — agent is querying ClickHouse via mcp-clickhouse",
      submit: "Run agent",
      error: "Agent failed",
      answer: "Answer",
      intent: "Intent",
      sqlTitle: "SQL executed (MCP run_query)",
      evidenceTitle: "Evidence ({count} rows)",
      timelineTitle: "Agent timeline",
      suggestions: [
        "Which genre is under-represented in our catalog?",
        "Recommend 3 titles for a late-night sci-fi slot",
        "What titles had the highest revenue last week?",
      ],
    },
    steps: {
      INTENT: "Classify intent",
      DISCOVER: "Discover schema / analytics",
      PLAN_SQL: "Plan SQL",
      EXECUTE: "Execute query",
      SYNTHESIZE: "Synthesize answer",
      AUDIT: "Audit run",
      showDetails: "Show details",
      hideDetails: "Hide details",
      noOutput: "No output",
      intentLabel: "Intent",
      sourceLabel: "Source",
      schemaLabel: "Live schema",
      sqlLabel: "SQL",
      rowsLabel: "Rows",
      rowCount: "{count} rows",
      latency: "{ms} ms",
      formulaLabel: "Scoring formula",
      candidateCountLabel: "Candidates scored",
      momentumRowsLabel: "Momentum rows",
      topCandidatesLabel: "Top candidates",
      attemptLabel: "Attempt {n}",
      retryLabel: "retry",
      fallbackLabel: "Used deterministic fallback",
      recommendationsLabel: "Recommendations",
      auditIdLabel: "Audit ID",
      queryLabel: "Query",
      rawOutputLabel: "Raw output",
      moreRows: "+{count} more rows",
      cellYes: "yes",
      cellNo: "no",
      status: {
        pending: "Pending",
        running: "Running",
        completed: "Completed",
        error: "Error",
        failed: "Failed",
      },
    },
    about: {
      badge: "User documentation",
      title: "User Guide — Catalog Greenlight",
      subtitle: "What this application does and how to use it",
      judgeTitle: "60-second path for judges",
      judgeSteps: [
        "Dashboard: live catalog size, revenue, and three greenlight picks with opportunity / WoW / genre gap.",
        "Expand MCP SQL evidence under analytics — four official mcp-clickhouse run_query statements.",
        "Ask the catalog with a chip. If Gemini is rate-limited, SQL + rows still come from ClickHouse.",
        "Catalog hides seed padding by default. Ingest needs Gemini credits (enrichment).",
      ],
      whatTitle: "What is Catalog Greenlight?",
      whatBody:
        "Catalog Greenlight is an agentic programming assistant for streaming catalogs. Each week it recommends three titles to push — not because an LLM guessed, but because the system measured genre gaps, week-over-week revenue momentum, and cannibalization risk in ClickHouse.",
      audience:
        "Built for programming chiefs, catalog analysts, and hackathon judges who need SQL evidence behind every pick.",
      purposeTitle: "What is it for?",
      purposeColNeed: "Need",
      purposeColHow: "How the app helps",
      purposes: [
        { need: "See catalog health", how: "Dashboard with live stats via MCP" },
        { need: "Pick 3 titles for the week", how: "Deterministic greenlight + Gemini narrative" },
        { need: "Browse existing titles", how: "Catalog with search filter" },
        { need: "Add a new title", how: "Ingest with Gemini enrichment + MCP INSERT" },
        { need: "Ask ad-hoc questions", how: "Ask the Catalog (NL → SQL → evidence)" },
      ],
      quickStartTitle: "Quick start",
      quickStartSteps: [
        "Open Dashboard for live stats and weekly greenlight recommendations.",
        "Use Catalog, Ingest, and Ask from the navigation bar.",
        "Expand the agent timeline to see MCP SQL and row evidence.",
        "Switch language with EN / ES in the header.",
      ],
      guideTitle: "Screens at a glance",
      screens: [
        {
          path: "/",
          title: "Dashboard",
          body: "Live catalog stats (size, genres, latest revenue) load first. The greenlight panel runs asynchronously and shows three grounded recommendations with the full 6-step agent timeline.",
          cta: "Open dashboard",
        },
        {
          path: "/catalog",
          title: "Catalog",
          body: "Browse every title stored in ClickHouse. Filter by title or genre. Use this to verify that greenlight picks exist in the catalog.",
          cta: "Browse catalog",
        },
        {
          path: "/ingest",
          title: "Ingest",
          body: "Add a new title: Gemini enriches metadata, then the agent persists the row via mcp-clickhouse INSERT.",
          cta: "Ingest a title",
        },
        {
          path: "/ask",
          title: "Ask the Catalog",
          body: "Ask questions in natural language. The agent classifies intent, discovers live schema, generates SQL, executes via MCP, synthesizes an answer, and audits the run.",
          cta: "Ask a question",
        },
      ],
      demoStoryLead:
        "The seeded demo catalog tells one story: Comedy is oversupplied, Thriller is thin, True Crime: Highway 101 forms a cannibal pair, and Crimen sin Fronteras: Bogotá is the LATAM breakout — all surfaced from measured ClickHouse analytics on the dashboard.",
      greenlightTitle: "How weekly greenlight works",
      greenlightIntro:
        "Greenlight is a deterministic analyst. Gemini writes the narrative; TypeScript chooses the titles.",
      greenlightSteps: [
        "Four fixed SELECT queries run in parallel: genre inventory, title momentum, cannibalization pairs, and slate holes.",
        "Each title is scored in TypeScript with an explicit formula (genre gap + WoW momentum − cannibalization penalty).",
        "The top three candidates are picked with genre diversity — at most one title per genre.",
        "Gemini receives only those candidate rows and must cite their numbers. Hallucinated titles are filtered out.",
      ],
      formulaTitle: "Scoring formula",
      formula:
        "opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty (+ small language-gap bonus)",
      stackTitle: "Technology",
      stackItems: [
        "Runtime AI: @google/genai (Gemini) — intent, NL→SQL, and synthesis only",
        "Data: ClickHouse via official mcp-clickhouse (McpClickHouseConnector)",
        "Orchestration: custom AgentRunner with a visible 6-step timeline",
        "No LangChain, OpenAI, Anthropic, or Agent Builder",
      ],
      tipsTitle: "Tips",
      tips: [
        "Switch language with the EN / ES toggle in the header.",
        "On the dashboard, stats appear before greenlight finishes — wait for recommendation cards or the timeline.",
        "On Ask, expand the timeline to see MCP SQL and row evidence for every step.",
        "After seeding the demo database, look for the LATAM breakout and cannibalization pair in the greenlight output.",
      ],
      troubleshootTitle: "Troubleshooting",
      troubleshootColSymptom: "Symptom",
      troubleshootColFix: "What to do",
      troubleshoot: [
        {
          symptom: "Empty dashboard / 503 error",
          fix: "Wait until API health shows ready: true, then refresh.",
        },
        {
          symptom: "Ask or Ingest returns 429 / credits exhausted",
          fix: "Fund GEMINI_API_KEY in Google AI Studio. Greenlight still scores from ClickHouse without Gemini.",
        },
        {
          symptom: "Greenlight shows measured scores without a Gemini memo",
          fix: "That is the designed fallback — ClickHouse + TypeScript still produced the slate.",
        },
        { symptom: "Missing GEMINI_API_KEY", fix: "Add it to .env and restart npm run dev." },
      ],
    },
  },
  es: {
    brand: {
      tagline: "El agente que indica a programación qué impulsar — con evidencia en ClickHouse.",
    },
    nav: {
      dashboard: "Panel",
      catalog: "Catálogo",
      ingest: "Ingresar",
      ask: "Consultar catálogo",
      judge: "Para jueces",
      about: "Guía de uso",
    },
    footer: "Agentic Cinema · track ClickHouse · Gemini + mcp-clickhouse",
    footerGuide: "Guía de uso",
    footerJudge: "Para jueces",
    lang: {
      switchTo: "English",
      label: "Idioma",
    },
    common: {
      loading: "Cargando…",
      evidence: "Evidencia",
      views: "visualizaciones",
      top: "Líder",
      yes: "sí",
      no: "no",
    },
    errors: {
      geminiBilling:
        "Los créditos de Gemini están agotados o hay límite de tasa (429). Añade facturación en Google AI Studio o espera unos minutos e inténtalo de nuevo.",
      clickhouseWaking:
        "ClickHouse o la API aún se están iniciando (503). Espera ~30 s hasta que health muestre ready: true y recarga.",
      timeout:
        "La solicitud expiró tras {seconds} s. Las llamadas al agente (Gemini + ClickHouse) pueden tardar 1–2 minutos — espera e inténtalo de nuevo.",
      network: "No se pudo conectar con la API. Comprueba que el servidor esté en ejecución.",
      generic: "Algo salió mal. Inténtalo de nuevo en un momento.",
    },
    health: {
      wakingTitle: "Despertando la demo en Render…",
      wakingBody:
        "El tier gratuito se apaga por inactividad. La primera carga puede tardar 60–90 s mientras arrancan MCP y la API.",
      retry: "Comprobar de nuevo",
      starting: "iniciando",
    },
    notFound: {
      title: "Página no encontrada",
      subtitle: "Esa URL no forma parte de la demo Catalog Greenlight.",
      heading: "Ruta desconocida",
      body: "Prueba el panel, el catálogo o la guía. Los picks de greenlight están en el panel.",
      dashboard: "Panel",
      apiHint:
        "Las rutas API como /api/v1/catalog/stats no son páginas del navegador — usa el panel o Catalog stats.",
    },
    judge: {
      title: "Para jueces",
      subtitle: "Track ClickHouse · Catalog Greenlight en menos de 60 segundos",
      pitch: "ClickHouse mide. TypeScript puntúa. Gemini explica.",
      icp: "Hecho para un jefe de programación de streaming que debe elegir el slate semanal del catálogo — no para continuidad de rodaje ni flujos de guion a producción.",
      coldStart:
        "El tier gratuito de Render se duerme por inactividad. La primera carga puede tardar 60–90 s mientras despiertan mcp-clickhouse y la API. Espera a que health muestre ready: true.",
      archTitle: "Arquitectura (runtime)",
      archMcp:
        "cuatro SELECT fijos en runtime: inventario por género, momentum WoW, pares de canibalización, huecos de slate.",
      archScorer:
        "fórmula determinista de opportunity + diversidad de género. Gemini no planifica el SQL de greenlight.",
      archGemini: "narrativa en greenlight; intención + NL→SQL en /ask. No Agent Builder / ADK.",
      scorerNote:
        "Gemini no planifica el SQL de greenlight. El ranking semanal es TypeScript (GreenlightScorer). Si la síntesis falla, expira o da 429, los tres picks puntuados siguen devolviéndose.",
      linksTitle: "Enlaces de la demo en vivo",
      linkDashboard: "Panel",
      linkGreenlight: "Sección Greenlight",
      linkAsk: "Consultar catálogo",
      linkHealth: "Health JSON",
      linkGreenlightApi: "API Greenlight (?refresh=1)",
      verifyTitle: "Cómo verificar en 2 minutos",
      verifyWarm: "Despierta Render:",
      verifyGreenlight: "Confirma tres picks puntuados:",
      verifyAsk:
        "Abre /ask y ejecuta el chip “Which genre is under-represented in our catalog?” — la respuesta debe citar un gap_score de ClickHouse (Documentary en el seed de demo).",
      wedgeTitle: "Cuña competitiva (track ClickHouse)",
      vsChloe:
        "Greenlighteamos un slate de catálogo para un jefe de programación — no producción guion→película (Chloe Greenlight).",
      vsFlashframe:
        "Usamos ClickHouse para economía de catálogo y riesgo de programación (gaps, WoW, canibalización) — no QC de fotosensibilidad (Flashframe).",
      slatePreviewTitle: "Slate semanal en vivo (scores medidos)",
      downloadJson: "Descargar JSON de evidencia para el jurado",
      downloaded: "Descargado",
      removeTitle: "Sin ClickHouse este greenlight semanal no puede medir",
      removeBody:
        "Quita ClickHouse / mcp-clickhouse y el greenlight semanal no puede medir huecos de género, momentum WoW, pares de canibalización ni huecos de slate en runtime — desaparecen esos cuatro SELECT MCP y los INSERT de auditoría; un scorer TypeScript sin entradas medidas no sirve. Gemini solo sintetiza narrativa (y NL→SQL en /ask).",
      qInventory: "huecos de género (cuota de títulos vs cuota de ingresos)",
      qMomentum: "momentum de ingresos semana a semana por título",
      qCannibal: "pares de títulos casi duplicados que se canibalizan",
      qHoles: "huecos de slate (gap_score de género e idioma)",
      codePointers: "Rutas de código",
      exportTitle: "Exportar JSON de evidencia para el jurado",
      exportBody:
        "Copia la última respuesta de greenlight (intent, model, fallback, tres picks, SQL) para el paquete del jurado.",
      copyJson: "Copiar JSON de evidencia",
      copied: "Copiado",
      copyFailed: "Portapapeles no disponible — usa el JSON de la API Greenlight.",
      waitingGreenlight:
        "Esperando una respuesta de greenlight (despierta la API si esto sigue vacío).",
    },
    empty: {
      catalog: {
        title: "Aún no hay títulos en el catálogo",
        body: "Sembra la base demo o ingresa tu primer título para poblar ClickHouse.",
        cta: "Ingresar un título →",
      },
      recommendations: {
        title: "Aún no hay recomendaciones de greenlight",
        body: "El analista terminó pero no devolvió tarjetas de recomendación. Revisa la línea de tiempo del agente por detalles MCP o de puntuación, o reintenta en un minuto.",
      },
    },
    dashboard: {
      title: "Panel de programación",
      subtitle:
        "Estadísticas del catálogo en vivo vía MCP · Greenlight semanal según huecos medidos y momentum",
      subtitleHero:
        "Primero la decisión semanal de greenlight — evidencia ClickHouse, puntuación TypeScript, narrativa Gemini.",
      trustPitch: "ClickHouse mide. TypeScript puntúa. Gemini explica.",
      showSnapshot: "Mostrar snapshot del catálogo y señales",
      hideSnapshot: "Ocultar snapshot del catálogo",
      showEvidence: "Mostrar evidencia (SQL, analítica, línea de tiempo)",
      hideEvidence: "Ocultar evidencia",
      liveStrip:
        "ClickHouse Cloud en vivo vía mcp-clickhouse oficial — ClickHouse mide, TypeScript puntúa, Gemini explica.",
      liveClickhouse: "ClickHouse {status}",
      liveMcp: "MCP {server}",
      mcpSqlTitle: "Evidencia SQL MCP",
      mcpSqlSub:
        "Las cuatro sentencias run_query del paso DISCOVER — prueba copiable para el jurado.",
      mcpSqlMeta: "{rows} filas · {ms} ms",
      mcpSqlError: "error de consulta",
      catalogSize: "Tamaño del catálogo",
      addedLast30: "{count} añadidos en los últimos 30 días",
      genresTracked: "Géneros monitorizados",
      latestRevenue: "Ingresos recientes (7 d)",
      noRevenue: "Sin datos de ingresos",
      greenlightTitle: "Greenlight de la semana",
      greenlightLoading: "Ejecutando analista determinístico (4 consultas MCP + redacción Gemini)…",
      greenlightProgressMeasuring: "Midiendo catálogo en ClickHouse…",
      greenlightProgressScoring: "Puntuando candidatos…",
      greenlightProgressNarrative: "Redactando narrativa…",
      greenlightProgressHint:
        "Suele tardar 1–3 minutos en arranque en frío. Las estadísticas del catálogo arriba ya están en vivo.",
      greenlightError429Title: "Gemini con límite de tasa",
      greenlightError429:
        "Gemini devolvió HTTP 429 (límite de tasa o cuota). Revisa tu clave API, cuota y facturación en Google AI Studio y recarga la página.",
      greenlightFallbackNotice:
        "ClickHouse midió estos picks y TypeScript los puntuó. La prosa de Gemini es opcional — los números siguen en vivo.",
      greenlightPartialNarrative: "Narrativa pendiente…",
      agentRun: "Ejecución del agente {ms} ms",
      followUp: "Hacer preguntas de seguimiento →",
      statsError: "No se pudieron cargar las estadísticas",
      greenlightError: "Falló el agente de greenlight",
      metricScore: "Puntuación de oportunidad",
      metricWow: "WoW",
      metricGenreGap: "Hueco de género",
      metricCannibal: "Par canibalizado",
      metricYes: "sí",
      metricNo: "no",
      analyticsTitle: "Analítica ClickHouse",
      analyticsSub: "De las 4 consultas MCP en el paso DISCOVER del greenlight",
      analyticsGenreTitle: "Hueco de género e inventario",
      analyticsGenreHint: "Cuota de ingresos menos cuota de títulos — más alto = infra-servido",
      analyticsGenreMeta: "{count} títulos · {titles} catálogo vs {revenue} ingresos",
      analyticsGenreTooltip: "Cuota títulos {titles} · cuota ingresos {revenue}",
      analyticsMomentumTitle: "Momentum WoW",
      analyticsMomentumHint: "Principales títulos por cambio de ingresos semana a semana",
      analyticsMomentumEmpty:
        "Ningún título con un movimiento semana a semana significativo en esta ejecución.",
      analyticsCannibalTitle: "Pares de canibalización",
      analyticsCannibalHint: "Títulos del mismo género en el cuartil superior de ingresos",
      analyticsCannibalClear: "No se detectaron pares canibalizados esta semana.",
      analyticsCannibalWarn:
        "Estos pares compiten en el mismo hueco de género — greenlight aplica penalización.",
      analyticsColTitleA: "Título A",
      analyticsColTitleB: "Título B",
      analyticsColGenre: "Género",
      analyticsColRevenue: "Ingresos (7 d)",
      analyticsNoData: "Sin filas para esta consulta.",
      ritualTitle: "Ritual semanal de programación",
      ritualSubtitle: "Evidencia → 3 títulos → contrafactual → exportar slate",
      colRank: "#",
      colTitle: "Título",
      colGenre: "Género",
      colEvidence: "Evidencia",
      exportCsv: "Exportar CSV",
      exportJson: "Exportar JSON",
      contrafactual:
        "Si impulsáramos el par {titleA} / {titleB} ({genre}), ambos títulos canibalizarían ingresos del cuartil superior en el mismo género — el scorer los excluyó del slate de esta semana.",
      contrafactualMore: "Y {count} pares casi duplicados más — ver analítica ClickHouse abajo.",
      signals: {
        title: "Señales de la semana",
        impact:
          "Sustituye SQL manual del analista — cuatro consultas MCP fijas puntúan cada título antes de que Gemini redacte la narrativa.",
        guideLink: "Cómo funciona la historia demo",
        measuring: "Actualizando desde ClickHouse…",
        loading: {
          comedy:
            "Exceso de comedia — medido con inventario por género (consulta A: títulos vs ingresos 4 semanas)",
          thriller:
            "Hueco de thriller — puntuado con analítica de huecos de programación (consulta D)",
          cannibal:
            "Pares de canibalización — títulos casi duplicados penalizados en el scoring (consulta C)",
          breakout:
            "Breakout LATAM — momentum semana a semana desde momentum por título (consulta B)",
        },
        loaded: {
          comedy:
            "Comedia en exceso: {count} títulos ({titlePct}% del catálogo) vs {revPct}% de ingresos en 4 semanas",
          comedyStatsOnly: "Comedia lidera volumen: {count} títulos ({titlePct}% del catálogo)",
          thrillerGap: "Hueco de thriller: {gap} gap score (consulta D — género infra-servido)",
          thrillerInventory:
            "Hueco de thriller: {thrillerCount} títulos vs Comedia con {comedyCount} — franja thriller delgada",
          cannibal: "Par canibalizado: {titleA} ↔ {titleB} (penalización consulta C)",
          cannibalSingle: "Par canibalizado: {title} (penalización del scorer)",
          breakout: "{title} — {wow} WoW · {genre} (momentum LATAM, consulta B)",
          breakoutPick: "Top pick {title} — {wow} WoW · oportunidad {score}",
        },
      },
    },
    greenlight: {
      stackBadge: "Medido en ClickHouse · Puntuado en TypeScript · Narrado por Gemini",
      formulaTitle: "Fórmula de puntuación",
      fallbackBadge: "Puntuación medida — memo Gemini opcional",
      provenanceTitle: "Procedencia del score (dimensiones MCP)",
      fromQuery: "← {query}",
      stripAria: "Campos medidos desde ClickHouse vía mcp-clickhouse",
      stripMcpTitle: "Cuatro SELECT MCP fijos en runtime del greenlight",
      clickhouseAttribution:
        "Estos números vienen de ClickHouse vía mcp-clickhouse — Gemini no inventó el ranking.",
      fillerBadge: "relleno de catálogo",
      fillerHint:
        "Relleno de diversidad de género desde profundidad del catálogo — medido en ClickHouse.",
    },
    catalog: {
      title: "Catálogo",
      subtitle: "{count} títulos en ClickHouse",
      subtitleFiltered: "{shown} de {total} títulos en ClickHouse (relleno oculto)",
      filterPlaceholder: "Filtrar por título o género…",
      hidePadding: "Ocultar relleno del seed (títulos numerados)",
      loadError: "No se pudo cargar el catálogo",
      colTitle: "Título",
      colGenre: "Género",
      colRelease: "Estreno",
      colCast: "Reparto",
    },
    catalogStats: {
      title: "Estadísticas del catálogo",
      subtitle: "Agregados en vivo desde ClickHouse vía MCP",
      backToCatalog: "← Tabla del catálogo",
      backToDashboard: "Panel",
    },
    ingest: {
      title: "Ingresar un título",
      subtitle:
        "Gemini enriquece resumen, etiquetas y posicionamiento; luego persiste vía mcp-clickhouse",
      labelTitle: "Título",
      titlePlaceholder: "p. ej. Night Shift Bogotá",
      labelDescription: "Descripción",
      labelGenre: "Género",
      labelRelease: "Fecha de estreno",
      labelCast: "Reparto (separado por comas)",
      castPlaceholder: "Actor Uno, Actor Dos",
      submitting: "Enriqueciendo y guardando…",
      submit: "Ingresar vía pipeline del agente",
      error: "Error al ingresar",
      success: "Guardado {id} en {ms} ms vía INSERT MCP",
      viewCatalog: "Ver en el catálogo →",
    },
    ask: {
      title: "Consultar el catálogo",
      subtitle:
        "Lenguaje natural → agente de 6 pasos. Los chips de demo siguen consultando ClickHouse si Gemini no está disponible.",
      fallbackNotice:
        "El planificador/redactor Gemini no estuvo disponible. ClickHouse sí corrió vía mcp-clickhouse — el SQL y las filas de abajo son en vivo.",
      fallbackBadge: "Fallback narrativo — la evidencia ClickHouse sigue en vivo",
      ungroundedRecs:
        "Las recomendaciones del agente no estaban ancladas en géneros del catálogo — revisa SQL y filas de evidencia arriba.",
      filteredRecs: "{count} recomendación(es) no anclada(s) oculta(s).",
      billingHint: "El greenlight del panel sigue midiendo ClickHouse sin Gemini.",
      billingHintCta: "Abrir panel →",
      labelQuestion: "Tu pregunta",
      running: "Ejecutando agente…",
      progressHint:
        "Una corrida típica tarda ~30 s (Gemini + ClickHouse). La demo no está congelada.",
      submit: "Ejecutar agente",
      error: "Falló el agente",
      answer: "Respuesta",
      intent: "Intención",
      sqlTitle: "SQL ejecutado (MCP run_query)",
      evidenceTitle: "Evidencia ({count} filas)",
      timelineTitle: "Línea de tiempo del agente",
      suggestions: [
        "¿Qué género está infra-representado en nuestro catálogo?",
        "Recomienda 3 títulos para un bloque nocturno de ciencia ficción",
        "¿Qué títulos tuvieron los mayores ingresos la semana pasada?",
      ],
    },
    steps: {
      INTENT: "Clasificar intención",
      DISCOVER: "Descubrir esquema / analítica",
      PLAN_SQL: "Planificar SQL",
      EXECUTE: "Ejecutar consulta",
      SYNTHESIZE: "Sintetizar respuesta",
      AUDIT: "Auditar ejecución",
      showDetails: "Mostrar detalles",
      hideDetails: "Ocultar detalles",
      noOutput: "Sin salida",
      intentLabel: "Intención",
      sourceLabel: "Origen",
      schemaLabel: "Esquema en vivo",
      sqlLabel: "SQL",
      rowsLabel: "Filas",
      rowCount: "{count} filas",
      latency: "{ms} ms",
      formulaLabel: "Fórmula de puntuación",
      candidateCountLabel: "Candidatos puntuados",
      momentumRowsLabel: "Filas de momentum",
      topCandidatesLabel: "Mejores candidatos",
      attemptLabel: "Intento {n}",
      retryLabel: "reintento",
      fallbackLabel: "Se usó respaldo determinístico",
      recommendationsLabel: "Recomendaciones",
      auditIdLabel: "ID de auditoría",
      queryLabel: "Consulta",
      rawOutputLabel: "Salida sin procesar",
      moreRows: "+{count} filas más",
      cellYes: "sí",
      cellNo: "no",
      status: {
        pending: "Pendiente",
        running: "En ejecución",
        completed: "Completado",
        error: "Error",
        failed: "Fallido",
      },
    },
    about: {
      badge: "Documentación de uso",
      title: "Guía de uso — Catalog Greenlight",
      subtitle: "Qué hace esta aplicación y cómo utilizarla",
      judgeTitle: "Ruta de 60 segundos para el jurado",
      judgeSteps: [
        "Panel: tamaño e ingresos del catálogo en vivo y tres picks de greenlight con opportunity / WoW / hueco de género.",
        "Abre la evidencia SQL MCP bajo analítica — cuatro sentencias oficiales run_query de mcp-clickhouse.",
        "Pregunta al catálogo con un chip. Si Gemini está limitado, SQL + filas siguen saliendo de ClickHouse.",
        "El catálogo oculta el relleno seed por defecto. Ingest necesita créditos Gemini (enriquecimiento).",
      ],
      whatTitle: "¿Qué es Catalog Greenlight?",
      whatBody:
        "Catalog Greenlight es un asistente agentic de programación para catálogos de streaming. Cada semana recomienda tres títulos para impulsar — no porque un LLM adivinó, sino porque el sistema midió huecos de género, momentum de ingresos semana a semana y riesgo de canibalización en ClickHouse.",
      audience:
        "Pensado para jefes de programación, analistas de catálogo y jurados del hackathon que necesitan evidencia SQL detrás de cada elección.",
      purposeTitle: "¿Para qué sirve?",
      purposeColNeed: "Necesidad",
      purposeColHow: "Cómo ayuda la app",
      purposes: [
        { need: "Ver el estado del catálogo", how: "Panel con estadísticas en vivo vía MCP" },
        {
          need: "Elegir 3 títulos de la semana",
          how: "Greenlight determinístico + narrativa Gemini",
        },
        { need: "Explorar títulos existentes", how: "Catálogo con filtro de búsqueda" },
        { need: "Añadir un título nuevo", how: "Ingresar con enriquecimiento Gemini + INSERT MCP" },
        {
          need: "Preguntas puntuales",
          how: "Consultar catálogo (lenguaje natural → SQL → evidencia)",
        },
      ],
      quickStartTitle: "Inicio rápido",
      quickStartSteps: [
        "Abre el Panel para estadísticas en vivo y recomendaciones de greenlight semanal.",
        "Usa Catálogo, Ingresar y Consultar desde la barra de navegación.",
        "Expande la línea de tiempo del agente para ver SQL MCP y filas de evidencia.",
        "Cambia el idioma con EN / ES en la cabecera.",
      ],
      guideTitle: "Pantallas de un vistazo",
      screens: [
        {
          path: "/",
          title: "Panel",
          body: "Las estadísticas del catálogo (tamaño, géneros, ingresos recientes) cargan primero. El panel de greenlight se ejecuta en segundo plano y muestra tres recomendaciones fundamentadas con la línea de tiempo completa de 6 pasos.",
          cta: "Abrir panel",
        },
        {
          path: "/catalog",
          title: "Catálogo",
          body: "Explora todos los títulos almacenados en ClickHouse. Filtra por título o género. Úsalo para verificar que las recomendaciones de greenlight existen en el catálogo.",
          cta: "Ver catálogo",
        },
        {
          path: "/ingest",
          title: "Ingresar",
          body: "Añade un título nuevo: Gemini enriquece los metadatos y el agente persiste la fila mediante INSERT vía mcp-clickhouse.",
          cta: "Ingresar un título",
        },
        {
          path: "/ask",
          title: "Consultar catálogo",
          body: "Haz preguntas en lenguaje natural. El agente clasifica la intención, descubre el esquema en vivo, genera SQL, ejecuta vía MCP, sintetiza la respuesta y audita la ejecución.",
          cta: "Hacer una pregunta",
        },
      ],
      demoStoryLead:
        "El catálogo demo sembrado cuenta una historia: la comedia está en exceso, el thriller es escaso, True Crime: Highway 101 forma un par canibalizado y Crimen sin Fronteras: Bogotá es el breakout LATAM — todo visible en el panel con analítica medida en ClickHouse.",
      greenlightTitle: "Cómo funciona el greenlight semanal",
      greenlightIntro:
        "El greenlight es un analista determinístico. Gemini redacta la narrativa; TypeScript elige los títulos.",
      greenlightSteps: [
        "Cuatro consultas SELECT fijas se ejecutan en paralelo: inventario por género, momentum por título, pares de canibalización y huecos de programación.",
        "Cada título se puntúa en TypeScript con una fórmula explícita (hueco de género + momentum WoW − penalización por canibalización).",
        "Se eligen los tres mejores candidatos con diversidad de género — como máximo un título por género.",
        "Gemini recibe solo esas filas candidatas y debe citar sus cifras. Los títulos alucinados se descartan.",
      ],
      formulaTitle: "Fórmula de puntuación",
      formula:
        "oportunidad = 0,4×hueco_género + 0,4×momentum_wow − 0,2×penalización_canibalización (+ pequeño bonus por hueco de idioma)",
      stackTitle: "Tecnología",
      stackItems: [
        "IA en runtime: @google/genai (Gemini) — solo intención, NL→SQL y síntesis",
        "Datos: ClickHouse vía mcp-clickhouse oficial (McpClickHouseConnector)",
        "Orquestación: AgentRunner propio con línea de tiempo visible de 6 pasos",
        "Sin LangChain, OpenAI, Anthropic ni Agent Builder",
      ],
      tipsTitle: "Consejos",
      tips: [
        "Cambia el idioma con el botón EN / ES en la cabecera.",
        "En el panel, las estadísticas aparecen antes de que termine el greenlight — espera las tarjetas de recomendación o la línea de tiempo.",
        "En Consultar, expande la línea de tiempo para ver el SQL MCP y las filas de evidencia en cada paso.",
        "Tras sembrar la base demo, busca el breakout LATAM y el par de canibalización en la salida de greenlight.",
      ],
      troubleshootTitle: "Solución de problemas",
      troubleshootColSymptom: "Síntoma",
      troubleshootColFix: "Qué hacer",
      troubleshoot: [
        {
          symptom: "Panel vacío / error 503",
          fix: "Espera a que la API muestre ready: true y recarga.",
        },
        {
          symptom: "Ask o Ingest devuelve 429 / créditos agotados",
          fix: "Recarga GEMINI_API_KEY en Google AI Studio. Greenlight sigue puntuando desde ClickHouse sin Gemini.",
        },
        {
          symptom: "Greenlight muestra puntuaciones medidas sin memo de Gemini",
          fix: "Es el respaldo diseñado — ClickHouse + TypeScript igual produjeron la pizarra.",
        },
        { symptom: "Falta GEMINI_API_KEY", fix: "Añádela al .env y reinicia npm run dev." },
      ],
    },
  },
} as const;

export type TranslationTree = typeof translations.en;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = getNested(translations[locale] as unknown as Record<string, unknown>, key);
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (text, [name, val]) => text.replace(new RegExp(`\\{${name}\\}`, "g"), String(val)),
    value,
  );
}
