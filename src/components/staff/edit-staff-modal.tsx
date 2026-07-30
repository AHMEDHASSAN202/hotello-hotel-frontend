'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Field, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { Locale } from '@/i18n/config';
import type { StaffMember, TenantRole } from '@/lib/types';

/**
 * Story 9.4 — edit a staff member's name and role. Email is immutable (shown
 * read-only with the "disable + re-invite" hint). A user cannot change their
 * own role, so the role select is disabled for the current user (the backend
 * enforces it regardless). The Owner role is never an option.
 */
export function EditStaffModal({
  member,
  roles,
  isSelf,
  onClose,
  onSaved,
}: {
  member: StaffMember | null;
  roles: TenantRole[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;

  const selectableRoles = roles.filter((r) => !r.isSystem);
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setRoleId(member.role?.id ?? '');
      setFormError(null);
    }
  }, [member]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setFormError(null);
    try {
      await api<StaffMember>(`/tenant/staff/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, roleId }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(resolveError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={member !== null} onClose={onClose} title={t('form.editTitle')}>
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
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label={t('form.email')}
          type="email"
          value={member?.email ?? ''}
          readOnly
          disabled
          hint={t('form.emailImmutable')}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('form.role')}
          </span>
          <select
            required
            value={roleId}
            disabled={isSelf}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:bg-paper disabled:text-ink-soft"
          >
            {selectableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {locale === 'ar' ? role.nameAr : role.nameEn}
              </option>
            ))}
          </select>
          {isSelf && (
            <span className="mt-1 block text-xs text-ink-soft">
              {t('form.ownRoleLocked')}
            </span>
          )}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('form.saveSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
