import { ReactNode } from "react";
import { HamburgerMenu } from "./HamburgerMenu";
import { Toaster } from "../ui/sonner";
import { Link } from "react-router-dom";
import { isDevEnvironment } from "@/utils/environment";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <Link
          to="/"
          className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          aria-label="Go to dashboard"
        >
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-600">
            Wyndham Vale Fire Brigade
            {isDevEnvironment() && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-amber-950 align-middle">
                DEV
              </span>
            )}
          </h2>
        </Link>
        <HamburgerMenu />
      </header>
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
