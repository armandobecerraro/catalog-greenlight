export type AgentIntent = 'ingest' | 'catalog_qa' | 'greenlight' | 'stats';

export interface GreenlightRecommendation {
  title: string;
  genre: string;
  justification: string;
  evidence: string;
  opportunity_score?: number;
  wow_pct?: number;
  genre_gap?: number;
  in_cannibal_pair?: boolean;
}

export interface ReasoningSynthesis {
  answer: string;
  recommendations?: GreenlightRecommendation[];
}

export interface SqlRetryContext {
  previousSql: string;
  errorOrEmpty: string;
}

export interface IGeminiReasoningPort {
  classifyIntent(userPrompt: string): Promise<AgentIntent>;
  generateSql(
    intent: AgentIntent,
    userPrompt: string,
    schemaContext: string,
    retry?: SqlRetryContext
  ): Promise<string>;
  synthesize(
    intent: AgentIntent,
    userPrompt: string,
    sql: string,
    rows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis>;
  synthesizeGreenlight(
    userPrompt: string,
    sql: string,
    candidateRows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis>;
}
