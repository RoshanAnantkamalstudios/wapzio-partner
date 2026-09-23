"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import { PartnerProfile } from "@/src/lib/session";

/**
 * The two ways a partner brings clients in:
 *   1. the hosted onboarding link, for partners who just want to share a URL;
 *   2. the partner API, for partners who sign clients up on their own website.
 *
 * Both are capped by the same seat count, and both stamp the new account with
 * this partner — there is no third way in.
 */
export default function OnboardingPage() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState<"key" | "link" | null>(null);

  const load = async () => {
    const res = await apiFetch<PartnerProfile>("/partner/me");
    if (res.ok && res.data) setProfile(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const appUrl = (process.env.NEXT_PUBLIC_FRONT_URL || "").replace(/\/$/, "");
  const joinUrl = profile?.onboarding_token ? `${appUrl}/join/${profile.onboarding_token}` : "";
  // The copy-paste examples must name the backend the partner will actually
  // call, not this panel's own origin.
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.wapzio.com/api").replace(/\/$/, "");

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const rotateLink = async () => {
    if (!window.confirm("Generate a new onboarding link?\n\nEvery link you have already shared stops working.")) return;
    setRotating("link");
    const res = await apiFetch<{ onboarding_token: string }>("/partner/credentials/onboarding-link", { method: "POST" });
    setRotating(null);

    if (res.ok) {
      toast.success("New link generated");
      load();
    } else {
      toast.error(res.message || "Could not generate a new link");
    }
  };

  const rotateKey = async () => {
    if (!window.confirm("Generate a new API key?\n\nYour current key stops working immediately.")) return;
    setRotating("key");
    const res = await apiFetch<{ api_key: string }>("/partner/credentials/api-key", { method: "POST" });
    setRotating(null);

    if (res.ok && res.data?.api_key) {
      setNewKey(res.data.api_key);
      toast.success("New API key generated");
      load();
    } else {
      toast.error(res.message || "Could not generate a new key");
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
        <h1 className="text-2xl font-semibold">Onboarding & API</h1>
        <p className="text-sm text-[var(--muted)] mt-1">How your clients get their Wapzio account.</p>
      </div>

      {/* Hosted link */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold">Onboarding link</h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-3">
          Share this with a client. They sign up, verify their email and connect their own WhatsApp number. Each sign-up
          uses one of your seats.
        </p>

        {joinUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-[var(--border)] px-3 py-2 text-sm">{joinUrl}</code>
            <button onClick={() => copy(joinUrl, "Link")} className="card p-2" aria-label="Copy link">
              <Copy size={16} />
            </button>
            <button onClick={rotateLink} disabled={rotating === "link"} className="card p-2" aria-label="Generate new link">
              {rotating === "link" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--warning)]">
            No onboarding link yet. Contact Wapzio to have one generated for your account.
          </p>
        )}
      </section>

      {/* API */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold">Partner API</h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-3">
          Create client accounts from your own website. Send your key in the <code>X-Partner-Key</code> header.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            {profile?.api_key_prefix ? `${profile.api_key_prefix}••••••••••••••••` : "No key issued"}
          </code>
          <button onClick={rotateKey} disabled={rotating === "key"} className="card p-2" aria-label="Generate new key">
            {rotating === "key" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {newKey ? (
          <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:bg-emerald-900/15 dark:border-emerald-900/40">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Check size={16} /> Your new API key
            </div>
            <code className="mt-2 block break-all text-sm">{newKey}</code>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <AlertTriangle size={14} />
              Copy it now — it is never shown again.
            </div>
            <button onClick={() => copy(newKey, "API key")} className="btn-primary mt-3 px-3 py-1.5 text-sm">
              Copy key
            </button>
          </div>
        ) : null}

        <div className="rounded-lg bg-black/5 dark:bg-white/5 p-4 overflow-x-auto">
          <pre className="text-xs leading-relaxed">{`# Create a client account
curl -X POST ${apiUrl}/partner-api/v1/clients \\
  -H "X-Partner-Key: <your key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Retail",
    "email": "owner@acme.com",
    "phone": "9876543210",
    "country_code": "+91"
  }'

# Seats and client counts
curl ${apiUrl}/partner-api/v1/stats \\
  -H "X-Partner-Key: <your key>"

# List your clients
curl "${apiUrl}/partner-api/v1/clients?page=1&limit=20" \\
  -H "X-Partner-Key: <your key>"`}</pre>
        </div>

        <p className="text-xs text-[var(--muted)] mt-3">
          A sign-up past your seat limit answers <code>409 SEAT_LIMIT_REACHED</code>. Handle that in your flow so your
          customer sees a clear message rather than a failure.
        </p>
      </section>
    </div>
  );
}
