"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { sessionStore } from "@/src/lib/session";
import { getRecaptchaToken } from "@/src/lib/recaptcha";

/**
 * Partner sign-in.
 *
 * Uses the platform's normal login endpoint — partners are real users with the
 * `partner` role — and then refuses anything that is not a partner, so a tenant
 * or an agent who wanders onto this domain is told plainly instead of landing in
 * a panel with no data in it.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The backend runs the same human check for every surface. Without a
      // token it answers RECAPTCHA_FAILED wherever the secret is configured.
      const recaptcha_token = await getRecaptchaToken("login");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email.trim(), password, recaptcha_token }),
      });
      const payload = await res.json();

      if (!res.ok || payload.success === false) {
        setError(payload.message || "Sign in failed");
        return;
      }

      // The login route answers with the token and user at the top level; the
      // `data` fallbacks are there so a future envelope change does not silently
      // log everyone out.
      const token = payload.token || payload.data?.token;
      const role = payload.user?.role || payload.data?.user?.role || null;

      if (!token) {
        setError("The server did not return a session. Please try again.");
        return;
      }

      if (role && role !== "partner") {
        // Fail here rather than after a redirect: the panel's API would answer
        // 403 to everything and the screen would look broken instead of clear.
        setError("This login is not a partner account. Use the Wapzio app or the admin panel.");
        return;
      }

      sessionStore.setToken(token);
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <header className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--text)] text-[15px] font-semibold tracking-tight text-[var(--bg)]">
            W
          </div>
          <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Partner Panel</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Onboard and manage your client accounts.</p>
        </header>

        <form
          onSubmit={submit}
          className="card p-6 shadow-[var(--shadow-card)] sm:p-7"
        >
          {error ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              <AlertCircle size={15} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input h-11 pl-10 pr-3"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input h-11 pl-10 pr-11"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 flex h-11 w-full items-center justify-center gap-2 text-[14px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mx-auto mt-5 max-w-[320px] text-center text-[12px] leading-5 text-[var(--muted)]">
          Partner accounts are created by Wapzio. Contact your account manager for access.
        </p>
      </div>
    </main>
  );
}
