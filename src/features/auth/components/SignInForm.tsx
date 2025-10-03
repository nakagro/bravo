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
        className="flex flex-col gap-6"
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <input 
                  className="input-field" 
                  type="text" 
                  name="firstName" 
                  placeholder="Enter your first name" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <input 
                  className="input-field" 
                  type="text" 
                  name="lastName" 
                  placeholder="Enter your last name" 
                  required 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CFA Member Number
              </label>
              <input 
                className="input-field" 
                type="text" 
                name="memberNumber" 
                placeholder="e.g. 7000001" 
                required 
              />
            </div>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input 
            className="input-field" 
            type="email" 
            name="email" 
            placeholder="Enter your email address" 
            required 
          />
        </div>
        
        {flow === "signIn" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input 
              className="input-field" 
              type="password" 
              name="password" 
              placeholder="Enter your password" 
              required 
            />
          </div>
        )}
        {flow === "signUp" && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Initial Password Setup</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Your initial password will be set to your CFA member number. You can change it after signing in through your profile settings.
                </p>
              </div>
            </div>
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
          className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg" 
          type="submit" 
          disabled={submitting || (isProduction && !captchaToken)}
        >
          {submitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {flow === "signIn" ? "Signing in..." : "Creating account..."}
            </div>
          ) : (
            flow === "signIn" ? "Sign In" : "Create Account"
          )}
        </button>
        
        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors duration-200"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>

    </div>
  );
}
