"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import { PartnerProfile } from "@/src/lib/session";

/**
 * What a partner may change about itself: contact details, the brand its
 * clients see on the sign-up page, and where Wapzio posts events.
 *
 * Seat limit and package are absent on purpose — those are commercial terms and
 * only Wapzio moves them.
 */
export default function SettingsPage() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_email: "",
    company_phone: "",
    logo_url: "",
    primary_color: "#16a34a",
    support_email: "",
  });

  useEffect(() => {
    const load = async () => {
      const res = await apiFetch<PartnerProfile>("/partner/me");
      if (res.ok && res.data) {
        setProfile(res.data);
        setForm({
          company_email: res.data.company_email || "",
          company_phone: res.data.company_phone || "",
          logo_url: res.data.branding?.logo_url || "",
          primary_color: res.data.branding?.primary_color || "#16a34a",
          support_email: res.data.branding?.support_email || "",
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const res = await apiFetch("/partner/settings", {
      method: "PUT",
      body: {
        company_email: form.company_email,
        company_phone: form.company_phone,
        branding: {
          logo_url: form.logo_url,
          primary_color: form.primary_color,
          support_email: form.support_email,
        },
      },
    });
    setSaving(false);

    if (res.ok) toast.success("Settings saved");
    else toast.error(res.message || "Could not save settings");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Your details and the brand your clients see.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Account</h2>

          <div>
            <label className="text-sm font-medium">Partner name</label>
            {/* Read-only: the name is part of the commercial record. */}
            <input className="input mt-1 opacity-60" value={profile?.name || ""} disabled />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Company email</label>
              <input
                type="email"
                className="input mt-1"
                value={form.company_email}
                onChange={(e) => setForm({ ...form, company_email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Company phone</label>
              <input
                className="input mt-1"
                value={form.company_phone}
                onChange={(e) => setForm({ ...form, company_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Seats</label>
              <input className="input mt-1 opacity-60" value={`${profile?.seats_used ?? 0} / ${profile?.seat_limit ?? 0}`} disabled />
            </div>
            <div>
              <label className="text-sm font-medium">Partner code</label>
              <input className="input mt-1 opacity-60" value={profile?.slug || ""} disabled />
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Branding</h2>
          <p className="text-sm text-[var(--muted)]">Shown on the sign-up page your onboarding link opens.</p>

          <div>
            <label className="text-sm font-medium">Logo URL</label>
            <input
              className="input mt-1"
              placeholder="https://…/logo.png"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Primary colour</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  className="h-10 w-14 rounded-lg border border-[var(--border)] bg-transparent"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
                <input
                  className="input"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Support email</label>
              <input
                type="email"
                className="input mt-1"
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* The webhook lives on its own screen — endpoint, signing secret, event
            subscriptions and the delivery log belong together, and two forms
            writing the same field would fight. */}
        <section className="card p-5">
          <h2 className="font-semibold">Webhook</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Endpoint, signing secret, events and delivery history are on the{" "}
            <Link href="/webhooks" className="text-[var(--primary)] font-medium">
              Webhooks
            </Link>{" "}
            screen.
          </p>
        </section>

        <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
