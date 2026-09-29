import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastType = "success" | "error";
export interface ToastState {
  message: string;
  type: ToastType;
}

/** One toast at a time; a new message replaces the current one. */
export function useToast(durationMs = 3500) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      timer.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`fixed bottom-6 right-6 z-[60] max-w-sm flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white ${
        toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
      <span>{toast.message}</span>
    </div>
  );
}

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Blocks closing (backdrop, Escape, ✕) while a save is in flight. */
  busy?: boolean;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}

const SIZES = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" };

export function Modal({ title, subtitle, onClose, busy, size = "md", children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl w-full ${SIZES[size]} shadow-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]`}
      >
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-start justify-between gap-3 bg-[#FAFAFA] rounded-t-2xl">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#111] truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#666] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm disabled:opacity-40"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#E5E5E5] bg-[#FAFAFA] rounded-b-2xl flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, error, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-5 py-2 rounded-lg text-[12px] font-bold text-white shadow-sm disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#E21B23] hover:bg-[#c4151c]"
            }`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[13px] text-gray-700 space-y-3">
        <div>{message}</div>
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Inline error banner used for load failures. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="underline shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}
