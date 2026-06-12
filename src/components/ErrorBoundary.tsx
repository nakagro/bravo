import { Component, type ErrorInfo, type ReactNode } from "react";
import posthog from "posthog-js";
import { TriangleAlert } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a crash in one component doesn't white-screen
 * the whole PWA. Offers "Try again" (re-render) and "Reload app" recovery.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
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

  render() {
    if (this.state.error) {
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
              An unexpected error occurred. You can try again, or reload the
              app if the problem persists.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
