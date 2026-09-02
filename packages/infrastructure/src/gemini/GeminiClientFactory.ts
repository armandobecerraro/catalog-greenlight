import { IGeminiEnrichmentPort } from '@bas/core';
import { GeminiEnrichmentAdapter } from './GeminiEnrichmentAdapter';
import { GeminiReasoningAdapter } from './GeminiReasoningAdapter';
import { resolveGeminiApiKey } from './resolveGeminiApiKey';

export class GeminiClientFactory {
  constructor(private readonly resolveKey: () => string = resolveGeminiApiKey) {}

  createEnrichmentClient(): IGeminiEnrichmentPort {
    return new GeminiEnrichmentAdapter(this.resolveKey());
  }

  createReasoningClient(): GeminiReasoningAdapter {
    return new GeminiReasoningAdapter(this.resolveKey());
  }
}
