import { McpClickHouseConnector, isMcpErrorText } from '../../src/partners/clickhouse/McpClickHouseConnector';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockCallTool = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    callTool: mockCallTool
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({
    close: mockClose
  }))
}));

describe('McpClickHouseConnector', () => {
  let connector: McpClickHouseConnector;

  beforeEach(() => {
    connector = new McpClickHouseConnector();
    mockConnect.mockClear();
    mockCallTool.mockReset();
    mockClose.mockClear();
  });

  it('should have correct name', () => {
    expect(connector.name).toBe('clickhouse-mcp');
  });

  it('should throw when querying without connection', async () => {
    await expect(connector.query({ partner: 'clickhouse', query: 'SELECT 1' })).rejects.toThrow(
      'MCP ClickHouse connector not connected'
    );
    await expect(connector.listDatabases()).rejects.toThrow('MCP ClickHouse connector not connected');
  });

  it('connects, queries, lists schema, and disconnects via MCP SDK', async () => {
    mockCallTool.mockImplementation(async ({ name }: { name: string }) => {
      if (name === 'run_query') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ columns: ['n'], rows: [[1]] })
            }
          ]
        };
      }
      if (name === 'list_databases') {
        return { content: [{ type: 'text', text: '["default","media_catalog"]' }] };
      }
      if (name === 'list_tables') {
        return { content: [{ type: 'text', text: JSON.stringify({ tables: [{ name: 'media_content' }] }) }] };
      }
      return { content: [] };
    });

    await connector.connect({
      partner: 'clickhouse',
      credentials: {
        host: 'localhost',
        mcpArgs: JSON.stringify(['mcp-clickhouse'])
      }
    });
    expect(mockConnect).toHaveBeenCalled();

    const result = await connector.query({ partner: 'clickhouse', query: 'SELECT 1' });
    expect(result.rows).toEqual([{ n: 1 }]);
    expect(result.metadata.partner).toBe('clickhouse');

    await expect(connector.listDatabases()).resolves.toEqual(['default', 'media_catalog']);
    await expect(connector.listTables('media_catalog')).resolves.toEqual(['media_content']);

    await connector.disconnect();
    expect(mockClose).toHaveBeenCalled();
    await connector.disconnect();
  });

  it('listDatabases returns [] for non-array JSON; listTables handles missing tables', async () => {
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: '{}' }] });
    await connector.connect({ partner: 'clickhouse', credentials: { host: 'h' } });
    await expect(connector.listDatabases()).resolves.toEqual([]);
    await expect(connector.listTables('media_catalog')).resolves.toEqual([]);
  });

  it('treats non-array MCP content as a single block', async () => {
    mockCallTool.mockResolvedValue({ content: { type: 'text', text: '["only"]' } });
    await connector.connect({ partner: 'clickhouse', credentials: { host: 'h' } });
    await expect(connector.listDatabases()).resolves.toEqual(['only']);
  });

  it('throws when MCP text content is missing', async () => {
    mockCallTool.mockResolvedValue({ content: [{ type: 'image' }] });
    await connector.connect({ partner: 'clickhouse', credentials: { host: 'h' } });
    await expect(connector.listDatabases()).rejects.toThrow(/missing text content/);
  });

  it('parses MCP JSON columns/rows format', () => {
    const content = [
      {
        text: JSON.stringify({
          columns: ['genre', 'cnt'],
          rows: [
            ['Sci-Fi', 10],
            ['Drama', 15]
          ]
        })
      }
    ];

    const rows = connector.parseMcpResult(content);
    expect(rows).toEqual([
      { genre: 'Sci-Fi', cnt: 10 },
      { genre: 'Drama', cnt: 15 }
    ]);
  });

  it('throws when MCP returns a query timeout string instead of rows', () => {
    expect(() =>
      connector.parseMcpResult([{ type: 'text', text: 'Query timed out after 30 seconds' }])
    ).toThrow(/timed out/i);
  });

  it('parses MCP database list JSON array', () => {
    const rows = connector.parseMcpResult([
      { type: 'text', text: '["default", "media_catalog", "system"]' }
    ]);
    expect(rows).toEqual([{ name: 'default' }, { name: 'media_catalog' }, { name: 'system' }]);
  });

  it('parses object blocks, plain strings, JSON objects, and empty content', () => {
    expect(connector.parseMcpResult(null)).toEqual([]);
    expect(connector.parseMcpResult([{ foo: 1 }])).toEqual([{ foo: 1 }]);
    expect(connector.parseMcpResult(['{"a":1}'])).toEqual([{ a: 1 }]);
    expect(connector.parseMcpResult([{ text: 'not-json' }])).toEqual([{ text: 'not-json' }]);
    expect(connector.parseMcpResult({ type: 'text', text: '{"k":2}' })).toEqual([{ k: 2 }]);
    expect(connector.parseMcpResult([{ type: 'text', text: '42' }])).toEqual([{ text: '42' }]);
    expect(connector.parseMcpResult([undefined])).toEqual([]);
  });

  it('detects MCP error strings', () => {
    expect(isMcpErrorText('Code: 60')).toBe(true);
    expect(isMcpErrorText('DB::Exception: boom')).toBe(true);
    expect(isMcpErrorText('ok')).toBe(false);
  });

  it('connects with default credentials and parses remaining MCP shapes', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ columns: ['n'], rows: [[1]] }) }]
    });
    await connector.connect({ partner: 'clickhouse', credentials: {} });
    const result = await connector.runQuery('SELECT 1');
    expect(result.rows).toEqual([{ n: 1 }]);
    expect(connector.parseMcpResult([{ type: 'text', text: '[{"a":2},"x"]' }])).toEqual([{ a: 2 }, { name: 'x' }]);
    expect(connector.parseMcpResult([{ type: 'text', text: 'true' }])).toEqual([{ text: 'true' }]);
    expect(connector.parseMcpResult([{ type: 'text', text: '{' }])).toEqual([{ text: '{' }]);
  });
});
