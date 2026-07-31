'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Field, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Locale } from '@/i18n/config';
import type {
  CreateStaffDirectResponse,
  StaffCredentials,
  StaffMember,
  TenantRole,
} from '@/lib/types';

type Mode = 'invite' | 'direct';

const EMPTY = {
  name: '',
  email: '',
  username: '',
  roleId: '',
  password: '',
  sendWelcomeEmail: false,
};

/**
 * Story 9.7 AC1 — one "Add staff" surface, two paths: invite by email (desk /
 * management staff) or create directly with a username + temporary password
 * (on-ground staff with no email). Both require `staff.invite`.
 */
export function AddStaffModal({
  open,
  roles,
  onClose,
  onInvited,
  onCreated,
}: {
  open: boolean;
  roles: TenantRole[];
  onClose: () => void;
  onInvited: () => void;
  onCreated: (credentials: StaffCredentials, staffName: string) => void;
}) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;

  const selectableRoles = roles.filter((r) => !r.isSystem);
  const [mode, setMode] = useState<Mode>('invite');
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    username?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('invite');
      setForm({ ...EMPTY, roleId: selectableRoles[0]?.id ?? '' });
      setFormError(null);
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (mode === 'invite') {
        await api<StaffMember>('/tenant/staff', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            roleId: form.roleId,
          }),
        });
        onInvited();
        onClose();
      } else {
        const res = await api<CreateStaffDirectResponse>('/tenant/staff/direct', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            username: form.username.toLowerCase(),
            ...(form.email ? { email: form.email } : {}),
            roleId: form.roleId,
            ...(form.password ? { password: form.password } : {}),
            sendWelcomeEmail: !!form.email && form.sendWelcomeEmail,
          }),
        });
        onCreated(res.credentials, res.staff.name);
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: resolveError(err) });
      } else if (err instanceof ApiError && err.code === 'USERNAME_TAKEN') {
        setFieldErrors({ username: resolveError(err) });
      } else {
        setFormError(resolveError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (m: Mode) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      mode === m
        ? 'bg-ink text-white'
        : 'bg-paper text-ink-soft hover:text-ink'
    }`;

  return (
    <Modal open={open} onClose={onClose} title={t('add.title')}>
      <div className="mb-4 flex gap-2 rounded-lg border border-line p-1">
        <button type="button" className={tabClass('invite')} onClick={() => setMode('invite')}>
          {t('add.tabInvite')}
        </button>
        <button type="button" className={tabClass('direct')} onClick={() => setMode('direct')}>
          {t('add.tabDirect')}
        </button>
      </div>

      <p className="mb-4 text-xs text-ink-soft">
        {mode === 'invite' ? t('add.inviteHint') : t('add.directHint')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        )}

        <Field
          label={t('form.name')}
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />

        {mode === 'direct' && (
          <Field
            label={t('form.username')}
            required
            hint={t('form.usernameHint')}
            error={fieldErrors.username}
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
          />
        )}

        <Field
          label={mode === 'invite' ? t('form.email') : t('form.emailOptional')}
          type="email"
          required={mode === 'invite'}
          error={fieldErrors.email}
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('form.role')}
          </span>
          <select
            required
            value={form.roleId}
            onChange={(e) => set('roleId', e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            {selectableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {locale === 'ar' ? role.nameAr : role.nameEn}
              </option>
            ))}
          </select>
        </label>

        {mode === 'direct' && (
          <>
            <Field
              label={t('form.password')}
              type="text"
              hint={t('form.passwordHint')}
              autoComplete="off"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            {form.email && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.sendWelcomeEmail}
                  onChange={(e) => set('sendWelcomeEmail', e.target.checked)}
                  className="rounded border-line"
                />
                {t('form.sendWelcome')}
              </label>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {mode === 'invite' ? t('add.inviteSubmit') : t('add.directSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
