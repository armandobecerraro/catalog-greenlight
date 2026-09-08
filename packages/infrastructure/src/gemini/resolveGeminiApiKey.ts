import { isGeminiVertexEnabled, resolveGeminiVertexConfig } from './resolveGeminiAuth';

export function parseGeminiApiKeys(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function resolveGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ...parseGeminiApiKeys(process.env.GEMINI_API_KEYS),
  ];
  for (const candidate of candidates) {
    const key = typeof candidate === 'string' ? candidate.trim() : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * AI Studio apiKey for local/dev. When Vertex is enabled, returns '' (ADC / GCP billing).
 * Still validates that Vertex project env is set so boot fails loud instead of at first call.
 */
export function resolveGeminiApiKey(): string {
  if (isGeminiVertexEnabled()) {
    resolveGeminiVertexConfig();
    return '';
  }
  const key = resolveGeminiApiKeys()[0];
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is required (AI Studio), or set GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT (+ ADC / GOOGLE_APPLICATION_CREDENTIALS_JSON) for Vertex billed to GCP.',
    );
  }
  return key;
}
