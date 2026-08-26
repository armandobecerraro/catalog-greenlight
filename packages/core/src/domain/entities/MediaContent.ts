import { v4 as uuidv4 } from 'uuid';
import { DomainError } from '../errors/DomainError';
import { MediaEnrichment } from '../value-objects/MediaEnrichment';
import { ReleaseDate } from '../value-objects/ReleaseDate';
import { Cast } from '../value-objects/Cast';
import { MediaEnrichmentCompleted, DomainEvent } from '../events/DomainEvent';

export class MediaContent {
  private readonly _id: string;
  private _title: string;
  private _description: string;
  private _genre: string;
  private _releaseDate: ReleaseDate;
  private _cast: Cast;
  private _enrichment: MediaEnrichment | null = null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  private constructor(id: string, title: string, description: string, genre: string, releaseDate: ReleaseDate, cast: Cast) {
    this._id = id;
    this._title = title;
    this._description = description;
    this._genre = genre;
    this._releaseDate = releaseDate;
    this._cast = cast;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  static create(title: string, description: string, genre: string, releaseDate: Date | string, cast: string[]): MediaContent {
    if (!title || title.trim().length === 0) {
      throw new DomainError('Title cannot be empty', 'EMPTY_TITLE');
    }
    if (!description || description.trim().length === 0) {
      throw new DomainError('Description cannot be empty', 'EMPTY_DESCRIPTION');
    }
    if (!genre || genre.trim().length === 0) {
      throw new DomainError('Genre cannot be empty', 'EMPTY_GENRE');
    }
    const releaseDateVO = ReleaseDate.create(releaseDate);
    const castVO = Cast.create(cast);
    return new MediaContent(uuidv4(), title.trim(), description.trim(), genre.trim(), releaseDateVO, castVO);
  }

  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get description(): string { return this._description; }
  get genre(): string { return this._genre; }
  get releaseDate(): ReleaseDate { return this._releaseDate; }
  get cast(): readonly string[] { return this._cast.toArray(); }
  get enrichment(): MediaEnrichment | null { return this._enrichment; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  applyEnrichment(enrichment: MediaEnrichment): void {
    if (!enrichment) {
      throw new DomainError('Enrichment cannot be null', 'INVALID_ENRICHMENT');
    }
    this._enrichment = enrichment;
    this._updatedAt = new Date();
    this._domainEvents.push(new MediaEnrichmentCompleted(this._id, enrichment.summary, enrichment.tags));
  }

  updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new DomainError('Title cannot be empty', 'EMPTY_TITLE');
    }
    this._title = title.trim();
    this._updatedAt = new Date();
  }

  updateGenre(genre: string): void {
    if (!genre || genre.trim().length === 0) {
      throw new DomainError('Genre cannot be empty', 'EMPTY_GENRE');
    }
    this._genre = genre.trim();
    this._updatedAt = new Date();
  }

  addCastMember(member: string): void {
    if (!member || member.trim().length === 0) {
      throw new DomainError('Cast member cannot be empty', 'EMPTY_CAST_MEMBER');
    }
    this._cast = Cast.create([...this._cast.toArray(), member.trim()]);
    this._updatedAt = new Date();
  }

  removeCastMember(member: string): void {
    const newCast = this._cast.toArray().filter(m => m !== member.trim());
    if (newCast.length === 0) {
      throw new DomainError('Cast must contain at least one member', 'EMPTY_CAST');
    }
    this._cast = Cast.fromArray(newCast);
    this._updatedAt = new Date();
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  hasUncommittedEvents(): boolean {
    return this._domainEvents.length > 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      title: this._title,
      description: this._description,
      genre: this._genre,
      releaseDate: this._releaseDate.toISOString(),
      cast: this._cast.toArray(),
      enrichment: this._enrichment ? this._enrichment.toJSON() : null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }

  equals(other: MediaContent): boolean {
    return this._id === other._id;
  }
}
