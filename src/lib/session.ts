/**
 * Partner session handling (browser side).
 *
 * The JWT the backend mints at login is kept in localStorage and sent on every
 * request through this project's own /api proxy, which is the only thing that
 * ever sees the backend URL. Same shape as the admin panel, deliberately: one
 * less thing that behaves differently between our two back-office surfaces.
 */

const TOKEN_KEY = "wapzio_partner_token";
const PARTNER_KEY = "wapzio_partner_profile";

export interface PartnerProfile {
  _id: string;
  name: string;
  slug: string;
  seat_limit: number;
  seats_used?: number;
  seats_remaining?: number;
  onboarding_token?: string | null;
  api_key_prefix?: string | null;
  webhook_url?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  branding?: {
    logo_url?: string | null;
    primary_color?: string | null;
    support_email?: string | null;
  };
}

export const sessionStore = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode — the session simply does not survive a reload */
    }
  },

  getProfile(): PartnerProfile | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PARTNER_KEY);
      return raw ? (JSON.parse(raw) as PartnerProfile) : null;
    } catch {
      return null;
    }
  },

  setProfile(profile: PartnerProfile) {
    try {
      window.localStorage.setItem(PARTNER_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  },

  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(PARTNER_KEY);
    } catch {
      /* ignore */
    }
  },
};
