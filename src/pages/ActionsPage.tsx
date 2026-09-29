import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { ActionList } from "../features/actionCentre/components/ActionList";
import { isUpdate } from "../features/actionCentre/types";

export function ActionsPage() {
  const actions = useQuery(api.actionCentre.getMyActions);
  const dismissActions = useMutation(api.actionCentre.dismissActions);

  // Nothing until the query lands - an empty list here would flash
  // "You're all caught up" at someone who isn't.
  if (actions === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Centre</h1>
      </div>
    );
  }

  const toDo = actions.filter((a) => !isUpdate(a));
  // Newest first: an update is news, and the latest is the one worth reading.
  const updates = actions.filter(isUpdate).sort((a, b) => b.createdAt - a.createdAt);

  const handleClearAll = async () => {
    try {
      await dismissActions({ actionIds: updates.map((a) => a.id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear updates");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Centre</h1>

      <section className="space-y-3">
        <SectionHeading>To do</SectionHeading>
        <ActionList actions={toDo} />
      </section>

      {updates.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>Updates</SectionHeading>
            <button
              type="button"
              onClick={handleClearAll}
              className="-my-2 -mr-2 px-2 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Clear all
            </button>
          </div>
          <ActionList actions={updates} />
        </section>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </h2>
  );
}

export default ActionsPage;
