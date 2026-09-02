import { generateGeminiText } from '../../src/gemini/generateContent';

const generateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent }
  })),
  HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
  }
}));

describe('generateGeminiText', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('returns trimmed text', async () => {
    generateContent.mockResolvedValue({ text: '  hello  ' });
    await expect(generateGeminiText('k', 'p', 'gemini-test')).resolves.toBe('hello');
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
});
