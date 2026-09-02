import './loadEnv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import {
  ContentIngestionUseCase,
  MediaIngestionService,
  InsightEngineService,
  IMcpConnector,
  DomainError
} from '@bas/core';
import {
  ConnectorFactory,
  buildClickHouseConfig
} from '@bas/infrastructure';
import { AgentRunner } from '@bas/orchestration';
import { requireApiKey } from './middleware/auth';

const app = express();

/** Optional gate: only enforced when API_KEY is set (hackathon hosted stays public by default). */
const apiAuth: typeof requireApiKey =
  process.env.API_KEY?.trim() ? requireApiKey : (_req, _res, next) => next();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

let ingestionUseCase: ContentIngestionUseCase | null = null;
let insightEngineService: InsightEngineService | null = null;
let agentRunner: AgentRunner | null = null;
let mcpConnector: IMcpConnector | null = null;
let initError: string | null = null;

const GREENLIGHT_CACHE_TTL_MS = 10 * 60_000;
let greenlightCache: { result: Awaited<ReturnType<AgentRunner['run']>>; expiresAt: number } | null = null;
let greenlightInFlight: Promise<Awaited<ReturnType<AgentRunner['run']>>> | null = null;

function shouldBypassGreenlightCache(req: Request): boolean {
  const refresh = req.query.refresh;
  if (refresh === '1' || refresh === 'true') return true;
  const cacheControl = req.get('Cache-Control');
  return cacheControl === 'no-cache' || cacheControl === 'no-store';
}

async function runGreenlightAgent(bypassCache = false): Promise<Awaited<ReturnType<AgentRunner['run']>>> {
  const now = Date.now();
  if (!bypassCache && greenlightCache && now < greenlightCache.expiresAt) {
    return greenlightCache.result;
  }
  if (!bypassCache && greenlightInFlight) {
    return greenlightInFlight;
  }

  const agentPromise = agentRunner!.runGreenlight().then(result => {
    greenlightCache = { result, expiresAt: Date.now() + GREENLIGHT_CACHE_TTL_MS };
    return result;
  });

  if (!bypassCache) {
    greenlightInFlight = agentPromise.finally(() => {
      greenlightInFlight = null;
    });
    return greenlightInFlight;
  }

  return agentPromise;
}

async function init() {
  const connectorFactory = new ConnectorFactory();
  const connector = await connectorFactory.create('clickhouse', buildClickHouseConfig());
  mcpConnector = connector as IMcpConnector;

  const geminiEnrichment = connectorFactory.createGeminiClient();
  const geminiReasoning = connectorFactory.createGeminiReasoningClient();

  const ingestionService = new MediaIngestionService(mcpConnector, geminiEnrichment);
  ingestionUseCase = new ContentIngestionUseCase(ingestionService);
  insightEngineService = new InsightEngineService(mcpConnector, geminiEnrichment);
  agentRunner = new AgentRunner(mcpConnector, geminiReasoning, geminiReasoning.modelName);
  initError = null;
}

function requireReady(_req: Request, res: Response, next: NextFunction) {
  if (!ingestionUseCase || !insightEngineService || !agentRunner) {
    res.status(503).json({
      error: initError || 'API is still initializing. Retry in a few seconds.'
    });
    return;
  }
  next();
}

interface IngestRequest {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
}

app.post('/api/v1/media/ingest', apiAuth, requireReady, async (req: Request<{}, {}, IngestRequest>, res: Response, next: NextFunction) => {
  try {
    const result = await ingestionUseCase!.execute(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/agent/ask', apiAuth, requireReady, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body as { question?: string };
    if (!question?.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    const result = await agentRunner!.run(question.trim());
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/greenlight', apiAuth, requireReady, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bypass = shouldBypassGreenlightCache(req);
    if (!bypass && greenlightCache && Date.now() < greenlightCache.expiresAt) {
      res.json({ ...greenlightCache.result, cached: true });
      return;
    }
    const result = await runGreenlightAgent(bypass);
    res.json({ ...result, cached: false });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog', apiAuth, requireReady, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const catalog = await insightEngineService!.getCatalog();
    res.json({ entries: catalog, count: catalog.length });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog/stats', apiAuth, requireReady, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await insightEngineService!.getCatalogStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: initError ? 'degraded' : ingestionUseCase ? 'ok' : 'starting',
    product: 'Catalog Greenlight',
    ready: Boolean(ingestionUseCase && insightEngineService && agentRunner && !initError),
    error: initError,
    timestamp: new Date().toISOString()
  });
});

app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const webDist = path.join(__dirname, '../../web/dist');
app.use(express.static(webDist));
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(webDist, 'index.html'), err => {
    if (err) next();
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (err instanceof DomainError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8080;

async function startup(): Promise<void> {
  app.listen(PORT, () => {
    console.log(`Catalog Greenlight API listening on port ${PORT} (initializing MCP + Gemini...)`);
  });

  try {
    await init();
    console.log('Catalog Greenlight API ready — ClickHouse MCP + Gemini connected');
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize API (health still up):', initError);
  }
}

startup();

export { app };
