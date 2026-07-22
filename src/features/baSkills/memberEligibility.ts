// Shared "who can appear in a BA record's member/verifier pickers" rule,
// used by both the full BA Skills form and the kiosk BA usage form.
export const RANK_ORDER: Record<string, number> = {
  Captain: 1,
  Lieutenant: 2,
  Firefighter: 3,
  Probationary: 4,
  "Brigade Member": 5,
};

export function isBARecordMemberOption(member: { rank?: string; skills?: string[] }) {
  return (
    member.rank === "Captain" ||
    member.rank === "Lieutenant" ||
    member.skills?.some((skill) => skill === "BAe" || skill === "BAi") === true
  );
}
