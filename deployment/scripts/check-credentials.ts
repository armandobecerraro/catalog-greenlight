/**
 * Verify local .env credentials without printing secrets.
 * Usage: npm run check:credentials
 */
import { loadRepoEnv } from '../../packages/infrastructure/src/loadEnv';
import { buildClickHouseConfig } from '../../packages/infrastructure/src/partners/ConnectorFactory';
import { McpClickHouseConnector } from '../../packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector';
import { generateGeminiText } from '../../packages/infrastructure/src/gemini/generateContent';
import { resolveGeminiApiKey, resolveGeminiApiKeys } from '../../packages/infrastructure/src/gemini/resolveGeminiApiKey';
import {
  describeGeminiAuthMode,
  isGeminiVertexEnabled,
  resolveGeminiVertexConfig,
} from '../../packages/infrastructure/src/gemini/resolveGeminiAuth';

function redact(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join('[REDACTED]');
}

function redactSecrets(message: string, secrets: string[]): string {
  return secrets.reduce((text, secret) => redact(text, secret), message);
}

function keyShape(key: string): string {
  const prefix = key.slice(0, 3);
  return `${prefix}… (len=${key.length})`;
}

async function checkGemini(): Promise<boolean> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const mode = describeGeminiAuthMode();

  if (isGeminiVertexEnabled()) {
    const { project, location } = resolveGeminiVertexConfig();
    const hasInlineJson = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()?.startsWith('{'),
    );
    const hasCredPath = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() &&
        !process.env.GOOGLE_APPLICATION_CREDENTIALS.trim().startsWith('{'),
    );
    console.log(
      `\n[Gemini] Vertex AI · project: ${project} · location: ${location} · model: ${model} · mode: ${mode}`,
    );
    console.log(
      `[Gemini] Credentials: ${hasInlineJson ? 'inline JSON env' : hasCredPath ? 'ADC file path' : 'ADC default (gcloud / metadata)'}`,
    );
    try {
      const text = await generateGeminiText('', 'Reply with exactly: OK', model);
      console.log(`[Gemini] PASS — response: ${text.slice(0, 60)}`);
      return true;
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      console.log(`[Gemini] FAIL — ${raw.slice(0, 400)}`);
      console.log(
        '[Gemini] Hint: enable Vertex AI API, attach the Partner Marketing credit to the GCP billing account, and set a service account with roles/aiplatform.user (Render: GOOGLE_APPLICATION_CREDENTIALS_JSON).',
      );
      return false;
    }
  }

  const keys = resolveGeminiApiKeys();
  const key = resolveGeminiApiKey();
  console.log(
    `\n[Gemini] AI Studio · ${keys.length} key(s) configured · primary shape: ${keyShape(key)} · model: ${model} · mode: ${mode}`,
  );
  try {
    const text = await generateGeminiText(key, 'Reply with exactly: OK', model);
    console.log(`[Gemini] PASS — response: ${text.slice(0, 60)}`);
    return true;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const msg = redactSecrets(raw, keys);
    console.log(`[Gemini] FAIL — ${msg.slice(0, 400)}`);
    if (/billing|credit|verify|suspended|PERMISSION_DENIED|403|prepayment|depleted/i.test(msg)) {
      console.log(
        '[Gemini] Hint: AI Studio prepaid is separate from GCP credits. Prefer GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT so hackathon GCP billing credits apply.',
      );
    }
    return false;
  }
}

async function checkClickHouseMcp(): Promise<boolean> {
  const config = buildClickHouseConfig();
  const { host, port, secure } = config.credentials;
  console.log(`\n[ClickHouse MCP] host: ${host} · port: ${port} · secure: ${secure}`);
  const connector = new McpClickHouseConnector();
  try {
    await connector.connect(config);
    const result = await connector.runQuery(
      'SELECT count() AS titles FROM media_catalog.media_content'
    );
    const count = result.rows[0]?.titles ?? result.rows[0]?.['count()'];
    console.log(`[ClickHouse MCP] PASS — titles: ${count} · latency: ${result.metadata.latencyMs}ms`);
    await connector.disconnect();
    return true;
  } catch (error) {
    const password = config.credentials.password || '';
    const raw = error instanceof Error ? error.message : String(error);
    const msg = redact(raw, password);
    console.log(`[ClickHouse MCP] FAIL — ${msg.slice(0, 400)}`);
    return false;
  }
}

async function main(): Promise<void> {
  loadRepoEnv();
  console.log('Catalog Greenlight — credential check (secrets never printed)');

  const geminiOk = await checkGemini();
  const chOk = await checkClickHouseMcp();

  console.log('\n--- Summary ---');
  console.log(`Gemini:          ${geminiOk ? 'OK' : 'FAIL'}`);
  console.log(`ClickHouse MCP:  ${chOk ? 'OK' : 'FAIL'}`);

  if (!geminiOk) {
    console.log(
      '\nGreenlight still works with scorer fallback when Gemini is down; /ask and /ingest need Gemini.'
    );
  }

  process.exit(geminiOk && chOk ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
