import { MediaContent, IMediaIngestionService, MediaEnrichment } from '@bas/core';

export interface AgentState {
  content: MediaContent | null;
  enrichment: MediaEnrichment | null;
  storageResult: { success: boolean; latencyMs: number; storedRows: number } | null;
  errors: string[];
  step: number;
}

/** Facade over MediaIngestionService — same ingest path as the HTTP API. */
export class MediaIngestionAgent {
  constructor(private readonly ingestion: IMediaIngestionService) {}

  async execute(content: MediaContent | null): Promise<AgentState> {
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
      const result = await this.ingestion.process(content);
      return {
        content,
        enrichment: content.enrichment,
        storageResult: {
          success: result.success,
          latencyMs: result.latencyMs,
          storedRows: result.storedRows
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
