import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../i18n/LocaleContext";
import App from "../App";
import Catalog from "./Catalog";
import Ingest from "./Ingest";
import Ask from "./Ask";
import Guide from "./Guide";
import { HealthBanner } from "../components/HealthBanner";
import { api } from "../api";
import { ApiError } from "../utils/apiErrors";
import * as juryEvidence from "../utils/juryEvidence";
import type { AgentRunResult } from "../api";

vi.mock("../api", () => ({
  api: {
    health: vi.fn(),
    getStats: vi.fn(),
    getCatalog: vi.fn(),
    getGreenlight: vi.fn(),
    ask: vi.fn(),
    ingest: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  health: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getCatalog: ReturnType<typeof vi.fn>;
  getGreenlight: ReturnType<typeof vi.fn>;
  ask: ReturnType<typeof vi.fn>;
  ingest: ReturnType<typeof vi.fn>;
};

function wrap(ui: ReactElement, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>{ui}</LocaleProvider>
    </MemoryRouter>,
  );
}

const askResult: AgentRunResult = {
  intent: "catalog_qa",
  answer: "Thriller is underserved.",
  sql: "SELECT genre, count() FROM media_catalog.media_content GROUP BY genre",
  queryRows: [{ genre: "Thriller", cnt: 8, active: true, nested: { a: 1 } }],
  recommendations: [
    {
      title: "Crimen sin Fronteras: Bogotá",
      genre: "Thriller",
      justification: "gap",
      evidence: "wow 32%",
    },
  ],
  steps: [
    {
      step: "INTENT",
      status: "completed",
      output: { intent: "catalog_qa", source: "gemini" },
      latencyMs: 4,
    },
    {
      step: "DISCOVER",
      status: "completed",
      output: { schema: "media_catalog.media_content(id UUID)" },
    },
    {
      step: "PLAN_SQL",
      status: "completed",
      output: { attempts: [{ sql: "SELECT 1", note: "ok" }] },
    },
    {
      step: "EXECUTE",
      status: "completed",
      output: {
        attempts: [{ sql: "SELECT 1", rowCount: 1, retry: true, error: "0 rows" }],
        rows: [{ genre: "Thriller" }],
      },
    },
    {
      step: "SYNTHESIZE",
      status: "completed",
      output: {
        answer: "ok",
        fallback: true,
        geminiError: "quota",
        recommendations: [{ title: "T" }],
      },
    },
    { step: "AUDIT", status: "completed", output: { auditId: "run-1" } },
    { step: "UNKNOWN", status: "failed", output: { extra: true }, error: "nope" },
  ],
  totalLatencyMs: 12,
  model: "gemini-test",
  fallback: true,
};

beforeEach(() => {
  mockedApi.health.mockResolvedValue({
    status: "ok",
    ready: true,
    partners: { clickhouse: "connected", mcp: "mcp-clickhouse", gemini: "gemini-test" },
  });
  mockedApi.getStats.mockResolvedValue({
    totalEntries: 200,
    genres: { Drama: 40, Thriller: 15 },
    recentAdditions: 2,
    latestRevenue: {
      totalViews: 1000,
      totalRevenueUsd: 500,
      topTitle: "Crimen sin Fronteras: Bogotá",
    },
  });
  mockedApi.getGreenlight.mockResolvedValue({
    ...askResult,
    intent: "greenlight",
    recommendations: [
      {
        title: "Crimen sin Fronteras: Bogotá",
        genre: "Thriller",
        justification: "breakout",
        evidence: "wow",
        opportunity_score: 0.26,
        wow_pct: 0.32,
        genre_gap: 0.13,
      },
    ],
    queryRows: [
      {
        title: "Crimen sin Fronteras: Bogotá",
        opportunity_score: 0.26,
        wow_pct: 0.32,
        genre_gap: 0.13,
      },
    ],
    steps: [
      {
        step: "DISCOVER",
        status: "completed",
        output: {
          fullById: {
            A_genre_inventory: [{ genre: "Thriller", title_count: 15, revenue_4w: 200 }],
            B_title_momentum: [
              { title: "Crimen sin Fronteras: Bogotá", genre: "Thriller", wow_pct: 0.32 },
            ],
            C_cannibalization: [],
            D_slate_holes: [
              {
                hole_type: "genre",
                dimension: "Thriller",
                gap_score: 0.4,
                title_share: 0.1,
                revenue_share: 0.3,
              },
            ],
          },
          queries: [{ id: "A_genre_inventory", sql: "SELECT 1", rowCount: 1, latencyMs: 3 }],
        },
      },
      { step: "SYNTHESIZE", status: "completed", output: { fallback: true } },
    ],
  });
  mockedApi.getCatalog.mockResolvedValue({
    count: 2,
    entries: [
      {
        id: "1",
        title: "Crimen sin Fronteras: Bogotá",
        description:
          "A long enough description for the catalog row that should truncate in the table.",
        genre: "Thriller",
        releaseDate: "2020-01-01",
        cast: ["Gael García Bernal"],
      },
      {
        id: "2",
        title: "Fading Line 75",
        description: "catalog title for demo seed",
        genre: "Drama",
        releaseDate: "2020-01-01",
        cast: ["Actor A"],
      },
    ],
  });
  mockedApi.ask.mockResolvedValue(askResult);
  mockedApi.ingest.mockResolvedValue({ contentId: "c-1", latencyMs: 9 });
});

describe("pages", () => {
  it("renders the dashboard with greenlight hero and expandable snapshot", async () => {
    wrap(<App />);
    expect(await screen.findByText("Greenlight this week")).toBeInTheDocument();
    expect(screen.getAllByText("Crimen sin Fronteras: Bogotá").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Show catalog snapshot/i }));
    expect(await screen.findByText("200")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
  });

  it("shows dashboard errors when stats fail", async () => {
    mockedApi.getStats.mockRejectedValue(new Error("stats down"));
    mockedApi.getGreenlight.mockRejectedValue(new ApiError("clickhouse_waking", "booting"));
    mockedApi.health.mockResolvedValue({ status: "ok", ready: true, partners: {} });
    wrap(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Show catalog snapshot/i }));
    expect(await screen.findByText("stats down")).toBeInTheDocument();
  });

  it("lists catalog titles, filters them, and can show padding", async () => {
    wrap(<Catalog />);
    expect(await screen.findByText("Crimen sin Fronteras: Bogotá")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 titles in ClickHouse \(seed hidden\)/)).toBeInTheDocument();
    expect(screen.queryByText("Fading Line 75")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Fading Line 75")).toBeInTheDocument();
    expect(screen.getByText(/2 titles in ClickHouse/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Filter by title or genre/i), {
      target: { value: "thriller" },
    });
    expect(screen.getByText("Crimen sin Fronteras: Bogotá")).toBeInTheDocument();
    expect(screen.queryByText("Fading Line 75")).not.toBeInTheDocument();
  });

  it("shows catalog error and empty states", async () => {
    mockedApi.getCatalog.mockRejectedValueOnce(new Error("catalog down"));
    const errorView = wrap(<Catalog />);
    expect(await screen.findByText(/catalog down/i)).toBeInTheDocument();
    errorView.unmount();

    mockedApi.getCatalog.mockResolvedValueOnce({ count: 0, entries: [] });
    wrap(<Catalog />);
    expect(await screen.findByText("No titles in the catalog yet")).toBeInTheDocument();
  });

  it("ingests a title and surfaces API errors", async () => {
    wrap(<Ingest />);
    fireEvent.change(screen.getByLabelText(/title|título/i), { target: { value: "New Title" } });
    fireEvent.change(screen.getByLabelText(/description|sinopsis/i), {
      target: { value: "A description" },
    });
    fireEvent.change(screen.getByLabelText(/cast|reparto/i), { target: { value: "Ada, Grace" } });
    fireEvent.change(screen.getByLabelText(/genre|género/i), { target: { value: "Drama" } });
    fireEvent.change(screen.getByLabelText(/release|estreno/i), {
      target: { value: "2024-07-01" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /Ingest via agent/i }).closest("form")!);
    expect(await screen.findByText(/c-1/i)).toBeInTheDocument();

    mockedApi.ingest.mockRejectedValueOnce(new Error("ingest failed"));
    fireEvent.submit(screen.getByRole("button", { name: /Ingest via agent/i }).closest("form")!);
    expect(await screen.findByText("ingest failed")).toBeInTheDocument();
  });

  it("asks a question and renders grounded badge plus collapsible SQL", async () => {
    wrap(<Ask />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Which genre is under-represented?" },
    });
    fireEvent.click(
      screen.getAllByRole("button").find((btn) => btn.className.includes("chip")) ??
        screen.getAllByRole("button")[0],
    );
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText("Thriller is underserved.")).toBeInTheDocument();
    expect(screen.getByText(/Measured in ClickHouse via mcp-clickhouse/i)).toBeInTheDocument();
    expect(screen.queryByText(/No ClickHouse evidence returned/i)).not.toBeInTheDocument();
    expect(screen.getByText(/SQL executed/i).closest("summary")).toBeTruthy();
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find((btn) => /show|ver|details|detalle/i.test(btn.textContent ?? ""))!,
    );
  });

  it("shows scary fallback badge only when Ask has no ClickHouse evidence", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      fallback: true,
      sql: undefined,
      queryRows: [],
      answer: "I could not measure the catalog.",
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText(/No ClickHouse evidence returned/i)).toBeInTheDocument();
    expect(screen.queryByText(/Measured in ClickHouse via mcp-clickhouse/i)).not.toBeInTheDocument();
  });

  it("omits status badges when Ask succeeds without fallback and without evidence flags", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      fallback: false,
      sql: undefined,
      queryRows: undefined,
      answer: "Catalog looks balanced.",
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText("Catalog looks balanced.")).toBeInTheDocument();
    expect(screen.queryByText(/Measured in ClickHouse via mcp-clickhouse/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No ClickHouse evidence returned/i)).not.toBeInTheDocument();
  });

  it("highlights gap_score above the fold when evidence rows include it", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      fallback: true,
      answer: "Documentary is the most underserved slice.",
      queryRows: [
        { hole_type: "genre", dimension: "Documentary", gap_score: 0.074 },
        { hole_type: "genre", genre: "Thriller", gap_score: 0.05 },
      ],
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByTestId("ask-gap-highlight")).toHaveTextContent(
      /Documentary: gap_score 0.074/,
    );
    expect(screen.getByText(/Measured in ClickHouse via mcp-clickhouse/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini planner\/writer was unavailable/i)).toBeInTheDocument();
  });

  it("renders greenlight provenance on Ask results", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      intent: "greenlight",
      queryRows: undefined,
      recommendations: [
        {
          title: "Crimen sin Fronteras: Bogotá",
          genre: "Thriller",
          justification: "gap",
          evidence: "wow",
          opportunity_score: 0.26,
          wow_pct: 0.32,
          genre_gap: 0.13,
        },
      ],
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(
      await screen.findByText(/Measured by ClickHouse|Medido en ClickHouse/i),
    ).toBeInTheDocument();
  });

  it("shows Gemini billing hint on Ask errors", async () => {
    mockedApi.ask.mockRejectedValueOnce(new ApiError("gemini_billing", "quota"));
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText(/credits are exhausted or rate-limited/i)).toBeInTheDocument();
  });

  it("shows ask progress while the agent is running", () => {
    vi.useFakeTimers();
    mockedApi.ask.mockReturnValue(new Promise(() => undefined));
    const view = wrap(<Ask />);
    try {
      act(() => {
        fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
      });
      expect(screen.getByRole("status")).toHaveTextContent(/Classify intent/i);
      expect(screen.getByText(/not frozen/i)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3_600);
      });
      const discover = screen.getAllByText("Discover schema / analytics");
      expect(discover.some((el) => el.closest("li")?.classList.contains("is-active"))).toBe(true);
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it("renders the user guide and redirects /about", async () => {
    const guide = wrap(<Guide />, "/guia");
    expect(screen.getByRole("heading", { level: 2, name: /User Guide/i })).toBeInTheDocument();
    guide.unmount();
    wrap(<App />, "/about");
    expect(
      await screen.findByRole("heading", { level: 2, name: /User Guide/i }),
    ).toBeInTheDocument();
  });

  it("scrolls a hash target on the user guide", async () => {
    const scrollIntoView = vi.fn();
    const original = document.getElementById.bind(document);
    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      const el = original(id);
      if (el) Object.assign(el, { scrollIntoView });
      return el;
    });
    wrap(<Guide />, "/guia#demo-story");
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("renders /judge with pitch, architecture, and a verify checklist", async () => {
    wrap(<App />, "/judge");
    expect(
      await screen.findByRole("heading", { level: 2, name: /For judges/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("ClickHouse measures. TypeScript scores. Gemini explains.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gemini does not plan greenlight SQL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "For judges" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/How to verify in 2 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/Competitive wedge/i)).toBeInTheDocument();
    expect(screen.getByText(/vs Chloe Greenlight/i)).toBeInTheDocument();
    expect(screen.getByText(/vs Flashframe/i)).toBeInTheDocument();
    expect(screen.getByText(/this product disappears/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted benchmarks/i)).toBeInTheDocument();
    expect(screen.getByText(/~11 s/i)).toBeInTheDocument();
    expect(screen.getByText(/ready: true before opening \/ask/i)).toBeInTheDocument();
    expect(screen.getAllByText(/A_genre_inventory/).length).toBeGreaterThan(0);
    await vi.waitFor(() => {
      expect(screen.queryByText(/mcp-clickhouse and the API wake/i)).not.toBeInTheDocument();
    });
  });

  it("shows judge slate preview with em dash when score is missing", async () => {
    mockedApi.getGreenlight.mockResolvedValue({
      intent: "greenlight",
      answer: "memo",
      recommendations: [{ title: "No Score Title", genre: "Drama", justification: "", evidence: "" }],
      queryRows: [],
      steps: [],
      totalLatencyMs: 1,
      model: "gemini-test",
    });
    wrap(<App />, "/judge");
    expect(
      await screen.findByRole("heading", { level: 2, name: /For judges/i }),
    ).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByText("No Score Title")).toBeInTheDocument();
    });
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("copies jury evidence JSON from /judge", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(<App />, "/judge");
    expect(
      await screen.findByRole("heading", { level: 2, name: /For judges/i }),
    ).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.queryByText(/Waiting for a greenlight response/i)).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Copy jury evidence JSON/i }));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /Copied/i })).toBeInTheDocument();
    });
    expect(JSON.parse(writeText.mock.calls[0][0] as string).intent).toBe("greenlight");
  });

  it("downloads jury evidence JSON from /judge", async () => {
    const downloadSpy = vi.spyOn(juryEvidence, "downloadJuryEvidence").mockReturnValue(true);

    wrap(<App />, "/judge");
    expect(
      await screen.findByRole("heading", { level: 2, name: /For judges/i }),
    ).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.queryByText(/Waiting for a greenlight response/i)).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Download jury evidence JSON/i }));
    expect(downloadSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Downloaded/i })).toBeInTheDocument();
    downloadSpy.mockRestore();
  });

  it("handles /judge clipboard failure", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    wrap(<App />, "/judge");
    expect(
      await screen.findByRole("heading", { level: 2, name: /For judges/i }),
    ).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.queryByText(/Waiting for a greenlight response/i)).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Copy jury evidence JSON/i }));
    expect(await screen.findByText(/Clipboard unavailable/i)).toBeInTheDocument();
  });

  it("shows /judge cold-start copy when health is waking", async () => {
    mockedApi.health.mockResolvedValue({ status: "starting", ready: false, partners: {} });
    mockedApi.getGreenlight.mockResolvedValue({ intent: "greenlight", recommendations: [], steps: [], totalLatencyMs: 1, model: "x", answer: "" });
    wrap(<App />, "/judge");
    expect(await screen.findByText(/mcp-clickhouse and the API wake/i)).toBeInTheDocument();
    expect(screen.queryByText(/Live weekly slate/i)).not.toBeInTheDocument();
  });

  it("shows /judge cold-start copy when health fails and no-ops JSON export", async () => {
    mockedApi.health.mockRejectedValue(new Error("down"));
    mockedApi.getGreenlight.mockRejectedValue(new Error("nope"));
    wrap(<App />, "/judge");
    expect(await screen.findByText(/mcp-clickhouse and the API wake/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for a greenlight response/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copy jury evidence JSON/i }));
  });

  it("shows catalog descriptions shorter than 80 characters", async () => {
    mockedApi.getCatalog.mockResolvedValueOnce({
      count: 2,
      entries: [
        {
          id: "1",
          title: "Short",
          description: "Short desc",
          genre: "Drama",
          releaseDate: "2020-01-01",
          cast: ["Ada"],
        },
        {
          id: "3",
          title: "Blank",
          description: "",
          genre: "Drama",
          releaseDate: "2020-01-01",
          cast: ["Ada"],
        },
        {
          id: "4",
          title: "Long",
          description:
            "A catalog description that is deliberately longer than eighty characters so the table truncates it with an ellipsis.",
          genre: "Drama",
          releaseDate: "2020-01-01",
          cast: ["Ada"],
        },
      ],
    });
    wrap(<Catalog />);
    expect(await screen.findByText("Short desc")).toBeInTheDocument();
    expect(screen.getByText(/A catalog description that is deliberately/)).toBeInTheDocument();
  });

  it("shows dashboard without revenue and with a health miss", async () => {
    mockedApi.getStats.mockResolvedValueOnce({
      totalEntries: 3,
      genres: { Drama: 3 },
      recentAdditions: 0,
    });
    mockedApi.health.mockResolvedValueOnce({ status: "ok", ready: true, partners: {} });
    wrap(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Show catalog snapshot/i }));
    expect(await screen.findByText(/No revenue data|Sin datos de ingresos/i)).toBeInTheDocument();
  });

  it("redirects /greenlight to dashboard hash and serves /catalog/stats", async () => {
    wrap(<App />, "/greenlight");
    expect(await screen.findByText("Greenlight this week")).toBeInTheDocument();

    wrap(<App />, "/catalog/stats");
    expect(await screen.findByText("Catalog stats")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows not found for unknown routes", async () => {
    wrap(<App />, "/not-a-real-page");
    expect(await screen.findByText(/Unknown route|Ruta desconocida/i)).toBeInTheDocument();
  });

  it("filters junk genre recommendations on Ask", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      recommendations: [
        { title: "Good", genre: "Thriller", justification: "ok", evidence: "1" },
        { title: "Bad", genre: "es", justification: "no", evidence: "2" },
      ],
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText("Thriller is underserved.")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.queryByText("Bad")).not.toBeInTheDocument();
    expect(screen.getByText(/ungrounded recommendation/i)).toBeInTheDocument();
  });

  it("shows ungrounded empty state when all Ask recommendations are junk", async () => {
    mockedApi.ask.mockResolvedValueOnce({
      ...askResult,
      recommendations: [{ title: "Bad", genre: "es", justification: "no", evidence: "2" }],
    });
    wrap(<Ask />);
    fireEvent.submit(screen.getByRole("button", { name: /Run agent/i }).closest("form")!);
    expect(await screen.findByText(/not grounded in catalog genres/i)).toBeInTheDocument();
  });

  it("shows health waking banner and supports retry", async () => {
    mockedApi.health
      .mockResolvedValueOnce({ status: "starting", ready: false, error: "still booting" })
      .mockResolvedValueOnce({ status: "ok", ready: true, partners: {} });
    wrap(<HealthBanner />);
    expect(await screen.findByText(/Waking the demo/i)).toBeInTheDocument();
    expect(screen.getByText("still booting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Check again/i }));
    await vi.waitFor(() => expect(screen.queryByText(/Waking the demo/i)).not.toBeInTheDocument());
  });

  it("catalog stats page handles missing revenue", async () => {
    mockedApi.getStats.mockResolvedValueOnce({
      totalEntries: 12,
      genres: { Drama: 12 },
      recentAdditions: 0,
    });
    wrap(<App />, "/catalog/stats");
    expect(await screen.findByText("No revenue data")).toBeInTheDocument();
  });

  it("catalog stats page surfaces load errors", async () => {
    mockedApi.getStats.mockRejectedValueOnce(new Error("stats unavailable"));
    wrap(<App />, "/catalog/stats");
    expect(await screen.findByText("stats unavailable")).toBeInTheDocument();
  });

  it("scrolls to greenlight when hash is present", async () => {
    const scrollIntoView = vi.fn();
    const orig = document.getElementById.bind(document);
    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      const el = orig(id);
      if (el) Object.assign(el, { scrollIntoView });
      return el;
    });
    wrap(<App />, "/#greenlight");
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("ignores greenlight hash when anchor is missing", async () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);
    wrap(<App />, "/#greenlight");
    expect(await screen.findByText("Greenlight this week")).toBeInTheDocument();
  });

  it("health banner stays visible when health fetch throws", async () => {
    mockedApi.health.mockRejectedValue(new Error("network"));
    wrap(<HealthBanner />);
    expect(await screen.findByText(/Waking the demo/i)).toBeInTheDocument();
  });

  it("health banner hides when API becomes ready on first poll", async () => {
    mockedApi.health.mockResolvedValue({ status: "ok", ready: true, partners: {} });
    wrap(<HealthBanner />);
    await vi.waitFor(() => expect(screen.queryByText(/Waking the demo/i)).not.toBeInTheDocument());
  });

  it("cancels in-flight health poll on unmount", async () => {
    let resolveHealth: (value: { status: string; ready: boolean }) => void = () => undefined;
    mockedApi.health.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    const view = wrap(<HealthBanner />);
    view.unmount();
    resolveHealth({ status: "starting", ready: false });
  });

  it("cancels health poll after a failed fetch resolves", async () => {
    let rejectHealth: (error: Error) => void = () => undefined;
    mockedApi.health.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectHealth = reject;
        }),
    );
    const view = wrap(<HealthBanner />);
    view.unmount();
    rejectHealth(new Error("boom"));
  });

  it("can hide the catalog snapshot after opening it", async () => {
    wrap(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Show catalog snapshot/i }));
    expect(await screen.findByText("Catalog size")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hide catalog snapshot/i }));
    expect(screen.queryByText("Catalog size")).not.toBeInTheDocument();
  });

  it("shows loading on catalog stats while the request is in flight", () => {
    mockedApi.getStats.mockReturnValue(new Promise(() => undefined));
    wrap(<App />, "/catalog/stats");
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
