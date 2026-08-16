import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MemberRecordsList } from "./MemberRecordsList";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockedUseQuery.mockReset();
});

describe("MemberRecordsList", () => {
  it("sorts captains first, lieutenants second, then other members", () => {
    mockedUseQuery.mockReturnValue([
      {
        _id: "member-1",
        name: "Zoe Young",
        lastName: "Young",
        rank: "Firefighter",
      },
      {
        _id: "member-2",
        name: "Ben Brown",
        lastName: "Brown",
        rank: "Lieutenant",
      },
      {
        _id: "member-3",
        name: "Amy Adams",
        lastName: "Adams",
        rank: "Captain",
      },
      {
        _id: "member-4",
        name: "Alex Able",
        lastName: "Able",
        rank: "Lieutenant",
      },
      {
        _id: "member-5",
        name: "Cara Clark",
        lastName: "Clark",
        rank: "Captain",
      },
      {
        _id: "member-6",
        name: "Mia Miller",
        lastName: "Miller",
        rank: "Probationary",
      },
      { _id: "member-7", name: "Ari Davis", lastName: "Davis" },
    ] as never);

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <MemberRecordsList />
      </MemoryRouter>,
    );

    const names = [
      "Amy Adams",
      "Cara Clark",
      "Alex Able",
      "Ben Brown",
      "Ari Davis",
      "Mia Miller",
      "Zoe Young",
    ];

    for (let index = 1; index < names.length; index += 1) {
      expect(markup.indexOf(names[index - 1])).toBeLessThan(
        markup.indexOf(names[index]),
      );
    }
  });
});
