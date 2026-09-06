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

export function resolveGeminiApiKey(): string {
  const key = resolveGeminiApiKeys()[0];
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is required. Set GEMINI_API_KEY (or GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEYS) before running the product or demo.',
    );
  }
  return key;
}
