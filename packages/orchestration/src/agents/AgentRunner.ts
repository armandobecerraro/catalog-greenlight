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

export interface AgentRunnerOptions {
  defaultIntent?: AgentIntent;
  skipAudit?: boolean;
}

export class AgentRunner {
  constructor(
    private readonly mcp: IMcpConnector,
    private readonly reasoning: IGeminiReasoningPort,
    private readonly modelName: string = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  ) {}

  async run(userPrompt: string, options: AgentRunnerOptions = {}): Promise<AgentRunResult> {
    const runId = uuidv4();
    const totalStart = Date.now();
    const steps: AgentStep[] = [];

    const intent = await this.runStep(steps, 'INTENT', async () => {
      if (options.defaultIntent) return options.defaultIntent;
      return this.reasoning.classifyIntent(userPrompt);
    });

    const schemaParts: string[] = [];
    await this.runStep(steps, 'DISCOVER', async () => {
      const databases = await this.mcp.listDatabases();
      schemaParts.push(`Databases: ${databases.join(', ')}`);
      if (databases.includes('media_catalog')) {
        const tables = await this.mcp.listTables('media_catalog');
        schemaParts.push(`Tables in media_catalog: ${tables.join(', ')}`);
      }
      return { databases, schema: schemaParts.join('\n') };
    });

    const sql = await this.runStep(steps, 'PLAN_SQL', async () => {
      const generated = await this.reasoning.generateSql(intent, userPrompt, schemaParts.join('\n'));
      validateGeneratedSql(generated, intent);
      return generated;
    });

    const queryResult = await this.runStep(steps, 'EXECUTE', async () => {
      validateGeneratedSql(sql, intent);
      const result = await this.mcp.runQuery(sql);
      return { rows: result.rows, latencyMs: result.metadata.latencyMs };
    });

    const synthesis = await this.runStep(steps, 'SYNTHESIZE', async () => {
      return this.reasoning.synthesize(intent, userPrompt, sql, queryResult.rows);
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
            '${this.modelName}',
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
      queryRows: queryResult.rows,
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
