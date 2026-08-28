# Guía de uso — Catalog Greenlight

**Agentic Cinema Hackathon · track ClickHouse**

---

## ¿Qué es?

**Catalog Greenlight** es una aplicación web para un **jefe de programación** de un estudio de streaming (catálogo LATAM/US). Cada semana necesita decidir **qué tres títulos impulsar** en la parrilla.

La app no “adivina” con un solo prompt: **mide** en ClickHouse los huecos de género, el momentum de ingresos semana a semana y la canibalización entre títulos similares. Luego Gemini **redacta** la recomendación citando cifras reales.

---

## ¿Para qué sirve?

| Necesidad | Cómo lo resuelve la app |
|-----------|-------------------------|
| Ver el estado del catálogo | Panel con tamaño, géneros e ingresos recientes (vía MCP) |
| Elegir 3 títulos para la semana | Greenlight determinístico + narrativa Gemini |
| Explorar títulos existentes | Catálogo filtrable |
| Añadir un título nuevo | Ingesta con enriquecimiento Gemini + INSERT MCP |
| Preguntas en lenguaje natural | Consultar catálogo (NL → SQL → evidencia) |

---

## Requisitos

- Node.js 20+
- `GEMINI_API_KEY` en `.env`
- ClickHouse (Cloud o Docker local)
- `uv` para el servidor MCP `mcp-clickhouse`

```bash
cp .env.example .env
# Editar GEMINI_API_KEY y credenciales ClickHouse
npm install
npm run dev
```

| URL | Qué es |
|-----|--------|
| http://localhost:5173 | Interfaz web |
| http://localhost:8080/api/v1/health | Estado de la API |

---

## Pantallas — paso a paso

### 1. Panel (`/`)

1. Abre la app en el navegador.
2. Las **estadísticas** cargan primero (tamaño del catálogo, géneros, ingresos 7 d).
3. El bloque **Greenlight de la semana** se carga en segundo plano (4 consultas MCP + 1 llamada Gemini).
4. Revisa las **3 tarjetas** de recomendación y la **línea de tiempo** de 6 pasos con SQL y filas.

**Qué buscar en la demo sembrada:** breakout LATAM (*Crimen sin Fronteras: Bogotá*), hueco en Thriller, rechazo del par canibal *True Crime: Highway 101*.

### 2. Catálogo (`/catalog`)

- Lista todos los títulos en ClickHouse.
- Usa el filtro por título o género.
- Verifica que los títulos del greenlight **existen** en esta tabla.

### 3. Ingresar (`/ingest`)

1. Completa título, descripción, género, fecha y reparto.
2. Pulsa **Ingresar vía pipeline del agente**.
3. Gemini enriquece metadatos; el agente hace `INSERT` vía MCP.
4. Confirma en **Catálogo** que el título apareció.

### 4. Consultar catálogo (`/ask`)

1. Escribe una pregunta o elige una sugerencia.
2. Pulsa **Ejecutar agente**.
3. Revisa: respuesta, SQL ejecutado, filas de evidencia y timeline de 6 pasos.

Ejemplos útiles:

- *¿Qué género está infra-representado en nuestro catálogo?*
- *¿Qué títulos tuvieron los mayores ingresos la semana pasada?*

### 5. Guía de uso (`/about`)

Documentación integrada en la app (inglés/español con el botón **EN / ES**).

---

## Cómo funciona el greenlight

1. **DISCOVER** — 4 `SELECT` en paralelo (inventario, momentum, canibalización, huecos).
2. **PLAN_SQL** — Scorer en TypeScript (no Gemini):
   ```
   oportunidad = 0,4×hueco_género + 0,4×momentum_wow − 0,2×penalización_canibalización
   ```
3. Se eligen **3 títulos** con diversidad de género (máx. 1 por género).
4. **SYNTHESIZE** — Gemini escribe justificaciones **solo** sobre esos candidatos.
5. Títulos que no estén en los datos se descartan automáticamente.

---

## Idioma de la interfaz

En la cabecera, botón **EN / ES**. La preferencia se guarda en el navegador.

---

## Sembrar datos de demo

```bash
# Docker local (~200 títulos, historia demo)
bash deployment/scripts/seed.sh

# ClickHouse Cloud
bash deployment/scripts/seed-remote.sh
```

Regenerar SQL: `node deployment/scripts/generate-seed-catalog.mjs`

---

## Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| Panel vacío / error 503 | Esperar a que `/api/v1/health` muestre `ready: true` |
| Greenlight sin tarjetas | Revisar timeline; puede haber timeout o error MCP |
| Sin `GEMINI_API_KEY` | Añadirla a `.env` y reiniciar `npm run dev` |
| Puerto 8080 ocupado | `lsof -ti :8080 \| xargs kill -9` y volver a arrancar |

---

## Más documentación

- [README.md](../README.md) — instalación y arquitectura técnica
- [docs/architecture.md](./architecture.md) — diagramas y flujos
- Interfaz: **Guía de uso** en el menú → `/about`
