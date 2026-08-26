import { IConnector, ConnectionConfig, QueryRequest, QueryResult, StreamRequest, StreamChunk } from '@bas/core';
import { createClient, ClickHouseClient } from '@clickhouse/client';

export class ClickHouseConnector implements IConnector {
  readonly name = 'clickhouse';
  private client: ClickHouseClient | null = null;

  async connect(config: ConnectionConfig): Promise<void> {
    const { host, username, password, database } = config.credentials;
    this.client = createClient({
      url: host || 'http://localhost:8123',
      username: username || 'default',
      password: password || '',
      database: database || 'default'
    });
    await this.client.ping();
  }

  async query(request: QueryRequest): Promise<QueryResult> {
    if (!this.client) throw new Error('ClickHouse not connected');

    const startTime = Date.now();
    const resultSet = await this.client.query({
      query: request.query,
      format: 'JSONEachRow'
    });

    const rows = (await resultSet.json()) as Record<string, unknown>[];
    const latencyMs = Date.now() - startTime;

    return {
      rows: Array.isArray(rows) ? rows : [rows],
      metadata: {
        rowCount: Array.isArray(rows) ? rows.length : 1,
        latencyMs,
        partner: 'clickhouse'
      }
    };
  }

  async *stream(request: StreamRequest): AsyncIterable<StreamChunk> {
    if (!this.client) throw new Error('ClickHouse not connected');

    const resultSet = await this.client.query({
      query: request.query,
      format: 'JSONEachRow'
    });

    for await (const rows of resultSet.stream()) {
      yield {
        data: Array.isArray(rows) ? rows as unknown as Record<string, unknown>[] : [rows as unknown as Record<string, unknown>],
        isLast: false,
        latencyMs: 0
      };
    }

    yield {
      data: [],
      isLast: true,
      latencyMs: 0
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
