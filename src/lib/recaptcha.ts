/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google reCAPTCHA v3 — script loader + token fetch.
 *
 * Same implementation as the admin panel's, deliberately: the backend's login
 * route runs one human check for every surface, and a panel that does not send
 * a token is simply refused with RECAPTCHA_FAILED wherever the secret is
 * configured.
 *
 * Enabled only when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set at build time. When it
 * is not, this resolves to null and the payload omits the token — the backend
 * fails open unless its own secret is set, so the two keys must be deployed
 * together.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).grecaptcha) return resolve();
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next submit
      reject(new Error("Failed to load reCAPTCHA"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

/**
 * A fresh v3 token for `action`, which must match what the backend expects
 * ("login" here). Never throws: a load or execute failure returns null and the
 * backend decides — it fails closed on a missing token when enforcement is on,
 * which is the safe side.
 */
export const getRecaptchaToken = async (action: string): Promise<string | null> => {
  if (!SITE_KEY) return null;
  try {
    await loadScript();
    const grecaptcha = (window as any).grecaptcha;
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return await grecaptcha.execute(SITE_KEY, { action });
  } catch (e) {
    console.error("reCAPTCHA token fetch failed:", e);
    return null;
  }
};
