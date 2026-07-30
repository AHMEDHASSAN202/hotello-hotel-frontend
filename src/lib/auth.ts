const ACCESS_KEY = 'gxp_tenant_access_token';
const REFRESH_KEY = 'gxp_tenant_refresh_token';
const COOKIE_FLAG = 'gxp_tenant_auth';

/**
 * All token handling lives here so the planned move to httpOnly cookies is a
 * one-file swap. The cookie is only a FLAG for middleware UX redirects — the
 * backend is the real gatekeeper.
 *
 * NOTE: no cookie Domain is set — each tenant subdomain keeps its own session
 * (per-subdomain isolation is desired).
 */
export const tokenStore = {
  access(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },

  set(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    document.cookie = `${COOKIE_FLAG}=1; path=/; max-age=604800; samesite=lax`;
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    document.cookie = `${COOKIE_FLAG}=; path=/; max-age=0`;
  },
};
