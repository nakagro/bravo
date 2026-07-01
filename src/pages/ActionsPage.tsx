import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ActionList } from "../features/actionCentre/components/ActionList";

export function ActionsPage() {
  const actions = useQuery(api.actionCentre.getMyActions);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Centre</h1>
      <ActionList actions={actions ?? []} />
    </div>
  );
}

export default ActionsPage;
