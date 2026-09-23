import { sessionStore } from "./session";

/**
 * Browser → this project's /api proxy → backend.
 *
 * Never call the backend directly from a component: the proxy is what attaches
 * the origin, keeps the backend URL out of the bundle, and gives us one place
 * to notice an expired session.
 */

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message: string | null;
  code?: string | null;
}

const onUnauthorized = () => {
  sessionStore.clear();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
};

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<ApiResult<T>> {
  const token = sessionStore.getToken();

  const res = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  // 401 is an expired or revoked session; 403 with these codes means the whole
  // partner account was suspended, and staying on the panel would only show
  // empty screens.
  const code = (payload.code as string) || null;
  if (res.status === 401 || code === "PARTNER_BLOCKED" || code === "ACCOUNT_BLOCKED") {
    onUnauthorized();
  }

  return {
    ok: res.ok && payload.success !== false,
    status: res.status,
    data: (payload.data as T) ?? null,
    message: (payload.message as string) ?? null,
    code,
  };
}
