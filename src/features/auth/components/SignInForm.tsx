"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const hCaptchaRef = useRef<HCaptcha>(null);
  const storeSignupData = useMutation(api.auth.storeSignupData);
  
  // Track if we need to show a profile update message
  const [showProfileMessage, setShowProfileMessage] = useState(false);
  
  // Check if we're in production (not localhost)
  const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
  
  // hCaptcha site key
  const hCaptchaSiteKey = "3130983c-4200-4120-98ae-46fe42be99f0";

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
            // Check CAPTCHA in production
            if (isProduction && !captchaToken) {
              toast.error("Please complete the CAPTCHA verification");
              setSubmitting(false);
              return;
            }
            
            // If signing up, collect the additional information
            if (flow === "signUp") {
              const firstName = formData.get("firstName") as string;
              const lastName = formData.get("lastName") as string;
              const memberNumber = formData.get("memberNumber") as string;
              const email = formData.get("email") as string;
              
              // Set the CFA member number as the password
              formData.set("password", memberNumber);
              
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
                // Reset CAPTCHA after successful signup
                if (isProduction) {
                  setCaptchaToken(null);
                  hCaptchaRef.current?.resetCaptcha();
                }
              }
            } else {
              // Regular sign in
              await signIn("password", formData);
              // Reset CAPTCHA after successful signin
              if (isProduction) {
                setCaptchaToken(null);
                hCaptchaRef.current?.resetCaptcha();
              }
            }
          } catch (_error) {
            const toastTitle =
              flow === "signIn"
                ? "Could not sign in, did you mean to sign up?"
                : "Could not sign up, did you mean to sign in?";
            toast.error(toastTitle);
            setSubmitting(false);
            // Reset CAPTCHA on error
            if (isProduction) {
              setCaptchaToken(null);
              hCaptchaRef.current?.resetCaptcha();
            }
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
        {flow === "signIn" && (
          <input className="input-field" type="password" name="password" placeholder="Password" required />
        )}
        {flow === "signUp" && (
          <div className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-800 dark:text-blue-200">Initial Password</p>
            <p>Your initial password will be set to your CFA member number. You can change it after signing in.</p>
          </div>
        )}
        
        {/* hCaptcha - only show in production */}
        {isProduction && (
          <div className="flex justify-center my-4">
            <HCaptcha
              ref={hCaptchaRef}
              sitekey={hCaptchaSiteKey}
              onVerify={(token) => {
                setCaptchaToken(token);
              }}
              onError={() => {
                toast.error("CAPTCHA verification failed. Please try again.");
                setCaptchaToken(null);
              }}
              onExpire={() => {
                toast.error("CAPTCHA expired. Please complete it again.");
                setCaptchaToken(null);
              }}
            />
          </div>
        )}
        
        <button 
          className="auth-button" 
          type="submit" 
          disabled={submitting || (isProduction && !captchaToken)}
        >
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

    </div>
  );
}
