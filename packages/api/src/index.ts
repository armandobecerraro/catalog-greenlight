import './loadEnv';
import { createApp } from './createApp';
import { composeRuntime, startingRuntime } from './composition';

const runtime = startingRuntime();
const app = createApp(runtime);

const PORT = process.env.PORT || 8080;

async function startup(): Promise<void> {
  app.listen(PORT, () => {
    console.log(`Catalog Greenlight API listening on port ${PORT} (initializing MCP + Gemini...)`);
  });

  try {
    const live = await composeRuntime();
    Object.assign(runtime, live);
    console.log('Catalog Greenlight API ready — ClickHouse MCP + Gemini connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Object.assign(runtime, startingRuntime(message));
    console.error('Failed to initialize API (health still up):', message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startup();
}

export { app, createApp, startup };
