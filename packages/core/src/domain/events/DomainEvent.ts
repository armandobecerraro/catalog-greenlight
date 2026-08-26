export interface IDomainEvent {
  eventId: string;
  aggregateId: string;
  occurredAt: Date;
}

export interface IDomainEventConstructor {
  new (aggregateId: string): IDomainEvent;
}

export abstract class DomainEvent implements IDomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;

  constructor(aggregateId: string) {
    this.eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
  }
}

export class MediaContentCreated extends DomainEvent {
  public readonly title: string;
  public readonly genre: string;

  constructor(aggregateId: string, title: string, genre: string) {
    super(aggregateId);
    this.title = title;
    this.genre = genre;
  }
}

export class MediaEnrichmentCompleted extends DomainEvent {
  public readonly enrichment: { summary: string; tags: string[] };

  constructor(aggregateId: string, public readonly summary: string, public readonly tags: readonly string[]) {
    super(aggregateId);
    this.enrichment = { summary, tags: [...tags] };
  }
}

export class WorkflowStepCompleted extends DomainEvent {
  constructor(aggregateId: string, public readonly step: number, public readonly partner: string) {
    super(aggregateId);
  }
}
