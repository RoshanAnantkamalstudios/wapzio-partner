"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";

/**
 * The panel's confirmation dialog.
 *
 * Replaces window.confirm, which cannot be styled, cannot be themed, renders
 * the browser's own chrome and the site's hostname, and blocks the whole tab
 * while it is open. Every destructive action here is irreversible — a rotated
 * key, a removed client — so the dialog also carries the consequence in its
 * body text rather than only asking "are you sure?".
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Escape closes, unless the action is already running — cancelling a request
  // that has left the browser would only lie about what happened.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-[var(--danger)] hover:opacity-90 text-white"
      : "bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        className="card w-full max-w-md p-5"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3 gap-4">
          <h2 id="confirm-title" className="font-semibold">
            {title}
          </h2>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-[var(--muted)] leading-relaxed">{body}</div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
