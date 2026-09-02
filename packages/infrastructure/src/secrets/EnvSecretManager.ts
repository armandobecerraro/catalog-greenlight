import { ISecretManager } from '@bas/core';

export class EnvSecretManager implements ISecretManager {
  readClickHouse(): Record<string, string> {
    return {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: process.env.CLICKHOUSE_PORT || '8123',
      username: process.env.CLICKHOUSE_USER || process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'media_catalog',
      secure: process.env.CLICKHOUSE_SECURE || 'false',
      allowWriteAccess: process.env.CLICKHOUSE_ALLOW_WRITE_ACCESS || 'true',
      mcpCommand: process.env.MCP_COMMAND || 'uv',
      mcpArgs:
        process.env.MCP_ARGS ||
        JSON.stringify(['run', '--with', 'mcp-clickhouse', '--python', '3.13', 'mcp-clickhouse'])
    };
  }

  async getSecret(secretRef: string): Promise<Record<string, string>> {
    const normalized = secretRef.trim().toLowerCase();
    if (normalized === 'local-dev' || normalized === 'clickhouse' || normalized === 'clickhouse-mcp') {
      return this.readClickHouse();
    }
    throw new Error(`Unknown secretRef: ${secretRef}`);
  }
}
