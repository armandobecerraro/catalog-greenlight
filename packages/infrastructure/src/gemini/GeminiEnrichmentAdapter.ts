import { IGeminiEnrichmentPort } from '@bas/core';
import { MediaEnrichment } from '@bas/core';
import { generateGeminiText } from './generateContent';

type EnrichmentContent = {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: readonly string[];
};

export class GeminiEnrichmentAdapter implements IGeminiEnrichmentPort {
  constructor(private readonly apiKey: string) {}

  async enrich(content: EnrichmentContent): Promise<MediaEnrichment> {
    const prompt = `You are a media content enrichment assistant for a Latin/US streaming catalog. Analyze the content and provide:
1. A detailed summary (2-3 sentences)
2. 5-10 relevant tags
3. A one-sentence positioning statement for programming (time slot / audience)

Return JSON with keys "summary", "tags", and "positioning".

Content:
Title: ${content.title}
Description: ${content.description}
Genre: ${content.genre}
Release Date: ${content.releaseDate}
Cast: ${content.cast.join(', ')}`;

    const text = await generateGeminiText(this.apiKey, prompt);

    let parsed: { summary: string; tags: string[] };
    try {
      parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    } catch {
      const lines = text.trim().split('\n');
      parsed = {
        summary: lines[0] || 'No summary available',
        tags: lines.slice(1).map((l: string) => l.trim()).filter(l => l.length > 0)
      };
    }

    return MediaEnrichment.create(
      parsed.summary || `Enrichment for ${content.title}`,
      parsed.tags.length > 0 ? parsed.tags : [content.genre.toLowerCase()],
      'positive'
    );
  }
}
