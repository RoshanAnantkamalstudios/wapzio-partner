import { Ban } from "lucide-react";

interface StatusSource {
  is_blocked: boolean;
  blocked_by_wapzio: boolean;
  whatsapp_status: string;
}

export type ClientStatus = "blocked_by_wapzio" | "blocked" | "live" | "pending";

export const clientStatus = (client: StatusSource): ClientStatus => {
  if (client.blocked_by_wapzio) return "blocked_by_wapzio";
  if (client.is_blocked) return "blocked";
  if (client.whatsapp_status === "connected") return "live";
  return "pending";
};

const RED = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-300";

export const ClientStatusPill = ({ client }: { client: StatusSource }) => {
  switch (clientStatus(client)) {
    case "blocked_by_wapzio":
      return (
        <span className={RED}>
          <Ban size={13} />
          Blocked by Wapzio
        </span>
      );
    case "blocked":
      return (
        <span className={RED}>
          <Ban size={13} />
          Blocked
        </span>
      );
    case "live":
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">Live</span>;
    default:
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300">Setup pending</span>;
  }
};

export default ClientStatusPill;
