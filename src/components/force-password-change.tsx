'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PasswordStrength } from '@/components/password-meter';
import { isPasswordValid } from '@/components/password-strength';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { useApiError } from '@/lib/errors';

/**
 * Story 9.7 AC4 — shown (blocking everything else) while the signed-in user
 * still holds a temporary password. They enter that temporary password plus a
 * new one; on success we sign them out so they re-enter with the new password.
 */
export function ForcePasswordChange() {
  const t = useTranslations('staff.forceChange');
  const resolveError = useApiError();
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid(newPassword)) {
      setError(t('tooWeak'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api<void>('/tenant/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      // Sign out and re-authenticate cleanly with the new password.
      tokenStore.clear();
      router.push(`/t/${params.slug}/login`);
    } catch (err) {
      setError(resolveError(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-line bg-white p-8"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft">
            <KeyRound size={20} className="text-gold" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">
            {t('title')}
          </h1>
          <p className="text-sm text-ink-soft">{t('subtitle')}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <Field
          label={t('current')}
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <div>
          <Field
            label={t('new')}
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordStrength password={newPassword} />
        </div>
        <Field
          label={t('confirm')}
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" loading={saving} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </div>
  );
}
