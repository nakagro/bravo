import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { isUpdate } from "../types";

export function ActionBell() {
  const actions = useQuery(api.actionCentre.getMyActions);

  // Show the bell to all signed-in users - the /actions page is already gated
  // by ProtectedRoute. Only hide while actions are still loading.
  if (actions === undefined) return null;

  // Only to-dos earn the red number. Updates are news, not a nag - they get
  // a quiet dot, and only when there's nothing to do.
  const count = actions.filter((a) => !isUpdate(a)).length;
  const hasUpdates = count === 0 && actions.some(isUpdate);

  return (
    <Link
      to="/actions"
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={`Action Centre${count > 0 ? ` (${count} to do)` : hasUpdates ? " (new updates)" : ""}`}
    >
      <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      {count > 0 && (
        <span className="absolute top-1 right-1 h-4 min-w-[1rem] px-0.5 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
      {hasUpdates && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
      )}
    </Link>
  );
}
