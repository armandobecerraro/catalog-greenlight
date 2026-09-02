import { v4 as uuidv4 } from 'uuid';
import {
  AgentRunResult,
  AgentStep,
  GreenlightRecommendation,
  IMcpConnector,
  IGeminiReasoningPort,
  validateAuditSql
} from '@bas/core';
import { GREENLIGHT_ANALYTICS_QUERIES } from '../greenlight/greenlightQueries';
import { scoreFromAnalyticsById, SCORER_WEIGHTS } from '../greenlight/GreenlightScorer';
import {
  groundRecommendations,
  recommendationsFromCandidateRows
} from '../greenlight/groundRecommendations';

/** Bound only the Gemini narrative call; MCP analytics + scorer are not capped here. */
export const GREENLIGHT_SYNTHESIZE_TIMEOUT_MS = 10_000;

const GREENLIGHT_USER_PROMPT =
  'Weekly greenlight: pick 3 titles using measured genre gaps, week-over-week momentum, and cannibalization penalties.';

const ANALYTICS_QUERY_IDS = {
  A: 'A_genre_inventory',
  B: 'B_title_momentum',
  C: 'C_cannibalization',
  D: 'D_slate_holes'
} as const;

export async function runGreenlightAnalysis(
  mcp: IMcpConnector,
  reasoning: IGeminiReasoningPort,
  modelName: string
): Promise<AgentRunResult> {
  const runId = uuidv4();
  const totalStart = Date.now();
  const steps: AgentStep[] = [];

  await runStep(steps, 'INTENT', async () => ({
    intent: 'greenlight',
    source: 'defaultIntent (no Gemini call)'
  }));

  const analyticsFullById = await runStep(steps, 'DISCOVER', async () => {
    const entries = Object.values(GREENLIGHT_ANALYTICS_QUERIES);
    const results = await Promise.all(
      entries.map(entry => runAnalyticsQuery(mcp, entry))
    );

    const fullById = Object.fromEntries(results.map(r => [r.id, r.fullRows]));

    return {
      fullById,
      queries: results.map(r => ({
        id: r.id,
        sql: r.sql,
        rowCount: r.rowCount,
        rows: r.fullRows.slice(0, 20),
        latencyMs: r.latencyMs,
        error: r.error
      }))
    };
  });

  const scoredPlan = scoreFromAnalyticsById(analyticsFullById.fullById);

  await runStep(steps, 'PLAN_SQL', async () => ({
    formula: `opportunity = ${SCORER_WEIGHTS.genre_gap}*genre_gap + ${SCORER_WEIGHTS.wow_momentum}*wow_momentum - ${SCORER_WEIGHTS.cannibalization_penalty}*cannibalization_penalty`,
    candidateCount: scoredPlan.scored.length,
    momentumRowsScored: (analyticsFullById.fullById[ANALYTICS_QUERY_IDS.B] ?? []).length,
    topCandidates: scoredPlan.top.map(c => ({
      title: c.title,
      genre: c.genre,
      opportunity_score: c.opportunity_score,
      wow_pct: c.wow_pct,
      genre_gap: c.genre_gap,
      in_cannibal_pair: c.in_cannibal_pair
    }))
  }));

  const candidates = await runStep(steps, 'EXECUTE', async () => ({
    rows: scoredPlan.candidateRows
  }));

  const candidateRows = candidates.rows as Record<string, unknown>[];
  const combinedSql = analyticsFullById.queries.map(q => `-- ${q.id}\n${q.sql}`).join('\n\n');

  const synthesis = await runSynthesizeStep(
    steps,
    reasoning,
    candidateRows,
    combinedSql
  );

  await runAuditStep(steps, mcp, {
    runId,
    combinedSql,
    modelName,
    totalLatencyMs: Date.now() - totalStart,
    summary: synthesis.recommendations.map(r => r.title).join(', ') || synthesis.answer.slice(0, 200)
  });

  return {
    runId,
    intent: 'greenlight',
    userPrompt: GREENLIGHT_USER_PROMPT,
    answer: synthesis.answer,
    sql: combinedSql,
    queryRows: candidateRows,
    recommendations: synthesis.recommendations,
    steps,
    totalLatencyMs: Date.now() - totalStart,
    model: modelName
  };
}

