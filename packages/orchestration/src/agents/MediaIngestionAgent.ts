import { MediaContent, MediaEnrichment, IMcpConnector, IGeminiEnrichmentPort } from '@bas/core';

export interface AgentState {
  content: MediaContent | null;
  enrichment: MediaEnrichment | null;
  storageResult: { success: boolean; latencyMs: number; storedRows: number } | null;
  errors: string[];
  step: number;
}

export class MediaIngestionAgent {
  constructor(
    private readonly mcp: IMcpConnector,
    private readonly geminiClient: IGeminiEnrichmentPort
  ) {}

  async execute(content: MediaContent): Promise<AgentState> {
    if (!content) {
      return {
        content: null,
        enrichment: null,
        storageResult: null,
        errors: ['No content provided'],
        step: 0
      };
    }

    try {
      const enrichStart = Date.now();
      const enrichment = await this.geminiClient.enrich({
        title: content.title,
        description: content.description,
        genre: content.genre,
        releaseDate: content.releaseDate.toISOString(),
        cast: content.cast
      });
      const enrichLatency = Date.now() - enrichStart;

      content.applyEnrichment(enrichment);

      const releaseDate = content.releaseDate.toDateOnlyString();
      const enrichmentJson = JSON.stringify(enrichment.toJSON()).replace(/'/g, "''");
      const castArray = [...content.cast].map(c => `'${c.replace(/'/g, "''")}'`).join(', ');

      const insertSql = `
        INSERT INTO media_catalog.media_content
          (id, title, description, genre, release_date, cast, enrichment)
        VALUES (
          '${content.id.replace(/'/g, "''")}',
          '${content.title.replace(/'/g, "''")}',
          '${content.description.replace(/'/g, "''")}',
          '${content.genre.replace(/'/g, "''")}',
          '${releaseDate}',
          [${castArray}],
          '${enrichmentJson}'
        )
      `;

      const storeStart = Date.now();
      const result = await this.mcp.runQuery(insertSql);
      const storeLatency = Date.now() - storeStart;

      return {
        content,
        enrichment,
        storageResult: {
          success: true,
          latencyMs: enrichLatency + storeLatency,
          storedRows: result.metadata.rowCount
        },
        errors: [],
        step: 3
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content,
        enrichment: null,
        storageResult: null,
        errors: [message],
        step: 0
      };
    }
  }
}
