export type AgentIntent = 'ingest' | 'catalog_qa' | 'greenlight' | 'stats';

export interface GreenlightRecommendation {
  title: string;
  genre: string;
  justification: string;
  evidence: string;
}

export interface ReasoningSynthesis {
  answer: string;
  recommendations?: GreenlightRecommendation[];
}

export interface IGeminiReasoningPort {
  classifyIntent(userPrompt: string): Promise<AgentIntent>;
  generateSql(
    intent: AgentIntent,
    userPrompt: string,
    schemaContext: string
  ): Promise<string>;
  synthesize(
    intent: AgentIntent,
    userPrompt: string,
    sql: string,
    rows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis>;
}
