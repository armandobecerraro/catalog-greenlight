import {
  ContentIngestionUseCase,
  MediaIngestionService,
  InsightEngineService,
  IMcpConnector
} from '@bas/core';
import { ConnectorFactory, buildClickHouseConfig } from '@bas/infrastructure';
import { AgentRunner } from '@bas/orchestration';

async function main() {
  console.log('🎬 Catalog Greenlight — Agent Demo (Gemini + mcp-clickhouse)\n');

  const connectorFactory = new ConnectorFactory();
  const connector = (await connectorFactory.create('clickhouse', buildClickHouseConfig())) as IMcpConnector;
  const geminiEnrichment = connectorFactory.createGeminiClient();
  const geminiReasoning = connectorFactory.createGeminiReasoningClient();

  const ingestionService = new MediaIngestionService(connector, geminiEnrichment);
  const insightEngine = new InsightEngineService(connector, geminiEnrichment);
  const useCase = new ContentIngestionUseCase(ingestionService);
  const agent = new AgentRunner(connector, geminiReasoning, geminiReasoning.modelName);

  console.log('Step 1: Ingest one new title via Gemini enrichment + MCP INSERT...\n');
  const ingestStart = Date.now();
  const ingest = await useCase.execute({
    title: 'Signal Lost: Bogotá',
    description: 'A late-night sci-fi thriller about a radio engineer who intercepts broadcasts from parallel timelines across Latin America.',
    genre: 'Sci-Fi',
    releaseDate: '2025-11-01',
    cast: ['Gael García Bernal', 'Tessa Thompson']
  });
  console.log(`  ✅ Ingested ${ingest.contentId} in ${Date.now() - ingestStart}ms (reported ${ingest.latencyMs}ms)\n`);

  console.log('Step 2: Catalog stats via MCP...\n');
  const statsStart = Date.now();
  const stats = await insightEngine.getCatalogStats();
  console.log(`  📊 ${stats.totalEntries} titles · ${Object.keys(stats.genres).length} genres · ${Date.now() - statsStart}ms`);
  if (stats.latestRevenue) {
    console.log(`  💰 7d revenue $${stats.latestRevenue.totalRevenueUsd.toFixed(0)} · top: ${stats.latestRevenue.topTitle}`);
  }
  console.log('');

  console.log('Step 3: Natural-language catalog question...\n');
  const askStart = Date.now();
  const qa = await agent.run('Which genre is under-represented in our catalog? Show counts.');
  console.log(`  ❓ Answer (${Date.now() - askStart}ms): ${qa.answer.slice(0, 200)}...`);
  console.log(`  📝 SQL: ${qa.sql?.slice(0, 120)}...`);
  console.log(`  📈 Rows: ${qa.queryRows?.length ?? 0}\n`);

  console.log('Step 4: Greenlight this week (3 picks)...\n');
  const glStart = Date.now();
  const greenlight = await agent.run(
    'Recommend exactly 3 titles to push this week based on genre gaps and recent revenue.',
    { defaultIntent: 'greenlight' }
  );
  console.log(`  🚦 Greenlight (${Date.now() - glStart}ms, total agent ${greenlight.totalLatencyMs}ms):`);
  for (const rec of greenlight.recommendations ?? []) {
    console.log(`    • ${rec.title} (${rec.genre}) — ${rec.justification}`);
    console.log(`      Evidence: ${rec.evidence}`);
  }

  console.log('\nStep 5: Agent trace (6 steps)...\n');
  for (const step of greenlight.steps) {
    console.log(`  [${step.step}] ${step.status} ${step.latencyMs ?? 0}ms`);
  }

  console.log('\n✨ Demo complete — Catalog Greenlight ready for judges.\n');
  await connector.disconnect();
  process.exit(0);
}

main().catch(async error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
