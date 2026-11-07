// Per-member push notification preferences.
//
// Each push carries a `notificationType`. Types are grouped into categories a
// member can switch off in Settings. A category is also tied to the module it
// belongs to: nobody gets a push for a module they can't open, so a Brigade
// Member without Availability access never gets the 10am reminder.
//
// Muting only stops the push. The notification history entry and any Action
// Centre item are still created, so nothing is lost by switching a push off.

export type NotificationCategory = "availabilityReminders" | "statusChanges" | "events" | "dutyCrew";

export type NotificationCategoryInfo = {
  key: NotificationCategory;
  label: string;
  description: string;
  moduleId: string;
  types: string[];
};

export const NOTIFICATION_CATEGORIES: NotificationCategoryInfo[] = [
  {
    key: "availabilityReminders",
    label: "Availability reminders",
    description: "The overnight reset and the 10am reminder when you haven't set a status.",
    moduleId: "availability",
    types: ["nightlyReset", "morningReminder"],
  },
  {
    key: "statusChanges",
    label: "Scheduled status changes",
    description: "When a status you scheduled ahead changes over.",
    moduleId: "availability",
    types: ["statusChange"],
  },
  {
    key: "events",
    label: "Events",
    description: "Event invitations, changes and reminders.",
    moduleId: "events",
    types: ["eventNotification"],
  },
  {
    key: "dutyCrew",
    label: "Duty Crew",
    description: "The reminder on the last day of your duty week.",
    moduleId: "dutyCrew",
    types: ["dutyCrewWeekClosing"],
  },
];

export function categoryForType(notificationType: string | undefined): NotificationCategoryInfo | undefined {
  if (!notificationType) return undefined;
  return NOTIFICATION_CATEGORIES.find((c) => c.types.includes(notificationType));
}

export type NotificationPrefs = Partial<Record<NotificationCategory, boolean>>;

/** A missing preference means "on". Only an explicit false mutes a category. */
export function isCategoryEnabled(prefs: NotificationPrefs | undefined, category: NotificationCategory): boolean {
  return prefs?.[category] !== false;
}
