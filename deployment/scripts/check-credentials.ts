/**
 * Verify local .env credentials without printing secrets.
 * Usage: npm run check:credentials
 */
import { loadRepoEnv } from '../../packages/infrastructure/src/loadEnv';
import { buildClickHouseConfig } from '../../packages/infrastructure/src/partners/ConnectorFactory';
import { McpClickHouseConnector } from '../../packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector';
import { generateGeminiText } from '../../packages/infrastructure/src/gemini/generateContent';
import { resolveGeminiApiKey, resolveGeminiApiKeys } from '../../packages/infrastructure/src/gemini/resolveGeminiApiKey';

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
  const keys = resolveGeminiApiKeys();
  const key = resolveGeminiApiKey();
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  console.log(`\n[Gemini] ${keys.length} key(s) configured · primary shape: ${keyShape(key)} · model: ${model}`);
  try {
    const text = await generateGeminiText(key, 'Reply with exactly: OK', model);
    console.log(`[Gemini] PASS — response: ${text.slice(0, 60)}`);
    return true;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const msg = redactSecrets(raw, keys);
    console.log(`[Gemini] FAIL — ${msg.slice(0, 400)}`);
    if (/billing|credit|verify|suspended|PERMISSION_DENIED|403/i.test(msg)) {
      console.log(
        '[Gemini] Hint: open https://aistudio.google.com/apikey → Billing → verify identity and add prepaid credit.'
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
