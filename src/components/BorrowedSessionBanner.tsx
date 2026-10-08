"use client";

import { useEffect, useState } from "react";
import { LogOut, ShieldAlert, Loader2 } from "lucide-react";
import { apiFetch } from "@/src/lib/api";
import { sessionStore } from "@/src/lib/session";

/**
 * Says out loud when this panel is being driven by somebody other than its
 * owner.
 *
 * A Wapzio admin can open a reseller's panel without their password. That is a
 * reasonable support tool and a bad secret: the partner has to be able to see
 * it happened, and the admin has to be able to tell at a glance that what they
 * are looking at is not their own screen. So the banner is loud, permanent for
 * the life of the session, and carries the way out.
 */
interface Status {
  isImpersonating: boolean;
  kind: string | null;
  actor: { name: string; email: string } | null;
  target: { name: string; email: string } | null;
}

export default function BorrowedSessionBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await apiFetch<Status>("/impersonation/status");
      if (cancelled) return;
      if (res.ok && res.data?.isImpersonating) setStatus(res.data);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.isImpersonating) return null;

  const leave = async () => {
    setLeaving(true);
    const res = await apiFetch<{ return_url: string | null }>("/impersonation/stop", { method: "POST" });
    sessionStore.clear();
    // Back to wherever the person came from. No return address means they
    // opened this some other way; the login screen is the honest fallback.
    window.location.href = res.data?.return_url || "/login";
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--warning)] px-4 py-2 text-[13px] font-medium text-black">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} />
        <span>
          Wapzio support is signed in as {status.target?.name || "this partner"}
          {status.actor?.name ? ` — opened by ${status.actor.name}` : ""}. Everything done here is recorded.
        </span>
      </div>
      <button
        onClick={leave}
        disabled={leaving}
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-black/80 px-3 py-1 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        {leaving ? "Leaving…" : "Leave"}
      </button>
    </div>
  );
}
