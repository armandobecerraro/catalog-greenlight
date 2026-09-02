import { IConnector } from '../ports/outbound/IConnector';
import { IGeminiEnrichmentPort } from '../ports/outbound/IGeminiEnrichmentPort';
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

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
  enrichment: string | null;
  language?: string;
}

export interface CatalogStats {
  totalEntries: number;
  genres: Record<string, number>;
  recentAdditions: number;
  topCast: Array<{ name: string; count: number }>;
  latestRevenue?: {
    totalViews: number;
    totalRevenueUsd: number;
    topTitle: string;
  };
}

export class InsightEngineService {
  constructor(
    private readonly connector: IConnector,
    private readonly geminiEnrichment: IGeminiEnrichmentPort
  ) {}

  async generateInsight(request: InsightRequest): Promise<InsightResult> {
    const startTime = Date.now();

    const genreDistribution = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT genre, count() AS cnt
        FROM media_catalog.media_content
        GROUP BY genre
        ORDER BY cnt DESC
      `
    });

    const similarTitles = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT title, genre, release_date
        FROM media_catalog.media_content
        WHERE genre = '${this.escapeSql(request.genre)}'
        ORDER BY release_date DESC
        LIMIT 5
      `
    });

    const queryLatencyMs = Date.now() - startTime;

    const enrichmentStart = Date.now();
    const enrichment: MediaEnrichment = await this.geminiEnrichment.enrich({
      title: request.title,
      description: `${request.description}\n\nCatalog context — genre counts: ${JSON.stringify(genreDistribution.rows)}. Similar titles: ${JSON.stringify(similarTitles.rows)}. Prompt: ${request.insightPrompt || 'Programming recommendation'}`,
      genre: request.genre,
      releaseDate: request.releaseDate,
      cast: request.cast
    });
    const enrichmentLatencyMs = Date.now() - enrichmentStart;

    return {
      success: true,
      contentId: `media-${Date.now()}`,
      insights: enrichment.summary,
      tokensEstimated: enrichment.tags.length,
      queryLatencyMs,
      enrichmentLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      partner: 'clickhouse',
      catalogContext: {
        genreDistribution: genreDistribution.rows,
        similarTitles: similarTitles.rows
      }
    };
  }

  async getCatalog(): Promise<CatalogEntry[]> {
    const result = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT id, title, description, genre, release_date, cast, enrichment
        FROM media_catalog.media_content
        ORDER BY if(title LIKE 'Catalog Extra%', 1, 0) ASC, title ASC
        LIMIT 500
      `
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      genre: row.genre as string,
      releaseDate: String(row.release_date),
      cast: this.parseCast(row.cast),
      enrichment: (row.enrichment as string) || null
    }));
  }

  async getCatalogStats(): Promise<CatalogStats> {
    const genreResult = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT genre, count() AS count
        FROM media_catalog.media_content
        GROUP BY genre
        ORDER BY count DESC
      `
    });

    const recentResult = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT count() AS recent
        FROM media_catalog.media_content
        WHERE created_at >= now() - INTERVAL 30 DAY
      `
    });

    const castResult = await this.connector.query({
      partner: 'clickhouse',
      query: `
        SELECT arrayJoin(cast) AS name, count() AS count
        FROM media_catalog.media_content
        GROUP BY name
        ORDER BY count DESC
        LIMIT 5
      `
    });

    let latestRevenue: CatalogStats['latestRevenue'];
    try {
      const revenueResult = await this.connector.query({
        partner: 'clickhouse',
        query: `
          SELECT
            sum(views) AS total_views,
            sum(revenue_usd) AS total_revenue,
            argMax(title, revenue_usd) AS top_title
          FROM media_catalog.title_revenue
          WHERE week_start >= (SELECT max(week_start) - 7 FROM media_catalog.title_revenue)
        `
      });
      if (revenueResult.rows[0]) {
        latestRevenue = {
          totalViews: Number(revenueResult.rows[0].total_views || 0),
          totalRevenueUsd: Number(revenueResult.rows[0].total_revenue || 0),
          topTitle: String(revenueResult.rows[0].top_title || 'N/A')
        };
      }
    } catch {
      // revenue table may not exist yet during init
    }

    const genres: Record<string, number> = {};
    let totalEntries = 0;
    for (const row of genreResult.rows) {
      genres[String(row.genre)] = Number(row.count);
      totalEntries += Number(row.count);
    }

    return {
      totalEntries,
      genres,
      recentAdditions: Number(recentResult.rows[0]?.recent || 0),
      topCast: castResult.rows.map(r => ({
        name: String(r.name),
        count: Number(r.count)
      })),
      latestRevenue
    };
  }

  private parseCast(castRaw: unknown): string[] {
    if (Array.isArray(castRaw)) return castRaw as string[];
    if (typeof castRaw === 'string') {
      try {
        return JSON.parse(castRaw);
      } catch {
        return [];
      }
    }
    return [];
  }

  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
