'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AuthError, AuthShell } from '@/components/auth-shell';
import { isPasswordValid } from '@/components/password-strength';
import { PasswordStrength } from '@/components/password-meter';
import { Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { useApiError } from '@/lib/errors';
import { isLocale, type Locale } from '@/i18n/config';
import { setLocaleCookie } from '@/i18n/locale';
import type { SetupPreviewResponse, SetupResponse } from '@/lib/types';

export default function SetupPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const slug = params.slug;
  const token = search.get('token') ?? '';
  const locale = useLocale() as Locale;
  const t = useTranslations('auth.setup');
  const tPw = useTranslations('auth.password');
  const resolveError = useApiError();

  const [preview, setPreview] = useState<SetupPreviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setLoadError(null);
    if (!token) {
      setLoadError(t('invalid'));
      setLoadingPreview(false);
      return;
    }
    try {
      const res = await api<SetupPreviewResponse>(
        '/tenant/public/setup/preview',
        { method: 'POST', body: JSON.stringify({ token }) },
      );
      setPreview(res);
    } catch {
      setLoadError(t('invalid'));
    } finally {
      setLoadingPreview(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      const res = await api<SetupResponse>('/tenant-users/setup', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      // Auto-login on success.
      tokenStore.set(res.accessToken, res.refreshToken);
      const preferred = res.user.preferredLanguage;
      if (isLocale(preferred)) setLocaleCookie(preferred);
      router.push(`/t/${slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('genericError'));
      setSubmitting(false);
    }
  }

  const hotelName =
    preview && (locale === 'ar' ? preview.hotelNameAr : preview.hotelNameEn);

  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      {loadingPreview ? (
        <p className="text-sm text-ink-soft">{t('loading')}</p>
      ) : loadError || !preview ? (
        <AuthError message={loadError ?? t('invalid')} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <AuthError message={error} />}

          <Field label={t('name')} value={preview.name} readOnly disabled />
          <Field label={t('hotel')} value={hotelName ?? ''} readOnly disabled />

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

          <Button type="submit" loading={submitting} className="w-full">
            {t('submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
