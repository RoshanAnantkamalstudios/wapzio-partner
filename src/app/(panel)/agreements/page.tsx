"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, FileText, Loader2, X } from "lucide-react";
import { apiFetch } from "@/src/lib/api";
import { CONSENT_REQUIRED_EVENT, ConsentItem, ConsentStatus } from "@/src/lib/consents";
import ConsentScreen, { DocumentText, formatDate } from "@/src/components/ConsentScreen";

/**
 * Everything the partner has agreed to, and anything still waiting.
 *
 * The same ledger rows Wapzio's admin sees, so what a partner reads here and what
 * support reads there cannot disagree.
 */
export default function AgreementsPage() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<ConsentItem | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<ConsentStatus>("/partner/consents");
    if (res.ok && res.data) setStatus(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
      </div>
    );
  }

  const items = (status?.items || []).filter((i) => i.published);
  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agreements</h1>
          <p className="text-sm text-[var(--muted)] mt-1">The terms and notices you have accepted as a Wapzio partner.</p>
        </div>
        {pending.length > 0 ? (
          <button onClick={() => setAccepting(true)} className="btn-primary h-12 px-5 text-sm">
            Review and accept ({pending.length})
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="card shadow-[var(--shadow-card)] p-8 text-center text-sm text-[var(--muted)]">
          There are no agreements to show yet.
        </div>
      ) : (
        <div className="card shadow-[var(--shadow-card)] overflow-hidden">
          <ul>
            {items.map((item) => (
              <li key={item.key} className="px-5 py-4 flex items-center gap-4 border-b border-[var(--border)] last:border-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    item.status === "accepted"
                      ? "bg-emerald-100 text-[var(--primary)] dark:bg-emerald-900/25"
                      : "bg-amber-100 text-[var(--warning)] dark:bg-amber-900/25"
                  }`}
                >
                  {item.status === "accepted" ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {item.kind === "notice" ? "Notice" : "Agreement"} · version {item.version}
                    {item.status === "accepted" && item.accepted_at
                      ? ` · accepted ${formatDate(item.accepted_at)}`
                      : item.is_reacceptance
                        ? " · updated, please accept the new version"
                        : " · waiting for your acceptance"}
                  </div>
                </div>
                <button
                  onClick={() => setReading(item)}
                  className="card h-10 px-4 text-sm font-medium flex items-center gap-2 hover:bg-black/[0.03] dark:hover:bg-white/5 shrink-0"
                >
                  <FileText size={16} />
                  Read
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={() => setReading(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={reading.title || "Agreement"}
            onMouseDown={(e) => e.stopPropagation()}
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h2 className="text-lg font-semibold">{reading.title}</h2>
                <p className="text-xs text-[var(--muted)]">Version {reading.version}</p>
              </div>
              <button onClick={() => setReading(null)} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
                <X size={20} />
              </button>
            </div>
            <DocumentText item={reading} />
          </div>
        </div>
      ) : null}

      {accepting && status && pending.length > 0 ? (
        <ConsentScreen
          status={status}
          mode="modal"
          onAccepted={(next) => {
            setStatus(next);
            setAccepting(false);
            // Tell the shell, so its banner and menu badge clear too.
            window.dispatchEvent(new Event(CONSENT_REQUIRED_EVENT));
          }}
          onClose={() => setAccepting(false)}
        />
      ) : null}
    </div>
  );
}
