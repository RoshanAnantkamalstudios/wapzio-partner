"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Headset,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { PartnerProfile } from "@/src/lib/session";

/**
 * The two ways a partner brings clients in:
 *   1. the hosted onboarding link, for partners who just want to share a URL;
 *   2. the partner API, for partners who sign clients up on their own website.
 *
 * Both are capped by the same seat count, and both stamp the new account with
 * this partner — there is no third way in.
 */

type Lang = "curl" | "js" | "python" | "php";
type Example = "create" | "list" | "stats";

const LANGS: { value: Lang; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "js", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "php", label: "PHP" },
];

const EXAMPLES: { value: Example; label: string }[] = [
  { value: "create", label: "Create Client" },
  { value: "list", label: "List Clients" },
  { value: "stats", label: "Get Stats" },
];

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@wapzio.com";

const CREATE_BODY = { name: "Acme Retail", email: "owner@acme.com", phone: "9876543210", country_code: "+91" };

const buildExample = (lang: Lang, example: Example, base: string): string => {
  const path = example === "create" ? "/clients" : example === "list" ? "/clients?page=1&limit=20" : "/stats";
  const url = `${base}/partner-api/v1${path}`;
  const post = example === "create";
  const json = JSON.stringify(CREATE_BODY, null, 2);

  switch (lang) {
    case "curl":
      return post
        ? `curl -X POST ${url} \\
  -H "X-Partner-Key: <your key>" \\
  -H "Content-Type: application/json" \\
  -d '${json}'`
        : `curl "${url}" \\
  -H "X-Partner-Key: <your key>"`;
    case "js":
      return post
        ? `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    "X-Partner-Key": "<your key>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),
});

const data = await res.json();`
        : `const res = await fetch("${url}", {
  headers: { "X-Partner-Key": "<your key>" },
});

const data = await res.json();`;
    case "python":
      return post
        ? `import requests

res = requests.post(
    "${url}",
    headers={"X-Partner-Key": "<your key>"},
    json=${json.replace(/"([a-z_]+)":/g, '"$1":').replace(/\n/g, "\n    ")},
)

print(res.json())`
        : `import requests

res = requests.get(
    "${url}",
    headers={"X-Partner-Key": "<your key>"},
)

print(res.json())`;
    case "php":
      return post
        ? `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-Partner-Key: <your key>",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "name" => "Acme Retail",
        "email" => "owner@acme.com",
        "phone" => "9876543210",
        "country_code" => "+91",
    ]),
]);

$response = curl_exec($ch);`
        : `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["X-Partner-Key: <your key>"],
]);

$response = curl_exec($ch);`;
  }
};

// Colours strings, comments and flags. Not a real parser: the examples are fixed
// and short, so a few patterns are enough and no highlighting library is shipped.
const TOKEN = /("(?:[^"\\]|\\.)*")|(#[^\n]*|\/\/[^\n]*)|(\s-[XHd]\b)/g;

const highlight = (line: string) => {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(line.slice(last, start));
    const [text, str, comment] = m;
    if (str) {
      // A string followed by a colon is an object key, otherwise a value.
      const isKey = /^\s*:/.test(line.slice(start + text.length));
      out.push(
        <span key={i++} className={isKey ? "text-[#a31515] dark:text-[#f19a8e]" : "text-[#0451a5] dark:text-[#7fb4f5]"}>
          {text}
        </span>
      );
    } else if (comment) {
      out.push(
        <span key={i++} className="text-slate-500">
          {text}
        </span>
      );
    } else {
      out.push(
        <span key={i++} className="text-[var(--primary-dark)] dark:text-emerald-400">
          {text}
        </span>
      );
    }
    last = start + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
};

