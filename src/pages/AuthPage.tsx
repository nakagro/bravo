import { SignInForm } from "../features/auth/components/SignInForm";
import { getVersionString } from "@/utils/version";

export function AuthPage() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-700 to-orange-400 bg-clip-text text-transparent mb-2">
            BRAVO
          </h1>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
            <span className="text-orange-600 dark:text-orange-500 font-semibold">BR</span>igade{" "}
            <span className="text-orange-600 dark:text-orange-500 font-semibold">AV</span>ailability and{" "}
            <span className="text-orange-600 dark:text-orange-500 font-semibold">O</span>perations
          </p>
        </div>
        
        {/* Decorative line */}
        <div className="flex items-center justify-center mb-6">
          <div className="h-px bg-gradient-to-r from-transparent via-red-500 to-transparent w-24"></div>
        </div>
      </div>

      {/* Sign In Form */}
      <SignInForm />
      
      {/* Version Display */}
      <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        v{getVersionString()}
      </div>
    </div>
  );
}
