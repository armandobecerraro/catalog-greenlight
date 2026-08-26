import { MediaEnrichmentCompleted, WorkflowStepCompleted, MediaContentCreated } from '@bas/core';

describe('Domain Events', () => {
  it('should create MediaEnrichmentCompleted event', () => {
    const event = new MediaEnrichmentCompleted('content-123', 'Test summary', ['a', 'b']);
    expect(event.eventId).toBeDefined();
    expect(event.aggregateId).toBe('content-123');
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.summary).toBe('Test summary');
    expect(event.tags).toEqual(['a', 'b']);
    expect(event.enrichment.summary).toBe('Test summary');
    expect(event.enrichment.tags).toEqual(['a', 'b']);
  });

  it('should create WorkflowStepCompleted event', () => {
    const event = new WorkflowStepCompleted('wf-456', 2, 'clickhouse');
    expect(event.step).toBe(2);
    expect(event.partner).toBe('clickhouse');
  });

  it('should create MediaContentCreated event', () => {
    const event = new MediaContentCreated('content-789', 'Inception', 'Sci-Fi');
    expect(event.aggregateId).toBe('content-789');
    expect(event.title).toBe('Inception');
    expect(event.genre).toBe('Sci-Fi');
  });
});
