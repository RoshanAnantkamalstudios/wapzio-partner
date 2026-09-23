"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, RefreshCw, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";

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
  success: boolean;
  status_code: number | null;
  error: string | null;
  attempt: number;
  duration_ms: number | null;
  is_test: boolean;
  created_at: string;
}

const EVENT_HELP: Record<string, string> = {
  "client.created": "A client account was created — through your link or the API.",
  "client.whatsapp_connected": "A client connected their WhatsApp number and can now send.",
  "client.blocked": "A client account was blocked.",
  "client.unblocked": "A client account was unblocked.",
  "client.removed": "A client account was removed and its seat freed.",
  "seats.low": "Few seats left on your quota.",
  "seats.exhausted": "The last seat was taken; new sign-ups are refused.",
};

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
  const [showSecret, setShowSecret] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  const loadDeliveries = useCallback(async () => {
    const res = await apiFetch<{ deliveries: Delivery[] }>("/partner/webhook/deliveries?limit=20");
    if (res.ok && res.data) setDeliveries(res.data.deliveries);
  }, []);

  const load = useCallback(async () => {
    const res = await apiFetch<WebhookConfig>("/partner/webhook");
    if (res.ok && res.data) {
      setConfig(res.data);
      setUrl(res.data.webhook_url || "");
      setEvents(res.data.webhook_events || []);
    }
    await loadDeliveries();
    setLoading(false);
  }, [loadDeliveries]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    const res = await apiFetch<WebhookConfig>("/partner/webhook", {
      method: "PUT",
      body: { webhook_url: url, webhook_events: events, ...extra },
    });
    setSaving(false);

    if (res.ok) {
      toast.success("Webhook settings saved");
      load();
    } else {
      toast.error(res.message || "Could not save");
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
      setTimeout(loadDeliveries, 2500);
    } else {
      toast.error(res.message || "Could not send the test event");
    }
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          We POST to your server when something happens to one of your clients.
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Endpoint URL</label>
          <div className="flex gap-2 mt-1">
            <input
              className="input"
              placeholder="https://your-system.com/wapzio/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button onClick={() => save()} disabled={saving} className="btn-primary px-4 flex items-center gap-2 shrink-0">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Must be https and publicly reachable. We retry 4 times with backoff on any non-2xx answer.
          </p>
        </div>

        {config?.webhook_secret ? (
          <div>
            <label className="text-sm font-medium">Signing secret</label>
            <div className="flex gap-2 mt-1">
              <code className="input font-mono text-xs flex items-center overflow-hidden">
                {showSecret ? config.webhook_secret : "•".repeat(40)}
              </code>
              <button onClick={() => setShowSecret((v) => !v)} className="card px-3 shrink-0" aria-label="Show secret">
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => copy(config.webhook_secret!, "Secret")} className="card px-3 shrink-0" aria-label="Copy secret">
                <Copy size={16} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Generate a new signing secret?\n\nYour server must be updated or every delivery will fail verification."))
                    save({ rotate_secret: true });
                }}
                className="card px-3 shrink-0"
                aria-label="Rotate secret"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">Keep this on your server only.</p>
          </div>
        ) : null}

        <div>
          <div className="text-sm font-medium mb-2">Events</div>
          <p className="text-xs text-[var(--muted)] mb-3">Tick nothing to receive all of them.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(config?.available_events || []).map((event) => (
              <label
                key={event}
                className="flex items-start gap-2 p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:border-[var(--primary)]/40"
              >
                <input
                  type="checkbox"
                  checked={events.length === 0 || events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span className="text-sm">
                  <code className="text-xs">{event}</code>
                  <span className="block text-[var(--muted)] text-xs mt-0.5">{EVENT_HELP[event]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={sendTest} disabled={testing || !config?.webhook_url} className="card px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send test event
          </button>
          <button onClick={loadDeliveries} className="card px-4 py-2 flex items-center gap-2 text-sm">
            <RefreshCw size={16} /> Refresh deliveries
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-2">Verifying the signature</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Each request carries <code>X-Wapzio-Timestamp</code> and <code>X-Wapzio-Signature</code>. Recompute it over
          <code> timestamp + &quot;.&quot; + raw body</code> and compare. Reject anything older than five minutes.
        </p>
        <div className="rounded-lg bg-black/5 dark:bg-white/5 p-4 overflow-x-auto">
          <pre className="text-xs leading-relaxed">{`const crypto = require("crypto");

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
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Recent deliveries</h2>
          {config?.stats ? (
            <span className="text-xs text-[var(--muted)]">
              {config.stats.total_deliveries || 0} sent · {config.stats.total_failed || 0} failed
            </span>
          ) : null}
        </div>

        {deliveries.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">
            No deliveries yet. Save a URL and send a test event.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Attempt</th>
                  <th className="px-4 py-2 font-medium">Took</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d._id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2 text-[var(--muted)] whitespace-nowrap">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">{d.event}</code>
                      {d.is_test ? <span className="ml-2 text-[10px] uppercase text-[var(--muted)]">test</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      {d.success ? (
                        <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                          <Check size={14} /> {d.status_code}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--danger)]" title={d.error || ""}>
                          <X size={14} /> {d.status_code || "failed"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[var(--muted)]">{d.attempt}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{d.duration_ms != null ? `${d.duration_ms} ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {config?.stats?.last_error ? (
          <div className="px-5 py-3 border-t border-[var(--border)] flex items-start gap-2 text-xs text-[var(--danger)]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Last error: {config.stats.last_error}
          </div>
        ) : null}
      </section>
    </div>
  );
}
