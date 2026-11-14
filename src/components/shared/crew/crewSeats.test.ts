import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { clearSeat, emptySeats, placeMember, seatHeldBy, setSeat } from "./crewSeats";

const alex = "alex" as Id<"users">;
const maria = "maria" as Id<"users">;

describe("placeMember", () => {
  it("fills an empty seat", () => {
    const seats = placeMember(emptySeats(), "driver", alex);
    expect(seats.driver.userId).toBe(alex);
  });

  it("swaps two members already on the truck", () => {
    let seats = placeMember(emptySeats(), "crewLeader", alex);
    seats = placeMember(seats, "driver", maria);
    seats = placeMember(seats, "crewLeader", maria);
    expect(seats.crewLeader.userId).toBe(maria);
    expect(seats.driver.userId).toBe(alex);
  });

  it("moves a member into an empty seat and empties their old one", () => {
    let seats = placeMember(emptySeats(), "crewLeader", alex);
    seats = placeMember(seats, 1, alex);
    expect(seats.crewLeader.userId).toBeNull();
    expect(seats.crewMembers[1].userId).toBe(alex);
  });

  it("swaps an outside name into the member's old seat", () => {
    let seats = setSeat(emptySeats(), "driver", { userId: null, name: "Sam Lee" });
    seats = placeMember(seats, 0, alex);
    seats = placeMember(seats, "driver", alex);
    expect(seats.driver.userId).toBe(alex);
    expect(seats.crewMembers[0]).toEqual({ userId: null, name: "Sam Lee" });
  });

  it("never seats a member twice", () => {
    let seats = placeMember(emptySeats(), "crewLeader", alex);
    seats = placeMember(seats, 2, alex);
    const held = [seats.crewLeader, seats.driver, ...seats.crewMembers].filter((s) => s.userId === alex);
    expect(held).toHaveLength(1);
    expect(seatHeldBy(seats, alex)).toBe(2);
  });
});

describe("clearSeat", () => {
  it("empties a seat", () => {
    const seats = clearSeat(placeMember(emptySeats(), "driver", alex), "driver");
    expect(seats.driver).toEqual({ userId: null, name: "" });
  });
});
