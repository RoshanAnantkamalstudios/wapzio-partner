"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Link2,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import ConfirmDialog from "@/src/components/ConfirmDialog";

interface WebhookConfig {
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_events: string[];
  available_events: string[];
  signature_scheme: string;
  stats: {
    total_deliveries?: number;
    total_failed?: number;
    last_delivery_at?: string | null;
    last_status_code?: number | null;
    last_error?: string | null;
  } | null;
}

interface Delivery {
  _id: string;
  event: string;
  url?: string;
  payload?: unknown;
  success: boolean;
  status_code: number | null;
  response_body?: string | null;
  error: string | null;
  attempt: number;
  duration_ms: number | null;
  is_test: boolean;
  created_at: string;
}

type Tone = "green" | "red" | "amber";

const BUBBLE: Record<Tone, string> = {
  green: "bg-emerald-100 text-[var(--primary)] dark:bg-emerald-900/25",
  red: "bg-red-100 text-[var(--danger)] dark:bg-red-900/25",
  amber: "bg-amber-100 text-[var(--warning)] dark:bg-amber-900/25",
};

const EVENT_META: Record<string, { icon: React.ElementType; tone: Tone; help: string }> = {
  "client.created": { icon: UserPlus, tone: "green", help: "Triggered when a new client is created." },
  "client.whatsapp_connected": { icon: MessageCircle, tone: "green", help: "Triggered when client connects WhatsApp." },
  "client.blocked": { icon: Ban, tone: "red", help: "Triggered when a client is blocked." },
  "client.unblocked": { icon: CheckCircle2, tone: "green", help: "Triggered when a client is unblocked." },
  "client.removed": { icon: Trash2, tone: "red", help: "Triggered when a client is removed." },
  "seats.low": { icon: AlertTriangle, tone: "amber", help: "Triggered when seats are low." },
  "seats.exhausted": { icon: AlertCircle, tone: "red", help: "Triggered when last seat is used." },
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

const DEFAULT_VISIBLE = 5;

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${on ? "bg-[var(--primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
  </button>
);

const ResultPill = ({ d }: { d: Delivery }) =>
  d.success ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
      <Check size={13} /> {d.status_code}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-300"
      title={d.error || ""}
    >
      <X size={13} /> {d.status_code || "Failed"}
    </span>
  );

/**
 * Webhook setup for the partner's own systems.
 *
 * The signing secret is shown here on purpose — the partner's server needs the
 * same value to verify what we send. The API key on the Onboarding screen is the
 * opposite kind of credential and is never shown twice.
 */
