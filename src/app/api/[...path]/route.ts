import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5500/api").replace(/\/$/, "");

/**
 * The panel's only door to the backend.
 *
 * One catch-all rather than a file per endpoint: every call this project makes
 * is a partner call, they all forward the same way, and a per-route copy would
 * be thirty files that drift. The allowlist below is what keeps that from
 * turning the panel into an open proxy to the whole API — a partner session
 * must never be able to reach a tenant or admin endpoint just by typing a
 * different path into fetch().
 */
const ALLOWED_PREFIXES = [
  "partner/", // the partner's own surface
  "auth/login", // sign in
  "auth/logout",
  "auth/profile",
];

const isAllowed = (path: string) => ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));

const forward = async (request: NextRequest, path: string, method: string) => {
  if (!isAllowed(path)) {
    return NextResponse.json(
      { success: false, message: "This endpoint is not available from the partner panel." },
      { status: 403 }
    );
  }

  const search = request.nextUrl.search || "";
  const auth = request.headers.get("authorization");

  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    const text = await request.text();
    body = text || undefined;
  }

  try {
    const res = await fetch(`${BACKEND_API_URL}/${path}${search}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body,
      cache: "no-store",
    });

    const text = await res.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      // A non-JSON answer means the backend fell over or something in front of
      // it returned HTML; say so rather than throwing a parse error at the UI.
      return NextResponse.json(
        { success: false, message: "Unexpected response from the server." },
        { status: res.status || 502 }
      );
    }
  } catch (error) {
    console.error(`Partner proxy error on ${method} ${path}:`, error);
    return NextResponse.json({ success: false, message: "Could not reach the server." }, { status: 502 });
  }
};

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(request, path.join("/"), "GET");
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(request, path.join("/"), "POST");
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(request, path.join("/"), "PUT");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(request, path.join("/"), "PATCH");
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(request, path.join("/"), "DELETE");
}
