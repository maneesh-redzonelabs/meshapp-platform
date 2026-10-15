import React from 'react';

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const base = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20',
    secondary: 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    ghost: 'bg-transparent hover:bg-purple-50 text-purple-700',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Input({ label, error, className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-purple-900 mb-1">{label}</span>}
      <input
        className={`w-full bg-purple-50/70 border rounded-xl px-3 py-2.5 text-sm text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
          error ? 'border-rose-400' : 'border-purple-200'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-rose-600 mt-1 block">{error}</span>}
    </label>
  );
}

export function Textarea({ label, error, className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-purple-900 mb-1">{label}</span>}
      <textarea
        className={`w-full bg-purple-50/70 border rounded-xl px-3 py-2.5 text-sm text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
          error ? 'border-rose-400' : 'border-purple-200'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-rose-600 mt-1 block">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  error,
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-purple-900 mb-1">{label}</span>}
      <select
        className={`w-full bg-purple-50/70 border rounded-xl px-3 py-2.5 text-sm text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
          error ? 'border-rose-400' : 'border-purple-200'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-2xl border border-purple-100 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <i className={`fa-solid fa-circle-notch animate-spin text-purple-600 ${className}`} />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-purple-700 py-10">
      <Spinner /> <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-10 px-4">
      <i className="fa-solid fa-triangle-exclamation text-rose-500 text-2xl" />
      <p className="text-sm text-slate-600 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'fa-inbox', title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center py-10 px-4">
      <i className={`fa-solid ${icon} text-purple-300 text-3xl mb-1`} />
      <p className="text-sm font-semibold text-purple-900">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 max-w-xs">{subtitle}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'purple' }: { children: React.ReactNode; tone?: 'purple' | 'green' | 'amber' | 'rose' | 'slate' }) {
  const tones: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tones[tone]}`}>{children}</span>;
}
