import { NextRequest, NextResponse } from 'next/server';

/**
 * One route tree serves BOTH `{slug}.{base}` subdomains AND `/t/{slug}` paths.
 *
 *  1. Subdomain rewrite: if Host matches `{slug}.{NEXT_PUBLIC_TENANT_BASE_DOMAIN}`,
 *     rewrite the URL to `/t/{slug}{path}` (unless the path is already `/t/...`).
 *  2. UX auth redirect (cookie `gxp_tenant_auth` — a FLAG only; the backend is
 *     the real gatekeeper): unauthenticated on a dashboard route → login;
 *     authenticated on a login route → dashboard home.
 */
const BASE_DOMAIN = process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? 'lvh.me:3001';

/** Strip port from a host:port. */
function hostname(host: string): string {
  return host.split(':')[0].toLowerCase();
}

/** Extract the tenant slug from a subdomain host, or null if it isn't one. */
function slugFromHost(host: string): string | null {
  const base = hostname(BASE_DOMAIN);
  const h = hostname(host);
  if (h === base || !h.endsWith(`.${base}`)) return null;
  const sub = h.slice(0, -(base.length + 1));
  const slug = sub.split('.').pop() ?? '';
  if (!slug || slug === 'www') return null;
  return slug;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // 1. Resolve the effective `/t/{slug}...` path (subdomain or explicit path).
  let effectivePath = pathname;
  let isSubdomainRewrite = false;
  const subdomainSlug = slugFromHost(host);
  if (subdomainSlug && !pathname.startsWith('/t/')) {
    effectivePath = `/t/${subdomainSlug}${pathname === '/' ? '' : pathname}`;
    isSubdomainRewrite = true;
  }

  // 2. Auth-flag UX redirect, computed against the effective path.
  const redirect = authRedirect(request, effectivePath);
  if (redirect) return redirect;

  // 3. Apply the subdomain rewrite if one is pending.
  if (isSubdomainRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = effectivePath;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

/**
 * Given the effective `/t/{slug}...` path, returns a redirect response for the
 * auth-flag UX rules, or null if no redirect is needed.
 */
function authRedirect(
  request: NextRequest,
  effectivePath: string,
): NextResponse | null {
  const match = effectivePath.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const slug = match[1];
  const rest = match[2] ?? '';

  const isAuthed = Boolean(request.cookies.get('gxp_tenant_auth')?.value);
  const isLoginRoute = rest === '/login' || rest.startsWith('/login/');
  const isAuthRoute =
    isLoginRoute ||
    rest.startsWith('/setup') ||
    rest.startsWith('/forgot-password') ||
    rest.startsWith('/reset-password');

  if (!isAuthed && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${slug}/login`;
    url.search = '';
    url.searchParams.set('next', effectivePath);
    return NextResponse.redirect(url);
  }
  if (isAuthed && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${slug}`;
    url.search = '';
    return NextResponse.redirect(url);
  }
  return null;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
