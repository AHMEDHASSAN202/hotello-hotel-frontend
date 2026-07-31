'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { AuthError, AuthShell } from '@/components/auth-shell';
import { Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { useApiError } from '@/lib/errors';
import { isLocale } from '@/i18n/config';
import { setLocaleCookie } from '@/i18n/locale';
import type { TenantLoginResponse } from '@/lib/types';

/**
 * Only follow same-tenant destinations after login. Two shapes are legal:
 *  - path mode: `/t/{slug}` or `/t/{slug}/...` (exact slug boundary — a raw
 *    startsWith would accept `/t/{slug}extra`, another tenant's tree);
 *  - subdomain mode: a plain same-host path like `/orders/1` (hardLogout emits
 *    these when the browser URL carries no `/t/` prefix). Reject `//` (protocol-
 *    relative) and any other tenant's `/t/...`.
 */
function safeNext(next: string | null, slug: string): string {
  const fallback = `/t/${slug}`;
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.startsWith('/t/')) {
    return next === fallback || next.startsWith(`${fallback}/`)
      ? next
      : fallback;
  }
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params.slug;
  const t = useTranslations('auth.login');
  const resolveError = useApiError();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<TenantLoginResponse>('/tenant/auth/login', {
        method: 'POST',
        body: JSON.stringify({ slug, identifier, password }),
      });
      tokenStore.set(res.accessToken, res.refreshToken);
      const preferred = res.user.preferredLanguage;
      if (isLocale(preferred)) setLocaleCookie(preferred);
      router.push(safeNext(search.get('next'), slug));
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('genericError'));
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}

        <Field
          label={t('identifier')}
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Field
          label={t('password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex justify-end">
          <Link
            href={`/t/${slug}/forgot-password`}
            className="text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            {t('forgot')}
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
