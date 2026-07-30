'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Field, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Locale } from '@/i18n/config';
import type { StaffMember, TenantRole } from '@/lib/types';

const EMPTY = { name: '', email: '', roleId: '' };

/**
 * Story 9.3 — invite a staff member by name, email and role. The Owner role is
 * not selectable (one owner per hotel). EMAIL_TAKEN maps to an inline email
 * error; STAFF_LIMIT_REACHED surfaces the plan limit as a form-level message.
 */
export function InviteStaffModal({
  open,
  roles,
  onClose,
  onInvited,
}: {
  open: boolean;
  roles: TenantRole[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;

  const selectableRoles = roles.filter((r) => !r.isSystem);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh form (default role selected) each time the modal opens.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, roleId: selectableRoles[0]?.id ?? '' });
      setFormError(null);
      setEmailError(null);
    }
    // selectableRoles identity changes each render; key on the first id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setEmailError(null);
    try {
      await api<StaffMember>('/tenant/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onInvited();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setEmailError(resolveError(err));
      } else {
        setFormError(resolveError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('form.createTitle')}>
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
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Field
          label={t('form.email')}
          type="email"
          required
          error={emailError ?? undefined}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('form.role')}
          </span>
          <select
            required
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            {selectableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {locale === 'ar' ? role.nameAr : role.nameEn}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('form.createSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
