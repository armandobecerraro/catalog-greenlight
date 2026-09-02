import {
  Cast,
  MediaContent,
  MediaEnrichment,
  ReleaseDate,
  DomainError
} from '@bas/core';

describe('Cast', () => {
  it('trims members and supports lookup/equality', () => {
    const cast = Cast.create(['  Ada  ', 'Grace']);
    expect(cast.length).toBe(2);
    expect(cast.includes('Ada')).toBe(true);
    expect(cast.toArray()).toEqual(['Ada', 'Grace']);
    expect(cast.equals(Cast.create(['Ada', 'Grace']))).toBe(true);
    expect(cast.equals(Cast.create(['Ada']))).toBe(false);
    expect(cast.equals(Cast.create(['Ada', 'Other']))).toBe(false);
  });

  it('rejects empty arrays and whitespace-only members', () => {
    expect(() => Cast.create([])).toThrow(DomainError);
    expect(() => Cast.create(null as never)).toThrow(DomainError);
    expect(() => Cast.create(['  '])).toThrow(DomainError);
  });

  it('fromArray skips validation', () => {
    expect(Cast.fromArray(['x']).members).toEqual(['x']);
  });
});

describe('ReleaseDate', () => {
  it('accepts past dates and compares them', () => {
    const a = ReleaseDate.create('2020-01-02T00:00:00.000Z');
    const b = ReleaseDate.fromDate(new Date('2020-01-02T00:00:00.000Z'));
    expect(a.equals(b)).toBe(true);
    expect(a.toDateOnlyString()).toBe('2020-01-02');
    expect(a.toString()).toContain('2020-01-02');
    expect(a.value).toBeInstanceOf(Date);
    expect(ReleaseDate.create(new Date('2020-01-02T00:00:00.000Z')).equals(a)).toBe(true);
  });

  it('rejects invalid and future dates', () => {
    expect(() => ReleaseDate.create('not-a-date')).toThrow(DomainError);
    const future = new Date(Date.now() + 86_400_000 * 3);
    expect(() => ReleaseDate.create(future)).toThrow(DomainError);
  });
});

describe('MediaEnrichment', () => {
  it('creates, mutates copies, and round-trips JSON', () => {
    const original = MediaEnrichment.create('Summary', ['a'], 'positive', [0.1]);
    const next = original.withSummary('Other').withSentiment('neutral').withEmbedding([0.2, 0.3]);
    expect(next.summary).toBe('Other');
    expect(next.sentiment).toBe('neutral');
    expect(next.embedding).toEqual([0.2, 0.3]);
    expect(original.equals(next)).toBe(false);
    expect(original.equals(MediaEnrichment.create('Summary', ['a'], 'positive'))).toBe(true);

    const json = original.toJSON();
    const restored = MediaEnrichment.fromJSON({
      summary: String(json.summary),
      tags: json.tags as string[],
      sentiment: String(json.sentiment),
      embedding: json.embedding as number[]
    });
    expect(restored.tags).toEqual(['a']);
    expect(restored.embedding).toEqual([0.1]);
  });

  it('rejects empty summary and invalid sentiment', () => {
    expect(() => MediaEnrichment.create('  ', [], 'positive')).toThrow(DomainError);
    expect(() => MediaEnrichment.create('ok', [], 'mixed' as 'positive')).toThrow(DomainError);
    expect(() => MediaEnrichment.create('ok', [], '' as 'positive')).toThrow(DomainError);
  });

  it('round-trips copies without embeddings', () => {
    const plain = MediaEnrichment.create('Summary', ['a'], 'negative');
    expect(plain.embedding).toBeNull();
    expect(plain.toJSON().embedding).toBeNull();
    expect(plain.withSummary('Next').embedding).toBeNull();
    expect(plain.withSentiment('positive').sentiment).toBe('positive');
    expect(MediaEnrichment.fromJSON({ summary: 'S', tags: ['t'], sentiment: 'neutral' }).embedding).toBeNull();
  });
});

describe('MediaContent mutations', () => {
  function film() {
    return MediaContent.create('Title', 'A valid description', 'Drama', '2020-01-01', ['Ada']);
  }

  it('updates title, genre, and cast', () => {
    const content = film();
    content.updateTitle('New Title');
    content.updateGenre('Thriller');
    content.addCastMember('Grace');
    expect(content.title).toBe('New Title');
    expect(content.genre).toBe('Thriller');
    expect(content.cast).toEqual(['Ada', 'Grace']);
    content.removeCastMember('Ada');
    expect(content.cast).toEqual(['Grace']);
    expect(content.createdAt).toBeInstanceOf(Date);
    expect(content.toJSON().title).toBe('New Title');
    expect(content.equals(content)).toBe(true);
    expect(content.equals(film())).toBe(false);
    content.applyEnrichment(MediaEnrichment.create('Sum', ['t'], 'positive'));
    expect(content.toJSON().enrichment).toMatchObject({ summary: 'Sum' });
    expect(content.description).toBe('A valid description');
  });

  it('rejects empty mutations and last-cast removal', () => {
    const content = film();
    expect(() => content.updateTitle('')).toThrow(DomainError);
    expect(() => content.updateTitle('   ')).toThrow(DomainError);
    expect(() => content.updateGenre('  ')).toThrow(DomainError);
    expect(() => content.addCastMember('')).toThrow(DomainError);
    expect(() => content.removeCastMember('Ada')).toThrow(DomainError);
    expect(() => content.applyEnrichment(null as never)).toThrow(DomainError);
  });

  it('rejects empty title, description, and genre on create', () => {
    expect(() => MediaContent.create('  ', 'Desc', 'Drama', '2020-01-01', ['A'])).toThrow(DomainError);
    expect(() => MediaContent.create('T', '', 'Drama', '2020-01-01', ['A'])).toThrow(DomainError);
    expect(() => MediaContent.create('T', 'Desc', '', '2020-01-01', ['A'])).toThrow(DomainError);
  });
});
