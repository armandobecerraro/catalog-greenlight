import { IConnector, IConnectorFactory, ConnectionConfig, IGeminiEnrichmentPort } from '@bas/core';
import { McpClickHouseConnector } from './clickhouse/McpClickHouseConnector';
import { GeminiEnrichmentAdapter } from '../gemini/GeminiEnrichmentAdapter';
import { GeminiReasoningAdapter } from '../gemini/GeminiReasoningAdapter';
import { resolveGeminiApiKey } from '../gemini/resolveGeminiApiKey';

export class ConnectorFactory implements IConnectorFactory {
  private static readonly connectors: Map<string, IConnector> = new Map();
  private static readonly registrations: Map<string, new () => IConnector> = new Map();

  async create(partner: string, config: ConnectionConfig): Promise<IConnector> {
    const key = `${partner}-${JSON.stringify(config)}`;
    let connector = ConnectorFactory.connectors.get(key);

    if (!connector) {
      switch (partner) {
        case 'clickhouse':
        case 'clickhouse-mcp':
          connector = new McpClickHouseConnector();
          break;
        default: {
          const RegisteredClass = ConnectorFactory.registrations.get(partner);
          if (RegisteredClass) {
            connector = new RegisteredClass();
          } else {
            throw new Error(`Unknown partner: ${partner}`);
          }
        }
      }
      ConnectorFactory.connectors.set(key, connector);
    }

    await connector.connect(config);
    return connector;
  }

  createGeminiClient(): IGeminiEnrichmentPort {
    const apiKey = resolveGeminiApiKey();
    return new GeminiEnrichmentAdapter(apiKey);
  }

  createGeminiReasoningClient(): GeminiReasoningAdapter {
    const apiKey = resolveGeminiApiKey();
    return new GeminiReasoningAdapter(apiKey);
  }

  createGeminiAdapter(apiKey: string): GeminiEnrichmentAdapter {
    return new GeminiEnrichmentAdapter(apiKey);
  }

  register(type: string, connectorClass: new () => IConnector): void {
    ConnectorFactory.registrations.set(type, connectorClass);
  }
}

export function buildClickHouseConfig(): ConnectionConfig {
  return {
    partner: 'clickhouse',
    secretRef: 'local-dev',
    credentials: {
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
    }
  };
}
