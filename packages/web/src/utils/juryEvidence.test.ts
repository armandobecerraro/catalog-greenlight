import { describe, expect, it, vi } from "vitest";
import { downloadJuryEvidence, juryEvidencePayload } from "./juryEvidence";
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
    const payload = juryEvidencePayload(run());
    expect(payload).toMatchObject({
      intent: "greenlight",
      fallback: true,
      sql: "SELECT 1",
      product: "Catalog Greenlight",
      recommendations: [{ title: "A", opportunity_score: 0.26 }],
    });
    expect(payload?.mcpQueryIds).toHaveLength(4);
    expect(payload?.uniqueGenres).toEqual(["Thriller"]);
    expect(
      juryEvidencePayload(run({ fallback: undefined, sql: undefined, recommendations: undefined })),
    ).toEqual({
      exportedAt: expect.any(String),
      product: "Catalog Greenlight",
      intent: "greenlight",
      model: "gemini-test",
      fallback: false,
      totalLatencyMs: 1,
      uniqueGenres: [],
      mcpQueryIds: expect.any(Array),
      recommendations: [],
      sql: null,
      attribution: expect.any(String),
    });
  });

  it("downloads jury evidence as a JSON file", () => {
    const click = vi.fn();
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => "blob:evidence");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: revoke });
    const anchor = { click, href: "", download: "" } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    expect(downloadJuryEvidence(run())).toBe(true);
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:evidence");
    expect(downloadJuryEvidence(null)).toBe(false);
  });
});
