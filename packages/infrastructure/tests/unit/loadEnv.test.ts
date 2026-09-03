import { loadRepoEnv, findRepoEnvPath } from '../../src/loadEnv';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('loadEnv', () => {
  it('finds a .env walking up from a nested dir', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-env-'));
    fs.writeFileSync(path.join(root, '.env'), 'FOO=1\n');
    const nested = path.join(root, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    expect(findRepoEnvPath(nested)).toBe(path.join(root, '.env'));
    loadRepoEnv();
  });

  it('returns undefined when no .env exists nearby', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-noenv-'));
    expect(findRepoEnvPath(root)).toBeUndefined();
  });
});
