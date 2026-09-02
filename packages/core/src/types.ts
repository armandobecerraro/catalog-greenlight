export type PartnerType = 'clickhouse' | 'ibm' | 'grafana' | 'parallel' | 'replit';

export interface ConnectionConfig {
  partner: PartnerType;
  type?: PartnerType;
  credentials: Record<string, string>;
  secretRef?: string;
  region?: string;
  projectId?: string;
}

export interface QueryRequest {
  partner: PartnerType;
  query: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  metadata: {
    rowCount: number;
    latencyMs: number;
    partner: PartnerType;
  };
}

export interface ConnectorConfig {
  type: PartnerType;
  secretRef: string;
  options?: Record<string, unknown>;
}

export interface AgentError {
  code: string;
  message: string;
  step?: number;
  partner?: PartnerType;
  timestamp: Date;
  recoverable: boolean;
}

export interface MediaArtifact {
  id: string;
  type: 'video' | 'audio' | 'metadata' | 'thumbnail';
  uri: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
