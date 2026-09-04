import {
  AgentIntent,
  GreenlightRecommendation,
  IGeminiReasoningPort,
  ReasoningSynthesis,
  SqlRetryContext
} from '@bas/core';
import { generateGeminiText } from './generateContent';

export class GeminiReasoningAdapter implements IGeminiReasoningPort {
  readonly modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  constructor(private readonly apiKey: string) {}

  async classifyIntent(userPrompt: string): Promise<AgentIntent> {
    const prompt = `Classify this programming-catalog request into exactly one intent.
Intents:
- ingest — add / insert a title into the catalog
- stats — counts, leaderboards, last-week revenue totals
- greenlight — ONLY the weekly 3-pick programming slate / ritual
- catalog_qa — recommend titles, which genre to program next, catalog questions

If the user asks which genre to greenlight next or recommends a title (comedy, runtime, etc.), that is catalog_qa, not greenlight.
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
- Apply every user constraint that exists as a column (genre, language, title). Filter with equality on genre when they name one (Comedy, Drama, …).
- media_content has NO duration/runtime/length column unless it appears in the live schema above. Do NOT invent duration filters. Still return matching titles for the other constraints.
- Title recommendations: SELECT title, genre, description, latest-week revenue — never a genre inventory GROUP BY.
- “Which genre … revenue / greenlight next”: use revenue share vs title share (gap_score) or revenue by genre — not “fewest titles”.
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
Answer the user's constraints. If they asked for comedy, only discuss comedy titles from the rows.
If they asked for runtime/duration and the SQL/schema has no such column, say so explicitly — do not pretend you filtered by length.
Never answer a different question (e.g. “fewest titles / Animation”) unless that is what they asked.
Use English. Be specific — reference counts, genres, revenue from the result rows.`;

    const text = await generateGeminiText(this.apiKey, prompt, this.modelName);
    return this.parseSynthesis(text);
  }

  async synthesizeGreenlight(
    userPrompt: string,
    sql: string,
    candidateRows: Record<string, unknown>[]
  ): Promise<ReasoningSynthesis> {
    // Slim prompt for Flash latency: no full SQL dump; only scored fields Gemini must cite.
    const slim = candidateRows.map(r => ({
      title: r.title,
      genre: r.genre,
      opportunity_score: r.opportunity_score,
      wow_pct: r.wow_pct,
      genre_gap: r.genre_gap,
      cannibalization_penalty: r.cannibalization_penalty
    }));
    const prompt = `Catalog Greenlight weekly memo for a streaming chief. Scorer already ranked picks — you only narrate.
Brief: ${userPrompt}
SQL fingerprint (do not invent queries): ${sql.slice(0, 180).replace(/\s+/g, ' ')}…
Candidates (ONLY these titles):
${JSON.stringify(slim)}
JSON only:
{"answer":"2-3 sentences citing opportunity_score, wow_pct, genre_gap","recommendations":[{"title":"exact","genre":"...","justification":"...","evidence":"cite numbers"}]}
Exactly ${Math.min(3, slim.length)} recommendations. No invented titles.`;

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
