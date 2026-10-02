"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Headset,
  ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Palette,
  Phone,
  Save,
  SquareArrowOutUpRight,
  User,
  Webhook,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import { PartnerProfile } from "@/src/lib/session";

const DEFAULT_COLOR = "#16a34a";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@wapzio.com";

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Form {
  company_email: string;
  company_phone: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
}

const EMPTY: Form = { company_email: "", company_phone: "", logo_url: "", primary_color: DEFAULT_COLOR, support_email: "" };

const SectionHead = ({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) => (
  <div className="flex items-start gap-4">
    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/25 text-[var(--primary)] flex items-center justify-center shrink-0">
      <Icon size={22} />
    </div>
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  </div>
);

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="text-sm font-semibold">{label}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);

const INPUT =
  "w-full h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] placeholder:text-[var(--muted)]";
const LOCKED = "w-full h-12 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-[var(--muted)] cursor-not-allowed";

const SwitchOff = ({ label }: { label: string }) => (
  <span
    role="switch"
    aria-checked={false}
    aria-disabled="true"
    aria-label={label}
    className="relative w-11 h-6 rounded-full shrink-0 bg-slate-300 dark:bg-slate-600 opacity-60 cursor-not-allowed"
  >
    <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow" />
  </span>
);

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
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [meRes, hookRes] = await Promise.all([
        apiFetch<PartnerProfile>("/partner/me"),
        apiFetch<{ webhook_url: string | null; webhook_secret: string | null }>("/partner/webhook"),
      ]);

      if (meRes.ok && meRes.data) {
        const d = meRes.data;
        setProfile(d);
        const initial: Form = {
          company_email: d.company_email || "",
          company_phone: d.company_phone || "",
          logo_url: d.branding?.logo_url || "",
          primary_color: d.branding?.primary_color || DEFAULT_COLOR,
          support_email: d.branding?.support_email || "",
        };
        setForm(initial);
        setSaved(initial);
      }
      if (hookRes.ok && hookRes.data) {
        setWebhookUrl(hookRes.data.webhook_url || "");
        setWebhookSecret(hookRes.data.webhook_secret || "");
      }
      setLoading(false);
    };
    load();
  }, []);

  const dirty = useMemo(() => (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k]), [form, saved]);

  const set = (key: keyof Form, value: string) => {
    if (key === "logo_url") setLogoFailed(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();

    const email = form.company_email.trim();
    const support = form.support_email.trim();
    const logo = form.logo_url.trim();
    const color = form.primary_color.trim();

    if (email && !EMAIL.test(email)) return toast.error("Enter a valid company email");
    if (support && !EMAIL.test(support)) return toast.error("Enter a valid support email");
    if (logo && !/^https?:\/\//i.test(logo)) return toast.error("The logo URL must start with https://");
    if (color && !HEX.test(color)) return toast.error("The primary colour must be a hex value like #16a34a");

    setSaving(true);
    const res = await apiFetch("/partner/settings", {
      method: "PUT",
      body: {
        company_email: email,
        company_phone: form.company_phone.trim(),
        branding: { logo_url: logo, primary_color: color || DEFAULT_COLOR, support_email: support },
      },
    });
    setSaving(false);

    if (res.ok) {
      const next = { ...form, company_email: email, company_phone: form.company_phone.trim(), logo_url: logo, primary_color: color || DEFAULT_COLOR, support_email: support };
      setForm(next);
      setSaved(next);
      toast.success("Settings saved");
    } else {
      toast.error(res.message || "Could not save settings");
    }
  };

  const copy = async (value: string, label: string) => {
    if (!value) {
      toast.info(`There is no ${label.toLowerCase()} yet`);
      return;
    }
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

  const appUrl = (process.env.NEXT_PUBLIC_FRONT_URL || "").replace(/\/$/, "");
  const joinUrl = profile?.onboarding_token ? `${appUrl}/join/${profile.onboarding_token}` : "";
  const brand = HEX.test(form.primary_color.trim()) ? form.primary_color.trim() : DEFAULT_COLOR;
  const logo = form.logo_url.trim();
  const showLogo = /^https?:\/\//i.test(logo) && !logoFailed;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Manage your partner details, branding and integration settings.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <form onSubmit={save} className="space-y-5 min-w-0">
          {/* Account */}
          <section className="card shadow-[var(--shadow-card)] p-5">
            <SectionHead icon={User} title="Account Information" text="Update your partner account details." />
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Partner name">
                {/* Read-only: the name is part of the commercial record. */}
                <input className={LOCKED} value={profile?.name || ""} readOnly title="Set by Wapzio" />
              </Field>
              <Field label="Company email">
                <input
                  type="email"
                  className={INPUT}
                  value={form.company_email}
                  onChange={(e) => set("company_email", e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Company phone">
                <div className="relative">
                  <Phone size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  <input
                    className={`${INPUT} pl-11`}
                    placeholder="+91 9876543210"
                    value={form.company_phone}
                    onChange={(e) => set("company_phone", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Seats">
                <input className={LOCKED} value={`${profile?.seats_used ?? 0} / ${profile?.seat_limit ?? 0}`} readOnly title="Set by Wapzio" />
              </Field>
              <Field label="Partner code">
                <input className={LOCKED} value={profile?.slug || ""} readOnly title="Set by Wapzio" />
              </Field>
            </div>
          </section>

          {/* Branding */}
          <section className="card shadow-[var(--shadow-card)] p-5">
            <SectionHead icon={Palette} title="Branding" text="This information will be shown on the client sign-up page." />
            <div className="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <Field label="Logo URL">
                <div className="flex gap-2">
                  <input
                    className={INPUT}
                    placeholder="https://…/logo.png"
                    value={form.logo_url}
                    onChange={(e) => set("logo_url", e.target.value)}
                  />
                  <a
                    href={showLogo ? logo : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open logo in a new tab"
                    aria-disabled={!showLogo}
                    onClick={(e) => {
                      if (!showLogo) {
                        e.preventDefault();
                        toast.info("Enter a logo URL to preview it");
                      }
                    }}
                    className="card h-12 w-12 flex items-center justify-center shrink-0 text-[var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/5"
                  >
                    <ImageIcon size={18} />
                  </a>
                </div>
              </Field>
              <Field label="Primary colour">
                <div className="flex items-center h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_var(--ring)] overflow-hidden">
                  <input
                    type="color"
                    aria-label="Pick primary colour"
                    value={brand}
                    onChange={(e) => set("primary_color", e.target.value)}
                    className="h-12 w-14 shrink-0 cursor-pointer border-0 bg-transparent p-1.5"
                  />
                  <input
                    aria-label="Primary colour hex"
                    value={form.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                    maxLength={7}
                    className="min-w-0 flex-1 h-full bg-transparent px-3 text-sm outline-none"
                  />
                </div>
              </Field>
              <Field label="Support email">
                <input
                  type="email"
                  className={INPUT}
                  placeholder="support@yourcompany.com"
                  value={form.support_email}
                  onChange={(e) => set("support_email", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* Webhook (read-only summary; edited on its own screen) */}
          <section className="card shadow-[var(--shadow-card)] p-5">
            <SectionHead
              icon={Webhook}
              title="Webhook Configuration"
              text="Manage your webhook endpoint and signing secret. Events and delivery history are in the Webhooks section."
            />
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Endpoint URL">
                <div className="flex gap-2">
                  <input className={`${INPUT} bg-[var(--surface)]`} value={webhookUrl} readOnly placeholder="Not set" />
                  <button
                    type="button"
                    onClick={() => copy(webhookUrl, "URL")}
                    aria-label="Copy URL"
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </Field>
              <Field label="Signing secret">
                <div className="flex gap-2">
                  <input
                    className={`${INPUT} bg-[var(--surface)]`}
                    value={webhookSecret ? (showSecret ? webhookSecret : "•".repeat(22)) : ""}
                    readOnly
                    placeholder="Generated when you save an endpoint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    disabled={!webhookSecret}
                    aria-label={showSecret ? "Hide secret" : "Show secret"}
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(webhookSecret, "Secret")}
                    aria-label="Copy secret"
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </Field>
            </div>
            <Link href="/webhooks" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline">
              Manage webhooks
              <ChevronRight size={15} />
            </Link>
          </section>

          {/* Preferences */}
          <section className="card shadow-[var(--shadow-card)] p-5">
            <SectionHead icon={SettingsIcon} title="Preferences" text="Set your preferences for notifications and system updates." />
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Bell, title: "Email notifications", text: "Get important updates via email" },
                { icon: Mail, title: "Marketing updates", text: "Receive product news and tips" },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="rounded-xl border border-[var(--border)] p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--muted)] flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-sm text-[var(--muted)]">{p.text}</div>
                    </div>
                    <SwitchOff label={p.title} />
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Notification preferences are not available yet. Wapzio will email you about important account changes in the
              meantime.
            </p>
          </section>

          <button
            type="submit"
            disabled={saving || !dirty}
            className="btn-primary h-12 px-6 flex items-center gap-2 text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {/* Right column */}
        <div className="space-y-5 min-w-0">
          <section className="card shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Preview (Sign-up Page)</h2>
              {joinUrl ? (
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open the live sign-up page"
                  title="Open the live sign-up page"
                  className="text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <SquareArrowOutUpRight size={18} />
                </a>
              ) : null}
            </div>

            <div
              className="mt-4 rounded-xl border border-[var(--border)] px-6 py-8 text-center overflow-hidden"
              style={{ background: `linear-gradient(160deg, ${brand}22 0%, transparent 55%)` }}
            >
              {showLogo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo}
                    alt="Your logo"
                    onError={() => setLogoFailed(true)}
                    className="mx-auto h-16 w-16 rounded-full object-contain bg-white"
                  />
                  <div className="mt-3 text-2xl font-bold tracking-tight">{profile?.name || "Your company"}</div>
                </>
              ) : (
                // No logo of the partner's own yet: the Wapzio wordmark, which already carries the name.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/wapzio-logo.png`}
                  alt="Wapzio"
                  className="mx-auto h-12 w-auto mix-blend-multiply dark:mix-blend-normal dark:bg-white dark:rounded-md dark:px-2 dark:py-1"
                />
              )}
              <div className="text-sm text-[var(--muted)] mt-1">All-in-One WhatsApp Platform</div>
              <div className="text-sm text-[var(--muted)] mt-3">Create your account to get started</div>

              <div className="mt-5 h-12 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2" style={{ background: brand }}>
                <MessageCircle size={18} />
                Continue with WhatsApp
              </div>
              <div className="my-3 flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="flex-1 h-px bg-[var(--border-strong)]" />
                OR
                <span className="flex-1 h-px bg-[var(--border-strong)]" />
              </div>
              <div className="h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium flex items-center justify-center gap-2">
                <Mail size={18} />
                Continue with Email
              </div>

              <div className="mt-6 text-xs text-[var(--muted)]">
                Powered by <span className="font-semibold text-[var(--text)]">Wapzio</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">A preview of your logo and colour. Save to apply changes.</p>
          </section>

          <section className="card shadow-[var(--shadow-card)] p-5 bg-sky-50/70 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/30">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Headset size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Need help?</h2>
                <p className="text-sm text-[var(--muted)]">
                  If you need any assistance with settings, integration or customization, we are here to help.
                </p>
              </div>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Partner help: ${profile?.name || ""}`)}`}
              className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-[var(--surface)] text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Contact support
              <ChevronRight size={16} />
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
