import { ReactNode, useLayoutEffect, useRef } from "react";
import { HamburgerMenu } from "./HamburgerMenu";
import { Toaster } from "../ui/sonner";
import { Link } from "react-router-dom";
import { getEnvironmentBadge } from "@/utils/environment";
import { BRIGADE_FULL_NAME, BRIGADE_SHORT_NAME } from "@/lib/brigadeConfig";
import { ActionBell } from "../../features/actionCentre/components/ActionBell";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const envBadge = getEnvironmentBadge();
  const headerRef = useRef<HTMLDivElement>(null);

  // Publish the app header's height so page-level sticky chrome can park
  // directly beneath it instead of colliding with it. Measured rather than
  // hardcoded - the header grows with the DEV badge and with font scaling.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${el.offsetHeight}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div ref={headerRef} className="sticky top-0 z-30">
        <header className="bg-white dark:bg-gray-800 px-4 py-2 flex justify-between items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/"
            className="group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            aria-label="Go to dashboard"
          >
            {/* One line on every phone: the short name below the width where the full name would wrap */}
            <h2 className="flex min-w-0 items-center gap-2 whitespace-nowrap text-lg font-semibold text-red-700 dark:text-red-600 sm:text-xl">
              <span className={`truncate ${envBadge ? "min-[440px]:hidden" : "min-[380px]:hidden"}`}>
                {BRIGADE_SHORT_NAME}
              </span>
              <span className={`hidden truncate ${envBadge ? "min-[440px]:inline" : "min-[380px]:inline"}`}>
                {BRIGADE_FULL_NAME}
              </span>
              {envBadge && (
                <span
                  className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-bold ${envBadge.className}`}
                  title={envBadge.long}
                >
                  {envBadge.short}
                </span>
              )}
            </h2>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <ActionBell />
            <HamburgerMenu />
          </div>
        </header>
      </div>
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
