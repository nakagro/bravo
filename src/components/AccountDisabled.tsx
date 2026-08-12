import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

/**
 * What a member who has left the brigade sees instead of the app.
 *
 * Their session is revoked the moment an admin disables them, so this screen is
 * mostly a safety net for a client that still holds a token: it stops the app
 * rendering, says plainly what happened, and gives them a way out.
 */
export function AccountDisabled() {
  const { signOut } = useAuthActions();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Account disabled
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This account has been disabled and can no longer access the brigade
          system. If you think this is a mistake, contact a brigade
          administrator.
        </p>
        <Button className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
