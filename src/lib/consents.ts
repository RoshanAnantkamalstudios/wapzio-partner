export interface ConsentItem {
  key: string;
  kind: "acceptance" | "notice";
  statement: string;
  published: boolean;
  title: string | null;
  version: string | null;
  body_sha256: string | null;
  effective_from: string | null;
  change_summary: string | null;
  status: "accepted" | "pending" | "unavailable";
  /** Pending, but the person accepted an earlier version: the wording changed. */
  is_reacceptance: boolean;
  accepted_at: string | null;
  accepted_version: string | null;
  acceptance_uid: string | null;
  body_html?: string | null;
}

export interface ConsentStatus {
  /** When false the screen still runs and acceptances are recorded, but nobody is locked out. */
  enforced: boolean;
  items: ConsentItem[];
  pending: string[];
}

/** Fired by apiFetch when the backend refuses a call because agreements are pending. */
export const CONSENT_REQUIRED_EVENT = "partner-consent-required";
