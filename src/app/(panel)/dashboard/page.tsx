"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Ban,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Plus,
  Users,
  Webhook,
  Zap,
  Headset,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import { sessionStore } from "@/src/lib/session";
import { StatTile, TONE } from "@/src/components/StatTile";
import { ClientStatusPill } from "@/src/components/ClientStatusPill";

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

interface Client {
  _id: string;
  name: string;
  email: string;
  phone: string;
  is_blocked: boolean;
  blocked_by_wapzio: boolean;
  whatsapp_status: string;
  plan_name: string | null;
  created_at: string;
}

interface ClientsResponse {
  clients: Client[];
  total: number;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
  const [hasWebhook, setHasWebhook] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ client: Client; top: number; right: number } | null>(null);

  // A fixed popup does not follow the page, so any scroll or resize closes it.
  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rowMenu]);

  useEffect(() => {
    // The shell has already fetched and cached the profile by the time a screen
    // renders, so the onboarding token and webhook state come from there.
    const profile = sessionStore.getProfile();
    setOnboardingToken(profile?.onboarding_token || null);
    setHasWebhook(!!profile?.webhook_url);

    const load = async () => {
      const [statsRes, clientsRes] = await Promise.all([
        apiFetch<Stats>("/partner/stats"),
        // Newest first is the backend default; five is what the card shows.
        apiFetch<ClientsResponse>("/partner/clients?page=1&limit=5"),
      ]);

      if (statsRes.ok && statsRes.data) setStats(statsRes.data);
      else setError(statsRes.message || "Could not load statistics");

      if (clientsRes.ok && clientsRes.data) setClients(clientsRes.data.clients);
      setLoading(false);
    };
    load();
  }, []);

  // Built from the clients we actually hold: a client's creation time is real
  // data; a block has no timestamp in the API, so it is shown without one
  // rather than with an invented time.
  const activity = useMemo(() => {
    const items: { key: string; kind: "created" | "blocked"; title: string; text: string; at: string | null }[] = [];
    for (const c of clients) {
      items.push({
        key: `created-${c._id}`,
        kind: "created",
        title: "Client created",
        text: `${c.name} was added as a client.`,
        at: c.created_at,
      });
      if (c.is_blocked || c.blocked_by_wapzio) {
        items.push({
          key: `blocked-${c._id}`,
          kind: "blocked",
          title: "Client blocked",
          text: `${c.name} is blocked${c.blocked_by_wapzio ? " by Wapzio" : ""}.`,
          at: null,
        });
      }
    }
    return items.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0)).slice(0, 6);
  }, [clients]);

  const copyOnboardingLink = async () => {
    const appUrl = (process.env.NEXT_PUBLIC_FRONT_URL || "").replace(/\/$/, "");
    if (!onboardingToken) {
      toast.error("No onboarding link yet. Contact Wapzio to have one generated.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${appUrl}/join/${onboardingToken}`);
      toast.success("Onboarding link copied");
    } catch {
      toast.error("Could not copy. Open Onboarding & API to copy it manually.");
    }
  };

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

  const steps = [
    {
      title: "Invite your first client",
      text: "Share your onboarding link with a client, or create the account for them from the Clients page.",
      done: stats.clients_total > 0,
    },
    {
      title: "Help client connect WhatsApp",
      text: "Each client connects their own WhatsApp number when they first sign in.",
      done: stats.clients_whatsapp_connected > 0,
    },
    {
      title: "Set up webhook notifications",
      text: "Get real-time updates for client events using the Webhooks page.",
      done: hasWebhook,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Your client accounts and onboarding activity at a glance.</p>
        </div>
        <Link href="/clients?add=1" className="btn-primary px-5 py-3 flex items-center gap-2 text-sm">
          <Plus size={18} />
          Add client
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Total clients" value={stats.clients_total} icon={Users} tone="green" />
        <StatTile label="WhatsApp connected" value={stats.clients_whatsapp_connected} icon={MessageCircle} tone="green" />
        <StatTile label="Setup pending" value={stats.clients_pending_setup} icon={Clock} tone="amber" />
        <StatTile label="Blocked" value={stats.clients_blocked} icon={Ban} tone="red" />
      </div>

      {/* Seats */}
      <div className="card shadow-[var(--shadow-card)] flex flex-col md:flex-row">
        <div className="flex-1 p-5 flex items-start gap-4">
          <Users size={26} className="text-[var(--muted)] mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold">Client seats</div>
            <div className="text-sm text-[var(--muted)]">
              {stats.seats_used} of {stats.seat_limit} seats used
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${stats.is_exhausted ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            {stats.is_exhausted ? (
              <div className="mt-3 flex items-start gap-2 text-sm text-[var(--danger)]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  All seats are in use. New sign-ups through your onboarding link are refused until Wapzio adds seats, or you
                  remove a client.
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="md:w-80 p-5 flex items-center gap-4 border-t md:border-t-0 md:border-l border-[var(--border)]">
          <Headset size={30} className="text-[var(--muted)] shrink-0" />
          <div>
            <div className={`font-semibold ${stats.is_exhausted ? "text-[var(--danger)]" : ""}`}>
              {stats.seats_remaining} seat{stats.seats_remaining === 1 ? "" : "s"} available
            </div>
            <div className="text-sm text-[var(--muted)]">Contact Wapzio to add more seats.</div>
          </div>
        </div>
      </div>

      {/* Activity + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <Activity size={22} className="text-[var(--muted)] mt-0.5" />
            <div>
              <div className="text-lg font-semibold">Client onboarding activity</div>
              <div className="text-sm text-[var(--muted)]">Recent activity across your client accounts.</div>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="mt-6 text-sm text-[var(--muted)]">Nothing yet. Activity appears here once you onboard a client.</div>
          ) : (
            <ul className="mt-5">
              {activity.map((item, i) => {
                const blocked = item.kind === "blocked";
                const last = i === activity.length - 1;
                return (
                  <li key={item.key} className="relative flex items-center gap-4 pb-5 last:pb-0">
                    {!last ? <span className="absolute left-[5px] top-4 bottom-0 w-px bg-[var(--border-strong)]" /> : null}
                    <span className={`w-[11px] h-[11px] rounded-full shrink-0 ${blocked ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`} />
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${TONE[blocked ? "red" : "green"].bubble}`}>
                      {blocked ? (
                        <Ban size={20} className="text-[var(--danger)]" />
                      ) : (
                        <Users size={20} className="text-[var(--primary)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-sm text-[var(--muted)] truncate">{item.text}</div>
                    </div>
                    {item.at ? (
                      <div className="text-right text-sm text-[var(--muted)] shrink-0">
                        <div>{formatDate(item.at)}</div>
                        <div>{formatTime(item.at)}</div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <Zap size={22} className="text-[var(--primary)] mt-0.5" />
            <div>
              <div className="text-lg font-semibold">Quick actions</div>
              <div className="text-sm text-[var(--muted)]">Common tasks to get started quickly.</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              {
                icon: Link2,
                title: "Copy onboarding link",
                text: "Share with your client to create their account",
                onClick: copyOnboardingLink,
                primary: true,
              },
              {
                icon: BookOpen,
                title: "View API docs",
                text: "Get your partner API key and integration guide",
                onClick: () => router.push("/onboarding"),
              },
              {
                icon: Webhook,
                title: "Configure webhooks",
                text: "Set up event notifications to your server",
                onClick: () => router.push("/webhooks"),
              },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.title}
                  onClick={a.onClick}
                  className={`w-full flex items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors ${
                    a.primary
                      ? "bg-emerald-50 dark:bg-emerald-900/15 hover:bg-emerald-100 dark:hover:bg-emerald-900/25"
                      : "bg-black/[0.03] dark:bg-white/5 hover:bg-black/[0.06] dark:hover:bg-white/10"
                  }`}
                >
                  <Icon size={22} className={a.primary ? "text-[var(--primary)]" : "text-[var(--muted)]"} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${a.primary ? "text-[var(--primary-dark)]" : ""}`}>{a.title}</div>
                    <div className="text-sm text-[var(--muted)]">{a.text}</div>
                  </div>
                  <ChevronRight size={18} className="text-[var(--muted)] shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Your clients */}
      <div className="card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <Users size={22} className="text-[var(--muted)] mt-0.5" />
            <div>
              <div className="text-lg font-semibold">Your clients</div>
              <div className="text-sm text-[var(--muted)]">All the client accounts you have onboarded.</div>
            </div>
          </div>
          <Link
            href="/clients"
            className="card px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            View all clients
            <ChevronRight size={16} />
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="px-5 pb-6 text-sm text-[var(--muted)]">No clients yet. Use Add client or share your onboarding link.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[var(--muted)] border-y border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">WhatsApp</th>
                  <th className="px-3 py-3 font-semibold">Plan</th>
                  <th className="px-3 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const connected = c.whatsapp_status === "connected";
                  return (
                    <tr key={c._id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-semibold shrink-0">
                            {(c.name || "?").trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{c.name}</div>
                            <div className="text-[var(--muted)] truncate">{c.email}</div>
                            {c.phone ? <div className="text-[var(--muted)] truncate">{c.phone}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <ClientStatusPill client={c} />
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                          <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-[var(--primary)]" : "bg-slate-400"}`} />
                          {connected ? "Connected" : "Not connected"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[var(--muted)]">{c.plan_name || "—"}</td>
                      <td className="px-3 py-4 text-[var(--muted)]">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            if (rowMenu?.client._id === c._id) {
                              setRowMenu(null);
                              return;
                            }
                            // Positioned from the button, and rendered outside the
                            // table: the scroll container would clip it otherwise.
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenu({ client: c, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          }}
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--muted)]"
                          aria-label="Client actions"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rowMenu ? (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setRowMenu(null)} />
          <div
            role="menu"
            style={{ top: rowMenu.top, right: rowMenu.right }}
            className="fixed z-50 w-48 card shadow-[var(--shadow-card)] p-1 text-left"
          >
            <Link
              href="/clients"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Users size={16} className="text-[var(--muted)]" />
              Manage in Clients
            </Link>
            <button
              role="menuitem"
              onClick={async () => {
                const email = rowMenu.client.email;
                setRowMenu(null);
                try {
                  await navigator.clipboard.writeText(email);
                  toast.success("Email copied");
                } catch {
                  toast.error("Could not copy the email");
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Copy size={16} className="text-[var(--muted)]" />
              Copy email
            </button>
          </div>
        </>
      ) : null}

      {/* Next steps */}
      <div className="card shadow-[var(--shadow-card)] bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 p-5 flex flex-col lg:flex-row gap-5 lg:gap-0">
        <div className="flex items-start gap-3 lg:w-72 shrink-0">
          <CheckCircle2 size={24} className="text-[var(--primary)] mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-semibold">Next steps</div>
            <div className="text-sm text-[var(--muted)]">Follow these steps to onboard your clients and start using Wapzio.</div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-0 md:divide-x divide-[var(--border-strong)]">
          {steps.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3 md:px-6">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  s.done ? "bg-[var(--primary)] text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                }`}
              >
                {s.done ? <Check size={18} /> : i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-sm text-[var(--muted)] mt-1">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
