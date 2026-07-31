'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { PasswordStrength } from '@/components/password-meter';
import { isPasswordValid } from '@/components/password-strength';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Button, ErrorState, Field, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { useApiError } from '@/lib/errors';
import { isLocale, localeLabels, locales, type Locale } from '@/i18n/config';
import { setLocaleCookie } from '@/i18n/locale';
import type { PreferredLanguage, TenantMeResponse } from '@/lib/types';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const resolveError = useApiError();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const locale = useLocale() as Locale;
  const { me, loading, error, reload, setMe } = useTenant();

  const [name, setName] = useState('');
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.user.name);
      setLanguage(me.user.preferredLanguage);
    }
  }, [me]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await api<TenantMeResponse>('/tenant/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, preferredLanguage: language }),
      });
      setMe(updated);
      setProfileSaved(true);
      // Apply the language choice to this browser immediately.
      if (isLocale(language) && language !== locale) {
        setLocaleCookie(language);
        router.refresh();
      }
    } catch (err) {
      setProfileError(resolveError(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (!isPasswordValid(newPassword)) {
      setPasswordError(t('password.tooWeak'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('password.mismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await api<void>('/tenant/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      // All other sessions are invalidated server-side — sign in again cleanly.
      tokenStore.clear();
      router.push(`/t/${params.slug}/login`);
    } catch (err) {
      setPasswordError(resolveError(err));
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !me) {
    return <ErrorState message={resolveError(error)} onRetry={reload} />;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-gold">
        {t('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile details */}
        <form
          onSubmit={handleProfileSave}
          className="space-y-4 rounded-xl border border-line bg-white p-6"
        >
          <h2 className="font-display font-semibold text-ink">
            {t('details.heading')}
          </h2>

          {profileError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {profileError}
            </div>
          )}
          {profileSaved && (
            <div
              role="status"
              className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success"
            >
              {t('details.saved')}
            </div>
          )}

          <Field
            label={t('details.name')}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label={t('details.email')}
            type="email"
            value={me.user.email ?? '—'}
            readOnly
            disabled
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('details.language')}
            </span>
            <select
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as PreferredLanguage)
              }
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {localeLabels[l]}
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium text-ink">
              {t('details.role')}
            </p>
            {me.user.role && (
              <Badge tone="gold">
                {locale === 'ar' ? me.user.role.nameAr : me.user.role.nameEn}
              </Badge>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={savingProfile}>
              {t('details.save')}
            </Button>
          </div>
        </form>

        {/* Change password */}
        <form
          onSubmit={handlePasswordChange}
          className="h-fit space-y-4 rounded-xl border border-line bg-white p-6"
        >
          <h2 className="font-display font-semibold text-ink">
            {t('password.heading')}
          </h2>
          <p className="text-xs text-ink-soft">{t('password.notice')}</p>

          {passwordError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {passwordError}
            </div>
          )}

          <Field
            label={t('password.current')}
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div>
            <Field
              label={t('password.new')}
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordStrength password={newPassword} />
          </div>
          <Field
            label={t('password.confirm')}
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="flex justify-end">
            <Button type="submit" variant="danger" loading={savingPassword}>
              {t('password.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
