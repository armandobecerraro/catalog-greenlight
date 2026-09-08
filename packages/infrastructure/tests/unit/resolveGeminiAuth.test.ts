import {
  describeGeminiAuthMode,
  envFlagEnabled,
  isGeminiVertexEnabled,
  resolveGeminiVertexConfig,
  resolveGoogleAuthCredentials,
} from '../../src/gemini/resolveGeminiAuth';

describe('resolveGeminiAuth', () => {
  const keys = [
    'GOOGLE_GENAI_USE_VERTEXAI',
    'GOOGLE_GENAI_USE_ENTERPRISE',
    'GOOGLE_CLOUD_PROJECT',
    'GCLOUD_PROJECT',
    'GOOGLE_CLOUD_LOCATION',
    'GOOGLE_CLOUD_REGION',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  ] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('parses truthy env flags', () => {
    expect(envFlagEnabled(undefined)).toBe(false);
    expect(envFlagEnabled('')).toBe(false);
    expect(envFlagEnabled('false')).toBe(false);
    expect(envFlagEnabled('true')).toBe(true);
    expect(envFlagEnabled('1')).toBe(true);
    expect(envFlagEnabled('YES')).toBe(true);
  });

  it('detects Vertex from GOOGLE_GENAI_USE_VERTEXAI', () => {
    expect(isGeminiVertexEnabled()).toBe(false);
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
    expect(isGeminiVertexEnabled()).toBe(true);
    expect(describeGeminiAuthMode()).toMatch(/^vertex:\(misconfigured\)/);
  });

  it('prefers ENTERPRISE flag when both are set', () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
    process.env.GOOGLE_GENAI_USE_ENTERPRISE = 'false';
    expect(isGeminiVertexEnabled()).toBe(false);
  });

  it('resolves project and default location', () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
    process.env.GOOGLE_CLOUD_PROJECT = 'demo-proj';
    expect(resolveGeminiVertexConfig()).toEqual({
      project: 'demo-proj',
      location: 'us-central1',
    });
    expect(describeGeminiAuthMode()).toBe('vertex:demo-proj@us-central1');
  });

  it('throws when Vertex is on without project', () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
    expect(() => resolveGeminiVertexConfig()).toThrow(/GOOGLE_CLOUD_PROJECT/);
  });

  it('parses inline service-account JSON', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
      type: 'service_account',
      client_email: 'sa@demo.iam.gserviceaccount.com',
    });
    expect(resolveGoogleAuthCredentials()).toMatchObject({ type: 'service_account' });
  });

  it('accepts raw JSON in GOOGLE_APPLICATION_CREDENTIALS', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '{"type":"service_account","project_id":"p"}';
    expect(resolveGoogleAuthCredentials()?.project_id).toBe('p');
  });

  it('ignores file-path GOOGLE_APPLICATION_CREDENTIALS (ADC)', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/secrets/sa.json';
    expect(resolveGoogleAuthCredentials()).toBeUndefined();
  });

  it('rejects invalid credentials JSON', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{not-json';
    expect(() => resolveGoogleAuthCredentials()).toThrow(/Invalid Google service-account JSON/);
  });

  it('describes aistudio mode when Vertex is off', () => {
    expect(describeGeminiAuthMode()).toBe('aistudio-apiKey');
  });
});
