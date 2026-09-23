"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Loader2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/src/lib/api";

interface Client {
  _id: string;
  name: string;
  email: string;
  phone: string;
  is_blocked: boolean;
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

const StatusPill = ({ client }: { client: Client }) => {
  if (client.is_blocked) {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">Blocked</span>;
  }
  if (client.whatsapp_status === "connected") {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Live</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">Setup pending</span>;
};

export default function ClientsPage() {
  const [data, setData] = useState<ClientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());

    const res = await apiFetch<ClientsResponse>(`/partner/clients?${params.toString()}`);
    if (res.ok && res.data) setData(res.data);
    else toast.error(res.message || "Could not load clients");
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async (client: Client) => {
    setBusyId(client._id);
    const res = await apiFetch(`/partner/clients/${client._id}/block`, {
      method: "PATCH",
      body: { blocked: !client.is_blocked },
    });
    setBusyId(null);

    if (res.ok) {
      toast.success(client.is_blocked ? "Client unblocked" : "Client blocked");
      load();
    } else {
      toast.error(res.message || "Could not update the client");
    }
  };

  const removeClient = async (client: Client) => {
    // A removed client frees its seat, so this is a commercial action as much as
    // a destructive one — confirm with the seat consequence spelled out.
    const ok = window.confirm(
      `Remove ${client.name}?\n\nThe account is closed and its seat is freed. This cannot be undone from the panel.`
    );
    if (!ok) return;

    setBusyId(client._id);
    const res = await apiFetch(`/partner/clients/${client._id}`, { method: "DELETE" });
    setBusyId(null);

    if (res.ok) {
      toast.success("Client removed");
      load();
    } else {
      toast.error(res.message || "Could not remove the client");
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Every account you have onboarded.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 flex items-center gap-2 text-sm">
          <Plus size={16} />
          Add client
        </button>
      </div>

      <div className="card p-3 flex items-center gap-2">
        <Search size={16} className="text-[var(--muted)] ml-1" />
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by name, email or phone"
          className="flex-1 bg-transparent outline-none text-sm py-1"
        />
        <button onClick={load} className="text-[var(--muted)] hover:text-[var(--text)] p-1" aria-label="Refresh">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
          </div>
        ) : !data || data.clients.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            No clients yet. Share your onboarding link, or add one here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">WhatsApp</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((client) => (
                  <tr key={client._id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{client.name}</div>
                      <div className="text-[var(--muted)] text-xs">{client.email}</div>
                      <div className="text-[var(--muted)] text-xs">{client.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill client={client} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{client.whatsapp_status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{client.plan_name || "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleBlock(client)}
                          disabled={busyId === client._id}
                          title={client.is_blocked ? "Unblock" : "Block"}
                          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                          {busyId === client._id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : client.is_blocked ? (
                            <Check size={16} className="text-[var(--primary)]" />
                          ) : (
                            <Ban size={16} className="text-[var(--warning)]" />
                          )}
                        </button>
                        <button
                          onClick={() => removeClient(client)}
                          disabled={busyId === client._id}
                          title="Remove"
                          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                          <Trash2 size={16} className="text-[var(--danger)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.total > data.limit ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">
            Page {data.page} of {totalPages} · {data.total} clients
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="card px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="card px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
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
