import { ReactNode } from "react";
import { HamburgerMenu } from "./HamburgerMenu";
import { Toaster } from "sonner";
import { DarkModeToggle } from "../common/DarkModeToggle";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-red-700 dark:text-red-600">Wyndham Vale Fire Brigade</h2>
        <div className="flex items-center space-x-2">
          <DarkModeToggle />
          <HamburgerMenu />
        </div>
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
