import { QueryRequest, QueryResult, ConnectionConfig } from '../../types';

export interface IConnector {
  readonly name: string;
  connect(config: ConnectionConfig): Promise<void>;
  query(request: QueryRequest): Promise<QueryResult>;
  disconnect(): Promise<void>;
}

export interface IConnectorFactory {
  create(type: string, config: ConnectionConfig): Promise<IConnector>;
  register(type: string, connectorClass: new () => IConnector): void;
}

export interface ISecretManager {
  getSecret(secretRef: string): Promise<Record<string, string>>;
}
