import { ActionCard } from "./ActionCard";
import type { ActionItem } from "../types";

interface ActionListProps {
  actions: ActionItem[];
  limit?: number;
}

export function ActionList({ actions, limit }: ActionListProps) {
  const displayed = limit ? actions.slice(0, limit) : actions;

  if (displayed.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
        You're all caught up.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {displayed.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
    </div>
  );
}
