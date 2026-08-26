import { MediaContent, MediaEnrichment, DomainError } from '@bas/core';

describe('MediaContent', () => {
  it('should create a valid media content entity', () => {
    const content = MediaContent.create(
      'Inception',
      'A thief who steals corporate secrets through dream-sharing technology.',
      'Sci-Fi',
      new Date('2010-07-16'),
      ['Leonardo DiCaprio', 'Joseph Gordon-Levitt']
    );

    expect(content.id).toBeDefined();
    expect(content.title).toBe('Inception');
    expect(content.genre).toBe('Sci-Fi');
    expect(content.cast).toHaveLength(2);
    expect(content.enrichment).toBeNull();
  });

  it('should throw DomainError when title is empty', () => {
    expect(() => {
      MediaContent.create('', 'Description', 'Genre', new Date(), ['Actor']);
    }).toThrow(DomainError);
  });

  it('should throw DomainError when cast is empty', () => {
    expect(() => {
      MediaContent.create('Title', 'Description', 'Genre', new Date(), []);
    }).toThrow(DomainError);
  });

  it('should apply enrichment and update timestamp', () => {
    const content = MediaContent.create('Title', 'Description', 'Genre', new Date(), ['Actor']);
    const beforeUpdate = content.updatedAt;

    const enrichment = new MediaEnrichment('Summary', ['tag'], 'positive', [0.1, 0.2]);
    content.applyEnrichment(enrichment);

    expect(content.enrichment?.summary).toBe('Summary');
    expect(content.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
  });
});
