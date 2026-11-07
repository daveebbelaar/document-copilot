import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Database,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

function getHumanReadableAuthError(err: unknown): string {
  if (!err) return "Authentication failed";
  const rawMsg = err instanceof Error ? err.message : String(err);

  const lower = rawMsg.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Please verify your credentials and try again.";
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
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inline validation state
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!isEmailValid) {
      setErrorMsg("Please enter a valid work email address.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("Password must contain at least 6 characters.");
      return;
    }

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
          setInfoMsg("Registration received! Please check your email inbox to confirm your account.");
        } else if (data.session) {
          navigate("/app", { replace: true });
        }
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          navigate("/app", { replace: true });
        }
      }
    } catch (err) {
      setErrorMsg(getHumanReadableAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface-950 text-slate-100 flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Brand / Value Panel (split layout) */}
        <div className="hidden md:flex md:w-1/2 lg:w-5/12 bg-surface-900/60 border-r border-surface-800 p-8 lg:p-12 flex-col justify-between relative overflow-hidden">
          <div className="space-y-8 relative z-10">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
            >
              <div className="h-9 w-9 rounded-xl bg-accent-glow border border-accent/30 flex items-center justify-center text-accent">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-white block">
                  Driftwood Capital
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  SEC Filing Copilot
                </span>
              </div>
            </Link>

            <div className="space-y-4 pt-4">
              <h2 className="font-serif text-2xl lg:text-3xl font-semibold text-white leading-snug">
                Institutional SEC 10-K research with guaranteed grounding.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Query audited annual reports with hybrid vector semantic search and exact-passage citations. Zero hallucinations.
              </p>
            </div>

            {/* Architecture value pillars */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-accent-glow text-accent flex items-center justify-center shrink-0 mt-0.5 border border-accent/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Deterministic Grounding Validator</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Every assertion links directly to verbatim SEC chunks and EDGAR accession links.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-surface-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-surface-700">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Hybrid Vector + Lexical RRF</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Dense embeddings via pgvector fused with BM25 full-text rank fusion for precision.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-surface-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-surface-700">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Audited 10-K Filings Corpus</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Active coverage: AAPL, MSFT, NVDA, AMZN, and GOOGL with section-aware chunking.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-surface-800/80 pt-4 relative z-10 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Supabase RLS Enabled</span>
            <span className="text-accent flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Production Live
            </span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-12">
          <div className="w-full max-w-sm space-y-6">
            {/* Mobile Header */}
            <div className="md:hidden text-center space-y-2">
              <Link to="/" className="inline-flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-xl bg-accent-glow border border-accent/30 flex items-center justify-center text-accent mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
              </Link>
              <h1 className="font-serif text-xl font-bold tracking-tight text-white">
                Driftwood Capital
              </h1>
              <p className="text-xs text-slate-400">
                SEC 10-K Research Assistant & Grounded Intelligence
              </p>
            </div>

            {/* Auth Mode Toggle Tabs */}
            <div className="grid grid-cols-2 p-1 bg-surface-900 border border-surface-800 rounded-xl text-xs font-medium select-none">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer min-h-[44px] ${
                  !isSignUp
                    ? "bg-surface-800 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer min-h-[44px] ${
                  isSignUp
                    ? "bg-surface-800 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs leading-relaxed"
              >
                {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs leading-relaxed"
              >
                {infoMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-email"
                  className="text-xs font-medium text-slate-300 flex items-center justify-between"
                >
                  <span>Work Email</span>
                  {emailTouched && !isEmailValid && email.length > 0 && (
                    <span className="text-[11px] text-rose-400">Invalid email format</span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    autoComplete="email"
                    placeholder="analyst@firm.com"
                    className={`w-full bg-surface-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition min-h-[44px] ${
                      emailTouched && !isEmailValid && email.length > 0
                        ? "border-rose-500/80 focus:ring-rose-500"
                        : "border-surface-800 focus:ring-accent focus:border-accent"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-password"
                  className="text-xs font-medium text-slate-300 flex items-center justify-between"
                >
                  <span>Password</span>
                  {passwordTouched && !isPasswordValid && password.length > 0 && (
                    <span className="text-[11px] text-rose-400">Min 6 characters</span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    required
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    className={`w-full bg-surface-900 border rounded-xl pl-9 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition min-h-[44px] ${
                      passwordTouched && !isPasswordValid && password.length > 0
                        ? "border-rose-500/80 focus:ring-rose-500"
                        : "border-surface-800 focus:ring-accent focus:border-accent"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition min-w-[44px] justify-center cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-accent text-surface-950 font-semibold text-sm hover:bg-accent-hover transition duration-150 disabled:opacity-50 cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent min-h-[44px]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-surface-950 border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? "Create Analyst Account" : "Access Research Terminal"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <Link
                to="/"
                className="text-xs text-slate-400 hover:text-slate-200 transition inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded p-1"
              >
                ← Return to Overview
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
