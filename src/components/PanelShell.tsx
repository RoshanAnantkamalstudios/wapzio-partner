"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  LinkIcon,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
  Webhook,
  ChevronDown,
  Bell,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/src/lib/api";
import { PartnerProfile, sessionStore } from "@/src/lib/session";
import { CONSENT_REQUIRED_EVENT, ConsentStatus } from "@/src/lib/consents";
import ConsentScreen from "@/src/components/ConsentScreen";
import BorrowedSessionBanner from "@/src/components/BorrowedSessionBanner";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/onboarding", label: "Onboarding & API", icon: LinkIcon },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Settings },
];

const useOutsideClose = (open: boolean, close: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
};

/** Avatar + name with the Settings / Sign out menu. Used in the sidebar and the top bar. */
const AccountMenu = ({
  name,
  placement,
  pendingAgreements = 0,
  onNavigate,
  onSignOut,
}: {
  name?: string;
  placement: "up" | "down";
  pendingAgreements?: number;
  onNavigate?: () => void;
  onSignOut: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const initial = (name || "P").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div
          role="menu"
          className={`absolute ${placement === "up" ? "bottom-full mb-2 left-0 right-0" : "top-full mt-2 right-0 w-52"} card shadow-[var(--shadow-card)] p-1 z-50`}
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Settings size={16} />
            Settings
          </Link>
          <Link
            href="/agreements"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ScrollText size={16} />
            Agreements
            {pendingAgreements > 0 ? (
              <span className="ml-auto text-[11px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5">
                {pendingAgreements} to accept
              </span>
            ) : null}
          </Link>
          <button
            role="menuitem"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--danger)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left"
      >
        <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-semibold shrink-0">
          {initial}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-xs text-[var(--muted)] truncate">Partner account</div>
        </div>
        <ChevronDown size={16} className={`text-[var(--muted)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
};

/** There is no notification feed behind the panel yet, so the bell says so rather than showing a dot. */
const BellMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5"
      >
        <Bell size={20} />
      </button>
      {open ? (
        <div className="absolute top-full mt-2 right-0 w-64 card shadow-[var(--shadow-card)] p-4 z-50 text-sm">
          <div className="font-semibold">Notifications</div>
          <div className="text-[var(--muted)] mt-1">You are all caught up.</div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Chrome + gate for every signed-in screen.
 *
 * The gate is the /partner/me call, not the presence of a token: a token that
 * was revoked, or a partner Wapzio has since suspended, must land on the login
 * screen rather than on an empty dashboard.
 */
export const PanelShell = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [consents, setConsents] = useState<ConsentStatus | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const loadConsents = useCallback(async () => {
    const res = await apiFetch<ConsentStatus>("/partner/consents");
    if (res.ok && res.data) setConsents(res.data);
  }, []);

  // A call the backend refused for pending agreements: put the screen up now.
  useEffect(() => {
    window.addEventListener(CONSENT_REQUIRED_EVENT, loadConsents);
    return () => window.removeEventListener(CONSENT_REQUIRED_EVENT, loadConsents);
  }, [loadConsents]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!sessionStore.getToken()) {
        router.replace("/login");
        return;
      }

      const res = await apiFetch<PartnerProfile>("/partner/me");
      if (cancelled) return;

      if (!res.ok || !res.data) {
        // apiFetch already redirected on 401/blocked; anything else means the
        // account is not usable here either.
        router.replace("/login");
        return;
      }

      sessionStore.setProfile(res.data);
      setProfile(res.data);
      await loadConsents();
      if (cancelled) return;
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router, loadConsents]);

  const signOut = () => {
    sessionStore.clear();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--primary)]" size={28} />
      </div>
    );
  }

  const pendingCount = consents?.pending.length ?? 0;

  // Enforcement on and something to accept: nothing else in the panel is reachable.
  if (consents && consents.enforced && pendingCount > 0) {
    return <ConsentScreen status={consents} mode="block" onAccepted={setConsents} onSignOut={signOut} />;
  }

  const seatLimit = profile?.seat_limit ?? 0;
  const seatsUsed = profile?.seats_used ?? 0;
  const seatsLeft = profile?.seats_remaining ?? Math.max(0, seatLimit - seatsUsed);
  const seatPercent = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-5 pt-5 pb-3" aria-label="Wapzio Partner Console home">
          {/* The logo has a white background. Multiply drops it onto the tinted
              sidebar; in dark mode it sits on a white chip instead. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/wapzio-logo.png`}
            alt="Wapzio"
            className="h-9 w-auto mix-blend-multiply dark:mix-blend-normal dark:bg-white dark:rounded-md dark:px-2 dark:py-1"
          />
          <div className="mt-1 text-xs text-[var(--muted)]">Partner Console</div>
        </Link>

        <nav className="px-3 pt-2 space-y-1 flex-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] font-semibold"
                    : "text-[var(--muted)] font-medium hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {active ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--primary)]" /> : null}
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 space-y-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="text-sm font-semibold">Partner seats</div>
            <div className="mt-1 text-sm font-medium">
              {seatsUsed} / {seatLimit} seats used
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${seatPercent}%` }} />
            </div>
            <div className="mt-2 text-xs text-[var(--muted)]">
              {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} available
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-2">
            <AccountMenu name={profile?.name} placement="up" pendingAgreements={pendingCount} onNavigate={() => setMenuOpen(false)} onSignOut={signOut} />
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <button
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      ) : null}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Above everything, including the header: if this panel is being
            driven by Wapzio support rather than its owner, that is the first
            thing anyone looking at the screen should know. */}
        <BorrowedSessionBanner />

        <header className="hidden lg:flex h-16 items-center justify-end gap-2 px-5 border-b border-[var(--border)] bg-[var(--surface)]">
          <BellMenu />
          <div className="w-60">
            <AccountMenu name={profile?.name} placement="down" pendingAgreements={pendingCount} onSignOut={signOut} />
          </div>
        </header>

        <header className="h-16 flex items-center gap-3 px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)] lg:hidden">
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold">{profile?.name}</span>
        </header>

        {/* Enforcement is still off: ask, but do not lock anyone out. */}
        {pendingCount > 0 ? (
          <div className="mx-4 sm:mx-5 mt-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 flex items-center gap-3 flex-wrap">
            <ShieldAlert size={18} className="text-amber-700 dark:text-amber-300 shrink-0" />
            <p className="flex-1 min-w-0 text-sm text-amber-900 dark:text-amber-200">
              {pendingCount} agreement{pendingCount === 1 ? "" : "s"} waiting for your acceptance.
            </p>
            <button
              onClick={() => setConsentOpen(true)}
              className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-dark)]"
            >
              Review and accept
            </button>
          </div>
        ) : null}

        <main className="px-4 py-4 sm:px-5 sm:py-5 lg:px-5 lg:py-6">{children}</main>

        {consentOpen && consents && pendingCount > 0 ? (
          <ConsentScreen
            status={consents}
            mode="modal"
            onAccepted={(next) => {
              setConsents(next);
              setConsentOpen(false);
            }}
            onClose={() => setConsentOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
};

export default PanelShell;
