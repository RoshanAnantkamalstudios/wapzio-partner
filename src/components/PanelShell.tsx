"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, LinkIcon, Settings, LogOut, Loader2, Menu, X, Webhook } from "lucide-react";
import { apiFetch } from "@/src/lib/api";
import { PartnerProfile, sessionStore } from "@/src/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/onboarding", label: "Onboarding & API", icon: LinkIcon },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold">W</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{profile?.name}</div>
            <div className="text-[11px] text-[var(--muted)]">Partner Panel</div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[var(--border)]">
          <div className="px-3 py-2 mb-2 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="text-[11px] text-[var(--muted)]">Seats</div>
            <div className="text-sm font-semibold">
              {profile?.seats_used ?? 0} / {profile?.seat_limit ?? 0}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <LogOut size={18} />
            Sign out
          </button>
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
        <header className="h-16 flex items-center gap-3 px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)] lg:hidden">
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold">{profile?.name}</span>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
};

export default PanelShell;
