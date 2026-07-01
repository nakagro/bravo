import { ActionProvider } from "./types";

export const profileProvider: ActionProvider = async (_ctx, p) => {
  if (!p.hasModuleAccess("settings")) return [];

  const user = p.user;
  if (user.skills && user.skills.length > 0) return [];

  return [
    {
      id: "settings:updateSkills",
      moduleId: "settings",
      kind: "updateSkills",
      title: "No Skills Set",
      description: "Please update your skills in User Settings.",
      url: "/settings",
      actionLabel: "Update Skills",
      priority: "medium",
      createdAt: user._creationTime,
    },
  ];
};
