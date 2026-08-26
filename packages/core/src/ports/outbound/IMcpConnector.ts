import { IConnector } from './IConnector';
import { QueryResult } from '../../types';

export interface IMcpConnector extends IConnector {
  listDatabases(): Promise<string[]>;
  listTables(database: string): Promise<string[]>;
  runQuery(query: string): Promise<QueryResult>;
}