export default function WebhooksPage() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [details, setDetails] = useState<Delivery | null>(null);
  const [eventInfo, setEventInfo] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  const loadDeliveries = useCallback(async () => {
    const res = await apiFetch<{ deliveries: Delivery[] }>("/partner/webhook/deliveries?limit=50");
    if (res.ok && res.data) setDeliveries(res.data.deliveries);
  }, []);

  const loadConfig = useCallback(async () => {
    const res = await apiFetch<WebhookConfig>("/partner/webhook");
    if (res.ok && res.data) {
      setConfig(res.data);
      setUrl(res.data.webhook_url || "");
      setEvents(res.data.webhook_events || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadConfig(), loadDeliveries()]);
      setLoading(false);
    })();
  }, [loadConfig, loadDeliveries]);

  const available = config?.available_events || [];
  // An empty saved list means "every event" on the backend.
  const effective = events.length === 0 ? available : events;
  const urlDirty = url.trim() !== (config?.webhook_url || "");

  const saveUrl = async () => {
    setSaving(true);
    const res = await apiFetch("/partner/webhook", { method: "PUT", body: { webhook_url: url.trim() } });
    setSaving(false);

    if (res.ok) {
      toast.success("Endpoint saved");
      loadConfig();
    } else {
      toast.error(res.message || "Could not save");
    }
  };

  const toggleEvent = async (event: string) => {
    const on = effective.includes(event);

    // The backend cannot say "none": an empty list means everything. So the last
    // event stays on rather than silently turning into "send all".
    if (on && effective.length === 1) {
      toast.info("Keep at least one event on. Remove the endpoint URL to stop all webhooks.");
      return;
    }

    const next = on ? effective.filter((e) => e !== event) : [...effective, event];
    // Everything selected is stored as the empty list, so events added to the
    // platform later reach partners who chose "all".
    const payload = next.length === available.length ? [] : next;

    const previous = events;
    setEvents(payload);

    const res = await apiFetch("/partner/webhook", { method: "PUT", body: { webhook_events: payload } });
    if (!res.ok) {
      setEvents(previous);
      toast.error(res.message || "Could not update events");
    }
  };

  const rotateSecret = async () => {
    setRotating(true);
    const res = await apiFetch("/partner/webhook", { method: "PUT", body: { rotate_secret: true } });
    setRotating(false);
    setConfirmRotate(false);

    if (res.ok) {
      toast.success("New signing secret generated");
      setShowSecret(true);
      loadConfig();
    } else {
      toast.error(res.message || "Could not generate a new secret");
    }
  };

  const sendTest = async () => {
    setTesting(true);
    const res = await apiFetch("/partner/webhook/test", { method: "POST", body: { event: "client.created" } });
    setTesting(false);

    if (res.ok) {
      toast.success(res.message || "Test event queued");
      // The delivery lands a moment after the enqueue answers, so give the
      // worker a beat before refreshing rather than showing an empty table.
      setTimeout(() => {
        loadDeliveries();
        loadConfig();
      }, 2500);
    } else {
      toast.error(res.message || "Could not send the test event");
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDeliveries(), loadConfig()]);
    setRefreshing(false);
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
      </div>
    );
  }

  // What we actually know about the endpoint: there is no reachability probe, so
  // this reports the outcome of the last real delivery instead of guessing.
  const stats = config?.stats;
  const savedUrl = config?.webhook_url;
  let endpointStatus: { tone: "ok" | "bad" | "idle"; text: string };
  if (!savedUrl) {
    endpointStatus = { tone: "idle", text: "Add an https URL to start receiving events." };
  } else if (stats?.last_error) {
    endpointStatus = { tone: "bad", text: `Last delivery failed: ${stats.last_error}` };
  } else if (stats?.last_status_code && stats.last_status_code >= 200 && stats.last_status_code < 300) {
    endpointStatus = { tone: "ok", text: "Endpoint is valid and reachable" };
  } else {
    endpointStatus = { tone: "idle", text: "Not tested yet. Send a test event to check it." };
  }

  const visible = showAll ? deliveries : deliveries.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Receive real-time events when something happens with your clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={sendTest}
            disabled={testing || !savedUrl}
            title={savedUrl ? "" : "Save an endpoint URL first"}
            className="btn-primary h-12 px-5 flex items-center gap-2 text-sm"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Send test event
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="card h-12 px-5 flex items-center gap-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh deliveries
          </button>
        </div>
      </div>

      {/* Endpoint + secret: one card, two halves */}
      <section className="card shadow-[var(--shadow-card)] bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-emerald-100 dark:divide-emerald-900/30">
        <div className="p-5 flex items-start gap-4 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${BUBBLE.green}`}>
            <Link2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Endpoint URL</h2>
            <p className="text-sm text-[var(--muted)]">Your server endpoint to receive webhook events.</p>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlDirty && !saving) saveUrl();
                }}
                placeholder="https://your-system.com/wapzio/webhook"
                aria-label="Endpoint URL"
                className="flex-1 min-w-0 h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              />
              {urlDirty ? (
                <button onClick={saveUrl} disabled={saving} className="btn-primary h-12 px-4 flex items-center gap-2 text-sm shrink-0">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save
                </button>
              ) : null}
              <button
                onClick={() => (url ? copy(url, "URL") : toast.info("There is no URL to copy yet"))}
                className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                aria-label="Copy URL"
              >
                <Copy size={18} />
              </button>
            </div>

            <p
              className={`mt-2 text-sm flex items-start gap-1.5 ${
                endpointStatus.tone === "ok"
                  ? "text-[var(--primary)]"
                  : endpointStatus.tone === "bad"
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
              }`}
            >
              {endpointStatus.tone === "ok" ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : endpointStatus.tone === "bad" ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              ) : null}
              <span className="min-w-0 break-words">{endpointStatus.text}</span>
            </p>
          </div>
        </div>

        <div className="p-5 flex items-start gap-4 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${BUBBLE.green}`}>
            <KeyRound size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Signing secret</h2>
            <p className="text-sm text-[var(--muted)]">Used to verify the webhook signature.</p>

            {config?.webhook_secret ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 min-w-0 h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm flex items-center overflow-hidden">
                    <span className="truncate">{showSecret ? config.webhook_secret : "•".repeat(26)}</span>
                  </code>
                  <button
                    onClick={() => setShowSecret((v) => !v)}
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    aria-label={showSecret ? "Hide secret" : "Show secret"}
                  >
                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    onClick={() => copy(config.webhook_secret!, "Secret")}
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    aria-label="Copy secret"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Keep this secret safe. Use it only on your server.{" "}
                  <button
                    onClick={() => setConfirmRotate(true)}
                    disabled={rotating}
                    className="text-[var(--primary)] font-medium hover:underline disabled:opacity-60"
                  >
                    {rotating ? "Generating…" : "Generate new"}
                  </button>
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                A signing secret is generated for you as soon as you save an endpoint URL.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="card shadow-[var(--shadow-card)] p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--muted)] flex items-center justify-center shrink-0">
              <Zap size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Events</h2>
              <p className="text-sm text-[var(--muted)]">
                Select which events you want to receive. Click on an event to view details.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDocs(true)}
            className="card h-11 px-4 flex items-center gap-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            <BookOpen size={16} />
            View documentation
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {available.map((event) => {
            const meta = EVENT_META[event] || { icon: Zap, tone: "green" as Tone, help: "" };
            const Icon = meta.icon;
            const on = effective.includes(event);
            return (
              <div
                key={event}
                role="button"
                tabIndex={0}
                onClick={() => setEventInfo(event)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEventInfo(event);
                  }
                }}
                className="rounded-xl border border-[var(--border)] p-3.5 flex items-start gap-3 min-w-0 cursor-pointer hover:border-[var(--primary)]/50 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${BUBBLE[meta.tone]}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{event}</div>
                  <div className="text-sm text-[var(--muted)]">{meta.help}</div>
                </div>
                {/* The switch must not also open the details. */}
                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Toggle on={on} onChange={() => toggleEvent(event)} label={`Receive ${event}`} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent deliveries */}
      <section className="card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--muted)] flex items-center justify-center shrink-0">
              <History size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Recent deliveries</h2>
              <p className="text-sm text-[var(--muted)]">Latest webhook event attempts from our server to your endpoint.</p>
            </div>
          </div>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="card h-11 px-4 flex items-center gap-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            {showAll ? "Show fewer" : "View all logs"}
            <ArrowRight size={16} className={showAll ? "-rotate-90" : ""} />
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div className="pb-10 pt-2 text-center text-sm text-[var(--muted)]">
            No deliveries yet. Save a URL and send a test event.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[var(--muted)] border-y border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-3 py-3 font-semibold">Event</th>
                  <th className="px-3 py-3 font-semibold">Result</th>
                  <th className="px-3 py-3 font-semibold">Attempt</th>
                  <th className="px-3 py-3 font-semibold">Response time</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d._id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-3.5 text-[var(--muted)] whitespace-nowrap">{formatWhen(d.created_at)}</td>
                    <td className="px-3 py-3.5">
                      <code className="text-[13px]">{d.event}</code>
                      {d.is_test ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                          test
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5">
                      <ResultPill d={d} />
                    </td>
                    <td className="px-3 py-3.5 text-[var(--muted)]">{d.attempt}</td>
                    <td className="px-3 py-3.5 text-[var(--muted)]">{d.duration_ms != null ? `${d.duration_ms} ms` : "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setDetails(d)}
                        className="card px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03] dark:hover:bg-white/5"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {eventInfo ? (
        <EventDetails
          event={eventInfo}
          on={effective.includes(eventInfo)}
          lastDelivery={deliveries.find((d) => d.event === eventInfo && d.payload) || null}
          onToggle={() => toggleEvent(eventInfo)}
          onClose={() => setEventInfo(null)}
        />
      ) : null}
      {showDocs ? <DocsModal onClose={() => setShowDocs(false)} /> : null}
      {details ? <DeliveryDetails delivery={details} onClose={() => setDetails(null)} /> : null}

      <ConfirmDialog
        open={confirmRotate}
        title="Generate a new signing secret?"
        body="Your server must be updated with the new secret, or every delivery we send will fail signature verification."
        confirmLabel="Generate new secret"
        tone="danger"
        busy={rotating}
        onConfirm={rotateSecret}
        onCancel={() => setConfirmRotate(false)}
      />
    </div>
  );
}

const stringify = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const DeliveryDetails = ({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const payload = stringify(delivery.payload);
  const response = stringify(delivery.response_body);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-4 py-2 border-b border-[var(--border)] last:border-0 text-sm">
      <div className="w-32 shrink-0 text-[var(--muted)]">{label}</div>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );

  const Block = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div className="mt-4">
        <div className="text-sm font-semibold mb-1.5">{label}</div>
        <pre className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-3 text-xs leading-5 font-mono overflow-auto max-h-56 whitespace-pre-wrap break-words">
          {value.length > 4000 ? `${value.slice(0, 4000)}\n… (truncated)` : value}
        </pre>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delivery details"
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Delivery details</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        </div>

        <Row label="Event">
          <code>{delivery.event}</code>
          {delivery.is_test ? <span className="ml-2 text-xs text-[var(--muted)]">(test event)</span> : null}
        </Row>
        <Row label="When">{formatWhen(delivery.created_at)}</Row>
        <Row label="Result">
          <ResultPill d={delivery} />
        </Row>
        <Row label="Attempt">{delivery.attempt}</Row>
        <Row label="Response time">{delivery.duration_ms != null ? `${delivery.duration_ms} ms` : "—"}</Row>
        {delivery.url ? <Row label="Sent to">{delivery.url}</Row> : null}
        {delivery.error ? (
          <Row label="Error">
            <span className="text-[var(--danger)]">{delivery.error}</span>
          </Row>
        ) : null}

        <Block label="Payload we sent" value={payload} />
        <Block label="Response from your server" value={response} />
      </div>
    </div>
  );
};

