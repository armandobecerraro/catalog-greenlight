import {
  errorText,
  generateGeminiText,
  geminiKeyPool,
  isPermanentGeminiQuotaError,
} from '../../src/gemini/generateContent';
import { GoogleGenAI } from '@google/genai';

const generateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
  HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
}));

describe('generateGeminiText', () => {
  const geminiEnvKeys = [
    'GEMINI_API_KEYS',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    generateContent.mockReset();
    (GoogleGenAI as unknown as jest.Mock).mockClear();
    for (const key of geminiEnvKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of geminiEnvKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('returns trimmed text', async () => {
    generateContent.mockResolvedValue({ text: '  hello  ' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).resolves.toBe('hello');
    generateContent.mockResolvedValue({ text: 'flash' });
    await expect(generateGeminiText('k', 'p', 'gemini-2.5-flash')).resolves.toBe('flash');
  });

  it('retries retryable errors then succeeds', async () => {
    generateContent
      .mockRejectedValueOnce({ status: 503, message: 'UNAVAILABLE' })
      .mockResolvedValueOnce({ text: 'ok' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).resolves.toBe('ok');
  });

  it('throws when all models fail', async () => {
    generateContent.mockRejectedValue(new Error('hard fail'));
    await expect(generateGeminiText('k', 'p', 'missing-model')).rejects.toThrow('hard fail');
  });

  it('treats empty responses as failure and tries the next model', async () => {
    generateContent.mockResolvedValue({ text: '   ' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).rejects.toThrow(/empty response/);
  });

  it('skips unavailable models without retrying', async () => {
    generateContent
      .mockRejectedValueOnce(new Error('NOT_FOUND models/gemini-gone'))
      .mockResolvedValueOnce({ text: 'fallback-ok' });
    await expect(generateGeminiText('k', 'p', 'gemini-gone')).resolves.toBe('fallback-ok');
  });

  it('returns empty-text failures and wraps non-Error rejections', async () => {
    generateContent.mockResolvedValue({ text: '   ' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).rejects.toThrow(/empty response/);
    generateContent.mockRejectedValue('plain-fail');
    await expect(generateGeminiText('k', 'p', 'missing-model')).rejects.toThrow('plain-fail');
  });

  it('uses GEMINI_MODEL default and retries 429 then succeeds', async () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    generateContent.mockResolvedValueOnce({ text: 'from-default' });
    await expect(generateGeminiText('k', 'p')).resolves.toBe('from-default');

    process.env.GEMINI_MODEL = 'gemini-flash-latest';
    generateContent
      .mockRejectedValueOnce({ status: 429, message: 'rate limit' })
      .mockResolvedValueOnce({ text: 'after-429' });
    await expect(generateGeminiText('k', 'p', 'gemini-flash-latest')).resolves.toBe('after-429');
    process.env.GEMINI_MODEL = original;
  });

  it('retries high-demand message errors', async () => {
    generateContent
      .mockRejectedValueOnce(new Error('The model is on high demand'))
      .mockResolvedValueOnce({ text: 'ok' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).resolves.toBe('ok');
  });

  it('retries Resource exhausted message errors', async () => {
    generateContent
      .mockRejectedValueOnce(new Error('Resource exhausted'))
      .mockResolvedValueOnce({ text: 'ok' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).resolves.toBe('ok');
  });

  it('classifies billing vs generic errors', () => {
    expect(errorText('plain')).toBe('plain');
    expect(errorText(new Error('boom'))).toBe('boom');
    expect(errorText({ message: 'nested' })).toBe('nested');
    expect(errorText({ message: null })).toBe('[object Object]');
    expect(errorText({ message: '' })).toBe('[object Object]');
    expect(errorText({ status: 429 })).toBe('[object Object]');
    expect(errorText(null)).toBe('null');
    expect(isPermanentGeminiQuotaError('Your prepayment credits are depleted')).toBe(true);
    expect(
      isPermanentGeminiQuotaError(
        '{"error":{"code":429,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ","status":"RESOURCE_EXHAUSTED"}}',
      ),
    ).toBe(true);
    expect(
      isPermanentGeminiQuotaError(
        'Please go to AI Studio at https://ai.studio to manage your project',
      ),
    ).toBe(false);
    expect(
      isPermanentGeminiQuotaError(
        'Your prepayment credits are depleted. Please go to AI Studio. billing#prepay',
      ),
    ).toBe(true);
    expect(isPermanentGeminiQuotaError(new Error('Resource exhausted'))).toBe(false);
    expect(isPermanentGeminiQuotaError(new Error('429 rate limit'))).toBe(false);
    expect(geminiKeyPool('')).toEqual([]);
    expect(geminiKeyPool('primary')).toEqual(['primary']);
    process.env.GEMINI_API_KEYS = 'primary, backup';
    expect(geminiKeyPool('primary')).toEqual(['primary', 'backup']);
    process.env.GOOGLE_API_KEY = 'alias-key';
    expect(geminiKeyPool('primary')).toEqual(['primary', 'alias-key', 'backup']);
  });

  it('fails fast on prepaid quota instead of retrying models', async () => {
    generateContent.mockRejectedValue({
      status: 429,
      message: 'Your prepayment credits are depleted. Please go to AI Studio.',
    });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).rejects.toThrow(/prepayment credits/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rotates to GEMINI_API_KEYS when the primary key is billed out', async () => {
    process.env.GEMINI_API_KEYS = 'backup-key';
    generateContent
      .mockRejectedValueOnce({
        status: 429,
        message: 'Your prepayment credits are depleted. Please go to AI Studio.',
      })
      .mockResolvedValueOnce({ text: 'from-backup' });
    await expect(generateGeminiText('primary-key', 'p', 'gemini-test')).resolves.toBe(
      'from-backup',
    );
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(GoogleGenAI).toHaveBeenNthCalledWith(1, { apiKey: 'primary-key' });
    expect(GoogleGenAI).toHaveBeenNthCalledWith(2, { apiKey: 'backup-key' });
    expect(geminiKeyPool('primary-key')).toEqual(['primary-key', 'backup-key']);
  });

  it('does not rotate keys on non-quota failures', async () => {
    process.env.GEMINI_API_KEYS = 'backup-key';
    generateContent.mockRejectedValue(new Error('hard fail using backup-key'));
    await expect(generateGeminiText('primary-key', 'p', 'missing-model')).rejects.toThrow(
      'hard fail using [REDACTED]',
    );
  });

  it('rejects an empty key pool', async () => {
    await expect(generateGeminiText('  ', 'p', 'gemini-test')).rejects.toThrow(
      /GEMINI_API_KEY is required/,
    );
  });

  it('wraps object failures with a message', async () => {
    generateContent.mockRejectedValue({ message: 'object-fail' });
    await expect(generateGeminiText('k', 'p', 'missing-model')).rejects.toThrow('object-fail');
  });
});
