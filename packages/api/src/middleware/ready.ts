import { Request, Response, NextFunction } from 'express';

export function createRequireReady(isReady: () => boolean, errorMessage: () => string | null) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!isReady()) {
      res.status(503).json({
        error: errorMessage() || 'API is still initializing. Retry in a few seconds.'
      });
      return;
    }
    next();
  };
}
