"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const storeSignupData = useMutation(api.auth.storeSignupData);
  
  // Track if we need to show a profile update message
  const [showProfileMessage, setShowProfileMessage] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          
          try {
            // If signing up, collect the additional information
            if (flow === "signUp") {
              const firstName = formData.get("firstName") as string;
              const lastName = formData.get("lastName") as string;
              const memberNumber = formData.get("memberNumber") as string;
              const email = formData.get("email") as string;
              
              // First, create the account with the auth system
              const signInResult = await signIn("password", formData);
              
              if (signInResult) {
                // Then store the profile data
                // We'll do this in a separate step to avoid timing issues
                setTimeout(async () => {
                  try {
                    await storeSignupData({
                      email,
                      firstName,
                      lastName,
                      memberNumber
                    });
                    setShowProfileMessage(true);
                  } catch (error) {
                    console.error("Failed to store profile data:", error);
                    toast.error("Your account was created, but we couldn't save your profile information. Please update your profile later.");
                  }
                }, 1000); // Give the auth system time to create the user
                
                toast.success("Account created successfully!");
              }
            } else {
              // Regular sign in
              await signIn("password", formData);
            }
          } catch (_error) {
            const toastTitle =
              flow === "signIn"
                ? "Could not sign in, did you mean to sign up?"
                : "Could not sign up, did you mean to sign in?";
            toast.error(toastTitle);
            setSubmitting(false);
          }
        }}
      >
        {flow === "signUp" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                className="input-field" 
                type="text" 
                name="firstName" 
                placeholder="First Name" 
                required 
              />
              <input 
                className="input-field" 
                type="text" 
                name="lastName" 
                placeholder="Last Name" 
                required 
              />
            </div>
            <input 
              className="input-field" 
              type="text" 
              name="memberNumber" 
              placeholder="CFA Member Number (e.g. 7000001)" 
              required 
            />
          </>
        )}
        <input className="input-field" type="email" name="email" placeholder="Email Address" required />
        <input className="input-field" type="password" name="password" placeholder="Password" required />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-slate-600 dark:text-slate-400">
          <span>{flow === "signIn" ? "Don't have an account? " : "Already have an account? "}</span>
          <button
            type="button"
            className="text-blue-500 dark:text-blue-400 cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
          <hr className="my-4 grow border-slate-200 dark:border-slate-700" />
          <span className="mx-4 text-slate-400 dark:text-slate-500">or</span>
          <hr className="my-4 grow border-slate-200 dark:border-slate-700" />
        </div>
        <button className="auth-button" onClick={() => void signIn("anonymous")}>
          Sign in anonymously
        </button>
    </div>
  );
}
