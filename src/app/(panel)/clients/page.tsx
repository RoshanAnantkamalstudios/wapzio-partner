"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import StatTile from "@/src/components/StatTile";
import ClientStatusPill, { clientStatus } from "@/src/components/ClientStatusPill";

interface Client {
  _id: string;
  name: string;
  email: string;
  phone: string;
  is_blocked: boolean;
  // Blocked by Wapzio rather than by you: an enforcement action against this
  // account on our platform, which only Wapzio support can lift.
  blocked_by_wapzio: boolean;
  block_reason: string | null;
  email_verified: boolean;
  business_profile_completed: boolean;
  onboarding_completed: boolean;
  whatsapp_status: string;
  plan_name: string | null;
  subscription_status: string;
  created_at: string;
}

interface ClientsResponse {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
}

interface Stats {
  clients_total: number;
  clients_blocked: number;
  clients_whatsapp_connected: number;
  clients_pending_setup: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "pending", label: "Setup pending" },
  { value: "blocked", label: "Blocked" },
];

const JOINED_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const PAGE_SIZES = [10, 20, 50];

// The API caps a page at 100. A partner holds a handful of seats, so loading
// every client once and filtering here is cheaper than a round trip per filter,
// and it is what makes the plan and joined filters possible at all.
const FETCH_PAGE = 100;
const MAX_FETCH_PAGES = 10;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ElementType;
}) => (
  <div className="relative">
    <span className="absolute -top-2 left-3 px-1 bg-[var(--surface)] text-xs text-[var(--muted)] z-10">{label}</span>
    {Icon ? <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" /> : null}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none w-full h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium pr-9 outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] ${
        Icon ? "pl-10" : "pl-3"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
  </div>
);

const Checkbox = ({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={checked}
    disabled={disabled}
    ref={(el) => {
      if (el) el.indeterminate = !!indeterminate && !checked;
    }}
    onChange={onChange}
    className="w-[18px] h-[18px] rounded border-[var(--border-strong)] accent-[var(--primary)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  />
);

export default function ClientsPage() {
  const [all, setAll] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Draft text is applied on Search / Enter; the selects apply as soon as they change.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [joined, setJoined] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Client | null>(null);
  const [rowMenu, setRowMenu] = useState<{ client: Client; top: number; right: number } | null>(null);

  // The dashboard's "Add client" button lands here with ?add=1 to open the dialog.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") {
      setShowCreate(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

  const load = useCallback(async () => {
    setLoading(true);

    const collected: Client[] = [];
    let failed: string | null = null;

    for (let p = 1; p <= MAX_FETCH_PAGES; p++) {
      const res = await apiFetch<ClientsResponse>(`/partner/clients?page=${p}&limit=${FETCH_PAGE}`);
      if (!res.ok || !res.data) {
        failed = res.message || "Could not load clients";
        break;
      }
      collected.push(...res.data.clients);
      if (collected.length >= res.data.total || res.data.clients.length === 0) break;
    }

    if (failed) toast.error(failed);
    else setAll(collected);

    const statsRes = await apiFetch<Stats>("/partner/stats");
    if (statsRes.ok && statsRes.data) setStats(statsRes.data);

    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const planOptions = useMemo(() => {
    const names = Array.from(new Set(all.map((c) => c.plan_name).filter((n): n is string => !!n))).sort();
    return [{ value: "all", label: "All" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff =
      joined === "all"
        ? null
        : joined === "today"
          ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
          : Date.now() - Number(joined) * 24 * 60 * 60 * 1000;

    return all.filter((c) => {
      if (q && !`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)) return false;
      if (status !== "all") {
        const s = clientStatus(c);
        // "Blocked" covers both a block of your own and one by Wapzio.
        if (status === "blocked" ? s !== "blocked" && s !== "blocked_by_wapzio" : s !== status) return false;
      }
      if (plan !== "all" && c.plan_name !== plan) return false;
      if (cutoff !== null && new Date(c.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [all, search, status, plan, joined]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(filtered.length, currentPage * pageSize);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filtersActive = !!search || status !== "all" || plan !== "all" || joined !== "all";

  const applySearch = () => {
    setPage(1);
    setSearch(searchDraft);
  };

  const reset = () => {
    setSearchDraft("");
    setSearch("");
    setStatus("all");
    setPlan("all");
    setJoined("all");
    setPage(1);
  };

  // Clients Wapzio blocked cannot be selected: the API refuses every change to them.
  const selectable = rows.filter((c) => !c.blocked_by_wapzio);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c._id));
  const someSelected = selectable.some((c) => selected.has(c._id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((c) => next.delete(c._id));
      else selectable.forEach((c) => next.add(c._id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setBlocked = async (client: Client, blocked: boolean) => {
    const res = await apiFetch(`/partner/clients/${client._id}/block`, { method: "PATCH", body: { blocked } });
    return res;
  };

  const toggleBlock = async (client: Client) => {
    setBusyId(client._id);
    const res = await setBlocked(client, !client.is_blocked);
    setBusyId(null);

    if (res.ok) {
      toast.success(client.is_blocked ? "Client unblocked" : "Client blocked");
      load();
    } else {
      toast.error(res.message || "Could not update the client");
    }
  };

  const bulkSet = async (blocked: boolean) => {
    const targets = all.filter((c) => selected.has(c._id) && !c.blocked_by_wapzio && c.is_blocked !== blocked);
    if (targets.length === 0) {
      toast.info(blocked ? "The selected clients are already blocked" : "The selected clients are not blocked");
      return;
    }

    setBulkBusy(true);
    const results = await Promise.all(targets.map((c) => setBlocked(c, blocked)));
    setBulkBusy(false);

    const ok = results.filter((r) => r.ok).length;
    const failedCount = results.length - ok;
    if (ok) toast.success(`${ok} client${ok === 1 ? "" : "s"} ${blocked ? "blocked" : "unblocked"}`);
    if (failedCount) toast.error(`${failedCount} could not be updated`);
    load();
  };

  const removeClient = async () => {
    const client = pendingRemove;
    if (!client) return;

    setBusyId(client._id);
    const res = await apiFetch(`/partner/clients/${client._id}`, { method: "DELETE" });
    setBusyId(null);
    setPendingRemove(null);

    if (res.ok) {
      toast.success("Client removed");
      load();
    } else {
      toast.error(res.message || "Could not remove the client");
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy the email");
    }
  };

  // Window of page buttons around the current page.
  const pageButtons = useMemo(() => {
    const out: number[] = [];
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    for (let p = start; p <= Math.min(totalPages, start + 4); p++) out.push(p);
    return out;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Manage all your client accounts in one place.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-5 py-3 flex items-center gap-2 text-sm">
          <Plus size={18} />
          Add client
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Total clients" value={stats?.clients_total ?? all.length} icon={Users} tone="green" />
        <StatTile label="Connected" value={stats?.clients_whatsapp_connected ?? 0} icon={MessageCircle} tone="green" />
        <StatTile label="Setup pending" value={stats?.clients_pending_setup ?? 0} icon={Clock} tone="amber" />
        <StatTile label="Blocked" value={stats?.clients_blocked ?? 0} icon={Ban} tone="red" />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applySearch();
        }}
        className="card shadow-[var(--shadow-card)] p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_170px_190px_auto_auto] gap-3 items-center"
      >
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full h-12 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] pl-10 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
          />
        </div>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Plan"
          value={plan}
          onChange={(v) => {
            setPlan(v);
            setPage(1);
          }}
          options={planOptions}
        />
        <FilterSelect
          label="Joined"
          value={joined}
          onChange={(v) => {
            setJoined(v);
            setPage(1);
          }}
          options={JOINED_OPTIONS}
          icon={CalendarDays}
        />
        <button
          type="button"
          onClick={reset}
          className="h-12 px-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-black/[0.03] dark:hover:bg-white/5"
        >
          <RotateCcw size={16} />
          Reset
        </button>
        <button type="submit" className="btn-primary h-12 px-6 text-sm flex items-center justify-center gap-2">
          <Search size={16} />
          Search
        </button>
      </form>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="card shadow-[var(--shadow-card)] px-5 py-3 flex items-center gap-3 flex-wrap bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button
            onClick={() => bulkSet(true)}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} className="text-[var(--warning)]" />}
            Block
          </button>
          <button
            onClick={() => bulkSet(false)}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={14} className="text-[var(--primary)]" />
            Unblock
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-[var(--muted)] hover:text-[var(--text)] ml-auto">
            Clear selection
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="card shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
          </div>
        ) : all.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--muted)]">
            No clients yet. Share your onboarding link, or add one here.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--muted)]">
            No clients match these filters.
            {filtersActive ? (
              <button onClick={reset} className="ml-2 text-[var(--primary)] font-medium">
                Reset filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="pl-5 pr-2 py-4 w-10">
                    <Checkbox
                      label="Select all clients on this page"
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={selectable.length === 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-4 font-semibold">Client</th>
                  <th className="px-3 py-4 font-semibold">Status</th>
                  <th className="px-3 py-4 font-semibold">WhatsApp</th>
                  <th className="px-3 py-4 font-semibold">Plan</th>
                  <th className="px-3 py-4 font-semibold">Joined</th>
                  <th className="px-5 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const connected = client.whatsapp_status === "connected";
                  return (
                    <tr key={client._id} className="border-b border-[var(--border)] last:border-0">
                      <td className="pl-5 pr-2 py-4">
                        <Checkbox
                          label={`Select ${client.name}`}
                          checked={selected.has(client._id)}
                          disabled={client.blocked_by_wapzio}
                          onChange={() => toggleOne(client._id)}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/25 text-[var(--primary)] flex items-center justify-center font-semibold text-lg shrink-0">
                            {(client.name || "?").trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{client.name}</div>
                            <div className="text-[var(--muted)] truncate">{client.email}</div>
                            {client.phone ? <div className="text-[var(--muted)] truncate">{client.phone}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <ClientStatusPill client={client} />
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                          <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-[var(--primary)]" : "bg-slate-400"}`} />
                          {connected ? "Connected" : "Not connected"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[var(--muted)]">{client.plan_name || "—"}</td>
                      <td className="px-3 py-4 text-[var(--muted)]">{formatDate(client.created_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            if (rowMenu?.client._id === client._id) {
                              setRowMenu(null);
                              return;
                            }
                            // Positioned from the button and rendered outside the
                            // table: the scroll container would clip it otherwise.
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenu({ client, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          }}
                          disabled={busyId === client._id}
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--muted)] disabled:opacity-50"
                          aria-label={`Actions for ${client.name}`}
                        >
                          {busyId === client._id ? <Loader2 size={18} className="animate-spin" /> : <MoreVertical size={18} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-[var(--muted)]">
              Showing {from === to ? from : `${from}–${to}`} of {filtered.length} client{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {pageButtons.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold ${
                    p === currentPage
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-[var(--primary-dark)]"
                      : "border border-[var(--border)] text-[var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/5"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
              <div className="relative ml-1">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Clients per page"
                  className="appearance-none h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-3 pr-9 text-sm font-medium outline-none focus:border-[var(--primary)]"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {rowMenu ? (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setRowMenu(null)} />
          <div
            role="menu"
            style={{ top: rowMenu.top, right: rowMenu.right }}
            className="fixed z-50 w-52 card shadow-[var(--shadow-card)] p-1 text-left"
          >
            <button
              role="menuitem"
              onClick={() => {
                const email = rowMenu.client.email;
                setRowMenu(null);
                copyEmail(email);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Copy size={16} className="text-[var(--muted)]" />
              Copy email
            </button>

            {/* An account Wapzio has blocked is out of the reseller's hands
                entirely: the API refuses both calls, so offering the buttons
                would only produce an error. */}
            {rowMenu.client.blocked_by_wapzio ? (
              <div
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]"
                title={rowMenu.client.block_reason || "Contact Wapzio support"}
              >
                <Lock size={16} />
                Wapzio support only
              </div>
            ) : (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    const c = rowMenu.client;
                    setRowMenu(null);
                    toggleBlock(c);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {rowMenu.client.is_blocked ? (
                    <Check size={16} className="text-[var(--primary)]" />
                  ) : (
                    <Ban size={16} className="text-[var(--warning)]" />
                  )}
                  {rowMenu.client.is_blocked ? "Unblock client" : "Block client"}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const c = rowMenu.client;
                    setRowMenu(null);
                    setPendingRemove(c);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--danger)] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Trash2 size={16} />
                  Remove client
                </button>
              </>
            )}
          </div>
        </>
      ) : null}

      {showCreate ? (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!pendingRemove}
        title={pendingRemove ? `Remove ${pendingRemove.name}?` : ""}
        body={
          <>
            The account is closed and its seat is freed. This cannot be undone from the panel.
          </>
        }
        confirmLabel="Remove client"
        tone="danger"
        busy={!!pendingRemove && busyId === pendingRemove._id}
        onConfirm={removeClient}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

const CreateClientModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", country_code: "+91", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const res = await apiFetch<{ temporary_password: string | null }>("/partner/clients", {
      method: "POST",
      body: form,
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.message || "Could not create the client");
      return;
    }

    // Shown once and never stored, so the modal stays open until the partner has
    // copied it rather than closing the only chance to read it.
    if (res.data?.temporary_password) {
      setTempPassword(res.data.temporary_password);
      toast.success("Client created");
      return;
    }

    toast.success("Client created");
    onCreated();
  };

  if (tempPassword) {
    return (
      <Modal onClose={onCreated} title="Client created">
        <p className="text-sm text-[var(--muted)]">
          Give this temporary password to the client. It is shown once — after this, the client must use “forgot
          password”.
        </p>
        <code className="mt-3 block rounded-lg border border-[var(--border)] px-3 py-2 text-sm break-all">
          {tempPassword}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(tempPassword).catch(() => {});
            toast.success("Copied");
          }}
          className="btn-primary w-full mt-4 py-2"
        >
          Copy password
        </button>
        <button onClick={onCreated} className="w-full mt-2 py-2 text-sm text-[var(--muted)]">
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Add client">
      <form onSubmit={submit} className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium">Business name</label>
          <input required className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input required type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-sm font-medium">Code</label>
            <input required className="input mt-1" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Phone</label>
            <input required className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Password (optional)</label>
          <input
            type="text"
            className="input mt-1"
            placeholder="Leave blank to generate one"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Creating…" : "Create client"}
        </button>
      </form>
    </Modal>
  );
};

const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div className="card w-full max-w-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);
