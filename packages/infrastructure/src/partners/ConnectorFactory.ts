import { IConnector, IConnectorFactory, ConnectionConfig, ISecretManager } from '@bas/core';
import { McpClickHouseConnector } from './clickhouse/McpClickHouseConnector';
import { EnvSecretManager } from '../secrets/EnvSecretManager';

export class ConnectorFactory implements IConnectorFactory {
  private static readonly connectors: Map<string, IConnector> = new Map();
  private static readonly registrations: Map<string, new () => IConnector> = new Map();

  constructor(private readonly secrets: ISecretManager = new EnvSecretManager()) {
    if (!ConnectorFactory.registrations.has('clickhouse')) {
      ConnectorFactory.registerDefaults();
    }
  }

  static registerDefaults(): void {
    ConnectorFactory.registrations.set('clickhouse', McpClickHouseConnector);
    ConnectorFactory.registrations.set('clickhouse-mcp', McpClickHouseConnector);
  }

  static resetForTests(): void {
    ConnectorFactory.connectors.clear();
    ConnectorFactory.registrations.clear();
    ConnectorFactory.registerDefaults();
  }

  async create(partner: string, config: ConnectionConfig): Promise<IConnector> {
    const credentials =
      Object.keys(config.credentials ?? {}).length > 0
        ? config.credentials
        : await this.secrets.getSecret(config.secretRef || partner);

    const resolved: ConnectionConfig = { ...config, credentials };
    const key = `${partner}-${JSON.stringify(resolved)}`;
    let connector = ConnectorFactory.connectors.get(key);

    if (!connector) {
      const RegisteredClass = ConnectorFactory.registrations.get(partner);
      if (!RegisteredClass) {
        throw new Error(`Unknown partner: ${partner}`);
      }
      connector = new RegisteredClass();
      ConnectorFactory.connectors.set(key, connector);
    }

    await connector.connect(resolved);
    return connector;
  }

  register(type: string, connectorClass: new () => IConnector): void {
    ConnectorFactory.registrations.set(type, connectorClass);
  }
}

export function buildClickHouseConfig(secrets: EnvSecretManager = new EnvSecretManager()): ConnectionConfig {
  return {
    partner: 'clickhouse',
    secretRef: 'local-dev',
    credentials: secrets.readClickHouse()
  };
}
