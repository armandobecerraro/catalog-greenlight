import './loadEnv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import {
  ContentIngestionUseCase,
  MediaIngestionService,
  InsightEngineService,
  IMcpConnector
} from '@bas/core';
import {
  ConnectorFactory,
  buildClickHouseConfig
} from '@bas/infrastructure';
import { AgentRunner } from '@bas/orchestration';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

let ingestionUseCase: ContentIngestionUseCase | null = null;
let insightEngineService: InsightEngineService | null = null;
let agentRunner: AgentRunner | null = null;
let mcpConnector: IMcpConnector | null = null;
let initError: string | null = null;

const GREENLIGHT_CACHE_TTL_MS = 60_000;
const GREENLIGHT_TIMEOUT_MS = 240_000;
let greenlightCache: { result: Awaited<ReturnType<AgentRunner['run']>>; expiresAt: number } | null = null;
let greenlightInFlight: Promise<Awaited<ReturnType<AgentRunner['run']>>> | null = null;
/** Bumped on timeout so stale in-flight runs never update cache. */
let greenlightRunGeneration = 0;

function withGreenlightTimeout<T>(promise: Promise<T>, generation: number, onTimeout: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(
        new Error(
          `Greenlight agent timed out after ${GREENLIGHT_TIMEOUT_MS / 1000}s. Retry — Gemini + ClickHouse Cloud can take 1–2 minutes.`
        )
      );
    }, GREENLIGHT_TIMEOUT_MS);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function runGreenlightAgent(): Promise<Awaited<ReturnType<AgentRunner['run']>>> {
  const now = Date.now();
  if (greenlightCache && now < greenlightCache.expiresAt) {
    return greenlightCache.result;
  }
  if (greenlightInFlight) {
    return greenlightInFlight;
  }

  const generation = ++greenlightRunGeneration;

  const agentPromise = agentRunner!.run(
    'Recommend exactly 3 titles to greenlight and push this week. Consider genre gaps, recent revenue, and cannibalization risk. Cite data.',
    { defaultIntent: 'greenlight' }
  ).then(result => {
    if (generation !== greenlightRunGeneration) {
      throw new Error('Greenlight run superseded (timeout or newer request)');
    }
    greenlightCache = { result, expiresAt: Date.now() + GREENLIGHT_CACHE_TTL_MS };
    return result;
  });

  greenlightInFlight = withGreenlightTimeout(agentPromise, generation, () => {
    if (generation === greenlightRunGeneration) {
      greenlightRunGeneration++;
    }
  }).finally(() => {
    greenlightInFlight = null;
  });

  return greenlightInFlight;
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

app.post('/api/v1/media/ingest', requireReady, async (req: Request<{}, {}, IngestRequest>, res: Response, next: NextFunction) => {
  try {
    const result = await ingestionUseCase!.execute(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/agent/ask', requireReady, async (req: Request, res: Response, next: NextFunction) => {
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

app.get('/api/v1/greenlight', requireReady, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = Date.now();
    if (greenlightCache && now < greenlightCache.expiresAt) {
      res.json({ ...greenlightCache.result, cached: true });
      return;
    }
    const result = await runGreenlightAgent();
    res.json({ ...result, cached: greenlightCache && now < greenlightCache.expiresAt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog', requireReady, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const catalog = await insightEngineService!.getCatalog();
    res.json({ entries: catalog, count: catalog.length });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog/stats', requireReady, async (_req: Request, res: Response, next: NextFunction) => {
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
    ready: Boolean(ingestionUseCase && !initError),
    error: initError,
    timestamp: new Date().toISOString()
  });
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
