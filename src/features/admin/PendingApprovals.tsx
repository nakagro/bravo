import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/dateFormat";
import { toastError } from "@/lib/errors";

type Pending = {
  _id: Id<"users">;
  _creationTime: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  memberNumber?: string;
};

function displayName(user: Pending) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "New sign-up";
}

/**
 * Self-service sign-ups waiting to be let in. Approve gives them the floor
 * rank they signed up with; set rank and roles afterwards as usual. Reject
 * deletes the account, which frees the email to sign up again.
 * Renders nothing when no one is waiting.
 */
export function PendingApprovals() {
  const pending = useQuery(api.users.listPendingUsers);
  const approveUser = useMutation(api.users.approveUser);
  const deleteUser = useMutation(api.users.deleteUser);
  const [approvingId, setApprovingId] = useState<Id<"users"> | null>(null);
  const [rejecting, setRejecting] = useState<Pending | null>(null);

  if (!pending || pending.length === 0) return null;

  const approve = async (user: Pending) => {
    setApprovingId(user._id);
    try {
      await approveUser({ userId: user._id });
      toast.success(`${displayName(user)} can now use BRAVO`);
    } catch (error) {
      toastError(error, "Could not approve");
    } finally {
      setApprovingId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      await deleteUser({ userId: rejecting._id });
      toast.success(`${displayName(rejecting)}'s sign-up was turned away`);
    } catch (error) {
      toastError(error, "Could not reject");
      throw error;
    }
  };

  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
      <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
        Waiting for approval ({pending.length})
      </h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        These people signed up and can't use BRAVO until you approve them.
      </p>
      <ul className="space-y-3">
        {pending.map((user) => (
          <li
            key={user._id}
            className="flex flex-col gap-2 rounded-md bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-800"
          >
            <div className="min-w-0 text-sm">
              <div className="font-medium text-gray-900 dark:text-white">{displayName(user)}</div>
              <div className="truncate text-gray-600 dark:text-gray-400">
                {[user.email, user.memberNumber && `CFA ${user.memberNumber}`].filter(Boolean).join(" · ")}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Signed up {formatDateTime(user._creationTime)}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" loading={approvingId === user._id} onClick={() => void approve(user)}>
                <UserCheck />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(user)}>
                <UserX />
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={<>Reject {rejecting ? displayName(rejecting) : "this sign-up"}?</>}
        description={<>This deletes the account. They can sign up again with the same email if it was a mistake.</>}
        confirmLabel="Reject"
        tone="destructive"
        onConfirm={reject}
      />
    </div>
  );
}
