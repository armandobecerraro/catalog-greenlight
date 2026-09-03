import { IMcpConnector, escapeSqlLiteral } from '@bas/core';

const SCHEMA_TTL_MS = 5 * 60 * 1000;

let cachedSchema: { text: string; expiresAt: number } | null = null;

export function clearSchemaCache(): void {
  cachedSchema = null;
}

export async function discoverLiveSchema(mcp: IMcpConnector): Promise<string> {
  const now = Date.now();
  if (cachedSchema && now < cachedSchema.expiresAt) {
    return cachedSchema.text;
  }

  const parts: string[] = [];
  const databases = await mcp.listDatabases();
  parts.push(`Databases: ${databases.join(', ')}`);

  if (databases.includes('media_catalog')) {
    const tables = await mcp.listTables('media_catalog');
    parts.push(`Tables in media_catalog: ${tables.join(', ')}`);

    for (const table of tables) {
      const colResult = await mcp.runQuery(`
        SELECT name, type
        FROM system.columns
        WHERE database = 'media_catalog' AND table = '${escapeSqlLiteral(table)}'
        ORDER BY position
      `);
      const cols = colResult.rows
        .map(r => `${String(r.name)} ${String(r.type)}`)
        .join(', ');
      parts.push(`media_catalog.${table}(${cols})`);
    }
  }

  const text = parts.join('\n');
  cachedSchema = { text, expiresAt: now + SCHEMA_TTL_MS };
  return text;
}
