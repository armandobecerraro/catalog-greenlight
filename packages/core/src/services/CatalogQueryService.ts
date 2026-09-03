import { ICatalogRepository } from '../ports/outbound/ICatalogRepository';
import { CatalogEntry, CatalogStats } from '../types/catalog';

export class CatalogQueryService {
  constructor(private readonly catalog: ICatalogRepository) {}

  getCatalog(): Promise<CatalogEntry[]> {
    return this.catalog.list();
  }

  getCatalogStats(): Promise<CatalogStats> {
    return this.catalog.stats();
  }
}
