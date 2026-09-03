import { discoverLiveSchema, clearSchemaCache } from '../../src/agents/SchemaCache';
import { IMcpConnector } from '@bas/core';

describe('SchemaCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  const mockMcp: jest.Mocked<IMcpConnector> = {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    listDatabases: jest.fn(),
    listTables: jest.fn(),
    runQuery: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSchemaCache();
    mockMcp.listDatabases.mockResolvedValue(['media_catalog']);
    mockMcp.listTables.mockResolvedValue(['media_content']);
    mockMcp.runQuery.mockResolvedValue({
      rows: [{ name: 'id', type: 'UUID' }],
      metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
    });
  });

  it('discovers live schema and caches it', async () => {
    const first = await discoverLiveSchema(mockMcp);
    const second = await discoverLiveSchema(mockMcp);
    expect(first).toContain('media_catalog');
    expect(first).toBe(second);
    expect(mockMcp.listDatabases).toHaveBeenCalledTimes(1);
  });

  it('returns databases without catalog tables when media_catalog is missing', async () => {
    mockMcp.listDatabases.mockResolvedValue(['default']);
    const text = await discoverLiveSchema(mockMcp);
    expect(text).toContain('default');
    expect(mockMcp.listTables).not.toHaveBeenCalled();
  });

  it('refreshes after the schema TTL expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await discoverLiveSchema(mockMcp);
    jest.setSystemTime(new Date('2026-01-01T00:05:01Z'));
    await discoverLiveSchema(mockMcp);
    expect(mockMcp.listDatabases).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
