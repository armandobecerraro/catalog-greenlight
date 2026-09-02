import { McpAgentAuditAdapter } from '../../src/catalog/McpAgentAuditAdapter';
import { McpCatalogRepository, parseCast } from '../../src/catalog/McpCatalogRepository';
import { EnvSecretManager } from '../../src/secrets/EnvSecretManager';
import { ConnectorFactory, buildClickHouseConfig } from '../../src/partners/ConnectorFactory';
import { IMcpConnector, MediaContent, MediaEnrichment } from '@bas/core';

function mockMcp(): jest.Mocked<IMcpConnector> {
  return {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    listDatabases: jest.fn(),
    listTables: jest.fn(),
    runQuery: jest.fn()
  };
}

describe('McpAgentAuditAdapter', () => {
  it('escapes quotes in INSERT literals', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockResolvedValue({ rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } });
    const adapter = new McpAgentAuditAdapter(mcp);
    await adapter.record({
      id: 'run-1',
      userPrompt: "it's weekly",
      intent: 'greenlight',
      sqlExecuted: 'SELECT 1',
      latencyMs: 10,
      model: "gemini'--",
      responseSummary: 'ok'
    });
    const sql = String(mcp.runQuery.mock.calls[0][0]);
    expect(sql).toContain("'gemini''--'");
    expect(sql).toContain("'it''s weekly'");
  });

  it('coerces missing latency to 0', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockResolvedValue({ rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } });
    await new McpAgentAuditAdapter(mcp).record({
      id: 'run-1',
      userPrompt: 'p',
      intent: 'greenlight',
      sqlExecuted: 'SELECT 1',
      latencyMs: Number.NaN,
      model: 'm',
      responseSummary: 'ok'
    });
    expect(String(mcp.runQuery.mock.calls[0][0])).toMatch(/,\s*0,/);
  });
});

describe('parseCast', () => {
  it('parses arrays, json strings, and garbage', () => {
    expect(parseCast(['A'])).toEqual(['A']);
    expect(parseCast('["B"]')).toEqual(['B']);
    expect(parseCast('not-json')).toEqual([]);
    expect(parseCast(null)).toEqual([]);
  });
});

