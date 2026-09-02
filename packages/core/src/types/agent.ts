import { AgentIntent } from '../ports/outbound/IGeminiReasoningPort';
import { GreenlightRecommendation } from '../ports/outbound/IGeminiReasoningPort';

export type AgentStepName =
  | 'INTENT'
  | 'DISCOVER'
  | 'PLAN_SQL'
  | 'EXECUTE'
  | 'SYNTHESIZE'
  | 'AUDIT';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface AgentStep {
  step: AgentStepName;
  status: AgentStepStatus;
  startedAt: string;
  completedAt?: string;
  input?: unknown;
  output?: unknown;
  latencyMs?: number;
  error?: string;
}

export interface AgentRunResult {
  runId: string;
  intent: AgentIntent;
  userPrompt: string;
  answer: string;
  sql?: string;
  queryRows?: Record<string, unknown>[];
  recommendations?: GreenlightRecommendation[];
  steps: AgentStep[];
  totalLatencyMs: number;
  model: string;
  /** True when Gemini was skipped or failed and MCP + TypeScript still produced the answer. */
  fallback?: boolean;
}
