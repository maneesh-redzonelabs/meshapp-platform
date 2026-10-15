import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, string> = {
  success: 'fa-circle-check text-emerald-500',
  error: 'fa-circle-exclamation text-rose-500',
  info: 'fa-circle-info text-purple-500',
  warning: 'fa-triangle-exclamation text-amber-500',
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 pointer-events-none sm:w-96">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white shadow-lg border border-purple-100 rounded-xl px-4 py-3 flex items-start gap-3 animate-[fadeIn_0.2s_ease-out] text-sm text-slate-800"
          >
            <i className={`fa-solid ${ICONS[t.kind]} mt-0.5`} />
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
