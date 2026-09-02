import {
  ContentIngestionUseCase,
  MediaIngestionService,
  CatalogQueryService,
  IMcpConnector
} from '@bas/core';
import {
  ConnectorFactory,
  buildClickHouseConfig,
  GeminiClientFactory,
  McpCatalogRepository,
  McpAgentAuditAdapter
} from '@bas/infrastructure';
import { AgentRunner } from '@bas/orchestration';
import { ApiRuntime, HealthSnapshot } from './runtime';

export async function composeRuntime(): Promise<ApiRuntime> {
  const connectorFactory = new ConnectorFactory();
  const connector = await connectorFactory.create('clickhouse', buildClickHouseConfig());
  const mcp = connector as IMcpConnector;

  const geminiFactory = new GeminiClientFactory();
  const geminiEnrichment = geminiFactory.createEnrichmentClient();
  const geminiReasoning = geminiFactory.createReasoningClient();

  const catalog = new McpCatalogRepository(mcp);
  const audit = new McpAgentAuditAdapter(mcp);
  const ingestionService = new MediaIngestionService(catalog, geminiEnrichment);
  const ingestionUseCase = new ContentIngestionUseCase(ingestionService);
  const catalogQueries = new CatalogQueryService(catalog);
  const agentRunner = new AgentRunner(mcp, geminiReasoning, geminiReasoning.modelName, audit);

  const health = (): HealthSnapshot => ({
    status: 'ok',
    product: 'Catalog Greenlight',
    ready: true,
    error: null,
    timestamp: new Date().toISOString(),
    partners: {
      clickhouse: 'connected',
      mcp: 'mcp-clickhouse',
      gemini: process.env.GEMINI_MODEL || 'gemini-flash-latest'
    }
  });

  return {
    ingestionUseCase,
    catalogQueries,
    agentRunner,
    isReady: () => true,
    initError: () => null,
    health,
    apiKeyRequired: Boolean(process.env.API_KEY?.trim())
  };
}

export function startingRuntime(error: string | null = null): ApiRuntime {
  const notReady = async () => {
    throw new Error('API is still initializing');
  };
  return {
    ingestionUseCase: { execute: notReady },
    catalogQueries: {
      getCatalog: notReady,
      getCatalogStats: notReady
    },
    agentRunner: {
      run: notReady,
      runGreenlight: notReady
    },
    isReady: () => false,
    initError: () => error,
    health: () => ({
      status: error ? 'degraded' : 'starting',
      product: 'Catalog Greenlight',
      ready: false,
      error,
      timestamp: new Date().toISOString(),
      partners: {
        clickhouse: error ? 'error' : 'starting',
        mcp: 'mcp-clickhouse',
        gemini: process.env.GEMINI_MODEL || 'gemini-flash-latest'
      }
    }),
    apiKeyRequired: Boolean(process.env.API_KEY?.trim())
  };
}
