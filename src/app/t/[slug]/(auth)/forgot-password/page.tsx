'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { AuthError, AuthShell } from '@/components/auth-shell';
import { RequiredNote } from '@/components/guidance';
import { Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { MessageResponse } from '@/lib/types';

export default function ForgotPasswordPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const t = useTranslations('auth.forgot');
  const tG = useTranslations('guidance.auth');
  const resolveError = useApiError();

  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api<MessageResponse>('/tenant/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ slug, identifier }),
      });
      // Always show the same confirmation regardless of whether the account exists.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={t('confirmationTitle')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-ink">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-success"
              aria-hidden
            />
            <p>{t('confirmation')}</p>
          </div>
          <Link
            href={`/t/${slug}/login`}
            className="inline-block text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </AuthShell>
    );
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
          placeholder={tG('identifierPlaceholder')}
          dir="ltr"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        {/* Story 8.4 AC5 — username-only accounts can't self-reset by email. */}
        <p className="text-xs text-ink-soft">{t('usernameHint')}</p>
        <RequiredNote />
        <Button type="submit" loading={loading} className="w-full">
          {t('submit')}
        </Button>
        <Link
          href={`/t/${slug}/login`}
          className="inline-block text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </form>
    </AuthShell>
  );
}
