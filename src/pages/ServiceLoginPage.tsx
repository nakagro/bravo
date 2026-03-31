import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { storeServiceToken } from "@/features/serviceAccounts/ServiceAccountContext";
import { Link, useSearchParams } from "react-router-dom";
import { getVersionString } from "@/utils/version";
import { isDevEnvironment } from "@/utils/environment";
import { Delete, LogIn } from "lucide-react";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 10;

export default function ServiceLoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [searchParams] = useSearchParams();

  const validatePin = useMutation(api.serviceAccounts.validateServicePin);
  const nextPath = searchParams.get("next");
  const redirectTo =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/";

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length < MIN_PIN_LENGTH || submittingRef.current) return;

      submittingRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const result = await validatePin({ pin: pinValue });

        if (result.success) {
          storeServiceToken(result.token, redirectTo);
        } else {
          setError(result.error);
          setPin("");
        }
      } catch {
        setError("An error occurred. Please try again.");
        setPin("");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [redirectTo, validatePin]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < MAX_PIN_LENGTH) {
        setPin(pin + digit);
        setError(null);
      }
    },
    [pin]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    submitPin(pin);
  }, [pin, submitPin]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 select-none">
      {isDevEnvironment() && (
        <div className="fixed top-0 inset-x-0 px-4 py-2 bg-amber-500 text-amber-950 text-center text-sm font-bold z-10">
          DEV ENVIRONMENT
        </div>
      )}

      {/* Single centred column, capped so it doesn't stretch too wide on large screens */}
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent mb-2">
            BRAVO
          </h1>
          <p className="text-slate-400 text-lg font-medium">Service Account Login</p>
          <div className="h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent w-24 mx-auto mt-3" />
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-4 min-h-5 items-center">
          {pin.length === 0 ? (
            <p className="text-sm text-slate-500">Enter PIN</p>
          ) : (
            Array.from({ length: pin.length }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full bg-red-500 scale-110 shadow-lg shadow-red-500/30"
              />
            ))
          )}
        </div>

        {/* Error / spacer */}
        <div className="mb-4 h-10 flex items-center justify-center">
          {error && (
            <div className="w-full px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-sm text-red-400 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit.toString())}
              disabled={submitting || pin.length >= MAX_PIN_LENGTH}
              className="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600/60 active:bg-slate-500/40 active:scale-95 border border-slate-600/30 text-white text-2xl font-semibold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting || pin.length === 0}
            className="h-16 rounded-xl bg-slate-700/30 hover:bg-slate-600/40 active:bg-slate-500/30 active:scale-95 border border-slate-600/20 text-slate-400 text-sm font-medium uppercase tracking-wider transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit("0")}
            disabled={submitting || pin.length >= MAX_PIN_LENGTH}
            className="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600/60 active:bg-slate-500/40 active:scale-95 border border-slate-600/30 text-white text-2xl font-semibold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={submitting || pin.length === 0}
            className="h-16 rounded-xl bg-slate-700/30 hover:bg-slate-600/40 active:bg-slate-500/30 active:scale-95 border border-slate-600/20 text-slate-400 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || pin.length < MIN_PIN_LENGTH}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:from-red-700 active:to-red-800 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Verifying...
            </>
          ) : (
            <>
              <LogIn className="h-5 w-5" />
              Sign In
            </>
          )}
        </button>

        {/* Footer */}
        <div className="mt-6 text-center space-y-1">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to regular sign in
          </Link>
          <div className="text-xs text-slate-600">v{getVersionString()}</div>
        </div>
      </div>
    </div>
  );
}
