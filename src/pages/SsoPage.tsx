import { useSearchParams } from "react-router-dom";
import { SignInForm } from "../features/auth/components/SignInForm";
import { AuthLayout } from "../components/layout/AuthLayout";

function parseSsoRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (
      u.protocol === "https:" &&
      (u.hostname === "grayhux.io" || u.hostname.endsWith(".grayhux.io"))
    ) {
      return u.href;
    }
  } catch {
    // malformed URL
  }
  return null;
}

export function SsoRedirect() {
  const [searchParams] = useSearchParams();
  const target = parseSsoRedirect(searchParams.get("redirect"));

  if (target) {
    window.location.href = target;
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}

export function SsoSignIn() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const target = parseSsoRedirect(redirect);

  return (
    <AuthLayout>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-700 to-orange-400 bg-clip-text text-transparent mb-2">
            BRAVO
          </h1>
          {target && (
            <p className="text-sm text-muted-foreground">
              Sign in to continue to Labs
            </p>
          )}
        </div>
        <SignInForm />
      </div>
    </AuthLayout>
  );
}
