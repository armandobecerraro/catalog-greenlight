import { ContentIngestionUseCase, MediaIngestionService, IMcpConnector } from '@bas/core';
import {
  ConnectorFactory,
  buildClickHouseConfig,
  GeminiClientFactory,
  McpCatalogRepository,
  loadRepoEnv
} from '@bas/infrastructure';

loadRepoEnv();

async function main() {
  console.log('🎬 Catalog Greenlight — Media Ingestion Demo\n');

  const connectorFactory = new ConnectorFactory();
  const connector = (await connectorFactory.create('clickhouse', buildClickHouseConfig())) as IMcpConnector;
  const geminiEnrichment = new GeminiClientFactory().createEnrichmentClient();
  const catalog = new McpCatalogRepository(connector);
  const ingestionService = new MediaIngestionService(catalog, geminiEnrichment);
  const useCase = new ContentIngestionUseCase(ingestionService);

  const demoData = {
    title: 'Signal Lost: Bogotá',
    description: 'Late-night sci-fi thriller about intercepted broadcasts from parallel timelines.',
    genre: 'Sci-Fi',
    releaseDate: '2025-11-01',
    cast: ['Gael García Bernal', 'Tessa Thompson']
  };

  try {
    console.log(`🎥 Ingesting: ${demoData.title}...`);
    const result = await useCase.execute(demoData);
    console.log('✅ Ingestion result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  } finally {
    await connector.disconnect();
  }
}

main();