async function runSynthesizeStep(
  steps: AgentStep[],
  reasoning: IGeminiReasoningPort,
  candidateRows: Record<string, unknown>[],
  combinedSql: string
): Promise<{ answer: string; recommendations: GreenlightRecommendation[] }> {
  const startedAt = new Date().toISOString();
  const step: AgentStep = { step: 'SYNTHESIZE', status: 'running', startedAt };
  steps.push(step);
  const stepStart = Date.now();

  const fallbackAnswer =
    'Weekly greenlight from measured ClickHouse analytics (deterministic scorer; Gemini narrative unavailable).';
  const fallbackRecommendations = recommendationsFromCandidateRows(candidateRows);

  try {
    const raw = await withTimeout(
      reasoning.synthesizeGreenlight(GREENLIGHT_USER_PROMPT, combinedSql, candidateRows),
      GREENLIGHT_SYNTHESIZE_TIMEOUT_MS,
      `Gemini synthesis timed out after ${GREENLIGHT_SYNTHESIZE_TIMEOUT_MS / 1000}s`
    );
    const { recommendations, usedFallback } = groundRecommendations(raw.recommendations, candidateRows);

    if (usedFallback) {
      step.status = 'error';
      step.error = 'Gemini returned no grounded recommendations; using scorer fallback.';
      step.completedAt = new Date().toISOString();
      step.latencyMs = Date.now() - stepStart;
      step.output = {
        answer: raw.answer || fallbackAnswer,
        recommendations,
        fallback: true
      };
      return {
        answer: raw.answer || fallbackAnswer,
        recommendations
      };
    }

    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.output = { answer: raw.answer, recommendations };
    return { answer: raw.answer, recommendations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    step.status = 'error';
    step.error = message;
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.output = {
      answer: fallbackAnswer,
      recommendations: fallbackRecommendations,
      fallback: true,
      geminiError: message
    };
    return {
      answer: fallbackAnswer,
      recommendations: fallbackRecommendations
    };
  }
}

async function runAnalyticsQuery(
  mcp: IMcpConnector,
  entry: { id: string; sql: string },
  retries = 1
): Promise<{
  id: string;
  sql: string;
  rowCount: number;
  fullRows: Record<string, unknown>[];
  latencyMs: number;
  error?: string;
}> {
  try {
    const result = await mcp.runQuery(entry.sql);
    const fullRows = result.rows.filter(row => !isPoisonAnalyticsRow(row));
    return {
      id: entry.id,
      sql: entry.sql,
      rowCount: fullRows.length,
      fullRows,
      latencyMs: result.metadata.latencyMs
    };
  } catch (error) {
    if (retries > 0) {
      return runAnalyticsQuery(mcp, entry, retries - 1);
    }
    return {
      id: entry.id,
      sql: entry.sql,
      rowCount: 0,
      fullRows: [],
      latencyMs: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function isPoisonAnalyticsRow(row: Record<string, unknown>): boolean {
  if (typeof row.title === 'string' && row.title.trim()) return false;
  const text = typeof row.text === 'string' ? row.text : '';
  return /timed out|exception:|query timed out/i.test(text);
}

async function runStep<T>(
  steps: AgentStep[],
  stepName: AgentStep['step'],
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = new Date().toISOString();
  const step: AgentStep = { step: stepName, status: 'running', startedAt };
  steps.push(step);
  const stepStart = Date.now();

  try {
    const output = await fn();
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.output = output;
    return output;
  } catch (error) {
    step.status = 'error';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function runAuditStep(
  steps: AgentStep[],
  mcp: IMcpConnector,
  input: {
    runId: string;
    combinedSql: string;
    modelName: string;
    totalLatencyMs: number;
    summary: string;
  }
): Promise<void> {
  const startedAt = new Date().toISOString();
  const step: AgentStep = { step: 'AUDIT', status: 'running', startedAt };
  steps.push(step);
  const stepStart = Date.now();

  try {
    const auditSql = `
      INSERT INTO media_catalog.agent_runs
        (id, user_prompt, intent, sql_executed, latency_ms, model, response_summary)
      VALUES (
        '${input.runId}',
        '${escapeSql(GREENLIGHT_USER_PROMPT)}',
        'greenlight',
        '${escapeSql(input.combinedSql.slice(0, 4000))}',
        ${input.totalLatencyMs},
        '${input.modelName}',
        '${escapeSql(input.summary)}'
      )
    `;
    validateAuditSql(auditSql.trim());
    await mcp.runQuery(auditSql.trim());
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.output = { auditId: input.runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Greenlight AUDIT failed (recommendations still returned):', message);
    step.status = 'error';
    step.error = message;
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
  }
}
