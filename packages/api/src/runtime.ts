import { IContentIngestionUseCase, CatalogQueryService } from '@bas/core';
import { AgentRunner } from '@bas/orchestration';

export interface HealthSnapshot {
  status: string;
  product: string;
  ready: boolean;
  error: string | null;
  timestamp: string;
  partners: {
    clickhouse: string;
    mcp: string;
    gemini: string;
  };
}

export interface ApiRuntime {
  ingestionUseCase: IContentIngestionUseCase;
  catalogQueries: Pick<CatalogQueryService, 'getCatalog' | 'getCatalogStats'>;
  agentRunner: Pick<AgentRunner, 'run' | 'runGreenlight'>;
  isReady: () => boolean;
  initError: () => string | null;
  health: () => HealthSnapshot;
  apiKeyRequired: boolean;
}
