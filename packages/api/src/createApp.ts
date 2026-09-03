import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { requireApiKey } from './middleware/auth';
import { createRequireReady } from './middleware/ready';
import { errorHandler } from './middleware/errorHandler';
import { GreenlightCache } from './greenlightCache';
import { ApiRuntime } from './runtime';

export function forwardSendFileError(err: Error | undefined, next: NextFunction): void {
  if (err) next(err);
}

export function createApp(runtime: ApiRuntime): express.Express {
  const app = express();
  const apiAuth = runtime.apiKeyRequired ? requireApiKey : (_req: Request, _res: Response, next: NextFunction) => next();
  const requireReady = createRequireReady(
    () => runtime.isReady(),
    () => runtime.initError()
  );
  const greenlightCache = new GreenlightCache({
    runGreenlight: () => runtime.agentRunner.runGreenlight()
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  app.post('/api/v1/media/ingest', apiAuth, requireReady, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await runtime.ingestionUseCase.execute(req.body);
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
      const result = await runtime.agentRunner.run(question.trim());
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/greenlight', apiAuth, requireReady, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bypass = greenlightCache.shouldBypass(req.query.refresh, req.get('Cache-Control'));
      const cached = !bypass ? greenlightCache.peek() : null;
      if (cached) {
        res.json({ ...cached.result, cached: true });
        return;
      }
      const result = await greenlightCache.get(bypass);
      res.json({ ...result, cached: false });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/catalog', apiAuth, requireReady, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const catalog = await runtime.catalogQueries.getCatalog();
      res.json({ entries: catalog, count: catalog.length });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/catalog/stats', apiAuth, requireReady, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await runtime.catalogQueries.getCatalogStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json(runtime.health());
  });

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  const webDist = path.join(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'), err => {
      forwardSendFileError(err, next);
    });
  });

  app.use(errorHandler);
  return app;
}
