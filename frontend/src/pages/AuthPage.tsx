import React, { useState } from "react";
import { FileText, Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

function getHumanReadableAuthError(err: unknown): string {
  if (!err) return "Authentication failed";
  const rawMsg = err instanceof Error ? err.message : String(err);

  const lower = rawMsg.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Please check your credentials and try again.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Please switch to Sign In.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address via the link sent to your inbox.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a few moments before trying again.";
  }
  return rawMsg;
}

export const AuthPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setInfoMsg("Registration received! Please check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(getHumanReadableAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col justify-center items-center px-4 py-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8 space-y-2 select-none">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-950/40">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Driftwood Capital
          </h1>
          <p className="text-xs text-slate-400">
            SEC 10-K Research Copilot & Grounded Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-5">
          <div className="flex border-b border-slate-800 pb-3 justify-between items-center text-xs">
            <span className="font-semibold text-white">
              {isSignUp ? "Create Analyst Account" : "Analyst Sign In"}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Supabase Auth</span>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs leading-relaxed animate-in fade-in duration-150"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs leading-relaxed animate-in fade-in duration-150"
            >
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-[11px] font-medium text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@driftwoodcapital.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-3 text-sm sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-[11px] font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-10 text-sm sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-white transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {isLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? "Register" : "Sign In"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer min-h-[44px] inline-flex items-center"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Need an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
