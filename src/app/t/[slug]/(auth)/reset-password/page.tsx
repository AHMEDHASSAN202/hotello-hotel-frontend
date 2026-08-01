'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { AuthError, AuthShell } from '@/components/auth-shell';
import { RequiredNote } from '@/components/guidance';
import { isPasswordValid } from '@/components/password-strength';
import { PasswordStrength } from '@/components/password-meter';
import { Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { MessageResponse } from '@/lib/types';

export default function ResetPasswordPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params.slug;
  const token = search.get('token') ?? '';
  const t = useTranslations('auth.reset');
  const tPw = useTranslations('auth.password');
  const resolveError = useApiError();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError(t('invalid'));
      return;
    }
    if (!isPasswordValid(password)) {
      setError(tPw('tooWeak'));
      return;
    }
    if (password !== confirm) {
      setError(tPw('mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await api<MessageResponse>('/tenant/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(t('invalid'));
      } else {
        setError(
          err instanceof ApiError ? resolveError(err) : t('genericError'),
        );
      }
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title={t('successTitle')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-ink">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-success"
              aria-hidden
            />
            <p>{t('success')}</p>
          </div>
          <Link
            href={`/t/${slug}/login`}
            className="inline-block text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            {t('goToLogin')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}
        <div>
          <Field
            label={t('password')}
            type="password"
            autoComplete="new-password"
            required
            hint={tPw('policy')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        <Field
          label={t('confirmPassword')}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <RequiredNote />
        <Button type="submit" loading={submitting} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
