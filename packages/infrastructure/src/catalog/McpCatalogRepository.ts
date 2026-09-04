import {
  ICatalogRepository,
  InsertContentResult,
  CatalogEntry,
  CatalogStats,
  MediaContent,
  IMcpConnector,
  escapeSqlLiteral
} from '@bas/core';

const DEFAULT_LIST_LIMIT = 500;

export class McpCatalogRepository implements ICatalogRepository {
  constructor(private readonly mcp: IMcpConnector) {}

  async insert(content: MediaContent): Promise<InsertContentResult> {
    const releaseDate = content.releaseDate.toDateOnlyString();
    const enrichmentJson = JSON.stringify(content.enrichment?.toJSON() ?? null).replace(/'/g, "''");
    const castArray = [...content.cast].map(c => `'${escapeSqlLiteral(c)}'`).join(', ');

    const query = `
      INSERT INTO media_catalog.media_content (id, title, description, genre, release_date, cast, enrichment)
      VALUES
      (
        '${escapeSqlLiteral(content.id)}',
        '${escapeSqlLiteral(content.title)}',
        '${escapeSqlLiteral(content.description)}',
        '${escapeSqlLiteral(content.genre)}',
        '${releaseDate}',
        [${castArray}],
        '${enrichmentJson}'
      )
    `;

    const result = await this.mcp.runQuery(query);
    return {
      storedRows: result.metadata.rowCount,
      partner: result.metadata.partner,
      latencyMs: result.metadata.latencyMs
    };
  }

  async list(limit = DEFAULT_LIST_LIMIT): Promise<CatalogEntry[]> {
    const result = await this.mcp.runQuery(`
      SELECT id, title, description, genre, release_date, cast, enrichment
      FROM media_catalog.media_content
      ORDER BY if(title LIKE 'Catalog Extra%', 1, 0) ASC, title ASC
      LIMIT ${Number(limit) || DEFAULT_LIST_LIMIT}
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      genre: row.genre as string,
      releaseDate: String(row.release_date),
      cast: parseCast(row.cast),
      enrichment: (row.enrichment as string) || null
    }));
  }

  async stats(): Promise<CatalogStats> {
    const genreResult = await this.mcp.runQuery(`
      SELECT genre, count() AS count
      FROM media_catalog.media_content
      GROUP BY genre
      ORDER BY count DESC
    `);

    const recentResult = await this.mcp.runQuery(`
      SELECT count() AS recent
      FROM media_catalog.media_content
      WHERE created_at >= now() - INTERVAL 30 DAY
    `);

    const castResult = await this.mcp.runQuery(`
      SELECT arrayJoin(cast) AS name, count() AS count
      FROM media_catalog.media_content
      GROUP BY name
      HAVING NOT match(name, '^Actor( [A-Z])?$')
      ORDER BY count DESC
      LIMIT 5
    `);

    let latestRevenue: CatalogStats['latestRevenue'];
    try {
      const revenueResult = await this.mcp.runQuery(`
        SELECT
          sum(views) AS total_views,
          sum(revenue_usd) AS total_revenue,
          argMax(title, revenue_usd) AS top_title
        FROM media_catalog.title_revenue
        WHERE week_start >= (SELECT max(week_start) - 7 FROM media_catalog.title_revenue)
      `);
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
      topCast: castResult.rows
        .map(r => ({
          name: String(r.name),
          count: Number(r.count)
        }))
        .filter(c => !/^Actor( [A-Z])?$/i.test(c.name))
        .slice(0, 5),
      latestRevenue
    };
  }

  async genreDistribution(): Promise<Record<string, unknown>[]> {
    const result = await this.mcp.runQuery(`
      SELECT genre, count() AS cnt
      FROM media_catalog.media_content
      GROUP BY genre
      ORDER BY cnt DESC
    `);
    return result.rows;
  }

  async similarTitles(genre: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await this.mcp.runQuery(`
      SELECT title, genre, release_date
      FROM media_catalog.media_content
      WHERE genre = '${escapeSqlLiteral(genre)}'
      ORDER BY release_date DESC
      LIMIT ${Number(limit) || 5}
    `);
    return result.rows;
  }
}

export function parseCast(castRaw: unknown): string[] {
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
