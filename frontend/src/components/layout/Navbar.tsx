import React from "react";
import { FileText, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NavbarProps {
  userEmail?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ userEmail }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">
              Driftwood Capital
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              Copilot
            </span>
          </div>
          <p className="text-[11px] text-slate-400">SEC 10-K Research Assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Grounded Retrieval Active</span>
        </div>

        {userEmail && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800 text-xs">
            <span className="text-slate-300 font-mono hidden sm:inline-block max-w-[160px] truncate">
              {userEmail}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 rounded hover:bg-slate-900"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
