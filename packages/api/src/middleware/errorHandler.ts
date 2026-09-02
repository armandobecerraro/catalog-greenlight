import { Request, Response, NextFunction } from 'express';
import { DomainError } from '@bas/core';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  if (err instanceof DomainError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  const text = err.message || '';
  if (/429|RESOURCE_EXHAUSTED|prepayment|quota|credits exhausted|rate.?limit/i.test(text)) {
    res.status(429).json({ error: text, code: 'gemini_billing' });
    return;
  }
  res.status(500).json({ error: text || 'Internal server error' });
}
