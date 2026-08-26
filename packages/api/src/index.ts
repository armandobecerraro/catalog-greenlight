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

let ingestionUseCase: ContentIngestionUseCase;
let insightEngineService: InsightEngineService;
let agentRunner: AgentRunner;
let mcpConnector: IMcpConnector;

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
}

interface IngestRequest {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
}

app.post('/api/v1/media/ingest', async (req: Request<{}, {}, IngestRequest>, res: Response, next: NextFunction) => {
  try {
    const result = await ingestionUseCase.execute(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/agent/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body as { question?: string };
    if (!question?.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    const result = await agentRunner.run(question.trim());
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/greenlight', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentRunner.run(
      'Recommend exactly 3 titles to greenlight and push this week. Consider genre gaps, recent revenue, and cannibalization risk. Cite data.',
      { defaultIntent: 'greenlight' }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const catalog = await insightEngineService.getCatalog();
    res.json({ entries: catalog, count: catalog.length });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/catalog/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await insightEngineService.getCatalogStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    product: 'Catalog Greenlight',
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
  await init();
  app.listen(PORT, () => {
    console.log(`Catalog Greenlight API running on port ${PORT}`);
  });
}

startup().catch(error => {
  console.error('Failed to initialize API:', error);
  process.exit(1);
});

export { app };
