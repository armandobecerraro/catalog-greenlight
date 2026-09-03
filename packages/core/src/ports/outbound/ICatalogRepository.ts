import { MediaContent } from '../../domain/entities/MediaContent';
import { CatalogEntry, CatalogStats } from '../../types/catalog';

export interface InsertContentResult {
  storedRows: number;
  partner: string;
  latencyMs: number;
}

export interface ICatalogRepository {
  insert(content: MediaContent): Promise<InsertContentResult>;
  list(limit?: number): Promise<CatalogEntry[]>;
  stats(): Promise<CatalogStats>;
  genreDistribution(): Promise<Record<string, unknown>[]>;
  similarTitles(genre: string, limit: number): Promise<Record<string, unknown>[]>;
}