const ModalShell = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const CLIENT_SAMPLE = {
  client_id: "64f1c0a2b7e9d3001a2b3c4d",
  name: "Acme Retail",
  email: "owner@acme.com",
  phone: "+919876543210",
  created_at: "2026-09-24T07:42:00.000Z",
};

const SEATS_SAMPLE = { seat_limit: 3, seats_used: 3, seats_remaining: 0, is_exhausted: true };

// Same envelope the backend sends: event, sent_at, partner, data.
const sampleFor = (event: string) => ({
  event,
  sent_at: "2026-09-24T07:42:01.000Z",
  partner: { id: "64f1c0a2b7e9d3001a2b3c00", name: "Your company", slug: "your-company" },
  data: event.startsWith("seats.")
    ? event === "seats.low"
      ? { ...SEATS_SAMPLE, seats_used: 2, seats_remaining: 1, is_exhausted: false }
      : SEATS_SAMPLE
    : event === "client.created"
      ? { ...CLIENT_SAMPLE, source: "onboarding_link" }
      : CLIENT_SAMPLE,
});

const EventDetails = ({
  event,
  on,
  lastDelivery,
  onToggle,
  onClose,
}: {
  event: string;
  on: boolean;
  lastDelivery: Delivery | null;
  onToggle: () => void;
  onClose: () => void;
}) => {
  const meta = EVENT_META[event];
  const Icon = meta?.icon || Zap;
  const real = lastDelivery?.payload;

  return (
    <ModalShell title={event} onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${BUBBLE[meta?.tone || "green"]}`}>
          <Icon size={20} />
        </div>
        <p className="flex-1 text-sm text-[var(--muted)]">{meta?.help}</p>
        <div className="flex items-center gap-2 text-sm font-medium">
          {on ? "On" : "Off"}
          <Toggle on={on} onChange={onToggle} label={`Receive ${event}`} />
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold mb-1.5">{real ? "Last payload we sent for this event" : "Example payload"}</div>
      <pre className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-3 text-xs leading-5 font-mono overflow-auto max-h-80 whitespace-pre-wrap break-words">
        {JSON.stringify(real ?? sampleFor(event), null, 2)}
      </pre>
      {!real ? (
        <p className="mt-2 text-xs text-[var(--muted)]">No delivery of this event yet, so this is a sample with the same shape.</p>
      ) : null}
    </ModalShell>
  );
};

const DocsModal = ({ onClose }: { onClose: () => void }) => (
  <ModalShell title="Webhook documentation" onClose={onClose}>
    <p className="text-sm text-[var(--muted)]">
      We POST a JSON body to your endpoint when something happens to one of your clients. The endpoint must be https and
      publicly reachable. We retry 4 times with backoff on any non-2xx answer.
    </p>

    <h3 className="mt-5 text-sm font-semibold">Verifying the signature</h3>
    <p className="text-sm text-[var(--muted)] mt-1 mb-3">
      Each request carries <code>X-Wapzio-Timestamp</code> and <code>X-Wapzio-Signature</code>. Recompute it over
      <code> timestamp + &quot;.&quot; + raw body</code> with your signing secret and compare. Reject anything older than
      five minutes.
    </p>
    <pre className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-4 text-[13px] leading-6 font-mono overflow-auto">{`const crypto = require("crypto");

app.post("/wapzio/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.header("X-Wapzio-Timestamp");
  const signature = req.header("X-Wapzio-Signature");

  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.WAPZIO_WEBHOOK_SECRET)
    .update(ts + "." + req.body.toString())
    .digest("hex");

  if (signature !== expected) return res.sendStatus(401);
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401);

  const { event, data } = JSON.parse(req.body.toString());
  // handle event…
  res.sendStatus(200);
});`}</pre>
  </ModalShell>
);