import { ClickHouseConnector } from '../../src/partners/clickhouse/ClickHouseConnector';

describe('ClickHouseConnector', () => {
  let connector: ClickHouseConnector;

  beforeEach(() => {
    connector = new ClickHouseConnector();
  });

  it('should have correct name', () => {
    expect(connector.name).toBe('clickhouse');
  });

  it('should throw when querying without connection', async () => {
    await expect(connector.query({
      partner: 'clickhouse',
      query: 'SELECT 1'
    })).rejects.toThrow('ClickHouse not connected');
  });

  it('should throw when streaming without connection', async () => {
    const stream = connector.stream({
      partner: 'clickhouse',
      query: 'SELECT 1'
    });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toThrow('ClickHouse not connected');
  });
});
