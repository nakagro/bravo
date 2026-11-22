import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

/**
 * What a new sign-up sees until an admin approves them. The server already
 * refuses them everything; this explains why and gives them a way out. The
 * page updates on its own the moment they're approved.
 */
export function AwaitingApproval() {
  const { signOut } = useAuthActions();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Waiting for approval
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Your account has been created. A brigade administrator needs to approve
          it before you can use BRAVO. This page will open the app as soon as
          they do.
        </p>
        <Button className="w-full" variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
