import {
  describeGeminiAuthMode,
  envFlagEnabled,
  isGeminiVertexEnabled,
  resolveGeminiVertexConfig,
  resolveGoogleAuthCredentials,
} from "../../src/gemini/resolveGeminiAuth";

describe("resolveGeminiAuth", () => {
  const keys = [
    "GOOGLE_GENAI_USE_VERTEXAI",
    "GOOGLE_GENAI_USE_ENTERPRISE",
    "GOOGLE_CLOUD_PROJECT",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_LOCATION",
    "GOOGLE_CLOUD_REGION",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
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

  it("parses truthy env flags", () => {
    expect(envFlagEnabled(undefined)).toBe(false);
    expect(envFlagEnabled(null)).toBe(false);
    expect(envFlagEnabled("")).toBe(false);
    expect(envFlagEnabled("false")).toBe(false);
    expect(envFlagEnabled("true")).toBe(true);
    expect(envFlagEnabled("1")).toBe(true);
    expect(envFlagEnabled("YES")).toBe(true);
    expect(envFlagEnabled("on")).toBe(true);
  });

  it("detects Vertex from GOOGLE_GENAI_USE_VERTEXAI", () => {
    expect(isGeminiVertexEnabled()).toBe(false);
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    expect(isGeminiVertexEnabled()).toBe(true);
    expect(describeGeminiAuthMode()).toMatch(/^vertex:\(misconfigured\)/);
  });

  it("prefers ENTERPRISE flag when both are set", () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_GENAI_USE_ENTERPRISE = "false";
    expect(isGeminiVertexEnabled()).toBe(false);
  });

  it("falls through blank ENTERPRISE to VERTEXAI flag", () => {
    process.env.GOOGLE_GENAI_USE_ENTERPRISE = "   ";
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    expect(isGeminiVertexEnabled()).toBe(true);
  });

  it("resolves project and default location", () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_CLOUD_PROJECT = "demo-proj";
    expect(resolveGeminiVertexConfig()).toEqual({
      project: "demo-proj",
      location: "us-central1",
    });
    expect(describeGeminiAuthMode()).toBe("vertex:demo-proj@us-central1");
  });

  it("accepts GCLOUD_PROJECT and GOOGLE_CLOUD_REGION aliases", () => {
    process.env.GCLOUD_PROJECT = "alias-proj";
    process.env.GOOGLE_CLOUD_REGION = "europe-west1";
    expect(resolveGeminiVertexConfig()).toEqual({
      project: "alias-proj",
      location: "europe-west1",
    });
  });

  it("throws when Vertex is on without project", () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    expect(() => resolveGeminiVertexConfig()).toThrow(/GOOGLE_CLOUD_PROJECT/);
  });

  it("parses inline service-account JSON", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
      type: "service_account",
      client_email: "sa@demo.iam.gserviceaccount.com",
    });
    expect(resolveGoogleAuthCredentials()).toMatchObject({ type: "service_account" });
  });

  it("accepts raw JSON in GOOGLE_APPLICATION_CREDENTIALS", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '{"type":"service_account","project_id":"p"}';
    expect(resolveGoogleAuthCredentials()?.project_id).toBe("p");
  });

  it("ignores file-path GOOGLE_APPLICATION_CREDENTIALS (ADC)", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/secrets/sa.json";
    expect(resolveGoogleAuthCredentials()).toBeUndefined();
  });

  it("ignores non-object-looking GOOGLE_APPLICATION_CREDENTIALS strings", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "{incomplete";
    expect(resolveGoogleAuthCredentials()).toBeUndefined();
  });

  it("rejects invalid credentials JSON", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "{not-json";
    expect(() => resolveGoogleAuthCredentials()).toThrow(/Invalid Google service-account JSON/);
  });

  it("rejects non-object credentials JSON (null / array / scalar)", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "null";
    expect(() => resolveGoogleAuthCredentials()).toThrow(/credentials JSON must be an object/);
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "[1,2]";
    expect(() => resolveGoogleAuthCredentials()).toThrow(/credentials JSON must be an object/);
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '"string"';
    expect(() => resolveGoogleAuthCredentials()).toThrow(/credentials JSON must be an object/);
  });

  it("stringifies non-Error parse failures", () => {
    const spy = jest.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw "plain-parse-fail";
    });
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account"}';
    expect(() => resolveGoogleAuthCredentials()).toThrow(/plain-parse-fail/);
    spy.mockRestore();
  });

  it("describes aistudio mode when Vertex is off", () => {
    expect(describeGeminiAuthMode()).toBe("aistudio-apiKey");
  });
});
