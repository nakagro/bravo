import { ReactNode } from "react";
import { Toaster } from "../ui/sonner";
import { DarkModeToggle } from "../common/DarkModeToggle";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Dark mode toggle in top right corner */}
      <div className="absolute top-4 right-4 z-10">
        <DarkModeToggle />
      </div>
      
      {/* Main content centered on screen */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
      
      <Toaster />
    </div>
  );
}
