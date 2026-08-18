import { tokenStore } from './auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Absolute URL for API-served assets (e.g. logo paths relative to the API). */
export function assetUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Parsed error body — may carry `code`, `module`, `violations` details. */
    public readonly details?: unknown,
    /**
     * Stable machine-readable error code. The frontend maps this to a translated
     * string so raw English never leaks into the UI.
     */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Public auth endpoints where a 401 is a *business* answer (wrong password,
 * bad token) — never a session problem. The silent refresh-and-retry must not
 * run for these: with a stale refresh token in localStorage it would swallow
 * the form's error in a hard-logout redirect.
 */
const NO_REFRESH_PATHS = [
  '/tenant/auth/login',
  '/tenant/auth/refresh',
  '/tenant/auth/password-reset/',
  '/tenant/public/',
  '/tenant-users/setup',
];

function isRefreshExempt(path: string): boolean {
  return NO_REFRESH_PATHS.some((p) => path.startsWith(p));
}

let refreshPromise: Promise<boolean> | null = null;

/** Single-flight silent refresh; concurrent 401s share one attempt. */
function tryRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const refreshToken = tokenStore.refresh();
      if (!refreshToken) return false;
      const res = await fetch(`${BASE_URL}/tenant/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Hard logout, preserving the intended destination via `?next=`.
 *
 * Two URL modes exist (middleware rewrites subdomains internally, so the
 * browser path differs):
 *  - path mode (`localhost/t/{slug}/...`): the path carries the slug — redirect
 *    to that tenant's `/t/{slug}/login`.
 *  - subdomain mode (`{slug}.domain/...`): the path has NO `/t/` prefix; the
 *    login page lives at `/login` on the same host (middleware rewrites it).
 */
function hardLogout() {
  tokenStore.clear();
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  const next = encodeURIComponent(`${pathname}${search}`);
  const match = pathname.match(/^\/t\/([^/]+)/);
  window.location.href = match
    ? `/t/${match[1]}/login?next=${next}`
    : `/login?next=${next}`;
}

async function parseError(
  res: Response,
): Promise<{ message: string; details?: unknown; code?: string }> {
  try {
    const body = await res.json();
    const code = typeof body?.code === 'string' ? body.code : undefined;
    const message = body?.message;
    if (Array.isArray(message))
      return { message: message.join('. '), details: body, code };
    if (typeof message === 'string') return { message, details: body, code };
    if (code) return { message: code, details: body, code };
  } catch {
    // fall through
  }
  return { message: `Request failed (${res.status})` };
}

/**
 * Shared core of every request helper below: fires `doFetch` with the current
 * access token, retries ONCE after a silent refresh on 401 (single-flight,
 * same as `tryRefresh()`), hard-logs-out if the refresh fails, and otherwise
 * parses JSON errors into `ApiError`. `api()`, `apiUpload()` and `apiBlob()`
 * differ only in how the request is built and how a 2xx body is read.
 */
async function request<T>(
  path: string,
  allowRetry: boolean,
  doFetch: (token: string | null) => Promise<Response>,
  parseSuccess: (res: Response) => Promise<T>,
): Promise<T> {
  const token = tokenStore.access();
  const res = await doFetch(token);

  if (
    res.status === 401 &&
    allowRetry &&
    !isRefreshExempt(path) &&
    tokenStore.refresh()
  ) {
    if (await tryRefresh()) {
      return request<T>(path, false, doFetch, parseSuccess);
    }
    hardLogout();
    throw new ApiError(401, 'Session expired', undefined, 'SESSION_EXPIRED');
  }

  if (!res.ok) {
    const { message, details, code } = await parseError(res);
    throw new ApiError(res.status, message, details, code);
  }
  return parseSuccess(res);
}

async function parseJsonBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * The only way to talk to the backend. Adds the bearer header, parses JSON
 * errors, and retries ONCE after a silent token refresh on 401 — then hard
 * logout. Never call raw fetch from screens.
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
  allowRetry = true,
): Promise<T> {
  return request<T>(
    path,
    allowRetry,
    (token) =>
      fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      }),
    parseJsonBody,
  );
}

/**
 * Multipart upload variant of api<T>() — same auth/refresh/error handling,
 * but lets the browser set the multipart boundary header itself.
 */
export async function apiUpload<T>(
  path: string,
  body: FormData,
  allowRetry = true,
): Promise<T> {
  return request<T>(
    path,
    allowRetry,
    (token) =>
      fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    parseJsonBody,
  );
}

/**
 * Binary-download variant of api<T>() — same auth/refresh/error handling,
 * but reads the body as a `Blob` and surfaces the server-suggested filename
 * from `Content-Disposition` (room cards PDF, QR poster, Excel export/template).
 */
export async function apiBlob(
  path: string,
  init: RequestInit = {},
  allowRetry = true,
): Promise<{ blob: Blob; filename: string | null }> {
  return request(
    path,
    allowRetry,
    (token) =>
      fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      }),
    async (res) => {
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      return { blob, filename: match ? match[1] : null };
    },
  );
}

/** Triggers a browser save-as for a blob fetched via `apiBlob()`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
