"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Users, UserPlus, Wifi, Ban } from "lucide-react";
import { apiFetch } from "@/src/lib/api";

interface Stats {
  seat_limit: number;
  seats_used: number;
  seats_remaining: number;
  is_exhausted: boolean;
  clients_total: number;
  clients_blocked: number;
  clients_whatsapp_connected: number;
  clients_pending_setup: number;
}

const Tile = ({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: "default" | "warn" | "danger" | "good";
}) => {
  const toneClass =
    tone === "good"
      ? "text-[var(--primary)]"
      : tone === "warn"
        ? "text-[var(--warning)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--text)]";

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[var(--muted)] text-xs font-medium uppercase tracking-wide">
        <Icon size={14} />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await apiFetch<Stats>("/partner/stats");
      if (res.ok && res.data) setStats(res.data);
      else setError(res.message || "Could not load statistics");
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
      </div>
    );
  }

  if (error || !stats) {
    return <div className="card p-6 text-sm text-[var(--danger)]">{error}</div>;
  }

  const usedPercent = stats.seat_limit > 0 ? Math.min(100, Math.round((stats.seats_used / stats.seat_limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted)] mt-1">How many client accounts you have onboarded, and what is left.</p>
      </div>

      {/* Seats — the number a reseller actually came here for, so it leads. */}
      <div className="card p-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)] font-medium">Client seats</div>
            <div className="mt-1 text-4xl font-semibold">
              {stats.seats_used}
              <span className="text-lg text-[var(--muted)] font-normal"> / {stats.seat_limit}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--muted)]">Remaining</div>
            <div className={`text-2xl font-semibold ${stats.is_exhausted ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>
              {stats.seats_remaining}
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${stats.is_exhausted ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>

        {stats.is_exhausted ? (
          <div className="mt-4 flex items-start gap-2 text-sm text-[var(--danger)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              All seats are in use. New sign-ups through your onboarding link are refused until Wapzio adds seats, or you
              remove a client.
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Clients" value={stats.clients_total} icon={Users} />
        <Tile label="WhatsApp connected" value={stats.clients_whatsapp_connected} icon={Wifi} tone="good" />
        <Tile label="Setup pending" value={stats.clients_pending_setup} icon={UserPlus} tone="warn" />
        <Tile label="Blocked" value={stats.clients_blocked} icon={Ban} tone={stats.clients_blocked ? "danger" : "default"} />
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Next steps</h2>
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 text-[var(--primary)] shrink-0" />
            <span>
              Share your{" "}
              <Link href="/onboarding" className="text-[var(--primary)] font-medium">
                onboarding link
              </Link>{" "}
              with a client, or create the account for them from the Clients screen.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 text-[var(--primary)] shrink-0" />
            <span>Each client connects their own WhatsApp number when they first sign in.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 text-[var(--primary)] shrink-0" />
            <span>
              Automating sign-ups from your own website? Use the{" "}
              <Link href="/onboarding" className="text-[var(--primary)] font-medium">
                partner API
              </Link>
              .
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
