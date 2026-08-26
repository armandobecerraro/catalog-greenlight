import { McpClickHouseConnector } from '../../src/partners/clickhouse/McpClickHouseConnector';

describe('McpClickHouseConnector', () => {
  let connector: McpClickHouseConnector;

  beforeEach(() => {
    connector = new McpClickHouseConnector();
  });

  it('should have correct name', () => {
    expect(connector.name).toBe('clickhouse-mcp');
  });

  it('should throw when querying without connection', async () => {
    await expect(connector.query({ partner: 'clickhouse', query: 'SELECT 1' })).rejects.toThrow(
      'MCP ClickHouse connector not connected'
    );
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

  it('returns empty array for null content', () => {
    expect(connector.parseMcpResult(null)).toEqual([]);
  });
});
