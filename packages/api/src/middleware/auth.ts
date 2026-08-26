import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
