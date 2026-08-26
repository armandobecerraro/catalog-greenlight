import { DomainError } from '../errors/DomainError';

export class InvalidEnrichmentError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_ENRICHMENT');
  }
}

export class MediaEnrichment {
  private readonly _summary: string;
  private readonly _tags: readonly string[];
  private readonly _sentiment: 'positive' | 'neutral' | 'negative';
  private readonly _embedding: readonly number[] | null;

  constructor(
    summary: string,
    tags: string[],
    sentiment: 'positive' | 'neutral' | 'negative',
    embedding: number[] | null = null
  ) {
    if (!summary || summary.trim().length === 0) {
      throw new InvalidEnrichmentError('Enrichment summary cannot be empty');
    }
    if (!sentiment || !['positive', 'neutral', 'negative'].includes(sentiment)) {
      throw new InvalidEnrichmentError('Sentiment must be positive, neutral, or negative');
    }
    this._summary = summary.trim();
    this._tags = Object.freeze([...tags]);
    this._sentiment = sentiment;
    this._embedding = embedding ? Object.freeze([...embedding]) : null;
  }

  static create(
    summary: string,
    tags: string[],
    sentiment: 'positive' | 'neutral' | 'negative',
    embedding?: number[] | null
  ): MediaEnrichment {
    return new MediaEnrichment(summary, tags, sentiment, embedding);
  }

  static fromJSON(data: { summary: string; tags: string[]; sentiment: string; embedding?: number[] | null }): MediaEnrichment {
    return new MediaEnrichment(data.summary, data.tags, data.sentiment as 'positive' | 'neutral' | 'negative', data.embedding ?? null);
  }

  get summary(): string {
    return this._summary;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get sentiment(): 'positive' | 'neutral' | 'negative' {
    return this._sentiment;
  }

  get embedding(): readonly number[] | null {
    return this._embedding;
  }

  withSummary(summary: string): MediaEnrichment {
    return new MediaEnrichment(summary, [...this._tags], this._sentiment, this._embedding ? [...this._embedding] : null);
  }

  withSentiment(sentiment: 'positive' | 'neutral' | 'negative'): MediaEnrichment {
    return new MediaEnrichment(this._summary, [...this._tags], sentiment, this._embedding ? [...this._embedding] : null);
  }

  withEmbedding(embedding: number[]): MediaEnrichment {
    return new MediaEnrichment(this._summary, [...this._tags], this._sentiment, [...embedding]);
  }

  toJSON(): Record<string, unknown> {
    return {
      summary: this._summary,
      tags: [...this._tags],
      sentiment: this._sentiment,
      embedding: this._embedding ? [...this._embedding] : null
    };
  }

  equals(other: MediaEnrichment): boolean {
    return (
      this._summary === other._summary &&
      this._sentiment === other._sentiment &&
      this._tags.length === other._tags.length &&
      this._tags.every((t, i) => t === other._tags[i])
    );
  }
}
