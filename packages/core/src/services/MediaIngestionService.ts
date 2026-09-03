import { MediaContent } from '../domain/entities/MediaContent';
import { IGeminiEnrichmentPort } from '../ports/outbound/IGeminiEnrichmentPort';
import { ICatalogRepository } from '../ports/outbound/ICatalogRepository';
import { IDomainEventPublisher, DomainEventPublisher } from '../domain/events/DomainEventPublisher';

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
    private readonly catalog: ICatalogRepository,
    private readonly geminiEnrichment: IGeminiEnrichmentPort,
    private readonly events: IDomainEventPublisher = new DomainEventPublisher()
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

    const stored = await this.catalog.insert(content);

    for (const event of content.pullDomainEvents()) {
      this.events.publish(event);
    }

    return {
      success: true,
      contentId: content.id,
      storedRows: stored.storedRows,
      partner: stored.partner,
      latencyMs: Date.now() - startTime
    };
  }
}
