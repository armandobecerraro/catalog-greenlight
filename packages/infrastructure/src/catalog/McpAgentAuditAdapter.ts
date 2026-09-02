import {
  AgentAuditRecord,
  IAgentAuditPort,
  IMcpConnector,
  escapeSqlLiteral,
  validateAuditSql
} from '@bas/core';

export class McpAgentAuditAdapter implements IAgentAuditPort {
  constructor(private readonly mcp: IMcpConnector) {}

  async record(run: AgentAuditRecord): Promise<void> {
    const auditSql = `
      INSERT INTO media_catalog.agent_runs
        (id, user_prompt, intent, sql_executed, latency_ms, model, response_summary)
      VALUES (
        '${escapeSqlLiteral(run.id)}',
        '${escapeSqlLiteral(run.userPrompt)}',
        '${escapeSqlLiteral(run.intent)}',
        '${escapeSqlLiteral(run.sqlExecuted)}',
        ${Number(run.latencyMs) || 0},
        '${escapeSqlLiteral(run.model)}',
        '${escapeSqlLiteral(run.responseSummary)}'
      )
    `;
    validateAuditSql(auditSql.trim());
    await this.mcp.runQuery(auditSql.trim());
  }
}
