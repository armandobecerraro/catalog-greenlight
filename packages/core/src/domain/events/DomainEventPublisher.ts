import { IDomainEvent } from './DomainEvent';

export type DomainEventHandler<T extends IDomainEvent = IDomainEvent> = (event: T) => void | Promise<void>;

export interface IDomainEventPublisher {
  publish<T extends IDomainEvent>(event: T): void;
  subscribe(eventName: string, handler: DomainEventHandler): void;
}

export class DomainEventPublisher implements IDomainEventPublisher {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  subscribe(eventName: string, handler: DomainEventHandler): void {
    const existing = this.handlers.get(eventName) ?? new Set();
    existing.add(handler);
    this.handlers.set(eventName, existing);
  }

  publish<T extends IDomainEvent>(event: T): void {
    const handlers = this.handlers.get(event.constructor.name);
    if (!handlers) return;
    for (const handler of handlers) {
      void handler(event);
    }
  }
}
