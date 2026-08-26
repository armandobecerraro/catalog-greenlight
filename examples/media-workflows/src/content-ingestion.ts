import { ContentIngestionUseCase, MediaIngestionService } from '@bas/core';
import { ConnectorFactory, buildClickHouseConfig } from '@bas/infrastructure';

async function main() {
  console.log('🎬 Catalog Greenlight — Media Ingestion Demo\n');

  const connectorFactory = new ConnectorFactory();
  const connector = await connectorFactory.create('clickhouse', buildClickHouseConfig());
  const geminiEnrichment = connectorFactory.createGeminiClient();
  const ingestionService = new MediaIngestionService(connector, geminiEnrichment);
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
