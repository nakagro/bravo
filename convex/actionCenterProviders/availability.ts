import { ActionProvider } from "./types";

export const availabilityProvider: ActionProvider = async (_ctx, p) => {
  if (!p.hasModuleAccess("availability")) return [];

  const user = p.user;
  const now = Date.now();
  const hasActiveStatus =
    !!user.currentStatus &&
    (!user.statusExpiresAt || user.statusExpiresAt > now);

  if (hasActiveStatus) return [];

  return [
    {
      id: "availability:setAvailability",
      moduleId: "availability",
      kind: "setAvailability",
      title: "No Availability Status Set",
      description: "Your availability status needs to be updated.",
      url: "/availability",
      actionLabel: "Update Availability",
      priority: "high",
      createdAt: user._creationTime,
    },
  ];
};
