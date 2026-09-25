import React from 'react';
import { initials } from '../utils/format';

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className = 'w-5 h-5', label }) => (
  <span role="status" className="inline-flex items-center gap-2">
    <span className={`${className} rounded-full border-2 border-current border-t-transparent animate-spin`} />
    {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
  </span>
);

export const FullScreenLoader: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F7F7F7] text-[#E31E24]">
    <img src="/icons/logo.png" alt="" className="w-14 h-14 rounded-2xl object-contain bg-white p-1.5 shadow-sm" />
    <Spinner className="w-6 h-6" />
    <span className="text-xs font-semibold text-gray-500">{label}</span>
  </div>
);

export const ErrorNotice: React.FC<{ message: string; onRetry?: () => void; className?: string }> = ({
  message,
  onRetry,
  className = '',
}) => (
  <div role="alert" className={`flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 ${className}`}>
    <span className="mt-0.5 font-black">!</span>
    <span className="flex-1 leading-relaxed">{message}</span>
    {onRetry && (
      <button onClick={onRetry} className="shrink-0 font-bold text-[#E31E24] hover:underline">
        Retry
      </button>
    )}
  </div>
);

export const Avatar: React.FC<{ name: string; photoUrl?: string; className?: string }> = ({
  name,
  photoUrl,
  className = 'w-12 h-12 text-sm',
}) =>
  photoUrl ? (
    <img src={photoUrl} alt={name} className={`${className} rounded-full object-cover border border-gray-200`} />
  ) : (
    <div className={`${className} rounded-full bg-gray-900 text-white font-bold flex items-center justify-center`} aria-label={name}>
      {initials(name)}
    </div>
  );

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
}> = ({ open, onClose, title, children, dismissible = true }) => {
  React.useEffect(() => {
    if (!open || !dismissible) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-black text-gray-900">{title}</h3>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const primaryBtn =
  'w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-[#C41820] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
export const secondaryBtn =
  'w-full bg-gray-100 text-gray-800 py-3 rounded-2xl font-bold text-sm hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2';
export const inputCls =
  'w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:border-[#E31E24] focus:bg-white focus:outline-none transition-colors placeholder-gray-400';
export const labelCls = 'text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1';
