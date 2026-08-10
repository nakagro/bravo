import { ActionProvider } from "./types";

// Audience policy: Role (via module access) - the `baSkillsAdmin` module is
// already scoped to Training Officers/admins, so no separate
// actionAccountability mapping is needed.
// Triggers when: one or more baRecords have not yet been entered into the CFA LMS.
export const baSkillsLmsProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("baSkillsAdmin")) return [];

  const records = await ctx.db.query("baRecords").collect();
  const pending = records.filter((r) => r.lmsEnteredAt === undefined);
  if (pending.length === 0) return [];

  return [
    {
      id: "baSkills:lmsPending",
      moduleId: "baSkills",
      kind: "lmsPending",
      title: `${pending.length} BA record${pending.length > 1 ? "s" : ""} pending LMS entry`,
      description: `${pending.length} BA usage record${pending.length > 1 ? "s" : ""} still need${pending.length > 1 ? "" : "s"} to be entered into the CFA LMS.`,
      url: "/ba-skills?tab=lms",
      actionLabel: "Enter into LMS",
      priority: "medium",
      count: pending.length,
      createdAt: Math.min(...pending.map((r) => r.createdAt)),
    },
  ];
};
