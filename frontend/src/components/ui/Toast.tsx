import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "error" | "success";
  action?: ToastAction;
  durationMs?: number;
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, type = "info", action, durationMs = 5000 }: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, message, type, action, durationMs };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }

      return id;
    },
    [dismissToast]
  );

  const contextValue = useMemo(() => ({ toast, dismissToast }), [toast, dismissToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/95 border border-slate-800 text-slate-100 shadow-xl backdrop-blur-md text-xs transition-opacity transition-transform animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {item.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : item.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="truncate">{item.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.onClick();
                    dismissToast(item.id);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold border border-emerald-500/40 hover:border-emerald-500 transition cursor-pointer"
                >
                  {item.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