describe('McpCatalogRepository', () => {
  it('inserts escaped content', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockResolvedValue({ rows: [], metadata: { rowCount: 1, latencyMs: 3, partner: 'clickhouse' } });
    const repo = new McpCatalogRepository(mcp);
    const content = MediaContent.create("O'Brien", 'A film description', 'Drama', '2020-01-01', ["D'Arcy"]);
    const result = await repo.insert(content);
    expect(result.storedRows).toBe(1);
    expect(String(mcp.runQuery.mock.calls[0][0])).toContain("O''Brien");

    content.applyEnrichment(MediaEnrichment.create('Sum', ['t'], 'positive'));
    await repo.insert(content);
    expect(String(mcp.runQuery.mock.calls[1][0])).toContain('Sum');
  });

  it('maps list and stats rows', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('ORDER BY if(title LIKE')) {
        return {
          rows: [
            {
              id: '1',
              title: 'T',
              description: 'D',
              genre: 'Drama',
              release_date: '2020-01-01',
              cast: ['A'],
              enrichment: null
            }
          ],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('GROUP BY genre')) {
        return {
          rows: [{ genre: 'Drama', count: 2 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('INTERVAL 30 DAY')) {
        return { rows: [{ recent: 2 }], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('arrayJoin')) {
        return {
          rows: [{ name: 'Actor A', count: 2 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('title_revenue')) {
        return {
          rows: [{ total_views: 10, total_revenue: 20, top_title: 'T' }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('count() AS cnt')) {
        return { rows: [{ genre: 'Drama', cnt: 2 }], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      return {
        rows: [{ title: 'T', genre: 'Drama', release_date: '2020-01-01' }],
        metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
      };
    });
    const repo = new McpCatalogRepository(mcp);
    const list = await repo.list(10);
    expect(list[0].title).toBe('T');
    const stats = await repo.stats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.latestRevenue?.topTitle).toBe('T');
    const dist = await repo.genreDistribution();
    expect(dist[0].genre).toBe('Drama');
    const similar = await repo.similarTitles('Drama', 3);
    expect(similar[0].title).toBe('T');
  });

  it('uses default limits and empty revenue/enrichment fallbacks', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('ORDER BY if(title LIKE')) {
        return {
          rows: [
            {
              id: '1',
              title: 'T',
              description: 'D',
              genre: 'Drama',
              release_date: '2020-01-01',
              cast: '["A"]',
              enrichment: ''
            }
          ],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('title_revenue')) {
        return {
          rows: [{ total_views: undefined, total_revenue: undefined, top_title: undefined }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('GROUP BY genre')) {
        return { rows: [{ genre: 'Drama', count: 1 }], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INTERVAL')) {
        return { rows: [{}], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('arrayJoin')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const repo = new McpCatalogRepository(mcp);
    const listed = await repo.list();
    expect(listed[0].enrichment).toBeNull();
    expect(String(mcp.runQuery.mock.calls[0][0])).toContain('LIMIT 500');
    await repo.list(0);
    expect(String(mcp.runQuery.mock.calls[1][0])).toContain('LIMIT 500');
    const stats = await repo.stats();
    expect(stats.latestRevenue?.topTitle).toBe('N/A');
    await repo.similarTitles('Drama', 0);
    expect(String(mcp.runQuery.mock.calls.at(-1)?.[0])).toContain('LIMIT 5');
  });

  it('omits revenue when the query fails', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('title_revenue')) throw new Error('missing table');
      if (sql.includes('GROUP BY genre')) {
        return { rows: [{ genre: 'Comedy', count: 1 }], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INTERVAL')) {
        return { rows: [{ recent: 0 }], metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('arrayJoin')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const stats = await new McpCatalogRepository(mcp).stats();
    expect(stats.latestRevenue).toBeUndefined();
    expect(stats.totalEntries).toBe(1);
  });

  it('omits latestRevenue when the revenue query returns no rows', async () => {
    const mcp = mockMcp();
    mcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('title_revenue')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('GROUP BY genre')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INTERVAL')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('arrayJoin')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const stats = await new McpCatalogRepository(mcp).stats();
    expect(stats.latestRevenue).toBeUndefined();
    expect(stats.recentAdditions).toBe(0);
    expect(stats.totalEntries).toBe(0);
  });
});

describe('EnvSecretManager', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('reads clickhouse env defaults', async () => {
    process.env = { ...original, CLICKHOUSE_HOST: 'example.clickhouse.cloud' };
    const secrets = new EnvSecretManager();
    const snap = secrets.readClickHouse();
    expect(snap.host).toBe('example.clickhouse.cloud');
    await expect(secrets.getSecret('clickhouse')).resolves.toMatchObject({ host: 'example.clickhouse.cloud' });
    await expect(secrets.getSecret('local-dev')).resolves.toMatchObject({ host: 'example.clickhouse.cloud' });
    await expect(secrets.getSecret('unknown')).rejects.toThrow(/Unknown secretRef/);
  });

  it('reads username alias, mcp args, and clickhouse-mcp secretRef', async () => {
    process.env = {
      ...original,
      CLICKHOUSE_USERNAME: 'cloud-user',
      MCP_ARGS: JSON.stringify(['mcp-clickhouse']),
      MCP_COMMAND: 'uvx'
    };
    delete process.env.CLICKHOUSE_USER;
    const secrets = new EnvSecretManager();
    const snap = secrets.readClickHouse();
    expect(snap.username).toBe('cloud-user');
    expect(snap.mcpCommand).toBe('uvx');
    expect(JSON.parse(snap.mcpArgs)).toEqual(['mcp-clickhouse']);
    await expect(secrets.getSecret('clickhouse-mcp')).resolves.toMatchObject({ username: 'cloud-user' });
  });
});

describe('ConnectorFactory', () => {
  afterEach(() => {
    ConnectorFactory.resetForTests();
  });

  it('rejects unknown partners', async () => {
    const factory = new ConnectorFactory();
    await expect(
      factory.create('ibm', { partner: 'ibm', credentials: { host: 'x' } })
    ).rejects.toThrow(/Unknown partner/);
  });

  it('registers additional partners without editing the switch', async () => {
    class FakeConnector {
      readonly name = 'ibm';
      connect = jest.fn().mockResolvedValue(undefined);
      query = jest.fn();
      disconnect = jest.fn();
    }
    const factory = new ConnectorFactory();
    factory.register('ibm', FakeConnector as never);
    const connector = await factory.create('ibm', { partner: 'ibm', credentials: { host: 'x' } });
    expect(connector.name).toBe('ibm');
    expect(connector.connect).toHaveBeenCalled();

    const again = await factory.create('ibm', { partner: 'ibm', credentials: { host: 'x' } });
    expect(again).toBe(connector);
    expect(connector.connect).toHaveBeenCalledTimes(2);
  });

  it('loads credentials from the secret manager when none are provided', async () => {
    class FakeConnector {
      readonly name = 'grafana';
      connect = jest.fn().mockResolvedValue(undefined);
      query = jest.fn();
      disconnect = jest.fn();
    }
    const secrets = {
      getSecret: jest.fn().mockResolvedValue({ host: 'from-secret' })
    };
    const factory = new ConnectorFactory(secrets);
    factory.register('grafana', FakeConnector as never);
    await factory.create('grafana', { partner: 'grafana', credentials: {}, secretRef: 'local-dev' });
    expect(secrets.getSecret).toHaveBeenCalledWith('local-dev');
  });

  it('uses the partner name as secretRef when credentials are empty', async () => {
    class FakeConnector {
      readonly name = 'grafana';
      connect = jest.fn().mockResolvedValue(undefined);
      query = jest.fn();
      disconnect = jest.fn();
    }
    const secrets = { getSecret: jest.fn().mockResolvedValue({ host: 'h' }) };
    const factory = new ConnectorFactory(secrets);
    factory.register('grafana', FakeConnector as never);
    await factory.create('grafana', { partner: 'grafana', credentials: {} });
    expect(secrets.getSecret).toHaveBeenCalledWith('grafana');
  });

  it('loads secrets when credentials are omitted', async () => {
    class FakeConnector {
      readonly name = 'grafana';
      connect = jest.fn().mockResolvedValue(undefined);
      query = jest.fn();
      disconnect = jest.fn();
    }
    const secrets = { getSecret: jest.fn().mockResolvedValue({ host: 'h' }) };
    const factory = new ConnectorFactory(secrets);
    factory.register('grafana', FakeConnector as never);
    await factory.create('grafana', { partner: 'grafana', credentials: undefined as never, secretRef: 'local-dev' });
    expect(secrets.getSecret).toHaveBeenCalledWith('local-dev');
  });

  it('builds clickhouse config from secrets', () => {
    const config = buildClickHouseConfig();
    expect(config.partner).toBe('clickhouse');
    expect(config.credentials.host).toBeDefined();
  });
});
