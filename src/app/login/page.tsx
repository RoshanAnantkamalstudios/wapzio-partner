"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] text-white text-xl font-bold mb-3">
            W
          </div>
          <h1 className="text-2xl font-semibold">Partner Panel</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Onboard and manage your client accounts.</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-9 pr-9"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-[var(--muted)] text-center">
            Partner accounts are created by Wapzio. Contact your account manager for access.
          </p>
        </form>
      </div>
    </div>
  );
}
