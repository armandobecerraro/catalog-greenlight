import {
  AgentIntent,
  GreenlightRecommendation,
  IGeminiReasoningPort,
  ReasoningSynthesis,
  SqlRetryContext
} from '@bas/core';
import { generateGeminiText } from './generateContent';

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

export class GeminiReasoningAdapter implements IGeminiReasoningPort {
  readonly modelName = MODEL;

  constructor(private readonly apiKey: string) {}

  async classifyIntent(userPrompt: string): Promise<AgentIntent> {
    const prompt = `Classify this programming-catalog request into exactly one intent.
Intents: ingest, catalog_qa, greenlight, stats
Respond with ONLY the intent word, nothing else.

Request: ${userPrompt}`;

    const text = (await generateGeminiText(this.apiKey, prompt, this.modelName)).trim().toLowerCase();

    if (text.includes('greenlight')) return 'greenlight';
    if (text.includes('stats')) return 'stats';
    if (text.includes('ingest')) return 'ingest';
    return 'catalog_qa';
  }

  async generateSql(
    intent: AgentIntent,
    userPrompt: string,
    schemaContext: string,
    retry?: SqlRetryContext
  ): Promise<string> {
    const writeAllowed = intent === 'ingest';
    const retryBlock = retry
      ? `
Previous SQL failed or returned no rows:
${retry.previousSql}

Error / result: ${retry.errorOrEmpty}

Generate a corrected SELECT that will return data.`
      : '';

    const prompt = `You are a ClickHouse SQL expert for a streaming catalog database.

Live schema (from system.columns — use only these tables/columns):
${schemaContext}

User request: ${userPrompt}
Intent: ${intent}
${retryBlock}

Rules:
- Database: media_catalog
- ${writeAllowed ? 'INSERT is allowed for ingest only.' : 'ONLY SELECT or WITH queries. No INSERT/UPDATE/DELETE/DROP.'}
- Return ONLY the SQL statement, no markdown fences.

Generate the best ClickHouse SQL to answer the request.`;

    return this.stripMarkdown(await generateGeminiText(this.apiKey, prompt, this.modelName));
  }

  async synthesize(
    intent: AgentIntent,
    userPrompt: string,
    sql: string,
    rows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis> {
    const prompt = `You are Catalog Greenlight, an agent for a streaming programming chief.

User question: ${userPrompt}
Intent: ${intent}
SQL executed: ${sql}
Query results (JSON): ${JSON.stringify(rows.slice(0, 50))}

Respond in JSON with:
{
  "answer": "clear actionable answer citing specific numbers from the results",
  "recommendations": [
    {"title": "...", "genre": "...", "justification": "...", "evidence": "cite row values"}
  ]
}

For catalog_qa: recommendations can be empty array.
If recommending titles, ONLY use titles that appear in the query results JSON.
Use English. Be specific — reference counts, genres, revenue from the result rows.`;

    const text = await generateGeminiText(this.apiKey, prompt, this.modelName);
    return this.parseSynthesis(text);
  }

  async synthesizeGreenlight(
    userPrompt: string,
    sql: string,
    candidateRows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis> {
    const prompt = `You are Catalog Greenlight writing weekly programming picks for a streaming chief.
The analyst team already scored titles in ClickHouse — you are the writer, not the analyst.

User brief: ${userPrompt}

Analytical SQL executed (deterministic, not your invention):
${sql.slice(0, 6000)}

Scored candidate rows (ONLY these titles may appear in recommendations):
${JSON.stringify(candidateRows)}

Respond in JSON:
{
  "answer": "2-3 sentence executive summary citing opportunity_score, wow_pct, and genre_gap from the rows",
  "recommendations": [
    {"title": "exact title from candidates", "genre": "...", "justification": "...", "evidence": "must cite numeric fields from that row"}
  ]
}

Provide exactly 3 recommendations — one per candidate row when 3 candidates exist.
Do NOT invent titles. Do NOT recommend cannibalized pairs unless opportunity_score still wins.`;

    const text = await generateGeminiText(this.apiKey, prompt, this.modelName);
    return this.parseSynthesis(text);
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/```sql\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  private parseSynthesis(text: string): ReasoningSynthesis {
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as ReasoningSynthesis;
      return {
        answer: parsed.answer || text,
        recommendations: parseRecommendations(parsed.recommendations)
      };
    } catch {
      return { answer: text.trim(), recommendations: [] };
    }
  }
}

export function parseRecommendations(raw: unknown): GreenlightRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is GreenlightRecommendation =>
      typeof r === 'object' &&
      r !== null &&
      'title' in r &&
      typeof (r as GreenlightRecommendation).title === 'string'
    )
    .slice(0, 3);
}