const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildPostman = (base: string) =>
  JSON.stringify(
    {
      info: {
        name: "Wapzio Partner API",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      variable: [
        { key: "base_url", value: `${base}/partner-api/v1` },
        { key: "partner_key", value: "<your key>" },
      ],
      item: [
        {
          name: "Create client",
          request: {
            method: "POST",
            header: [
              { key: "X-Partner-Key", value: "{{partner_key}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            body: { mode: "raw", raw: JSON.stringify(CREATE_BODY, null, 2) },
            url: "{{base_url}}/clients",
          },
        },
        {
          name: "List clients",
          request: {
            method: "GET",
            header: [{ key: "X-Partner-Key", value: "{{partner_key}}" }],
            url: "{{base_url}}/clients?page=1&limit=20",
          },
        },
        {
          name: "Seats and client counts",
          request: {
            method: "GET",
            header: [{ key: "X-Partner-Key", value: "{{partner_key}}" }],
            url: "{{base_url}}/stats",
          },
        },
        {
          name: "Block or unblock a client",
          request: {
            method: "PATCH",
            header: [
              { key: "X-Partner-Key", value: "{{partner_key}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            body: { mode: "raw", raw: JSON.stringify({ blocked: true }, null, 2) },
            url: "{{base_url}}/clients/:clientId/block",
          },
        },
        {
          name: "Remove a client",
          request: {
            method: "DELETE",
            header: [{ key: "X-Partner-Key", value: "{{partner_key}}" }],
            url: "{{base_url}}/clients/:clientId",
          },
        },
      ],
    },
    null,
    2
  );

const buildGuide = (base: string, joinUrl: string) => `# Wapzio Partner integration guide

There are two ways to bring a client onto Wapzio. Both use one of your seats.

## 1. Onboarding link

Share this link with a client. They sign up, verify their email and connect their own WhatsApp number.

${joinUrl || "(No onboarding link yet. Contact Wapzio to have one generated.)"}

## 2. Partner API

Create client accounts from your own website. Send your key in the \`X-Partner-Key\` header.

Base URL: \`${base}/partner-api/v1\`

| Method | Path | What it does |
| --- | --- | --- |
| POST | /clients | Create a client account |
| GET | /clients | List your clients (\`page\`, \`limit\`, \`search\`). Email and phone come back masked (\`email_masked\`, \`phone_masked\`); \`search\` still accepts a full email or phone |
| GET | /stats | Seats and client counts |
| PATCH | /clients/:clientId/block | Block or unblock a client (\`{ "blocked": true }\`) |
| DELETE | /clients/:clientId | Remove a client and free its seat |

### Create a client

\`\`\`bash
${buildExample("curl", "create", base)}
\`\`\`

The response includes a \`temporary_password\` that is shown once. Give it to the client, who can change it after signing in.

### Errors to handle

- \`409 SEAT_LIMIT_REACHED\` — every seat is in use. Show your customer a clear message.
- \`409 EMAIL_TAKEN\` — an account with that email already exists.
- \`400 VALIDATION_ERROR\` — a required field is missing or invalid.
- \`403 PLATFORM_BLOCKED\` — Wapzio blocked this client; only Wapzio support can change it.

### Keeping your key safe

Keep the key on your server, never in a browser or a mobile app. If it leaks, generate a new one from the Onboarding & API page. The old key stops working immediately.

Need help? ${SUPPORT_EMAIL}
`;

const IconBubble = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/25 text-[var(--primary)] flex items-center justify-center shrink-0">
    <Icon size={22} />
  </div>
);

export default function OnboardingPage() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState<"key" | "link" | null>(null);
  const [confirming, setConfirming] = useState<"link" | "key" | null>(null);
  const [lang, setLang] = useState<Lang>("curl");
  const [example, setExample] = useState<Example>("create");
  const examplesRef = useRef<HTMLElement>(null);

  const load = async () => {
    const res = await apiFetch<PartnerProfile>("/partner/me");
    if (res.ok && res.data) setProfile(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const appUrl = (process.env.NEXT_PUBLIC_FRONT_URL || "").replace(/\/$/, "");
  const joinUrl = profile?.onboarding_token ? `${appUrl}/join/${profile.onboarding_token}` : "";
  // The copy-paste examples must name the backend the partner will actually
  // call, not this panel's own origin.
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.wapzio.com/api").replace(/\/$/, "");

  const code = useMemo(() => buildExample(lang, example, apiUrl), [lang, example, apiUrl]);
  const lines = code.split("\n");

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const copyKey = () => {
    if (newKey) {
      copy(newKey, "API key");
      return;
    }
    // Only a hash of the key is stored, so the full key cannot be recovered.
    toast.info("The full key is shown only once, when you generate it. Use Refresh to generate a new one.");
  };

  const rotateLink = async () => {
    setConfirming(null);
    setRotating("link");
    const res = await apiFetch<{ onboarding_token: string }>("/partner/credentials/onboarding-link", { method: "POST" });
    setRotating(null);

    if (res.ok) {
      toast.success("New link generated");
      load();
    } else {
      toast.error(res.message || "Could not generate a new link");
    }
  };

  const rotateKey = async () => {
    setConfirming(null);
    setRotating("key");
    const res = await apiFetch<{ api_key: string }>("/partner/credentials/api-key", { method: "POST" });
    setRotating(null);

    if (res.ok && res.data?.api_key) {
      setNewKey(res.data.api_key);
      toast.success("New API key generated");
      load();
    } else {
      toast.error(res.message || "Could not generate a new key");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
      </div>
    );
  }

  const resources = [
    {
      icon: BookOpen,
      title: "API Documentation",
      text: "View endpoints and examples",
      bubble: "bg-emerald-100 text-[var(--primary)] dark:bg-emerald-900/25",
      onClick: () => examplesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
    {
      icon: Send,
      title: "Postman Collection",
      text: "Download and test the APIs",
      bubble: "bg-orange-100 text-orange-600 dark:bg-orange-900/25",
      onClick: () => {
        download("wapzio-partner-api.postman_collection.json", buildPostman(apiUrl), "application/json");
        toast.success("Postman collection downloaded");
      },
    },
    {
      icon: FileText,
      title: "Integration Guide",
      text: "Step by step setup instructions",
      bubble: "bg-violet-100 text-violet-600 dark:bg-violet-900/25",
      onClick: () => {
        download("wapzio-partner-integration-guide.md", buildGuide(apiUrl, joinUrl), "text/markdown");
        toast.success("Integration guide downloaded");
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Onboarding & API</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Help your clients get started with Wapzio.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        {/* Left column */}
        <div className="space-y-5 min-w-0">
          {/* Onboarding link */}
          <section className="card shadow-[var(--shadow-card)] p-5 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-start gap-4">
              <IconBubble icon={Link2} />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">Onboarding link</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Share this link with your client. They can sign up, verify their email and connect their own WhatsApp
                  number. Each sign-up uses one of your seats.
                </p>

                {joinUrl ? (
                  <div className="mt-4 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <code className="flex-1 min-w-0 truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                      {joinUrl}
                    </code>
                    <button
                      onClick={() => copy(joinUrl, "Link")}
                      className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                      aria-label="Copy link"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => setConfirming("link")}
                      disabled={rotating === "link"}
                      className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-60"
                      aria-label="Generate new link"
                      title="Generate new link"
                    >
                      {rotating === "link" ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    </button>
                    <a
                      href={joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-12 px-4 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-[var(--primary-dark)] dark:text-emerald-300 font-medium text-sm flex items-center gap-2 shrink-0 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/50"
                    >
                      <ExternalLink size={16} />
                      Open link
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--warning)]">
                    No onboarding link yet. Contact Wapzio to have one generated for your account.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Partner API */}
          <section className="card shadow-[var(--shadow-card)] p-5">
            <div className="flex items-start gap-4">
              <IconBubble icon={KeyRound} />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">Partner API</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Create client accounts from your own website. Send your key in the <code>X-Partner-Key</code> header.
                </p>

                <div className="mt-4 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <code className="flex-1 min-w-0 truncate rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
                    {profile?.api_key_prefix ? `${profile.api_key_prefix}${"•".repeat(24)}` : "No key issued"}
                  </code>
                  <button
                    onClick={copyKey}
                    className="card h-12 w-12 flex items-center justify-center shrink-0 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    aria-label="Copy API key"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => setConfirming("key")}
                    disabled={rotating === "key"}
                    className="card h-12 px-5 flex items-center justify-center gap-2 shrink-0 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-60"
                  >
                    {rotating === "key" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Refresh
                  </button>
                </div>

                {newKey ? (
                  <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:bg-emerald-900/15 dark:border-emerald-900/40">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                      <Check size={16} /> Your new API key
                    </div>
                    <code className="mt-2 block break-all text-sm">{newKey}</code>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <AlertTriangle size={14} />
                      Copy it now — it is never shown again.
                    </div>
                    <button onClick={() => copy(newKey, "API key")} className="btn-primary mt-3 px-3 py-1.5 text-sm">
                      Copy key
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* API examples */}
          <section ref={examplesRef} className="card shadow-[var(--shadow-card)] p-5 scroll-mt-5">
            <div className="flex items-start gap-4">
              <IconBubble icon={Code2} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold">API Examples</h2>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Use the examples below to integrate with Wapzio from your application.
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as Lang)}
                      aria-label="Language"
                      className="appearance-none h-11 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-4 pr-9 text-sm font-medium outline-none focus:border-[var(--primary)]"
                    >
                      {LANGS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  </div>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap" role="tablist">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.value}
                      role="tab"
                      aria-selected={example === ex.value}
                      onClick={() => setExample(ex.value)}
                      className={`h-11 px-6 rounded-lg text-sm font-semibold transition-colors ${
                        example === ex.value
                          ? "bg-[var(--primary)] text-white"
                          : "border border-[var(--border)] text-[var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/5"
                      }`}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                <div className="relative mt-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <button
                    onClick={() => copy(code, "Example")}
                    className="absolute top-3 right-3 card h-10 w-10 flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/5"
                    aria-label="Copy example"
                  >
                    <Copy size={16} />
                  </button>
                  <pre className="overflow-x-auto py-4 pr-16 text-[13px] leading-6 font-mono">
                    {lines.map((line, i) => (
                      <Fragment key={i}>
                        <div className="flex">
                          <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-400">{i + 1}</span>
                          <code className="whitespace-pre">{highlight(line)}</code>
                        </div>
                      </Fragment>
                    ))}
                  </pre>
                </div>

                <p className="text-xs text-[var(--muted)] mt-3">
                  A sign-up past your seat limit answers <code>409 SEAT_LIMIT_REACHED</code>. Handle that in your flow so
                  your customer sees a clear message rather than a failure.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-5 min-w-0">
          <section className="card shadow-[var(--shadow-card)] p-5 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-3">
              <IconBubble icon={BookOpen} />
              <h2 className="text-lg font-semibold">How it works?</h2>
            </div>
            <ol className="mt-5">
              {[
                { title: "Share onboarding link", text: "Client creates their account" },
                { title: "Client verifies email", text: "They add and connect their WhatsApp number" },
                { title: "Start using", text: "Client can send and receive messages" },
              ].map((s, i, arr) => (
                <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < arr.length - 1 ? <span className="absolute left-[15px] top-9 bottom-1 w-px bg-[var(--border-strong)]" /> : null}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                      i === 0 ? "bg-[var(--primary)] text-white" : "bg-emerald-100 text-[var(--primary-dark)] dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="text-sm text-[var(--muted)]">{s.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--muted)] flex items-center justify-center shrink-0">
                <Braces size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Resources</h2>
                <p className="text-sm text-[var(--muted)]">Everything you need to integrate.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {resources.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.title}
                    onClick={r.onClick}
                    className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/5"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.bubble}`}>
                      {r.title === "API Documentation" ? <Icon size={22} /> : <Download size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{r.title}</div>
                      <div className="text-sm text-[var(--muted)]">{r.text}</div>
                    </div>
                    <ChevronRight size={18} className="text-[var(--muted)] shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card shadow-[var(--shadow-card)] p-5 bg-sky-50/70 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Headset size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Need help?</h2>
                <p className="text-sm text-[var(--muted)]">Our team is here to help you.</p>
              </div>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Partner help: ${profile?.name || ""}`)}`}
              className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-[var(--surface)] text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Contact support
              <ChevronRight size={16} />
            </a>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === "key" ? "Generate a new API key?" : "Generate a new onboarding link?"}
        body={
          confirming === "key"
            ? "Your current key stops working immediately. Anything calling the Wapzio API with it will start failing until you update it."
            : "Every link you have already shared stops working. Anyone part-way through signing up on the old link will have to start again."
        }
        confirmLabel={confirming === "key" ? "Generate new key" : "Generate new link"}
        tone="danger"
        busy={rotating !== null}
        onConfirm={() => (confirming === "key" ? rotateKey() : rotateLink())}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
