import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HoseInventory } from "./HoseInventory";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("./HoseForm", () => ({ HoseForm: () => null }));
vi.mock("./HoseDetailPanel", () => ({ HoseDetailPanel: () => null }));

const hose = {
  _id: "hose-1",
  hoseId: "WV001",
  status: "In date",
  size: "38",
  length: 30,
  type: "Canvas",
  testDate: Date.now(),
  location: "Station",
};

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockedUseQuery.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HoseInventory search", () => {
  it("keeps the search control mounted while refreshed results load", () => {
    mockedUseQuery.mockReturnValue(undefined);
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?tab=inventory"]}>
        <HoseInventory />
      </MemoryRouter>,
    );

    expect(markup).toContain('aria-label="Search inventory"');
    expect(markup).toContain('aria-label="Loading hose results"');
  });

  it("shows a pointer and strong hover affordance on clickable cards", () => {
    mockedUseQuery.mockReturnValueOnce([hose] as never).mockReturnValueOnce([]);

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?tab=inventory"]}>
        <HoseInventory />
      </MemoryRouter>,
    );

    expect(markup).toMatch(/<button[^>]*cursor-pointer[^>]*aria-label="View hose WV001"/);
    expect(markup).toContain("hover:bg-accent");
  });

  it("keeps table rows clickable with pointer and hover affordances", () => {
    vi.stubGlobal("window", { innerWidth: 1024 });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "table"),
      setItem: vi.fn(),
    });
    mockedUseQuery.mockReturnValueOnce([hose] as never).mockReturnValueOnce([]);

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?tab=inventory"]}>
        <HoseInventory />
      </MemoryRouter>,
    );

    expect(markup).toMatch(/<tr[^>]*cursor-pointer[^>]*role="button"/);
    expect(markup).toContain("hover:bg-red-50/70");
  });
});
