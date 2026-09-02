import {
  AgentRunResult,
  AgentStep,
  IMcpConnector,
  IGeminiReasoningPort,
  IAgentAuditPort,
  AgentIntent,
  WorkflowId,
  validateGeneratedSql,
  runAgentStep
} from '@bas/core';
import { discoverLiveSchema } from './SchemaCache';
import { runGreenlightAnalysis } from '../greenlight/GreenlightAnalyst';
import { groundRecommendations } from '../greenlight/groundRecommendations';
import {
  coerceGeneratedAskSql,
  isGeminiPlannerUnavailable,
  planSqlFallback,
  resolveAskIntent,
  synthesizeFromRows
} from './askSqlFallback';

export interface AgentRunnerOptions {
  defaultIntent?: AgentIntent;
  skipAudit?: boolean;
}

export class AgentRunner {
  constructor(
    private readonly mcp: IMcpConnector,
    private readonly reasoning: IGeminiReasoningPort,
    private readonly modelName: string,
    private readonly audit: IAgentAuditPort
  ) {}

  async runGreenlight(): Promise<AgentRunResult> {
    return runGreenlightAnalysis(this.mcp, this.reasoning, this.modelName, this.audit);
  }

  async run(userPrompt: string, options: AgentRunnerOptions = {}): Promise<AgentRunResult> {
    if (options.defaultIntent) {
      const special = this.specialIntentRunners[options.defaultIntent];
      if (special) {
        return special();
      }
    }

    const runId = WorkflowId.create().value;
    const totalStart = Date.now();
    const steps: AgentStep[] = [];

    let usedFallback = false;

    const intent = await runAgentStep(steps, 'INTENT', async () => {
      if (options.defaultIntent) return options.defaultIntent;
      try {
        const classified = await this.reasoning.classifyIntent(userPrompt);
        return resolveAskIntent(classified, userPrompt);
      } catch (error) {
        if (!isGeminiPlannerUnavailable(error)) throw error;
        usedFallback = true;
        return 'catalog_qa' as AgentIntent;
      }
    });

    const schemaText = await runAgentStep(steps, 'DISCOVER', async () => {
      const schema = await discoverLiveSchema(this.mcp);
      return { schema };
    });

    const planAttempts: Array<{ sql: string; note?: string; fallback?: boolean }> = [];
    let sql = '';

    await runAgentStep(steps, 'PLAN_SQL', async () => {
      try {
        sql = await this.reasoning.generateSql(intent, userPrompt, schemaText.schema);
        validateGeneratedSql(sql, intent);
        const coerced = coerceGeneratedAskSql(userPrompt, sql, schemaText.schema);
        if (coerced) {
          sql = coerced.sql;
          validateGeneratedSql(sql, coerced.intent);
          usedFallback = true;
          planAttempts.push({ sql, note: coerced.note, fallback: true });
          return { attempts: [...planAttempts], fallback: true, queryId: coerced.queryId };
        }
        planAttempts.push({ sql });
        return { attempts: [...planAttempts] };
      } catch (error) {
        if (intent === 'ingest' || !isGeminiPlannerUnavailable(error)) throw error;
        const fallback = planSqlFallback(userPrompt);
        sql = fallback.sql;
        validateGeneratedSql(sql, fallback.intent);
        usedFallback = true;
        planAttempts.push({ sql, note: fallback.note, fallback: true });
        return { attempts: [...planAttempts], fallback: true, queryId: fallback.queryId };
      }
    });

    const executeAttempts: Array<{ sql: string; rowCount: number; error?: string; retry?: boolean }> = [];
    let queryRows: Record<string, unknown>[] = [];

    await runAgentStep(steps, 'EXECUTE', async () => {
      const runOnce = async (statement: string) => {
        validateGeneratedSql(statement, intent === 'ingest' ? intent : 'catalog_qa');
        return this.mcp.runQuery(statement);
      };

      try {
        const result = await runOnce(sql);
        queryRows = result.rows;
        executeAttempts.push({ sql, rowCount: queryRows.length });
        if (queryRows.length === 0 && intent !== 'ingest') {
          throw new Error('Query returned 0 rows');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        executeAttempts.push({ sql, rowCount: 0, error: message });
        if (intent === 'ingest') {
          return { rows: [], attempts: executeAttempts };
        }
        try {
          const retrySql = await this.reasoning.generateSql(intent, userPrompt, schemaText.schema, {
            previousSql: sql,
            errorOrEmpty: message
          });
          validateGeneratedSql(retrySql, intent);
          sql = retrySql;
          planAttempts.push({ sql, note: 'retry after execute failure' });
        } catch (retryErr) {
          if (!isGeminiPlannerUnavailable(retryErr) && !isGeminiPlannerUnavailable(err)) {
            throw retryErr;
          }
          const fallback = planSqlFallback(userPrompt);
          sql = fallback.sql;
          validateGeneratedSql(sql, fallback.intent);
          usedFallback = true;
          planAttempts.push({ sql, note: fallback.note, fallback: true });
        }
        const retryResult = await runOnce(sql);
        queryRows = retryResult.rows;
        executeAttempts.push({ sql, rowCount: queryRows.length, retry: true });
      }

      return { rows: queryRows, attempts: executeAttempts, planAttempts: [...planAttempts] };
    });

    const synthesis = await runAgentStep(steps, 'SYNTHESIZE', async () => {
      try {
        const raw = await this.reasoning.synthesize(intent, userPrompt, sql, queryRows);
        const { recommendations } = groundRecommendations(raw.recommendations, queryRows);
        return { answer: raw.answer, recommendations };
      } catch (error) {
        if (!isGeminiPlannerUnavailable(error)) throw error;
        usedFallback = true;
        const raw = synthesizeFromRows(userPrompt, queryRows);
        return { answer: raw.answer, recommendations: raw.recommendations, fallback: true };
      }
    });

    if (!options.skipAudit) {
      await runAgentStep(steps, 'AUDIT', async () => {
        await this.audit.record({
          id: runId,
          userPrompt,
          intent,
          sqlExecuted: sql,
          latencyMs: Date.now() - totalStart,
          model: this.modelName,
          responseSummary: synthesis.answer.slice(0, 500)
        });
        return { auditId: runId };
      });
    }

    return {
      runId,
      intent,
      userPrompt,
      answer: synthesis.answer,
      sql,
      queryRows,
      recommendations: synthesis.recommendations,
      steps,
      totalLatencyMs: Date.now() - totalStart,
      model: this.modelName,
      fallback: usedFallback || undefined
    };
  }

  private get specialIntentRunners(): Partial<Record<AgentIntent, () => Promise<AgentRunResult>>> {
    return {
      greenlight: () => this.runGreenlight()
    };
  }
}
