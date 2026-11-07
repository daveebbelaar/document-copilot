import React, { useState, useEffect, Suspense } from "react";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queries";
import { ToastProvider } from "@/components/ui/Toast";
import { ChatPage } from "@/pages/ChatPage";

const AuthPage = React.lazy(() => import("@/pages/AuthPage"));

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Fast initial session verification
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    // Listen for real-time auth transitions
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
        {isInitializing ? (
          <div className="h-[100dvh] bg-slate-950 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              Initializing Research Terminal...
            </p>
          </div>
        ) : !session ? (
          <Suspense
            fallback={
              <div className="h-[100dvh] bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              </div>
            }
          >
            <AuthPage />
          </Suspense>
        ) : (
          <ChatPage userEmail={session.user.email} />
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
