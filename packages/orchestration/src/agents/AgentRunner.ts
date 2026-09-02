import { v4 as uuidv4 } from 'uuid';
import {
  AgentRunResult,
  AgentStep,
  AgentStepName,
  IMcpConnector,
  IGeminiReasoningPort,
  AgentIntent,
  validateGeneratedSql,
  validateAuditSql
} from '@bas/core';
import { discoverLiveSchema } from './SchemaCache';
import { runGreenlightAnalysis } from '../greenlight/GreenlightAnalyst';
import { groundRecommendations } from '../greenlight/groundRecommendations';

export interface AgentRunnerOptions {
  defaultIntent?: AgentIntent;
  skipAudit?: boolean;
}

export class AgentRunner {
  constructor(
    private readonly mcp: IMcpConnector,
    private readonly reasoning: IGeminiReasoningPort,
    private readonly modelName: string = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  ) {}

  async runGreenlight(): Promise<AgentRunResult> {
    return runGreenlightAnalysis(this.mcp, this.reasoning, this.modelName);
  }

  async run(userPrompt: string, options: AgentRunnerOptions = {}): Promise<AgentRunResult> {
    if (options.defaultIntent === 'greenlight') {
      return this.runGreenlight();
    }

    const runId = uuidv4();
    const totalStart = Date.now();
    const steps: AgentStep[] = [];

    const intent = await this.runStep(steps, 'INTENT', async () => {
      if (options.defaultIntent) return options.defaultIntent;
      return this.reasoning.classifyIntent(userPrompt);
    });

    const schemaText = await this.runStep(steps, 'DISCOVER', async () => {
      const schema = await discoverLiveSchema(this.mcp);
      return { schema };
    });

    const planAttempts: Array<{ sql: string; note?: string }> = [];
    let sql = '';

    await this.runStep(steps, 'PLAN_SQL', async () => {
      sql = await this.reasoning.generateSql(intent, userPrompt, schemaText.schema);
      validateGeneratedSql(sql, intent);
      planAttempts.push({ sql });
      return { attempts: [...planAttempts] };
    });

    const executeAttempts: Array<{ sql: string; rowCount: number; error?: string; retry?: boolean }> = [];
    let queryRows: Record<string, unknown>[] = [];

    await this.runStep(steps, 'EXECUTE', async () => {
      const runOnce = async (statement: string) => {
        validateGeneratedSql(statement, intent);
        const result = await this.mcp.runQuery(statement);
        return result;
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
        const retrySql = await this.reasoning.generateSql(intent, userPrompt, schemaText.schema, {
          previousSql: sql,
          errorOrEmpty: message
        });
        validateGeneratedSql(retrySql, intent);
        sql = retrySql;
        planAttempts.push({ sql, note: 'retry after execute failure' });
        const retryResult = await runOnce(sql);
        queryRows = retryResult.rows;
        executeAttempts.push({ sql, rowCount: queryRows.length, retry: true });
      }

      return { rows: queryRows, attempts: executeAttempts, planAttempts: [...planAttempts] };
    });

    const synthesis = await this.runStep(steps, 'SYNTHESIZE', async () => {
      const raw = await this.reasoning.synthesize(intent, userPrompt, sql, queryRows);
      const { recommendations } = groundRecommendations(raw.recommendations, queryRows);
      return { answer: raw.answer, recommendations };
    });

    if (!options.skipAudit) {
      await this.runStep(steps, 'AUDIT', async () => {
        const auditSql = `
          INSERT INTO media_catalog.agent_runs
            (id, user_prompt, intent, sql_executed, latency_ms, model, response_summary)
          VALUES (
            '${runId}',
            '${this.escapeSql(userPrompt)}',
            '${intent}',
            '${this.escapeSql(sql)}',
            ${Date.now() - totalStart},
            '${this.escapeSql(this.modelName)}',
            '${this.escapeSql(synthesis.answer.slice(0, 500))}'
          )
        `;
        validateAuditSql(auditSql.trim());
        await this.mcp.runQuery(auditSql);
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
      model: this.modelName
    };
  }

  private async runStep<T>(
    steps: AgentStep[],
    stepName: AgentStepName,
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

  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
