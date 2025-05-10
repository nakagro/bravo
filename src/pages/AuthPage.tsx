import { SignInForm } from "../features/auth/components/SignInForm";

export function AuthPage() {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold text-red-700 mb-4">Brigade Management System</h1>
      <p className="text-xl text-slate-600 mb-8">Sign in to access the system</p>
      <SignInForm />
    </div>
  );
}
