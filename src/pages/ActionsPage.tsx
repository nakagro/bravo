import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ActionList } from "../features/actionCenter/components/ActionList";

export function ActionsPage() {
  const actions = useQuery(api.actionCenter.getMyActions);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Center</h1>
      <ActionList actions={actions ?? []} />
    </div>
  );
}

export default ActionsPage;
