import React from "react";
import { FileText, LogOut, ShieldCheck, Menu } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NavbarProps {
  userEmail?: string | null;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 pt-[env(safe-area-inset-top)] select-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Close navigation sidebar" : "Open navigation sidebar"}
            className="md:hidden flex items-center justify-center w-11 h-11 -ml-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <FileText className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-semibold text-xs sm:text-sm tracking-tight text-white truncate">
              Driftwood Capital
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 shrink-0">
              Copilot
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:block truncate">
            SEC 10-K Research Assistant
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Grounded Retrieval Active</span>
        </div>

        {userEmail && (
          <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-800 text-xs">
            <span className="text-slate-300 font-mono hidden md:inline-block max-w-[150px] truncate">
              {userEmail}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors px-2 py-2 min-h-[44px] rounded hover:bg-slate-900 cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
