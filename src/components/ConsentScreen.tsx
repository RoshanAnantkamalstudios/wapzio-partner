"use client";

import { useState } from "react";
import { ChevronDown, FileText, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import { ConsentItem, ConsentStatus } from "@/src/lib/consents";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** The published text of one agreement, rendered from the ledger. */
export const DocumentText = ({ item }: { item: ConsentItem }) =>
  item.body_html ? (
    // Published by Wapzio through the legal ledger, never entered by a partner.
    <div className="doc-body" dangerouslySetInnerHTML={{ __html: item.body_html }} />
  ) : (
    <p className="text-sm text-[var(--muted)]">The full text is not available right now.</p>
  );

/**
 * Asks the signed-in partner to accept whatever is pending.
 *
 * mode "block": the whole screen, shown when enforcement is on. Nothing else in
 *   the panel is reachable, and the only other action is to sign out.
 * mode "modal": a dismissible popup, shown when enforcement is still off so the
 *   partner can accept early without being locked out.
 *
 * Boxes start unticked and there is no "accept all" shortcut: each statement is
 * a separate act, which is the point of recording them separately.
 */
export default function ConsentScreen({
  status,
  mode,
  onAccepted,
  onClose,
  onSignOut,
}: {
  status: ConsentStatus;
  mode: "block" | "modal";
  onAccepted: (next: ConsentStatus) => void;
  onClose?: () => void;
  onSignOut?: () => void;
}) {
  const pending = status.items.filter((i) => i.status === "pending");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(pending[0]?.key ?? null);
  const [saving, setSaving] = useState(false);

  const allTicked = pending.length > 0 && pending.every((i) => ticked.has(i.key));

  const toggle = (key: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    const res = await apiFetch<ConsentStatus>("/partner/consents/accept", {
      method: "POST",
      body: { accepted: pending.map((i) => i.key) },
    });
    setSaving(false);

    if (res.ok && res.data) {
      toast.success(res.message || "Your acceptance has been recorded");
      onAccepted(res.data);
    } else {
      toast.error(res.message || "Could not record your acceptance");
    }
  };

  const card = (
    <div className="card shadow-[var(--shadow-card)] w-full max-w-2xl max-h-[92vh] flex flex-col">
      <div className="shrink-0 p-5 border-b border-[var(--border)] flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/25 text-[var(--primary)] flex items-center justify-center shrink-0">
          <ShieldCheck size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">
            {mode === "block" ? "Before you continue" : "Partner agreements"}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Please read and accept the following. Each one is recorded with the version you saw, the date and time, and your
            account.
          </p>
        </div>
        {mode === "modal" && onClose ? (
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        ) : null}
      </div>

      {/*
        min-h-0 is what makes max-h-[92vh] above mean anything.

        A flex item defaults to min-height:auto, so this one would not shrink
        below its content: with a couple of agreements open the card grew past
        the cap and, being centred, spilled out of the top and bottom of the
        window at once — heading gone, buttons on the edge, and a scrollbar
        with nothing to scroll.
      */}
      <div className="flex-1 min-h-0 p-5 space-y-3 overflow-y-auto">
        {pending.map((item) => {
          const expanded = open === item.key;
          return (
            <div key={item.key} className="rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : item.key)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <FileText size={18} className="text-[var(--muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {item.kind === "notice" ? "Notice" : "Agreement"} · version {item.version}
                    {item.is_reacceptance ? " · updated" : ""}
                  </div>
                </div>
                <ChevronDown size={16} className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded ? (
                <div className="px-4 pb-3 border-t border-[var(--border)] max-h-[min(16rem,40vh)] overflow-y-auto">
                  {item.is_reacceptance && item.change_summary ? (
                    <p className="mt-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/15 text-amber-800 dark:text-amber-300 px-3 py-2">
                      What changed: {item.change_summary}
                    </p>
                  ) : null}
                  <DocumentText item={item} />
                </div>
              ) : null}

              <label className="flex items-start gap-3 px-4 py-3 border-t border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ticked.has(item.key)}
                  onChange={() => toggle(item.key)}
                  className="mt-0.5 w-[18px] h-[18px] shrink-0 accent-[var(--primary)]"
                />
                <span className="text-sm">{item.statement}</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 p-5 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        {mode === "block" && onSignOut ? (
          <button onClick={onSignOut} className="text-sm text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-2">
            <LogOut size={16} />
            Sign out
          </button>
        ) : (
          <button onClick={onClose} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Later
          </button>
        )}
        <button onClick={submit} disabled={!allTicked || saving} className="btn-primary h-11 px-6 text-sm flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Accept and continue
        </button>
      </div>
    </div>
  );

  if (mode === "block") {
    return <div className="min-h-screen flex items-center justify-center p-4">{card}</div>;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">{card}</div>;
}

export { formatDate };
