// Brigade seniority: rank, and for Lieutenants which one (1st to 5th).
//
// Shared by the backend and the frontend so every list that orders people by
// seniority - the training roll first - agrees on the order.

export type Rank = "Brigade Member" | "Probationary" | "Firefighter" | "Lieutenant" | "Captain";

// A brigade has at most five Lieutenants, numbered by seniority
export const LIEUTENANT_NUMBERS = [1, 2, 3, 4, 5] as const;

// Most senior first
const SENIORITY: Rank[] = ["Captain", "Lieutenant", "Firefighter", "Probationary", "Brigade Member"];

type Ranked = {
  rank?: Rank;
  lieutenantNumber?: number;
  firstName?: string;
  lastName?: string;
  name?: string;
};

export function isValidLieutenantNumber(value: number): boolean {
  return (LIEUTENANT_NUMBERS as readonly number[]).includes(value);
}

/** 1 -> "1st", 2 -> "2nd" ... 5 -> "5th" */
export function ordinal(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

/** "1st Lieutenant", "Lieutenant" (unnumbered), "Captain"; "" with no rank */
export function formatRank(person: Ranked): string {
  if (!person.rank) return "";
  if (person.rank === "Lieutenant" && person.lieutenantNumber) {
    return `${ordinal(person.lieutenantNumber)} Lieutenant`;
  }
  return person.rank;
}

/**
 * Sort comparator, most senior first: Captain, Lieutenants by number (an
 * unnumbered Lieutenant after the numbered ones), Firefighter, Probationary,
 * Brigade Member, no rank. Ties break on surname, then first name.
 */
export function compareBySeniority(a: Ranked, b: Ranked): number {
  const rankIndex = (p: Ranked) => (p.rank ? SENIORITY.indexOf(p.rank) : SENIORITY.length);
  const byRank = rankIndex(a) - rankIndex(b);
  if (byRank !== 0) return byRank;

  if (a.rank === "Lieutenant") {
    const byNumber = (a.lieutenantNumber ?? 99) - (b.lieutenantNumber ?? 99);
    if (byNumber !== 0) return byNumber;
  }

  const surname = (p: Ranked) => (p.lastName ?? p.name?.split(" ").slice(-1)[0] ?? "").toLowerCase();
  const first = (p: Ranked) => (p.firstName ?? p.name ?? "").toLowerCase();
  return surname(a).localeCompare(surname(b)) || first(a).localeCompare(first(b));
}
