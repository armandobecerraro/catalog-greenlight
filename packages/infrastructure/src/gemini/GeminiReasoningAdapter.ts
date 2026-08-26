import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AgentIntent,
  GreenlightRecommendation,
  IGeminiReasoningPort,
  ReasoningSynthesis
} from '@bas/core';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export class GeminiReasoningAdapter implements IGeminiReasoningPort {
  readonly modelName = MODEL;
  private readonly model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: MODEL });
  }

  async classifyIntent(userPrompt: string): Promise<AgentIntent> {
    const prompt = `Classify this programming-catalog request into exactly one intent.
Intents: ingest, catalog_qa, greenlight, stats
Respond with ONLY the intent word, nothing else.

Request: ${userPrompt}`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim().toLowerCase();

    if (text.includes('greenlight')) return 'greenlight';
    if (text.includes('stats')) return 'stats';
    if (text.includes('ingest')) return 'ingest';
    return 'catalog_qa';
  }

  async generateSql(
    intent: AgentIntent,
    userPrompt: string,
    schemaContext: string
  ): Promise<string> {
    const writeAllowed = intent === 'ingest';
    const prompt = `You are a ClickHouse SQL expert for a streaming catalog database.

Schema context:
${schemaContext}

User request: ${userPrompt}
Intent: ${intent}

Rules:
- Database: media_catalog
- Main table: media_catalog.media_content (id, title, description, genre, release_date, cast, enrichment, created_at)
- Revenue table: media_catalog.title_revenue (title_id, title, week_start, views, revenue_usd)
- ${writeAllowed ? 'INSERT is allowed for ingest only.' : 'ONLY SELECT queries. No INSERT/UPDATE/DELETE/DROP.'}
- Return ONLY the SQL statement, no markdown fences.

Generate the best ClickHouse SQL to answer the request.`;

    const result = await this.model.generateContent(prompt);
    return this.stripMarkdown(result.response.text());
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
For greenlight or weekly picks: provide exactly 3 recommendations with data-backed evidence.
Use English. Be specific — reference counts, genres, revenue from the result rows.`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
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
        recommendations: parsed.recommendations || []
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
