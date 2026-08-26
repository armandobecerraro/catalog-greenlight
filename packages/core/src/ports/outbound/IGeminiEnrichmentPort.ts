import { MediaEnrichment } from '../../domain/value-objects/MediaEnrichment';

export interface IGeminiEnrichmentPort {
  enrich(content: { title: string; description: string; genre: string; releaseDate: string; cast: readonly string[] }): Promise<MediaEnrichment>;
}
