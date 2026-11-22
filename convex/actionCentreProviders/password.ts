import { ActionProvider } from "./types";

/**
 * Ask a member to change a password that isn't private to them: still their
 * CFA number, or a temporary one an admin set. Not dismissible: it stays
 * until they change it, which clears the flag.
 */
export const passwordProvider: ActionProvider = async (_ctx, p) => {
  const reason = p.user.passwordChangeReason;
  if (!reason) return [];

  return [
    {
      id: "settings:changePassword",
      moduleId: "settings",
      kind: "changePassword",
      title: "Change your password",
      description:
        reason === "cfaNumber"
          ? "Your password is still your CFA number, which other people can find out. Choose a new one."
          : "An administrator set your password. Choose your own so only you know it.",
      url: "/settings#password",
      actionLabel: "Change password",
      priority: "high",
      createdAt: p.user._creationTime,
    },
  ];
};
