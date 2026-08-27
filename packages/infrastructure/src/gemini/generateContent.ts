import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);
  return status === 503 || status === 429 || /UNAVAILABLE|high demand|Resource exhausted/i.test(message);
}

/**
 * Calls Gemini via the official `@google/genai` SDK (`google-genai`).
 * Uses the same generateContent RPC as AI Studio's curl (X-goog-api-key / AQ. keys).
 */
export async function generateGeminiText(apiKey: string, prompt: string, model = DEFAULT_MODEL): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const models = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: unknown;

  for (const candidate of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: candidate,
          contents: prompt,
          config: { safetySettings: SAFETY }
        });
        const text = response.text?.trim();
        if (text) return text;
        throw new Error('Gemini returned an empty response');
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) && attempt === 0) {
          break;
        }
        await sleep(800 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
