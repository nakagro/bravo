// Shared "who can appear in a BA record's member/verifier pickers" rule,
// used by both the full BA Skills form and the kiosk BA usage form. The rule
// lives in convex/lib/baEligibility.ts so the server enforces the same one.
export { RANK_ORDER, isBARecordMemberOption } from "../../../convex/lib/baEligibility";
