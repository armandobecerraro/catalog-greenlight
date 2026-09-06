import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { parseGeminiApiKeys, resolveGeminiApiKeys } from './resolveGeminiApiKey';

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash-lite'];

function defaultModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-flash-latest';
}

export function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (message != null && message !== '') return String(message);
  }
  return String(error);
}

/** Prepaid / billing-dead 429s from Gemini — not RPM RESOURCE_EXHAUSTED. Keep in sync with web `isPermanentGeminiQuota`. */
export function isPermanentGeminiQuotaError(error: unknown): boolean {
  return /prepayment credits(?: are)? depleted|credits are depleted|billing#prepay|billing must be active/i.test(
    errorText(error),
  );
}

function isModelUnavailable(error: unknown): boolean {
  return /NOT_FOUND|no longer available|models\/gemini/i.test(errorText(error));
}

const SAFETY = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  const message = errorText(error);
  return (
    status === 503 || status === 429 || /UNAVAILABLE|high demand|Resource exhausted/i.test(message)
  );
}

export function geminiKeyPool(primary: string): string[] {
  const keys = parseGeminiApiKeys(primary);
  for (const extra of resolveGeminiApiKeys()) {
    if (!keys.includes(extra)) keys.push(extra);
  }
  return keys;
}

function wrapError(error: unknown, keys: string[] = []): Error {
  const err = error instanceof Error ? error : new Error(errorText(error));
  if (keys.length === 0) return err;
  err.message = keys.reduce((text, key) => text.split(key).join('[REDACTED]'), err.message);
  return err;
}

async function generateWithModels(
  ai: GoogleGenAI,
  models: string[],
  prompt: string,
): Promise<string> {
  let lastError: unknown = new Error('Gemini request failed');

  for (const candidate of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: candidate,
          contents: prompt,
          config: { safetySettings: SAFETY },
        });
        const text = response?.text?.trim();
        if (text) return text;
        throw new Error('Gemini returned an empty response');
      } catch (error) {
        lastError = error;
        if (isPermanentGeminiQuotaError(error)) {
          throw wrapError(error);
        }
        if (isModelUnavailable(error)) {
          break;
        }
        if (!isRetryable(error) && attempt === 0) {
          break;
        }
        await sleep(800 * (attempt + 1));
      }
    }
  }

  throw wrapError(lastError);
}

export async function generateGeminiText(
  apiKey: string,
  prompt: string,
  model = defaultModel(),
): Promise<string> {
  const keys = geminiKeyPool(apiKey);
  if (keys.length === 0) {
    throw new Error(
      'GEMINI_API_KEY is required. Set GEMINI_API_KEY (or GEMINI_API_KEYS) before calling Gemini.',
    );
  }

  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastError: unknown = new Error('Gemini request failed');

  for (let i = 0; i < keys.length; i++) {
    const ai = new GoogleGenAI({ apiKey: keys[i] });
    try {
      return await generateWithModels(ai, models, prompt);
    } catch (error) {
      lastError = error;
      const hasBackup = i < keys.length - 1;
      if (!(isPermanentGeminiQuotaError(error) && hasBackup)) {
        break;
      }
    }
  }

  throw wrapError(lastError, keys);
}
