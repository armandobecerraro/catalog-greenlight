import { AgentIntent, GreenlightRecommendation } from '../ports/outbound/IGeminiReasoningPort';

export type GeminiStatus = 'explained' | 'skipped' | 'error';
export type WhyLost = 'lower_score' | 'diversity' | 'cannibal';

export interface ScoreBreakdownPayload {
  genre_gap: number;
  wow_momentum: number;
  cannibalization_penalty: number;
  language_gap: number;
  opportunity_score: number;
  weights: {
    genre_gap: number;
    wow_momentum: number;
    cannibalization_penalty: number;
    language_gap: number;
  };
  fromQueries: {
    genre_gap: 'A_genre_inventory';
    wow_momentum: 'B_title_momentum';
    cannibalization_penalty: 'C_cannibalization';
    language_gap: 'D_slate_holes';
  };
}

export interface RunnerUpPayload {
  title: string;
  genre: string;
  opportunity_score: number;
  whyLost: WhyLost;
}

export interface CannibalExcludedPayload {
  title: string;
  genre: string;
  opportunity_score: number;
  pair: { title_a: string; title_b: string; genre: string };
  copy: string;
}

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
  geminiStatus?: GeminiStatus;
  mcpMs?: number;
  geminiMs?: number;
  scoreBreakdown?: ScoreBreakdownPayload[];
  runnerUp?: RunnerUpPayload;
  cannibalExcluded?: CannibalExcludedPayload[];
}
