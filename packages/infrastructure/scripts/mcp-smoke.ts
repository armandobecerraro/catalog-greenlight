/**
 * MCP-only runtime smoke test (no Gemini required).
 * Verifies mcp-clickhouse run_query against local ClickHouse.
 *
 * Usage: npm run smoke:mcp --workspace=@bas/infrastructure
 * Loads repo-root `.env` automatically (same as check:credentials).
 */
import { loadRepoEnv } from '../src/loadEnv';
import { McpClickHouseConnector } from '../src/partners/clickhouse/McpClickHouseConnector';
import { buildClickHouseConfig } from '../src/partners/ConnectorFactory';

loadRepoEnv();

async function main(): Promise<void> {
  const connector = new McpClickHouseConnector();
  const config = buildClickHouseConfig();

  console.log('Connecting MCP ClickHouse...');
  await connector.connect(config);

  const dbs = await connector.listDatabases();
  console.log('list_databases:', dbs);

  const tables = await connector.listTables('media_catalog');
  console.log('list_tables(media_catalog):', tables);

  const result = await connector.runQuery(
    'SELECT count() AS titles FROM media_catalog.media_content'
  );
  console.log('run_query result:', result.rows);
  console.log('latency_ms:', result.metadata.latencyMs);

  await connector.disconnect();
  console.log('MCP smoke test PASSED');
}

main().catch(err => {
  console.error('MCP smoke test FAILED:', err);
  process.exit(1);
});
