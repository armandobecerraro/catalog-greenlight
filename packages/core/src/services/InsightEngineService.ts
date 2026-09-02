import { v4 as uuidv4 } from 'uuid';
import { IGeminiEnrichmentPort } from '../ports/outbound/IGeminiEnrichmentPort';
import { ICatalogRepository } from '../ports/outbound/ICatalogRepository';
import { MediaEnrichment } from '../domain/value-objects/MediaEnrichment';

export interface InsightRequest {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
  insightPrompt?: string;
}

export interface InsightResult {
  success: boolean;
  contentId: string;
  insights: string;
  tokensEstimated: number;
  queryLatencyMs: number;
  enrichmentLatencyMs: number;
  totalLatencyMs: number;
  partner: string;
  catalogContext?: Record<string, unknown>;
}

export class InsightEngineService {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly geminiEnrichment: IGeminiEnrichmentPort
  ) {}

  async generateInsight(request: InsightRequest): Promise<InsightResult> {
    const startTime = Date.now();

    const genreDistribution = await this.catalog.genreDistribution();
    const similarTitles = await this.catalog.similarTitles(request.genre, 5);
    const queryLatencyMs = Date.now() - startTime;

    const enrichmentStart = Date.now();
    const enrichment: MediaEnrichment = await this.geminiEnrichment.enrich({
      title: request.title,
      description: `${request.description}\n\nCatalog context — genre counts: ${JSON.stringify(genreDistribution)}. Similar titles: ${JSON.stringify(similarTitles)}. Prompt: ${request.insightPrompt || 'Programming recommendation'}`,
      genre: request.genre,
      releaseDate: request.releaseDate,
      cast: request.cast
    });
    const enrichmentLatencyMs = Date.now() - enrichmentStart;

    return {
      success: true,
      contentId: uuidv4(),
      insights: enrichment.summary,
      tokensEstimated: enrichment.tags.length,
      queryLatencyMs,
      enrichmentLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      partner: 'clickhouse',
      catalogContext: {
        genreDistribution,
        similarTitles
      }
    };
  }
}
