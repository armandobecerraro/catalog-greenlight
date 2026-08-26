export function resolveGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key || key.trim().length === 0) {
    throw new Error(
      'GEMINI_API_KEY is required. Set GEMINI_API_KEY (or GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) before running the product or demo.'
    );
  }

  return key.trim();
}
