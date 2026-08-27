/**
 * Load repo-root `.env` before any other app imports read process.env.
 * Safe for MCP_ARGS JSON (dotenv does not use shell source).
 */
import dotenv from 'dotenv';
import path from 'path';

const repoRootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: repoRootEnv });
