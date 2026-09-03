export interface AgentAuditRecord {
  id: string;
  userPrompt: string;
  intent: string;
  sqlExecuted: string;
  latencyMs: number;
  model: string;
  responseSummary: string;
}

export interface IAgentAuditPort {
  record(run: AgentAuditRecord): Promise<void>;
}
