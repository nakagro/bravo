import { Authenticated, Unauthenticated } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { HoseInventory } from "./HoseInventory";
import { Toaster } from "sonner";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold text-red-700">Wyndham Vale Fire Brigade</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  return (
    <div className="flex flex-col gap-8">
      <Authenticated>
        <HoseInventory />
      </Authenticated>
      <Unauthenticated>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-700 mb-4">Hose Inventory Management</h1>
          <p className="text-xl text-slate-600 mb-8">Sign in to access the system</p>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
