import { describe, expect, it } from "vitest";
import { juryEvidencePayload } from "./juryEvidence";
import type { AgentRunResult } from "../api";

const run = (overrides: Partial<AgentRunResult> = {}): AgentRunResult => ({
  intent: "greenlight",
  answer: "memo",
  sql: "SELECT 1",
  recommendations: [
    { title: "A", genre: "Thriller", justification: "j", evidence: "e", opportunity_score: 0.26 },
  ],
  steps: [],
  totalLatencyMs: 1,
  model: "gemini-test",
  fallback: true,
  ...overrides,
});

describe("juryEvidencePayload", () => {
  it("returns null without a run", () => {
    expect(juryEvidencePayload(null)).toBeNull();
  });

  it("packs scored recommendations and optional sql", () => {
    expect(juryEvidencePayload(run())).toMatchObject({
      intent: "greenlight",
      fallback: true,
      sql: "SELECT 1",
      recommendations: [{ title: "A", opportunity_score: 0.26 }],
    });
    expect(
      juryEvidencePayload(run({ fallback: undefined, sql: undefined, recommendations: undefined })),
    ).toEqual({
      intent: "greenlight",
      model: "gemini-test",
      fallback: false,
      recommendations: [],
      sql: null,
    });
  });
});
