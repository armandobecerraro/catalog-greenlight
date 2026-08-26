import { IGeminiEnrichmentPort } from '@bas/core';
import { MediaEnrichment } from '@bas/core';

type EnrichmentContent = {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: readonly string[];
};

const MOCK_RESPONSES: Record<string, { summary: string; tags: string[] }> = {
  action: {
    summary: 'A high-octane action thriller featuring spectacular stunts and intense combat sequences.',
    tags: ['action', 'thriller', 'adventure', 'high-energy']
  },
  comedy: {
    summary: 'A laugh-out-loud comedy that delivers non-stop humor and witty character interactions.',
    tags: ['comedy', 'humor', 'entertainment', 'light-hearted']
  },
  drama: {
    summary: 'A deeply moving drama exploring complex human relationships and emotional journeys.',
    tags: ['drama', 'emotional', 'character-driven', 'thought-provoking']
  },
  horror: {
    summary: 'A chilling horror experience with terrifying moments and psychological suspense.',
    tags: ['horror', 'thriller', 'suspense', 'dark']
  },
  'sci-fi': {
    summary: 'A visionary sci-fi saga exploring futuristic concepts and cutting-edge technology.',
    tags: ['sci-fi', 'futuristic', 'technology', 'speculative']
  },
  romance: {
    summary: 'A heartwarming romance celebrating love, connection, and emotional intimacy.',
    tags: ['romance', 'love-story', 'emotional', 'uplifting']
  }
};

export class FakeGeminiEnrichmentClient implements IGeminiEnrichmentPort {
  async enrich(content: EnrichmentContent): Promise<MediaEnrichment> {
    const genreKey = content.genre.toLowerCase();
    let response = MOCK_RESPONSES[genreKey];

    if (!response) {
      for (const [key, value] of Object.entries(MOCK_RESPONSES)) {
        if (genreKey.includes(key)) {
          response = value;
          break;
        }
      }
    }

    const simulatedLatency = process.env.NODE_ENV === 'test' ? 0 : 50 + Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    const summary = this.applyTemplate(response?.summary ?? '', content);
    const tags = this.expandTags(response?.tags ?? [], content);

    return MediaEnrichment.create(summary, tags, 'positive');
  }

  private applyTemplate(template: string, content: EnrichmentContent): string {
    let result = template
      .replace(/\$\{title\}/g, content.title)
      .replace(/\$\{genre\}/g, content.genre)
      .replace(/\$\{description\}/g, content.description);

    if (result.length === 0) {
      result = `An engaging ${content.genre} film titled "${content.title}" with a compelling story and memorable characters.`;
    }

    if (!result.includes(content.title)) {
      result = `${content.title}: ${result}`;
    }

    return result;
  }

  private expandTags(baseTags: string[], content: EnrichmentContent): string[] {
    const tags = [...baseTags];
    const titleWords = content.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of titleWords.slice(0, 2)) {
      if (!tags.includes(word)) {
        tags.push(word);
      }
    }
    const castTag = `cast-${content.cast.length}`;
    if (!tags.includes(castTag)) {
      tags.push(castTag);
    }
    return tags;
  }
}
