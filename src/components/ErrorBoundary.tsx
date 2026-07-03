import { Component, type ErrorInfo, type ReactNode } from "react";
import posthog from "posthog-js";
import { TriangleAlert, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
  reloading: boolean;
}

/**
 * Catches render errors so a crash in one component doesn't white-screen
 * the whole PWA. Recovery is a full hard refresh (unregister service
 * workers + clear caches + reload), and the error details are shown
 * on-screen so a user screenshot is actually diagnosable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
    try {
      // React swallows boundary-caught errors in production, so PostHog's
      // window-level autocapture never sees them — report explicitly.
      posthog.captureException(error, {
        componentStack: errorInfo.componentStack,
      });
    } catch {
      // PostHog unavailable — already logged to console above
    }
  }

  handleReload = async () => {
    this.setState({ reloading: true });
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } catch (cleanupError) {
      // Cleanup is best-effort — still reload so the user isn't stuck
      console.error("Hard refresh cleanup failed:", cleanupError);
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const { error, componentStack, reloading } = this.state;
      // First few component frames are enough to locate the crash without
      // filling the screen.
      const stackPreview = componentStack
        ?.split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5)
        .join("\n");

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <TriangleAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              An unexpected error occurred. Reload the app to continue — if it
              keeps happening, screenshot this page and send it to an admin.
            </p>
            <div className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 overflow-x-auto">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 break-words">
                {error.name}: {error.message}
              </p>
              {stackPreview && (
                <pre className="text-[11px] leading-4 text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words">
                  {stackPreview}
                </pre>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {new Date().toLocaleString()} · {window.location.pathname}
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => void this.handleReload()}
                disabled={reloading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
                {reloading ? "Reloading…" : "Reload app"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
