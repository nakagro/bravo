import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVersionString } from "@/utils/version";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  
  // Verify the token
  const tokenVerification = useQuery(
    api.passwordReset.verifyResetToken,
    token ? { token } : "skip"
  );
  
  const resetPassword = useAction(api.passwordReset.resetPasswordWithToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    
    setSubmitting(true);

    try {
      const result = await resetPassword({ 
        token, 
        newPassword 
      });
      
      if (result.success) {
        setResetComplete(true);
        toast.success("Password reset successfully!");
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        toast.error(result.message || "Failed to reset password");
      }
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state while verifying token
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Reset Link
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This password reset link is invalid or missing.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tokenVerification === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (!tokenVerification.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Reset Link Invalid
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {tokenVerification.reason}
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show success state after password reset
  if (resetComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Password Reset Complete
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your password has been successfully reset. Redirecting to sign in...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show the reset password form
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full">
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

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Reset Your Password
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your new password below
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input 
              className="input-field" 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)" 
              autoComplete="new-password"
              autoFocus
              required 
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <input 
              className="input-field" 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password" 
              autoComplete="new-password"
              required 
              minLength={8}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Password Requirements
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Password must be at least 8 characters long
                </p>
              </div>
            </div>
          </div>

          <button 
            className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg" 
            type="submit" 
            disabled={submitting}
          >
            {submitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Resetting password...
              </div>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>

        {/* Version Display */}
        <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          v{getVersionString()}
        </div>
      </div>
    </div>
  );
}
