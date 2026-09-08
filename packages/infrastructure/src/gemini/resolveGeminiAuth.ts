/**
 * Gemini auth: AI Studio apiKey (local/dev) or Vertex AI billed to a GCP project.
 *
 * Vertex uses GCP billing / promotional credits (not AI Studio prepaid).
 * Preferred env flag: GOOGLE_GENAI_USE_VERTEXAI=true
 * Alias: GOOGLE_GENAI_USE_ENTERPRISE=true (SDK rename; treated the same here).
 */

export type GeminiVertexConfig = {
  project: string;
  location: string;
};

/** Truthy env values for Vertex / Enterprise cloud flag. */
export function envFlagEnabled(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Prefer Vertex when GOOGLE_GENAI_USE_VERTEXAI or GOOGLE_GENAI_USE_ENTERPRISE is set.
 * If both are set with conflicting values, ENTERPRISE wins (matches @google/genai).
 */
export function isGeminiVertexEnabled(): boolean {
  const enterprise = process.env.GOOGLE_GENAI_USE_ENTERPRISE;
  const vertex = process.env.GOOGLE_GENAI_USE_VERTEXAI;
  if (enterprise !== undefined && String(enterprise).trim() !== '') {
    return envFlagEnabled(enterprise);
  }
  return envFlagEnabled(vertex);
}

export function resolveGeminiVertexConfig(): GeminiVertexConfig {
  const project = (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '').trim();
  const location = (process.env.GOOGLE_CLOUD_LOCATION || process.env.GOOGLE_CLOUD_REGION || '').trim();
  if (!project) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT is required when GOOGLE_GENAI_USE_VERTEXAI=true (or GOOGLE_GENAI_USE_ENTERPRISE=true).',
    );
  }
  return {
    project,
    location: location || 'us-central1',
  };
}

/**
 * Optional inline service-account JSON for hosts (e.g. Render) that cannot mount a key file.
 * Prefer GOOGLE_APPLICATION_CREDENTIALS_JSON; also accept raw JSON in GOOGLE_APPLICATION_CREDENTIALS.
 * When unset, ADC uses GOOGLE_APPLICATION_CREDENTIALS as a file path (or the runtime metadata server).
 */
export function resolveGoogleAuthCredentials(): Record<string, unknown> | undefined {
  const inline =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
    lookLikeJsonCredentials(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!inline) return undefined;
  try {
    const parsed = JSON.parse(inline) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('credentials JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid Google service-account JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON (or GOOGLE_APPLICATION_CREDENTIALS): ${detail}`,
    );
  }
}

function lookLikeJsonCredentials(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  return undefined;
}

/** Human-readable mode for logs / health (no secrets). */
export function describeGeminiAuthMode(): string {
  if (isGeminiVertexEnabled()) {
    try {
      const { project, location } = resolveGeminiVertexConfig();
      return `vertex:${project}@${location}`;
    } catch {
      return 'vertex:(misconfigured)';
    }
  }
  return 'aistudio-apiKey';
}
