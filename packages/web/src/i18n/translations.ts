export type Locale = 'en' | 'es';

export const translations = {
  en: {
    brand: {
      tagline: 'The agent that tells programming what to push — with ClickHouse evidence.'
    },
    nav: {
      dashboard: 'Dashboard',
      catalog: 'Catalog',
      ingest: 'Ingest',
      ask: 'Ask the Catalog',
      about: 'User guide'
    },
    footer: 'Agentic Cinema · ClickHouse track · Gemini + mcp-clickhouse',
    footerGuide: 'User guide',
    lang: {
      switchTo: 'Español',
      label: 'Language'
    },
    common: {
      loading: 'Loading…',
      evidence: 'Evidence',
      views: 'views',
      top: 'Top',
      yes: 'yes',
      no: 'no'
    },
    errors: {
      geminiBilling:
        'Gemini API credits are exhausted or rate-limited (429). Add billing in Google AI Studio or wait a few minutes, then try again.',
      clickhouseWaking:
        'ClickHouse or the API is still starting (503). Wait ~30 seconds until health shows ready: true, then refresh.',
      timeout:
        'The request timed out after {seconds}s. Agent calls (Gemini + ClickHouse) can take 1–2 minutes — please wait and retry.',
      network: 'Could not reach the API. Check that the server is running.',
      generic: 'Something went wrong. Try again in a moment.'
    },
    empty: {
      catalog: {
        title: 'No titles in the catalog yet',
        body: 'Seed the demo database or ingest your first title to populate ClickHouse.',
        cta: 'Ingest a title →'
      },
      recommendations: {
        title: 'No greenlight picks yet',
        body: 'The analyst finished but returned no recommendation cards. Check the agent timeline below for MCP or scoring details, or retry in a minute.'
      }
    },
    dashboard: {
      title: 'Programming Dashboard',
      subtitle:
        'Live catalog stats from ClickHouse via MCP · Weekly greenlight picks from measured gaps and momentum',
      catalogSize: 'Catalog size',
      addedLast30: '{count} added in the last 30 days',
      genresTracked: 'Genres tracked',
      latestRevenue: 'Latest revenue (7d)',
      noRevenue: 'No revenue data',
      greenlightTitle: 'Greenlight this week',
      greenlightLoading: 'Running deterministic analyst (4 MCP queries + Gemini writer)…',
      greenlightProgressMeasuring: 'Measuring catalog in ClickHouse…',
      greenlightProgressScoring: 'Scoring candidates…',
      greenlightProgressNarrative: 'Writing narrative…',
      greenlightProgressHint:
        'Usually takes 1–3 minutes on cold start. Catalog stats above are already live.',
      greenlightError429Title: 'Gemini rate limited',
      greenlightError429:
        'Gemini returned HTTP 429 (rate limit or quota). Check your API key, quota, and billing in Google AI Studio, then reload the page.',
      greenlightFallbackNotice:
        'Showing deterministic scorer picks — Gemini narrative was unavailable.',
      greenlightPartialNarrative: 'Narrative pending…',
      agentRun: 'Agent run {ms}ms',
      followUp: 'Ask follow-up questions →',
      statsError: 'Failed to load stats',
      greenlightError: 'Greenlight agent failed',
      metricScore: 'Opportunity score',
      metricWow: 'WoW',
      metricGenreGap: 'Genre gap',
      metricCannibal: 'Cannibal pair',
      metricYes: 'yes',
      metricNo: 'no',
      analyticsTitle: 'ClickHouse analytics',
      analyticsSub: 'From the 4 MCP queries in the greenlight DISCOVER step',
      analyticsGenreTitle: 'Genre gap & inventory',
      analyticsGenreHint: 'Revenue share minus title share — higher means underserved',
      analyticsGenreMeta: '{count} titles · {titles} catalog vs {revenue} revenue',
      analyticsGenreTooltip: 'Title share {titles} · revenue share {revenue}',
      analyticsMomentumTitle: 'WoW momentum',
      analyticsMomentumHint: 'Top titles by week-over-week revenue change',
      analyticsCannibalTitle: 'Cannibalization pairs',
      analyticsCannibalHint: 'Same-genre titles both in top revenue quartile',
      analyticsCannibalClear: 'No cannibal pairs detected this week.',
      analyticsCannibalWarn: 'These pairs compete in the same genre slot — greenlight applies a penalty.',
      analyticsColTitleA: 'Title A',
      analyticsColTitleB: 'Title B',
      analyticsColGenre: 'Genre',
      analyticsColRevenue: 'Revenue (7d)',
      analyticsNoData: 'No rows for this query.',
      ritualTitle: 'Weekly programming ritual',
      ritualSubtitle: 'Evidence → 3 picks → contrafactual → export slate',
      colRank: '#',
      colTitle: 'Title',
      colGenre: 'Genre',
      colEvidence: 'Evidence',
      exportCsv: 'Export CSV',
      exportJson: 'Export JSON',
      contrafactual:
        'If we pushed the {titleA} / {titleB} pair ({genre}), both titles would cannibalize top-quartile revenue in the same genre — the scorer excluded them from this week\'s slate.',
      signals: {
        title: "This week's signals",
        impact:
          'Replaces manual analyst SQL — four fixed MCP queries score every title before Gemini writes the narrative.',
        guideLink: 'How the demo story works',
        measuring: 'Updating from ClickHouse…',
        loading: {
          comedy:
            'Comedy oversupply — measured from genre inventory (query A: title count vs 4-week revenue share)',
          thriller: 'Thriller slate hole — scored from slate-holes analytics (query D)',
          cannibal:
            'Cannibalization pairs — near-duplicate titles penalized in scoring (query C)',
          breakout:
            'LATAM breakout momentum — week-over-week revenue surge from title momentum (query B)'
        },
        loaded: {
          comedy:
            'Comedy oversupplied: {count} titles ({titlePct}% of catalog) vs {revPct}% of 4-week revenue',
          comedyStatsOnly:
            'Comedy leads catalog volume: {count} titles ({titlePct}% of catalog)',
          thrillerGap: 'Thriller slate hole: {gap} gap score (query D — underserved genre)',
          thrillerInventory:
            'Thriller gap: {thrillerCount} titles vs Comedy at {comedyCount} — thin thriller slice',
          cannibal: 'Cannibal pair flagged: {titleA} ↔ {titleB} (query C penalty applied)',
          cannibalSingle: 'Cannibal pair flagged: {title} (scorer penalty applied)',
          breakout: '{title} — {wow} WoW · {genre} (LATAM momentum, query B)',
          breakoutPick: 'Top pick {title} — {wow} WoW · opportunity {score}'
        }
      }
    },
    greenlight: {
      stackBadge: 'Measured by ClickHouse · Scored in TypeScript · Narrated by Gemini',
      formulaTitle: 'Scoring formula',
      fallbackBadge: 'Scorer fallback — Gemini writer unavailable',
      provenanceTitle: 'Score provenance (MCP query dimensions)',
      fromQuery: '← {query}'
    },
    catalog: {
      title: 'Catalog',
      subtitle: '{count} titles in ClickHouse',
      filterPlaceholder: 'Filter by title or genre…',
      loadError: 'Failed to load catalog',
      colTitle: 'Title',
      colGenre: 'Genre',
      colRelease: 'Release',
      colCast: 'Cast'
    },
    ingest: {
      title: 'Ingest a title',
      subtitle: 'Gemini enriches summary, tags, and positioning, then persists via mcp-clickhouse',
      labelTitle: 'Title',
      labelDescription: 'Description',
      labelGenre: 'Genre',
      labelRelease: 'Release date',
      labelCast: 'Cast (comma-separated)',
      castPlaceholder: 'Actor One, Actor Two',
      submitting: 'Enriching & storing…',
      submit: 'Ingest via agent pipeline',
      error: 'Ingest failed',
      success: 'Stored {id} in {ms}ms via MCP INSERT',
      viewCatalog: 'View in catalog →'
    },
    ask: {
      title: 'Ask the catalog',
      subtitle: 'Natural language → INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT',
      labelQuestion: 'Your question',
      running: 'Agent running…',
      submit: 'Run agent',
      error: 'Agent failed',
      answer: 'Answer',
      intent: 'Intent',
      sqlTitle: 'SQL executed (MCP run_query)',
      evidenceTitle: 'Evidence ({count} rows)',
      timelineTitle: 'Agent timeline',
      suggestions: [
        'Which genre is under-represented in our catalog?',
        'Recommend 3 titles for a late-night sci-fi slot',
        'What titles had the highest revenue last week?'
      ]
    },
    steps: {
      INTENT: 'Classify intent',
      DISCOVER: 'Discover schema / analytics',
      PLAN_SQL: 'Plan SQL',
      EXECUTE: 'Execute query',
      SYNTHESIZE: 'Synthesize answer',
      AUDIT: 'Audit run',
      showDetails: 'Show details',
      hideDetails: 'Hide details',
      noOutput: 'No output',
      intentLabel: 'Intent',
      sourceLabel: 'Source',
      schemaLabel: 'Live schema',
      sqlLabel: 'SQL',
      rowsLabel: 'Rows',
      rowCount: '{count} rows',
      latency: '{ms} ms',
      formulaLabel: 'Scoring formula',
      candidateCountLabel: 'Candidates scored',
      momentumRowsLabel: 'Momentum rows',
      topCandidatesLabel: 'Top candidates',
      attemptLabel: 'Attempt {n}',
      fallbackLabel: 'Used deterministic fallback',
      recommendationsLabel: 'Recommendations',
      auditIdLabel: 'Audit ID',
      queryLabel: 'Query',
      rawOutputLabel: 'Raw output',
      moreRows: '+{count} more rows',
      cellYes: 'yes',
      cellNo: 'no',
      status: {
        pending: 'Pending',
        running: 'Running',
        completed: 'Completed',
        error: 'Error',
        failed: 'Failed'
      }
    },
    about: {
      badge: 'User documentation',
      title: 'User Guide — Catalog Greenlight',
      subtitle: 'What this application does and how to use it',
      whatTitle: 'What is Catalog Greenlight?',
      whatBody:
        'Catalog Greenlight is an agentic programming assistant for streaming catalogs. Each week it recommends three titles to push — not because an LLM guessed, but because the system measured genre gaps, week-over-week revenue momentum, and cannibalization risk in ClickHouse.',
      audience:
        'Built for programming chiefs, catalog analysts, and hackathon judges who need SQL evidence behind every pick.',
      purposeTitle: 'What is it for?',
      purposeColNeed: 'Need',
      purposeColHow: 'How the app helps',
      purposes: [
        { need: 'See catalog health', how: 'Dashboard with live stats via MCP' },
        { need: 'Pick 3 titles for the week', how: 'Deterministic greenlight + Gemini narrative' },
        { need: 'Browse existing titles', how: 'Catalog with search filter' },
        { need: 'Add a new title', how: 'Ingest with Gemini enrichment + MCP INSERT' },
        { need: 'Ask ad-hoc questions', how: 'Ask the Catalog (NL → SQL → evidence)' }
      ],
      quickStartTitle: 'Quick start',
      quickStartSteps: [
        'Open Dashboard for live stats and weekly greenlight recommendations.',
        'Use Catalog, Ingest, and Ask from the navigation bar.',
        'Expand the agent timeline to see MCP SQL and row evidence.',
        'Switch language with EN / ES in the header.'
      ],
      guideTitle: 'Screens at a glance',
      screens: [
        {
          path: '/',
          title: 'Dashboard',
          body: 'Live catalog stats (size, genres, latest revenue) load first. The greenlight panel runs asynchronously and shows three grounded recommendations with the full 6-step agent timeline.',
          cta: 'Open dashboard'
        },
        {
          path: '/catalog',
          title: 'Catalog',
          body: 'Browse every title stored in ClickHouse. Filter by title or genre. Use this to verify that greenlight picks exist in the catalog.',
          cta: 'Browse catalog'
        },
        {
          path: '/ingest',
          title: 'Ingest',
          body: 'Add a new title: Gemini enriches metadata, then the agent persists the row via mcp-clickhouse INSERT.',
          cta: 'Ingest a title'
        },
        {
          path: '/ask',
          title: 'Ask the Catalog',
          body: 'Ask questions in natural language. The agent classifies intent, discovers live schema, generates SQL, executes via MCP, synthesizes an answer, and audits the run.',
          cta: 'Ask a question'
        }
      ],
      demoStoryLead:
        'The seeded demo catalog tells one story: Comedy is oversupplied, Thriller is thin, True Crime: Highway 101 forms a cannibal pair, and Crimen sin Fronteras: Bogotá is the LATAM breakout — all surfaced from measured ClickHouse analytics on the dashboard.',
      greenlightTitle: 'How weekly greenlight works',
      greenlightIntro:
        'Greenlight is a deterministic analyst. Gemini writes the narrative; TypeScript chooses the titles.',
      greenlightSteps: [
        'Four fixed SELECT queries run in parallel: genre inventory, title momentum, cannibalization pairs, and slate holes.',
        'Each title is scored in TypeScript with an explicit formula (genre gap + WoW momentum − cannibalization penalty).',
        'The top three candidates are picked with genre diversity — at most one title per genre.',
        'Gemini receives only those candidate rows and must cite their numbers. Hallucinated titles are filtered out.'
      ],
      formulaTitle: 'Scoring formula',
      formula:
        'opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty (+ small language-gap bonus)',
      stackTitle: 'Technology',
      stackItems: [
        'Runtime AI: @google/genai (Gemini) — intent, NL→SQL, and synthesis only',
        'Data: ClickHouse via official mcp-clickhouse (McpClickHouseConnector)',
        'Orchestration: custom AgentRunner with a visible 6-step timeline',
        'No LangChain, OpenAI, Anthropic, or Agent Builder'
      ],
      tipsTitle: 'Tips',
      tips: [
        'Switch language with the EN / ES toggle in the header.',
        'On the dashboard, stats appear before greenlight finishes — wait for recommendation cards or the timeline.',
        'On Ask, expand the timeline to see MCP SQL and row evidence for every step.',
        'After seeding the demo database, look for the LATAM breakout and cannibalization pair in the greenlight output.'
      ],
      troubleshootTitle: 'Troubleshooting',
      troubleshootColSymptom: 'Symptom',
      troubleshootColFix: 'What to do',
      troubleshoot: [
        { symptom: 'Empty dashboard / 503 error', fix: 'Wait until API health shows ready: true, then refresh.' },
        { symptom: 'Greenlight without recommendation cards', fix: 'Check the agent timeline below for MCP or timeout errors.' },
        { symptom: 'Missing GEMINI_API_KEY', fix: 'Add it to .env and restart npm run dev.' }
      ]
    }
  },
  es: {
    brand: {
      tagline: 'El agente que indica a programación qué impulsar — con evidencia en ClickHouse.'
    },
    nav: {
      dashboard: 'Panel',
      catalog: 'Catálogo',
      ingest: 'Ingresar',
      ask: 'Consultar catálogo',
      about: 'Guía de uso'
    },
    footer: 'Agentic Cinema · track ClickHouse · Gemini + mcp-clickhouse',
    footerGuide: 'Guía de uso',
    lang: {
      switchTo: 'English',
      label: 'Idioma'
    },
    common: {
      loading: 'Cargando…',
      evidence: 'Evidencia',
      views: 'visualizaciones',
      top: 'Líder',
      yes: 'sí',
      no: 'no'
    },
    errors: {
      geminiBilling:
        'Los créditos de Gemini están agotados o hay límite de tasa (429). Añade facturación en Google AI Studio o espera unos minutos e inténtalo de nuevo.',
      clickhouseWaking:
        'ClickHouse o la API aún se están iniciando (503). Espera ~30 s hasta que health muestre ready: true y recarga.',
      timeout:
        'La solicitud expiró tras {seconds} s. Las llamadas al agente (Gemini + ClickHouse) pueden tardar 1–2 minutos — espera e inténtalo de nuevo.',
      network: 'No se pudo conectar con la API. Comprueba que el servidor esté en ejecución.',
      generic: 'Algo salió mal. Inténtalo de nuevo en un momento.'
    },
    empty: {
      catalog: {
        title: 'Aún no hay títulos en el catálogo',
        body: 'Sembra la base demo o ingresa tu primer título para poblar ClickHouse.',
        cta: 'Ingresar un título →'
      },
      recommendations: {
        title: 'Aún no hay recomendaciones de greenlight',
        body: 'El analista terminó pero no devolvió tarjetas de recomendación. Revisa la línea de tiempo del agente por detalles MCP o de puntuación, o reintenta en un minuto.'
      }
    },
    dashboard: {
      title: 'Panel de programación',
      subtitle:
        'Estadísticas del catálogo en vivo vía MCP · Greenlight semanal según huecos medidos y momentum',
      catalogSize: 'Tamaño del catálogo',
      addedLast30: '{count} añadidos en los últimos 30 días',
      genresTracked: 'Géneros monitorizados',
      latestRevenue: 'Ingresos recientes (7 d)',
      noRevenue: 'Sin datos de ingresos',
      greenlightTitle: 'Greenlight de la semana',
      greenlightLoading: 'Ejecutando analista determinístico (4 consultas MCP + redacción Gemini)…',
      greenlightProgressMeasuring: 'Midiendo catálogo en ClickHouse…',
      greenlightProgressScoring: 'Puntuando candidatos…',
      greenlightProgressNarrative: 'Redactando narrativa…',
      greenlightProgressHint:
        'Suele tardar 1–3 minutos en arranque en frío. Las estadísticas del catálogo arriba ya están en vivo.',
      greenlightError429Title: 'Gemini con límite de tasa',
      greenlightError429:
        'Gemini devolvió HTTP 429 (límite de tasa o cuota). Revisa tu clave API, cuota y facturación en Google AI Studio y recarga la página.',
      greenlightFallbackNotice:
        'Mostrando selección del scorer determinístico — la narrativa de Gemini no estuvo disponible.',
      greenlightPartialNarrative: 'Narrativa pendiente…',
      agentRun: 'Ejecución del agente {ms} ms',
      followUp: 'Hacer preguntas de seguimiento →',
      statsError: 'No se pudieron cargar las estadísticas',
      greenlightError: 'Falló el agente de greenlight',
      metricScore: 'Puntuación de oportunidad',
      metricWow: 'WoW',
      metricGenreGap: 'Hueco de género',
      metricCannibal: 'Par canibalizado',
      metricYes: 'sí',
      metricNo: 'no',
      analyticsTitle: 'Analítica ClickHouse',
      analyticsSub: 'De las 4 consultas MCP en el paso DISCOVER del greenlight',
      analyticsGenreTitle: 'Hueco de género e inventario',
      analyticsGenreHint: 'Cuota de ingresos menos cuota de títulos — más alto = infra-servido',
      analyticsGenreMeta: '{count} títulos · {titles} catálogo vs {revenue} ingresos',
      analyticsGenreTooltip: 'Cuota títulos {titles} · cuota ingresos {revenue}',
      analyticsMomentumTitle: 'Momentum WoW',
      analyticsMomentumHint: 'Principales títulos por cambio de ingresos semana a semana',
      analyticsCannibalTitle: 'Pares de canibalización',
      analyticsCannibalHint: 'Títulos del mismo género en el cuartil superior de ingresos',
      analyticsCannibalClear: 'No se detectaron pares canibalizados esta semana.',
      analyticsCannibalWarn: 'Estos pares compiten en el mismo hueco de género — greenlight aplica penalización.',
      analyticsColTitleA: 'Título A',
      analyticsColTitleB: 'Título B',
      analyticsColGenre: 'Género',
      analyticsColRevenue: 'Ingresos (7 d)',
      analyticsNoData: 'Sin filas para esta consulta.',
      ritualTitle: 'Ritual semanal de programación',
      ritualSubtitle: 'Evidencia → 3 títulos → contrafactual → exportar slate',
      colRank: '#',
      colTitle: 'Título',
      colGenre: 'Género',
      colEvidence: 'Evidencia',
      exportCsv: 'Exportar CSV',
      exportJson: 'Exportar JSON',
      contrafactual:
        'Si impulsáramos el par {titleA} / {titleB} ({genre}), ambos títulos canibalizarían ingresos del cuartil superior en el mismo género — el scorer los excluyó del slate de esta semana.',
      signals: {
        title: 'Señales de la semana',
        impact:
          'Sustituye SQL manual del analista — cuatro consultas MCP fijas puntúan cada título antes de que Gemini redacte la narrativa.',
        guideLink: 'Cómo funciona la historia demo',
        measuring: 'Actualizando desde ClickHouse…',
        loading: {
          comedy:
            'Exceso de comedia — medido con inventario por género (consulta A: títulos vs ingresos 4 semanas)',
          thriller: 'Hueco de thriller — puntuado con analítica de huecos de programación (consulta D)',
          cannibal:
            'Pares de canibalización — títulos casi duplicados penalizados en el scoring (consulta C)',
          breakout:
            'Breakout LATAM — momentum semana a semana desde momentum por título (consulta B)'
        },
        loaded: {
          comedy:
            'Comedia en exceso: {count} títulos ({titlePct}% del catálogo) vs {revPct}% de ingresos en 4 semanas',
          comedyStatsOnly:
            'Comedia lidera volumen: {count} títulos ({titlePct}% del catálogo)',
          thrillerGap: 'Hueco de thriller: {gap} gap score (consulta D — género infra-servido)',
          thrillerInventory:
            'Hueco de thriller: {thrillerCount} títulos vs Comedia con {comedyCount} — franja thriller delgada',
          cannibal: 'Par canibalizado: {titleA} ↔ {titleB} (penalización consulta C)',
          cannibalSingle: 'Par canibalizado: {title} (penalización del scorer)',
          breakout: '{title} — {wow} WoW · {genre} (momentum LATAM, consulta B)',
          breakoutPick: 'Top pick {title} — {wow} WoW · oportunidad {score}'
        }
      }
    },
    greenlight: {
      stackBadge: 'Medido en ClickHouse · Puntuado en TypeScript · Narrado por Gemini',
      formulaTitle: 'Fórmula de puntuación',
      fallbackBadge: 'Respaldo del scorer — redactor Gemini no disponible',
      provenanceTitle: 'Procedencia del score (dimensiones MCP)',
      fromQuery: '← {query}'
    },
    catalog: {
      title: 'Catálogo',
      subtitle: '{count} títulos en ClickHouse',
      filterPlaceholder: 'Filtrar por título o género…',
      loadError: 'No se pudo cargar el catálogo',
      colTitle: 'Título',
      colGenre: 'Género',
      colRelease: 'Estreno',
      colCast: 'Reparto'
    },
    ingest: {
      title: 'Ingresar un título',
      subtitle:
        'Gemini enriquece resumen, etiquetas y posicionamiento; luego persiste vía mcp-clickhouse',
      labelTitle: 'Título',
      labelDescription: 'Descripción',
      labelGenre: 'Género',
      labelRelease: 'Fecha de estreno',
      labelCast: 'Reparto (separado por comas)',
      castPlaceholder: 'Actor Uno, Actor Dos',
      submitting: 'Enriqueciendo y guardando…',
      submit: 'Ingresar vía pipeline del agente',
      error: 'Error al ingresar',
      success: 'Guardado {id} en {ms} ms vía INSERT MCP',
      viewCatalog: 'Ver en el catálogo →'
    },
    ask: {
      title: 'Consultar el catálogo',
      subtitle: 'Lenguaje natural → INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT',
      labelQuestion: 'Tu pregunta',
      running: 'Ejecutando agente…',
      submit: 'Ejecutar agente',
      error: 'Falló el agente',
      answer: 'Respuesta',
      intent: 'Intención',
      sqlTitle: 'SQL ejecutado (MCP run_query)',
      evidenceTitle: 'Evidencia ({count} filas)',
      timelineTitle: 'Línea de tiempo del agente',
      suggestions: [
        '¿Qué género está infra-representado en nuestro catálogo?',
        'Recomienda 3 títulos para un bloque nocturno de ciencia ficción',
        '¿Qué títulos tuvieron los mayores ingresos la semana pasada?'
      ]
    },
    steps: {
      INTENT: 'Clasificar intención',
      DISCOVER: 'Descubrir esquema / analítica',
      PLAN_SQL: 'Planificar SQL',
      EXECUTE: 'Ejecutar consulta',
      SYNTHESIZE: 'Sintetizar respuesta',
      AUDIT: 'Auditar ejecución',
      showDetails: 'Mostrar detalles',
      hideDetails: 'Ocultar detalles',
      noOutput: 'Sin salida',
      intentLabel: 'Intención',
      sourceLabel: 'Origen',
      schemaLabel: 'Esquema en vivo',
      sqlLabel: 'SQL',
      rowsLabel: 'Filas',
      rowCount: '{count} filas',
      latency: '{ms} ms',
      formulaLabel: 'Fórmula de puntuación',
      candidateCountLabel: 'Candidatos puntuados',
      momentumRowsLabel: 'Filas de momentum',
      topCandidatesLabel: 'Mejores candidatos',
      attemptLabel: 'Intento {n}',
      fallbackLabel: 'Se usó respaldo determinístico',
      recommendationsLabel: 'Recomendaciones',
      auditIdLabel: 'ID de auditoría',
      queryLabel: 'Consulta',
      rawOutputLabel: 'Salida sin procesar',
      moreRows: '+{count} filas más',
      cellYes: 'sí',
      cellNo: 'no',
      status: {
        pending: 'Pendiente',
        running: 'En ejecución',
        completed: 'Completado',
        error: 'Error',
        failed: 'Fallido'
      }
    },
    about: {
      badge: 'Documentación de uso',
      title: 'Guía de uso — Catalog Greenlight',
      subtitle: 'Qué hace esta aplicación y cómo utilizarla',
      whatTitle: '¿Qué es Catalog Greenlight?',
      whatBody:
        'Catalog Greenlight es un asistente agentic de programación para catálogos de streaming. Cada semana recomienda tres títulos para impulsar — no porque un LLM adivinó, sino porque el sistema midió huecos de género, momentum de ingresos semana a semana y riesgo de canibalización en ClickHouse.',
      audience:
        'Pensado para jefes de programación, analistas de catálogo y jurados del hackathon que necesitan evidencia SQL detrás de cada elección.',
      purposeTitle: '¿Para qué sirve?',
      purposeColNeed: 'Necesidad',
      purposeColHow: 'Cómo ayuda la app',
      purposes: [
        { need: 'Ver el estado del catálogo', how: 'Panel con estadísticas en vivo vía MCP' },
        { need: 'Elegir 3 títulos de la semana', how: 'Greenlight determinístico + narrativa Gemini' },
        { need: 'Explorar títulos existentes', how: 'Catálogo con filtro de búsqueda' },
        { need: 'Añadir un título nuevo', how: 'Ingresar con enriquecimiento Gemini + INSERT MCP' },
        { need: 'Preguntas puntuales', how: 'Consultar catálogo (lenguaje natural → SQL → evidencia)' }
      ],
      quickStartTitle: 'Inicio rápido',
      quickStartSteps: [
        'Abre el Panel para estadísticas en vivo y recomendaciones de greenlight semanal.',
        'Usa Catálogo, Ingresar y Consultar desde la barra de navegación.',
        'Expande la línea de tiempo del agente para ver SQL MCP y filas de evidencia.',
        'Cambia el idioma con EN / ES en la cabecera.'
      ],
      guideTitle: 'Pantallas de un vistazo',
      screens: [
        {
          path: '/',
          title: 'Panel',
          body: 'Las estadísticas del catálogo (tamaño, géneros, ingresos recientes) cargan primero. El panel de greenlight se ejecuta en segundo plano y muestra tres recomendaciones fundamentadas con la línea de tiempo completa de 6 pasos.',
          cta: 'Abrir panel'
        },
        {
          path: '/catalog',
          title: 'Catálogo',
          body: 'Explora todos los títulos almacenados en ClickHouse. Filtra por título o género. Úsalo para verificar que las recomendaciones de greenlight existen en el catálogo.',
          cta: 'Ver catálogo'
        },
        {
          path: '/ingest',
          title: 'Ingresar',
          body: 'Añade un título nuevo: Gemini enriquece los metadatos y el agente persiste la fila mediante INSERT vía mcp-clickhouse.',
          cta: 'Ingresar un título'
        },
        {
          path: '/ask',
          title: 'Consultar catálogo',
          body: 'Haz preguntas en lenguaje natural. El agente clasifica la intención, descubre el esquema en vivo, genera SQL, ejecuta vía MCP, sintetiza la respuesta y audita la ejecución.',
          cta: 'Hacer una pregunta'
        }
      ],
      demoStoryLead:
        'El catálogo demo sembrado cuenta una historia: la comedia está en exceso, el thriller es escaso, True Crime: Highway 101 forma un par canibalizado y Crimen sin Fronteras: Bogotá es el breakout LATAM — todo visible en el panel con analítica medida en ClickHouse.',
      greenlightTitle: 'Cómo funciona el greenlight semanal',
      greenlightIntro:
        'El greenlight es un analista determinístico. Gemini redacta la narrativa; TypeScript elige los títulos.',
      greenlightSteps: [
        'Cuatro consultas SELECT fijas se ejecutan en paralelo: inventario por género, momentum por título, pares de canibalización y huecos de programación.',
        'Cada título se puntúa en TypeScript con una fórmula explícita (hueco de género + momentum WoW − penalización por canibalización).',
        'Se eligen los tres mejores candidatos con diversidad de género — como máximo un título por género.',
        'Gemini recibe solo esas filas candidatas y debe citar sus cifras. Los títulos alucinados se descartan.'
      ],
      formulaTitle: 'Fórmula de puntuación',
      formula:
        'oportunidad = 0,4×hueco_género + 0,4×momentum_wow − 0,2×penalización_canibalización (+ pequeño bonus por hueco de idioma)',
      stackTitle: 'Tecnología',
      stackItems: [
        'IA en runtime: @google/genai (Gemini) — solo intención, NL→SQL y síntesis',
        'Datos: ClickHouse vía mcp-clickhouse oficial (McpClickHouseConnector)',
        'Orquestación: AgentRunner propio con línea de tiempo visible de 6 pasos',
        'Sin LangChain, OpenAI, Anthropic ni Agent Builder'
      ],
      tipsTitle: 'Consejos',
      tips: [
        'Cambia el idioma con el botón EN / ES en la cabecera.',
        'En el panel, las estadísticas aparecen antes de que termine el greenlight — espera las tarjetas de recomendación o la línea de tiempo.',
        'En Consultar, expande la línea de tiempo para ver el SQL MCP y las filas de evidencia en cada paso.',
        'Tras sembrar la base demo, busca el breakout LATAM y el par de canibalización en la salida de greenlight.'
      ],
      troubleshootTitle: 'Solución de problemas',
      troubleshootColSymptom: 'Síntoma',
      troubleshootColFix: 'Qué hacer',
      troubleshoot: [
        { symptom: 'Panel vacío / error 503', fix: 'Espera a que la API muestre ready: true y recarga.' },
        { symptom: 'Greenlight sin tarjetas de recomendación', fix: 'Revisa la línea de tiempo del agente por errores MCP o timeout.' },
        { symptom: 'Falta GEMINI_API_KEY', fix: 'Añádela al .env y reinicia npm run dev.' }
      ]
    }
  }
} as const;

export type TranslationTree = typeof translations.en;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const value = getNested(translations[locale] as unknown as Record<string, unknown>, key);
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (text, [name, val]) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(val)),
    value
  );
}
