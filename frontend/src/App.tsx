import React, { useState, useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queries";
import { ToastProvider } from "@/components/ui/Toast";
import { ChatPage } from "@/pages/ChatPage";

const LandingPage = React.lazy(() => import("@/pages/LandingPage"));
const AuthPage = React.lazy(() => import("@/pages/AuthPage"));

interface GuardedRouteProps {
  session: Session | null;
  isInitializing: boolean;
  children: React.ReactNode;
}

const ProtectedAppRoute: React.FC<GuardedRouteProps> = ({ session, isInitializing, children }) => {
  if (isInitializing) {
    return (
      <div className="h-[100dvh] bg-surface-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Authenticating Research Terminal...
        </p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
};

const PublicAuthRoute: React.FC<GuardedRouteProps> = ({ session, isInitializing, children }) => {
  if (isInitializing) {
    return (
      <div className="h-[100dvh] bg-surface-950 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Initial fast session lookup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    // Listen to Supabase auth transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsInitializing(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing page: lazy chunk, fully static, never blocks on auth */}
            <Route
              path="/"
              element={
                <Suspense
                  fallback={
                    <div className="min-h-[100dvh] bg-surface-950 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    </div>
                  }
                >
                  <LandingPage />
                </Suspense>
              }
            />

            {/* Auth page: signin / signup */}
            <Route
              path="/signin"
              element={
                <PublicAuthRoute session={session} isInitializing={isInitializing}>
                  <Suspense
                    fallback={
                      <div className="min-h-[100dvh] bg-surface-950 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                      </div>
                    }
                  >
                    <AuthPage />
                  </Suspense>
                </PublicAuthRoute>
              }
            />

            {/* Guarded App workspace */}
            <Route
              path="/app"
              element={
                <ProtectedAppRoute session={session} isInitializing={isInitializing}>
                  <ChatPage userEmail={session?.user.email} />
                </ProtectedAppRoute>
              }
            />

            {/* Guarded App workspace with threadId param */}
            <Route
              path="/app/:threadId"
              element={
                <ProtectedAppRoute session={session} isInitializing={isInitializing}>
                  <ChatPage userEmail={session?.user.email} />
                </ProtectedAppRoute>
              }
            />

            {/* Fallback to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
