import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Walk up from startDir until a `.env` file is found (repo root).
 * Works from infrastructure `src/` (ts-node) and `dist/` (compiled).
 */
export function findRepoEnvPath(startDir = __dirname): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Load repo-root `.env` into process.env (no-op if missing). */
export function loadRepoEnv(): void {
  const envPath = findRepoEnvPath();
  if (envPath) {
    dotenv.config({ path: envPath });
  }
}
