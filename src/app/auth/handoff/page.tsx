"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { sessionStore } from "@/src/lib/session";

/**
 * Where a Wapzio admin lands when they open this panel from the admin side.
 *
 * The admin panel, this panel and the client app are three different origins,
 * so a session cannot be carried across in storage — something has to travel in
 * the URL. What travels is a one-time ticket, not a token: random, valid for
 * ninety seconds, redeemable once, and worthless the moment this page has
 * traded it in. A token in a query string would sit in browser history and in
 * the referrer of the next request the page makes.
 */
function HandoffHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const ticket = params.get("ticket");
  const [error, setError] = useState<string | null>(null);

  // React runs effects twice in development. Redeeming is destructive — the
  // second attempt would always fail on an already-spent ticket and show an
  // error over a session that worked.
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;

    if (!ticket) {
      setError("This link is missing its sign-in code. Open the panel again from the admin side.");
      return;
    }

    const redeem = async () => {
      try {
        const res = await fetch("/api/impersonation/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket }),
        });
        const payload = await res.json();

        const token = payload?.token || payload?.data?.token;
        if (!res.ok || payload?.success === false || !token) {
          setError(payload?.message || "This link has already been used or has expired.");
          return;
        }

        // Anything the previous occupant of this browser left behind would
        // otherwise show through: the profile cache is keyed by nothing.
        sessionStore.clear();
        sessionStore.setToken(token);

        // Full reload rather than a client navigation, so every component
        // mounts against the new session instead of the one React still holds.
        window.location.href = "/dashboard";
      } catch {
        setError("Could not reach the server. Try opening the panel again.");
      }
    };

    redeem();
  }, [ticket, router]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-[420px] w-full p-7 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <AlertCircle size={20} className="text-[var(--danger)]" />
          </div>
          <h1 className="mt-4 text-[17px] font-semibold tracking-tight">Could not open this panel</h1>
          <p className="mt-2 text-[13px] text-[var(--muted)]">{error}</p>
          <button onClick={() => router.replace("/login")} className="btn-primary mt-5 w-full py-2.5 text-sm">
            Go to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 size={28} className="mx-auto animate-spin text-[var(--muted)]" />
        <h1 className="mt-4 text-[17px] font-semibold tracking-tight">Opening the panel…</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">One moment while the session is set up.</p>
      </div>
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-4">
          <Loader2 size={28} className="animate-spin text-[var(--muted)]" />
        </main>
      }
    >
      <HandoffHandler />
    </Suspense>
  );
}
