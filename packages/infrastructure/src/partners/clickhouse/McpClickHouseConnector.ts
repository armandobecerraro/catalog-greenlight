import {
  ConnectionConfig,
  QueryRequest,
  QueryResult,
  IMcpConnector
} from '@bas/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class McpClickHouseConnector implements IMcpConnector {
  readonly name = 'clickhouse-mcp';
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  async connect(config: ConnectionConfig): Promise<void> {
    const env = {
      CLICKHOUSE_HOST: config.credentials.host || 'localhost',
      CLICKHOUSE_PORT: String(config.credentials.port || 8123),
      CLICKHOUSE_USER: config.credentials.username || 'default',
      CLICKHOUSE_PASSWORD: config.credentials.password || '',
      CLICKHOUSE_SECURE: String(config.credentials.secure || 'false'),
      CLICKHOUSE_DATABASE: config.credentials.database || 'media_catalog',
      CLICKHOUSE_ALLOW_WRITE_ACCESS: config.credentials.allowWriteAccess || 'true',
      CLICKHOUSE_SEND_RECEIVE_TIMEOUT: process.env.CLICKHOUSE_SEND_RECEIVE_TIMEOUT || '90',
      ...process.env
    };

    this.transport = new StdioClientTransport({
      command: config.credentials.mcpCommand || 'uv',
      args: config.credentials.mcpArgs
        ? JSON.parse(config.credentials.mcpArgs)
        : ['run', '--with', 'mcp-clickhouse', '--python', '3.13', 'mcp-clickhouse'],
      env
    });

    this.client = new Client(
      { name: 'catalog-greenlight', version: '0.1.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  async query(request: QueryRequest): Promise<QueryResult> {
    return this.runQuery(request.query);
  }

  async runQuery(query: string): Promise<QueryResult> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP ClickHouse connector not connected');
    }

    const startTime = Date.now();
    const result = await this.client.callTool({
      name: 'run_query',
      arguments: { query }
    });

    const latencyMs = Date.now() - startTime;
    const rows = this.parseMcpResult(result.content);

    return {
      rows,
      metadata: {
        rowCount: rows.length,
        latencyMs,
        partner: 'clickhouse'
      }
    };
  }

  async listDatabases(): Promise<string[]> {
    const content = await this.callToolRaw('list_databases', {});
    const text = this.extractFirstText(content);
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    return [];
  }

  async listTables(database: string): Promise<string[]> {
    const content = await this.callToolRaw('list_tables', { database });
    const text = this.extractFirstText(content);
    const parsed = JSON.parse(text) as { tables?: Array<{ name: string }> };
    return (parsed.tables ?? []).map(t => t.name);
  }

  private extractFirstText(content: unknown): string {
    const blocks: unknown[] = Array.isArray(content) ? content : [content];
    for (const block of blocks) {
      if (block && typeof block === 'object' && 'text' in block) {
        const text = (block as { text: unknown }).text;
        if (typeof text === 'string') return text;
      }
    }
    throw new Error('MCP response missing text content');
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
    this.isConnected = false;
  }

  private async callToolRaw(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP ClickHouse connector not connected');
    }
    const result = await this.client.callTool({ name, arguments: arguments_ });
    return result.content;
  }

  parseMcpResult(content: unknown): Record<string, unknown>[] {
    if (!content) return [];

    const blocks: unknown[] = Array.isArray(content) ? content : [content];

    for (const block of blocks) {
      if (block && typeof block === 'object' && 'text' in block) {
        const textContent = (block as { text: unknown }).text;
        if (typeof textContent === 'string') {
          return this.parseJsonText(textContent);
        }
      }
      if (typeof block === 'string') {
        return this.parseJsonText(block);
      }
      if (block && typeof block === 'object') {
        return [block as Record<string, unknown>];
      }
    }

    return [];
  }

  private parseJsonText(textContent: string): Record<string, unknown>[] {
    const trimmed = textContent.trim();
    if (isMcpErrorText(trimmed)) {
      throw new Error(trimmed);
    }

    try {
      const parsed = JSON.parse(textContent);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.rows) &&
        Array.isArray(parsed.columns)
      ) {
        return parsed.rows.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          parsed.columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
          });
          return obj;
        });
      }
      if (Array.isArray(parsed)) {
        return parsed.map(item =>
          typeof item === 'string' ? ({ name: item } as Record<string, unknown>) : (item as Record<string, unknown>)
        );
      }
      if (parsed && typeof parsed === 'object') return [parsed as Record<string, unknown>];
      return [{ text: textContent }];
    } catch {
      return [{ text: textContent }];
    }
  }
}

export function isMcpErrorText(text: string): boolean {
  return /timed out|query timed out|exception:|code:\s*\d+/i.test(text);
}
