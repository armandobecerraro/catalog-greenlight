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
