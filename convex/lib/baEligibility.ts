// Who can appear in a BA record's member/verifier pickers, and who the server
// accepts as the member or verifier on a kiosk-submitted record. The browser
// re-exports this from src/features/baSkills/memberEligibility.ts so the
// pickers and the server check cannot drift apart. Keep it free of Convex
// imports: it ships in the frontend bundle.

export const RANK_ORDER: Record<string, number> = {
  Captain: 1,
  Lieutenant: 2,
  Firefighter: 3,
  Probationary: 4,
  "Brigade Member": 5,
};

/** `skills` are skill codes (e.g. "BAi"), not skill ids. */
export function isBARecordMemberOption(member: { rank?: string; skills?: string[] }) {
  return (
    member.rank === "Captain" ||
    member.rank === "Lieutenant" ||
    member.skills?.some((skill) => skill === "BAe" || skill === "BAi") === true
  );
}
