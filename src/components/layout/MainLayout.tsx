import { ReactNode, useLayoutEffect, useRef } from "react";
import { HamburgerMenu } from "./HamburgerMenu";
import { Toaster } from "../ui/sonner";
import { Link } from "react-router-dom";
import { getEnvironmentBadge } from "@/utils/environment";
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
        <header className="bg-white dark:bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/"
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            aria-label="Go to dashboard"
          >
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-600">
              Wyndham Vale Fire Brigade
              {envBadge && (
                <span
                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold align-middle ${envBadge.className}`}
                  title={envBadge.long}
                >
                  {envBadge.short}
                </span>
              )}
            </h2>
          </Link>
          <div className="flex items-center gap-1">
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
