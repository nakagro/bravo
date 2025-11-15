"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp" | "forgotPassword">("signIn");
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

  // Show forgot password form if in that flow
  if (flow === "forgotPassword") {
    return <ForgotPasswordForm onBack={() => setFlow("signIn")} />;
  }

  return (
    <div className="w-full">
      {/* Back button for sign up flow */}
      {flow === "signUp" && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setFlow("signIn")}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 group"
          >
            <svg 
              className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-200" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Sign In</span>
          </button>
        </div>
      )}
      
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
          } catch (error: any) {
            // Parse the error to provide specific feedback
            const errorMessage = error?.message || error?.toString() || "";
            console.error("Authentication error:", error);
            let toastTitle = "";
            
            if (flow === "signIn") {
              // Sign in errors
              if (errorMessage.includes("InvalidSecret")) {
                toastTitle = "Incorrect email or password";
              } else if (errorMessage.includes("InvalidAccountId") || errorMessage.includes("not found")) {
                toastTitle = "No account found with this email. Please sign up first.";
              } else if (errorMessage.includes("TooManyFailedAttempts")) {
                toastTitle = "Too many failed login attempts. Please try again later.";
              } else if (errorMessage.includes("disabled")) {
                toastTitle = "This account has been disabled. Please contact an administrator.";
              } else {
                toastTitle = "Could not sign in. Please check your credentials and try again.";
              }
            } else {
              // Sign up errors
              if (errorMessage.includes("already exists")) {
                toastTitle = "An account with this email already exists.";
              } else if (errorMessage.includes("invalid email") || errorMessage.includes("InvalidEmail")) {
                toastTitle = "Please enter a valid email address.";
              } else if (errorMessage.includes("Password must be")) {
                toastTitle = errorMessage; // Show the specific password requirement error
              } else if (errorMessage.includes("weak password") || errorMessage.includes("WeakPassword")) {
                toastTitle = "Password is too weak. Please use a stronger password.";
              } else {
                toastTitle = "Could not create account. Unknown/Uncaught error.";
              }
            }
            
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
            autoComplete="email"
            autoFocus={false}
            required 
          />
        </div>
        
        {flow === "signIn" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => setFlow("forgotPassword")}
                className="text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors duration-200"
              >
                Forgot password?
              </button>
            </div>
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
