import { MediaContent } from '../domain/entities/MediaContent';
import { IConnector } from '../ports/outbound/IConnector';
import { IGeminiEnrichmentPort } from '../ports/outbound/IGeminiEnrichmentPort';
import { QueryResult } from '../types';

export interface IMediaIngestionService {
  process(content: MediaContent): Promise<IngestionResult>;
}

export interface IngestionResult {
  success: boolean;
  contentId: string;
  storedRows: number;
  partner: string;
  latencyMs: number;
}

export class MediaIngestionService implements IMediaIngestionService {
  constructor(
    private readonly connector: IConnector,
    private readonly geminiEnrichment: IGeminiEnrichmentPort
  ) {}

  async process(content: MediaContent): Promise<IngestionResult> {
    const startTime = Date.now();

    const enrichment = await this.geminiEnrichment.enrich({
      title: content.title,
      description: content.description,
      genre: content.genre,
      releaseDate: content.releaseDate.toISOString(),
      cast: content.cast
    });

    content.applyEnrichment(enrichment);

    const releaseDate = content.releaseDate.toDateOnlyString();
    const enrichmentJson = JSON.stringify(enrichment.toJSON()).replace(/'/g, "''");
    const castArray = [...content.cast].map(c => `'${c.replace(/'/g, "''")}'`).join(', ');

    const query = `
      INSERT INTO media_catalog.media_content (id, title, description, genre, release_date, cast, enrichment)
      VALUES
      (
        '${this.escapeSql(content.id)}',
        '${this.escapeSql(content.title)}',
        '${this.escapeSql(content.description)}',
        '${this.escapeSql(content.genre)}',
        '${releaseDate}',
        [${castArray}],
        '${enrichmentJson}'
      )
    `;

    const result: QueryResult = await this.connector.query({
      partner: 'clickhouse',
      query
    });

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      contentId: content.id,
      storedRows: result.metadata.rowCount,
      partner: result.metadata.partner,
      latencyMs
    };
  }

  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
