import { IGeminiEnrichmentPort } from "@bas/core";
import { GeminiEnrichmentAdapter } from "./GeminiEnrichmentAdapter";
import { GeminiReasoningAdapter } from "./GeminiReasoningAdapter";
import { resolveGeminiApiKey } from "./resolveGeminiApiKey";

/**
 * Builds real Gemini adapters for API/demo/web.
 * Auth is resolved at construction: Vertex (GCP billing) when
 * GOOGLE_GENAI_USE_VERTEXAI is set, otherwise AI Studio apiKey.
 */
export class GeminiClientFactory {
  constructor(private readonly resolveKey: () => string = resolveGeminiApiKey) {}

  createEnrichmentClient(): IGeminiEnrichmentPort {
    return new GeminiEnrichmentAdapter(this.resolveKey());
  }

  createReasoningClient(): GeminiReasoningAdapter {
    return new GeminiReasoningAdapter(this.resolveKey());
  }
}
