import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.API_KEY?.trim();
  const apiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
  if (!expected || !apiKey || apiKey !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
