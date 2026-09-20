"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { useMutation, useConvex } from "convex/react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { useSearchParams } from "react-router-dom";
import { usePostHog } from "posthog-js/react";

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
  memberNumber: z.string().min(1, "CFA member number is required").trim(),
  email: z.email("Please enter a valid email address"),
});

const signInSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const otpEmailSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

const otpCodeSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type SignInValues = z.infer<typeof signInSchema>;
type OtpEmailValues = z.infer<typeof otpEmailSchema>;
type OtpCodeValues = z.infer<typeof otpCodeSchema>;

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const posthog = usePostHog();
  const [flow, setFlow] = useState<"signIn" | "signUp" | "forgotPassword" | "emailCode">("emailCode");
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const hCaptchaRef = useRef<HCaptcha>(null);
  const convex = useConvex();
  const storeSignupData = useMutation(api.auth.storeSignupData);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: "", lastName: "", memberNumber: "", email: "" },
  });

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const otpEmailForm = useForm<OtpEmailValues>({
    resolver: zodResolver(otpEmailSchema),
    defaultValues: { email: "" },
  });

  const otpCodeForm = useForm<OtpCodeValues>({
    resolver: zodResolver(otpCodeSchema),
    defaultValues: { code: "" },
  });

  // Show success message if redirected from password reset
  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      toast.success("Password reset successfully! You can now sign in with your new password.", {
        duration: 5000,
      });
      searchParams.delete("reset");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
  const captchaEnabled = isProduction && import.meta.env.VITE_DISABLE_CAPTCHA !== 'true';
  // Overridable per environment (e.g. a UAT site key); falls back to the
  // production key so builds without the var keep working.
  const hCaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY || "3130983c-4200-4120-98ae-46fe42be99f0";

  const resetCaptcha = () => {
    if (captchaEnabled) {
      setCaptchaToken(null);
      hCaptchaRef.current?.resetCaptcha();
    }
  };

  if (flow === "forgotPassword") {
    return <ForgotPasswordForm onBack={() => setFlow("emailCode")} />;
  }

  const handleSignUp = async (values: SignUpValues) => {
    setSubmitting(true);
    try {
      if (captchaEnabled && !captchaToken) {
        toast.error("Please complete the CAPTCHA verification");
        setSubmitting(false);
        return;
      }

      const email = values.email.toLowerCase().trim();
      const { firstName, lastName, memberNumber } = values;

      // Validate uniqueness BEFORE creating the auth account
      const validation = await convex.query(api.auth.validateSignupData, {
        memberNumber,
        email,
      });

      if (!validation.valid) {
        toast.error(validation.error ?? "Validation failed");
        setSubmitting(false);
        return;
      }

      // Build FormData for the auth system
      const formData = new FormData();
      formData.set("flow", "signUp");
      formData.set("email", email);
      formData.set("password", memberNumber);
      formData.set("firstName", firstName);
      formData.set("lastName", lastName);
      formData.set("memberNumber", memberNumber);

      // Create the auth account
      const signInResult = await signIn("password", formData);

      if (signInResult) {
        // Store profile data - retry up to 3 times to handle auth system timing
        let stored = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await storeSignupData({ email, firstName, lastName, memberNumber });
            stored = true;
            break;
          } catch (error: any) {
            if (attempt < 2 && error?.message?.includes("User not found")) {
              // Auth system hasn't created the user record yet, wait and retry
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              throw error;
            }
          }
        }

        if (!stored) {
          toast.error("Your account was created, but we couldn't save your profile information. Please update your profile in settings.");
        } else {
          toast.success("Account created successfully!");
        }
        resetCaptcha();
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "";
      console.error("Signup error:", error);

      let toastTitle: string;
      if (errorMessage.includes("CFA number already exists")) {
        toastTitle = "A member with this CFA number already exists. Please check your member number or contact an administrator.";
      } else if (errorMessage.includes("already exists")) {
        toastTitle = "An account with this email already exists.";
      } else if (errorMessage.includes("invalid email") || errorMessage.includes("InvalidEmail")) {
        toastTitle = "Please enter a valid email address.";
      } else if (errorMessage.includes("Password must be")) {
        toastTitle = errorMessage;
      } else if (errorMessage.includes("weak password") || errorMessage.includes("WeakPassword")) {
        toastTitle = "Password is too weak. Please use a stronger password.";
      } else {
        toastTitle = "Could not create account. Unknown/Uncaught error.";
      }

      toast.error(toastTitle);
      setSubmitting(false);
      resetCaptcha();
    }
  };

  const handleSignIn = async (values: SignInValues) => {
    setSubmitting(true);
    try {
      if (captchaEnabled && !captchaToken) {
        toast.error("Please complete the CAPTCHA verification");
        setSubmitting(false);
        return;
      }

      const email = values.email.toLowerCase().trim();
      const formData = new FormData();
      formData.set("flow", "signIn");
      formData.set("email", email);
      formData.set("password", values.password);

      await signIn("password", formData);

      posthog?.capture("user_login_success", {
        email,
        timestamp: new Date().toISOString(),
      });
      resetCaptcha();
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "";
      console.error("Authentication error:", error);

      const email = values.email.toLowerCase().trim();
      let toastTitle: string;
      let errorType = "unknown";

      if (errorMessage.includes("InvalidSecret")) {
        toastTitle = "Incorrect email or password";
        errorType = "invalid_credentials";
      } else if (errorMessage.includes("InvalidAccountId") || errorMessage.includes("not found")) {
        toastTitle = "No account found with this email. Please sign up first.";
        errorType = "account_not_found";
      } else if (errorMessage.includes("TooManyFailedAttempts")) {
        toastTitle = "Too many failed login attempts. Please try again later.";
        errorType = "rate_limited";
      } else if (errorMessage.includes("disabled")) {
        toastTitle = "This account has been disabled. Please contact an administrator.";
        errorType = "account_disabled";
      } else {
        toastTitle = "Could not sign in. Please check your credentials and try again.";
        errorType = "generic_error";
      }

      posthog?.capture("user_login_failed", {
        email,
        error_type: errorType,
        error_message: toastTitle,
        timestamp: new Date().toISOString(),
      });

      toast.error(toastTitle);
      setSubmitting(false);
      resetCaptcha();
    }
  };

  const handleOtpSend = async (values: OtpEmailValues) => {
    setSubmitting(true);
    try {
      const email = values.email.toLowerCase().trim();
      await signIn("email-otp", { email });
      setOtpEmail(email);
      toast.success("Code sent! Check your email.");
      setSubmitting(false);
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("disabled")) {
        toast.error("This account has been disabled. Please contact an administrator.");
      } else {
        toast.error("Could not send code. Check your email address and try again.");
      }
      setSubmitting(false);
    }
  };

  const handleOtpVerify = async (values: OtpCodeValues) => {
    if (!otpEmail) return;
    setSubmitting(true);
    try {
      await signIn("email-otp", { email: otpEmail, code: values.code });
      posthog?.capture("user_login_success", {
        email: otpEmail,
        method: "email_otp",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const msg = error?.message || "";
      let toastTitle: string;
      if (msg.includes("InvalidToken") || msg.includes("invalid") || msg.includes("expired") || msg.includes("Could not verify")) {
        toastTitle = "Invalid or expired code. Please try again.";
      } else {
        toastTitle = "Could not verify code. Please try again.";
      }
      toast.error(toastTitle);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {flow === "signUp" && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setFlow("emailCode")}
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

      {flow === "signUp" ? (
        <form
          className="flex flex-col gap-6"
          onSubmit={signUpForm.handleSubmit(handleSignUp)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Enter your first name"
                  {...signUpForm.register("firstName")}
                />
                {signUpForm.formState.errors.firstName && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signUpForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Enter your last name"
                  {...signUpForm.register("lastName")}
                />
                {signUpForm.formState.errors.lastName && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signUpForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CFA Member Number
              </label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g. 7000001"
                {...signUpForm.register("memberNumber")}
              />
              {signUpForm.formState.errors.memberNumber && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signUpForm.formState.errors.memberNumber.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              className="input-field"
              type="email"
              placeholder="Enter your email address"
              autoComplete="email"
              {...signUpForm.register("email")}
            />
            {signUpForm.formState.errors.email && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signUpForm.formState.errors.email.message}</p>
            )}
          </div>

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

          {captchaEnabled && (
            <div className="flex justify-center my-4">
              <HCaptcha
                ref={hCaptchaRef}
                sitekey={hCaptchaSiteKey}
                onVerify={(token) => setCaptchaToken(token)}
                onError={() => { toast.error("CAPTCHA verification failed. Please try again."); setCaptchaToken(null); }}
                onExpire={() => { toast.error("CAPTCHA expired. Please complete it again."); setCaptchaToken(null); }}
              />
            </div>
          )}

          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            type="submit"
            disabled={submitting || (captchaEnabled && !captchaToken)}
          >
            {submitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating account...
              </div>
            ) : (
              "Create Account"
            )}
          </button>

          <div className="text-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Already have an account? </span>
            <button
              type="button"
              className="text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors duration-200"
              onClick={() => setFlow("emailCode")}
            >
              Sign in instead
            </button>
          </div>
        </form>
      ) : flow === "emailCode" ? (
        otpEmail ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={otpCodeForm.handleSubmit(handleOtpVerify)}
          >
            <div className="mb-2">
              <button
                type="button"
                onClick={() => { setOtpEmail(null); otpCodeForm.reset(); }}
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
                <span className="text-sm font-medium">Change email</span>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter the 6-digit code sent to <strong>{otpEmail}</strong>
            </p>

            <div>
              <input
                className="input-field text-center text-2xl tracking-widest"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                autoFocus
                {...otpCodeForm.register("code")}
              />
              {otpCodeForm.formState.errors.code && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{otpCodeForm.formState.errors.code.message}</p>
              )}
            </div>

            <button
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                "Verify Code"
              )}
            </button>

            <button
              type="button"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => {
                otpCodeForm.reset();
                handleOtpSend({ email: otpEmail });
              }}
              disabled={submitting}
            >
              Resend code
            </button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={otpEmailForm.handleSubmit(handleOtpSend)}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="Enter your email address"
                autoComplete="email"
                {...otpEmailForm.register("email")}
              />
              {otpEmailForm.formState.errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{otpEmailForm.formState.errors.email.message}</p>
              )}
            </div>

            <button
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Sending code...
                </div>
              ) : (
                "Send Sign-In Code"
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
                onClick={() => setFlow("signIn")}
              >
                Use password instead
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Don't have an account? </span>
              <button
                type="button"
                className="text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors duration-200"
                onClick={() => setFlow("signUp")}
              >
                Sign up instead
              </button>
            </div>
          </form>
        )
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={signInForm.handleSubmit(handleSignIn)}
        >
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setFlow("emailCode")}
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
              <span className="text-sm font-medium">Back to email code</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              className="input-field"
              type="email"
              placeholder="Enter your email address"
              autoComplete="email"
              {...signInForm.register("email")}
            />
            {signInForm.formState.errors.email && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signInForm.formState.errors.email.message}</p>
            )}
          </div>

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
              placeholder="Enter your password"
              {...signInForm.register("password")}
            />
            {signInForm.formState.errors.password && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{signInForm.formState.errors.password.message}</p>
            )}
          </div>

          {captchaEnabled && (
            <div className="flex justify-center my-4">
              <HCaptcha
                ref={hCaptchaRef}
                sitekey={hCaptchaSiteKey}
                onVerify={(token) => setCaptchaToken(token)}
                onError={() => { toast.error("CAPTCHA verification failed. Please try again."); setCaptchaToken(null); }}
                onExpire={() => { toast.error("CAPTCHA expired. Please complete it again."); setCaptchaToken(null); }}
              />
            </div>
          )}

          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            type="submit"
            disabled={submitting || (captchaEnabled && !captchaToken)}
          >
            {submitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              "Sign In"
            )}
          </button>

        </form>
      )}
    </div>
  );
}
