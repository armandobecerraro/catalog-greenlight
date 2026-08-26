import { IDomainEvent } from './DomainEvent';

export type DomainEventHandler<T extends IDomainEvent = IDomainEvent> = (event: T) => void | Promise<void>;

export interface IDomainEventPublisher {
  publish<T extends IDomainEvent>(event: T): void | Promise<void>;
  subscribe<T extends IDomainEvent>(eventType: new (args: never) => T, handler: DomainEventHandler<T>): void;
}

export class DomainEventPublisher implements IDomainEventPublisher {
  private handlers = new Map<new (args: never) => IDomainEvent, Set<DomainEventHandler<IDomainEvent>>>();

  subscribe<T extends IDomainEvent>(eventType: new (args: never) => T, handler: DomainEventHandler<T>): void {
    const handlers = this.handlers.get(eventType) || new Set();
    handlers.add(handler as DomainEventHandler<IDomainEvent>);
    this.handlers.set(eventType, handlers);
  }

  publish<T extends IDomainEvent>(event: T): void {
    const handlers = this.handlers.get(event.constructor as new (args: never) => T);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(event);
    }
  }
}
